import {
  Part1Question,
  Part2Question,
  Part3Question,
  EssayQuestion,
} from '../types/exam';
import { normalizeBrokenFormulasToLatex } from './chemMathNormalizer';

export type IssueSeverity = 'error' | 'warning';

export type IssueCategory =
  | 'missing_content'
  | 'missing_option'
  | 'duplicate_option'
  | 'missing_answer'
  | 'invalid_answer'
  | 'unparsed_latex'
  | 'missing_image';

export interface ValidationIssue {
  id: string;
  part: '1' | '2' | '3' | 'essay';
  questionIndex: number;
  questionNumber: number;
  field: string;
  fieldLabel: string;
  severity: IssueSeverity;
  category: IssueCategory;
  message: string;
  canAutoFixLatex?: boolean;
}

export interface ExamValidationSummary {
  issues: ValidationIssue[];
  byPart: Record<'1' | '2' | '3' | 'essay', ValidationIssue[]>;
  byQuestionKey: Record<string, ValidationIssue[]>;
  errorCount: number;
  warningCount: number;
  autoFixableCount: number;
  questionCountWithIssues: number;
}

const DEFAULT_STEM_PLACEHOLDERS = [
  'nội dung câu hỏi mới...',
  'đoạn thông tin / ngữ cảnh câu hỏi mới...',
  'nội dung câu hỏi trả lời ngắn (yêu cầu điền số)...',
  'nội dung câu hỏi tự luận...',
];

const DEFAULT_OPTION_PLACEHOLDERS = [
  'phương án a',
  'phương án b',
  'phương án c',
  'phương án d',
];

const DEFAULT_PART2_PLACEHOLDERS = [
  'mệnh đề ý a...',
  'mệnh đề ý b...',
  'mệnh đề ý c...',
  'mệnh đề ý d...',
  'phát biểu a',
  'phát biểu b',
  'phát biểu c',
  'phát biểu d',
];

/**
 * Inspects a string for unparsed or broken LaTeX / mhchem syntax:
 * 1. Unmatched '$' or '$$' delimiters
 * 2. Unbalanced '{' or '}' braces
 * 3. Raw LaTeX commands (\ce{, \frac{, \xrightarrow, ^{, _{, etc.) outside '$...$'
 * 4. Unformatted chemical reaction arrows or electron configurations outside '$...$'
 */
export function detectLatexSyntaxIssues(
  text: string
): { message: string; severity: IssueSeverity; canAutoFix: boolean }[] {
  if (!text || !text.trim()) return [];

  const found: { message: string; severity: IssueSeverity; canAutoFix: boolean }[] = [];

  // Replace escaped \$ temporarily
  const withoutEscapedDollar = text.replace(/\\\$/g, '__ESC_DOLLAR__');

  // Check $$ count
  const doubleDollarMatches = withoutEscapedDollar.match(/\$\$/g) || [];
  if (doubleDollarMatches.length % 2 !== 0) {
    found.push({
      message: 'Thiếu cặp dấu đóng "$$" cho khối công thức toán/hóa học.',
      severity: 'error',
      canAutoFix: true,
    });
  }

  // Strip valid $$...$$ blocks and check single $ count
  const withoutDisplayMath = withoutEscapedDollar.replace(/\$\$[\s\S]*?\$\$/g, '__DISPLAY_MATH__');
  const singleDollarMatches = withoutDisplayMath.match(/\$/g) || [];
  if (singleDollarMatches.length % 2 !== 0) {
    found.push({
      message: 'Cú pháp LaTeX bị lẻ dấu "$": thiếu dấu "$" đóng hoặc mở công thức.',
      severity: 'error',
      canAutoFix: true,
    });
  }

  // Check for empty $ $ blocks
  if (/\$\s*\$/.test(withoutDisplayMath)) {
    found.push({
      message: 'Cặp dấu "$...$" bị rỗng (chưa có nội dung công thức bên trong).',
      severity: 'warning',
      canAutoFix: true,
    });
  }

  // Check balanced curly braces '{' and '}'
  const withoutEscapedBraces = withoutEscapedDollar.replace(/\\[{}]/g, '');
  let braceBalance = 0;
  let hasNegativeBalance = false;
  for (const ch of withoutEscapedBraces) {
    if (ch === '{') braceBalance++;
    else if (ch === '}') {
      braceBalance--;
      if (braceBalance < 0) hasNegativeBalance = true;
    }
  }
  if (braceBalance !== 0 || hasNegativeBalance) {
    found.push({
      message:
        braceBalance > 0
          ? `Thiếu ${braceBalance} dấu ngoặc nhọn đóng "}" trong công thức LaTeX.`
          : 'Dư dấu ngoặc nhọn đóng "}" hoặc thiếu dấu mở "{" trong công thức LaTeX.',
      severity: 'error',
      canAutoFix: true,
    });
  }

  // Extract segments outside of $...$ and $$...$$ to detect raw unparsed LaTeX commands
  const outsideMathText = withoutDisplayMath.replace(/\$[^$]*\$/g, ' ');

  const rawLatexCmdMatch = outsideMathText.match(
    /\\(?:ce|frac|sqrt|xrightarrow|xleftarrow|rightleftharpoons|Delta|alpha|beta|gamma|cdot|times|text|mathrm)\b|\^[0-9+-]+\b|\^\{[^}]*\}|_\{[^}]*\}/
  );
  if (rawLatexCmdMatch) {
    found.push({
      message: `Lệnh LaTeX "${rawLatexCmdMatch[0]}" nằm ngoài cặp dấu "$...$" nên chưa được KaTeX hiển thị.`,
      severity: 'error',
      canAutoFix: true,
    });
  }

  // Check inside $...$ for \ce{ without matching } or typos like \ce(...)
  const inlineMathBlocks = withoutDisplayMath.match(/\$[^$]+\$/g) || [];
  for (const block of inlineMathBlocks) {
    if (/\\ce\s*\(/.test(block) && !/\\ce\s*\{/.test(block)) {
      found.push({
        message: 'Lệnh \\ce(...) dùng sai ngoặc tròn, cần viết là \\ce{...}.',
        severity: 'error',
        canAutoFix: true,
      });
      break;
    }
  }

  // Check for raw unformatted reaction arrows or raw electron configurations outside $...$
  if (
    /(?:--+\s*(?:t0|t°|to|xt)?\s*--+>|->\s*\((?:t0|t°|to)\)|<=>|<->)/.test(outsideMathText) ||
    /\b1s2\s*2s2\s*2p[1-6]/i.test(outsideMathText)
  ) {
    found.push({
      message:
        'Phát hiện ký hiệu phản ứng / cấu hình e thô chưa chuẩn hóa sang KaTeX ($\\ce{...}$).',
      severity: 'warning',
      canAutoFix: true,
    });
  }

  return found;
}

/**
 * Automatically repairs common LaTeX syntax mistakes (unwrapped \ce{...}, unbalanced braces,
 * odd '$' delimiters, and raw chemical formulas/arrows).
 */
export function autoFixLatexInText(text: string): string {
  if (!text) return text;
  let s = text;

  // 1. Remove empty $ $ pairs
  s = s.replace(/\$\s+\$/g, ' ');

  // 2. Fix \ce(...) typo -> \ce{...}
  s = s.replace(/\\ce\s*\(([^()]+)\)/g, '\\ce{$1}');

  // 3. Wrap bare \ce{...}, \frac{...}{...}, \sqrt{...}, \xrightarrow{...}, \rightleftharpoons outside $...$
  const parts = s.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g);
  s = parts
    .map((segment) => {
      if (segment.startsWith('$') && segment.endsWith('$')) {
        return segment;
      }
      return segment
        .replace(/(\\ce\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/g, '$$$1$$')
        .replace(/(\\frac\{[^{}]*\}\{[^{}]*\})/g, '$$$1$$')
        .replace(/(\\sqrt\{[^{}]*\})/g, '$$$1$$')
        .replace(/(\\xrightarrow(?:\[[^{}\]]*\])?\{[^{}]*\})/g, '$$$1$$')
        .replace(/(\\rightleftharpoons)/g, '$$$1$$')
        .replace(/([A-Za-z0-9)\]]+(?:\^\{[^{}]+\}|_\{[^{}]+\})+)/g, '$$$1$$');
    })
    .join('');

  // 4. Balance curly braces if needed
  let braceDiff = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{' && s[i - 1] !== '\\') braceDiff++;
    else if (s[i] === '}' && s[i - 1] !== '\\') braceDiff--;
  }
  if (braceDiff > 0) {
    // Insert missing closing braces before the last '$' if one exists, otherwise at end
    const lastDollar = s.lastIndexOf('$');
    if (lastDollar > 0) {
      s = s.slice(0, lastDollar) + '}'.repeat(braceDiff) + s.slice(lastDollar);
    } else {
      s = s + '}'.repeat(braceDiff);
    }
  } else if (braceDiff < 0) {
    // Strip trailing stray '}' outside balanced pairs
    let toRemove = Math.abs(braceDiff);
    for (let i = s.length - 1; i >= 0 && toRemove > 0; i--) {
      if (s[i] === '}') {
        s = s.slice(0, i) + s.slice(i + 1);
        toRemove--;
      }
    }
  }

  // 5. Fix odd number of '$' signs by closing the unclosed math span
  const nonDisplay = s.replace(/\$\$[\s\S]*?\$\$/g, '  ');
  const dollarIndices: number[] = [];
  for (let i = 0; i < nonDisplay.length; i++) {
    if (nonDisplay[i] === '$' && nonDisplay[i - 1] !== '\\') {
      dollarIndices.push(i);
    }
  }
  if (dollarIndices.length % 2 !== 0) {
    s = s.trimEnd() + '$';
  }

  // 6. Run chemical & mathematical formula normalizer
  return normalizeBrokenFormulasToLatex(s);
}

/**
 * Validates a Part I Multiple-Choice Question (A, B, C, D)
 */
export function validatePart1Question(
  q: Part1Question,
  index: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const qNum = index + 1;
  const stem = (q.content || '').trim();

  // 1. Check question stem
  if (!stem) {
    issues.push({
      id: `p1_${index}_empty_stem`,
      part: '1',
      questionIndex: index,
      questionNumber: qNum,
      field: 'content',
      fieldLabel: 'Nội dung câu hỏi',
      severity: 'error',
      category: 'missing_content',
      message: 'Chưa nhập nội dung đề bài cho câu hỏi.',
    });
  } else if (DEFAULT_STEM_PLACEHOLDERS.includes(stem.toLowerCase())) {
    issues.push({
      id: `p1_${index}_placeholder_stem`,
      part: '1',
      questionIndex: index,
      questionNumber: qNum,
      field: 'content',
      fieldLabel: 'Nội dung câu hỏi',
      severity: 'warning',
      category: 'missing_content',
      message: 'Nội dung câu hỏi đang để văn bản mẫu mặc định.',
    });
  }

  // 2. Check if stem mentions a figure/diagram but no image or inline SVG is attached
  if (
    /hình\s*vẽ\s*bên|hình\s*bên|sơ\s*đồ\s*bên|đồ\s*thị\s*bên|như\s*hình\s*vẽ/i.test(stem) &&
    !q.imageUrl &&
    !stem.includes('[svg:')
  ) {
    issues.push({
      id: `p1_${index}_missing_image`,
      part: '1',
      questionIndex: index,
      questionNumber: qNum,
      field: 'imageUrl',
      fieldLabel: 'Hình minh họa',
      severity: 'warning',
      category: 'missing_image',
      message: 'Đề bài nhắc đến "hình vẽ / sơ đồ" nhưng chưa đính kèm hình ảnh hoặc SVG.',
    });
  }

  // 3. Check LaTeX syntax in stem
  for (const lIssue of detectLatexSyntaxIssues(stem)) {
    issues.push({
      id: `p1_${index}_latex_stem_${issues.length}`,
      part: '1',
      questionIndex: index,
      questionNumber: qNum,
      field: 'content',
      fieldLabel: 'Nội dung câu hỏi',
      severity: lIssue.severity,
      category: 'unparsed_latex',
      message: `Nội dung câu hỏi: ${lIssue.message}`,
      canAutoFixLatex: lIssue.canAutoFix,
    });
  }

  // 4. Check options A, B, C, D
  const optionKeys = ['A', 'B', 'C', 'D'] as const;
  const normalizedValues = new Map<string, 'A' | 'B' | 'C' | 'D'>();

  for (const optKey of optionKeys) {
    const rawOpt = (q.options?.[optKey] || '').trim();
    if (!rawOpt) {
      issues.push({
        id: `p1_${index}_missing_opt_${optKey}`,
        part: '1',
        questionIndex: index,
        questionNumber: qNum,
        field: `option_${optKey}`,
        fieldLabel: `Phương án ${optKey}`,
        severity: 'error',
        category: 'missing_option',
        message: `Thiếu nội dung lựa chọn ${optKey}.`,
      });
    } else if (DEFAULT_OPTION_PLACEHOLDERS.includes(rawOpt.toLowerCase())) {
      issues.push({
        id: `p1_${index}_placeholder_opt_${optKey}`,
        part: '1',
        questionIndex: index,
        questionNumber: qNum,
        field: `option_${optKey}`,
        fieldLabel: `Phương án ${optKey}`,
        severity: 'warning',
        category: 'missing_option',
        message: `Phương án ${optKey} đang để nội dung mẫu ("${rawOpt}").`,
      });
    } else {
      // Check duplicate option values
      const norm = rawOpt.toLowerCase().replace(/\s+/g, ' ');
      const existingKey = normalizedValues.get(norm);
      if (existingKey) {
        issues.push({
          id: `p1_${index}_dup_opt_${optKey}`,
          part: '1',
          questionIndex: index,
          questionNumber: qNum,
          field: `option_${optKey}`,
          fieldLabel: `Phương án ${optKey}`,
          severity: 'warning',
          category: 'duplicate_option',
          message: `Phương án ${optKey} trùng lặp nội dung với phương án ${existingKey}.`,
        });
      } else {
        normalizedValues.set(norm, optKey);
      }

      // Check LaTeX syntax in option
      for (const lIssue of detectLatexSyntaxIssues(rawOpt)) {
        issues.push({
          id: `p1_${index}_latex_opt_${optKey}_${issues.length}`,
          part: '1',
          questionIndex: index,
          questionNumber: qNum,
          field: `option_${optKey}`,
          fieldLabel: `Phương án ${optKey}`,
          severity: lIssue.severity,
          category: 'unparsed_latex',
          message: `Phương án ${optKey}: ${lIssue.message}`,
          canAutoFixLatex: lIssue.canAutoFix,
        });
      }
    }
  }

  // 5. Check valid correctAnswer
  if (!q.correctAnswer || !['A', 'B', 'C', 'D'].includes(q.correctAnswer)) {
    issues.push({
      id: `p1_${index}_missing_ans`,
      part: '1',
      questionIndex: index,
      questionNumber: qNum,
      field: 'correctAnswer',
      fieldLabel: 'Đáp án đúng',
      severity: 'error',
      category: 'missing_answer',
      message: 'Chưa chọn đáp án đúng (A, B, C hoặc D).',
    });
  }

  // 6. Check LaTeX in explanation if present
  if (q.explanation) {
    for (const lIssue of detectLatexSyntaxIssues(q.explanation)) {
      issues.push({
        id: `p1_${index}_latex_exp_${issues.length}`,
        part: '1',
        questionIndex: index,
        questionNumber: qNum,
        field: 'explanation',
        fieldLabel: 'Lời giải',
        severity: lIssue.severity,
        category: 'unparsed_latex',
        message: `Lời giải: ${lIssue.message}`,
        canAutoFixLatex: lIssue.canAutoFix,
      });
    }
  }

  return issues;
}

/**
 * Validates a Part II True/False Question (a, b, c, d)
 */
export function validatePart2Question(
  q: Part2Question,
  index: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const qNum = index + 1;
  const stem = (q.content || '').trim();

  if (!stem) {
    issues.push({
      id: `p2_${index}_empty_stem`,
      part: '2',
      questionIndex: index,
      questionNumber: qNum,
      field: 'content',
      fieldLabel: 'Đoạn dẫn câu hỏi',
      severity: 'error',
      category: 'missing_content',
      message: 'Chưa nhập đoạn thông tin / ngữ cảnh cho câu hỏi Đúng/Sai.',
    });
  } else if (DEFAULT_STEM_PLACEHOLDERS.includes(stem.toLowerCase())) {
    issues.push({
      id: `p2_${index}_placeholder_stem`,
      part: '2',
      questionIndex: index,
      questionNumber: qNum,
      field: 'content',
      fieldLabel: 'Đoạn dẫn câu hỏi',
      severity: 'warning',
      category: 'missing_content',
      message: 'Đoạn thông tin câu hỏi đang để nội dung mẫu mặc định.',
    });
  }

  if (
    /hình\s*vẽ\s*bên|hình\s*bên|sơ\s*đồ\s*bên|đồ\s*thị\s*bên|như\s*hình\s*vẽ/i.test(stem) &&
    !q.imageUrl &&
    !stem.includes('[svg:')
  ) {
    issues.push({
      id: `p2_${index}_missing_image`,
      part: '2',
      questionIndex: index,
      questionNumber: qNum,
      field: 'imageUrl',
      fieldLabel: 'Hình minh họa',
      severity: 'warning',
      category: 'missing_image',
      message: 'Đề bài nhắc đến "hình vẽ / sơ đồ" nhưng chưa đính kèm hình ảnh hoặc SVG.',
    });
  }

  for (const lIssue of detectLatexSyntaxIssues(stem)) {
    issues.push({
      id: `p2_${index}_latex_stem_${issues.length}`,
      part: '2',
      questionIndex: index,
      questionNumber: qNum,
      field: 'content',
      fieldLabel: 'Đoạn dẫn câu hỏi',
      severity: lIssue.severity,
      category: 'unparsed_latex',
      message: `Đoạn dẫn: ${lIssue.message}`,
      canAutoFixLatex: lIssue.canAutoFix,
    });
  }

  const expectedLabels: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
  if (!q.items || q.items.length < 4) {
    issues.push({
      id: `p2_${index}_missing_items`,
      part: '2',
      questionIndex: index,
      questionNumber: qNum,
      field: 'items',
      fieldLabel: 'Các mệnh đề a, b, c, d',
      severity: 'error',
      category: 'missing_option',
      message: `Câu Đúng/Sai cần đủ 4 mệnh đề a), b), c), d) (hiện có ${q.items?.length || 0} ý).`,
    });
  }

  expectedLabels.forEach((lbl, idxItem) => {
    const item = q.items?.[idxItem];
    const itemText = (item?.text || '').trim();
    if (!item || !itemText) {
      issues.push({
        id: `p2_${index}_empty_item_${lbl}`,
        part: '2',
        questionIndex: index,
        questionNumber: qNum,
        field: `item_${lbl}`,
        fieldLabel: `Mệnh đề ${lbl})`,
        severity: 'error',
        category: 'missing_option',
        message: `Thiếu nội dung phát biểu tại ý ${lbl}).`,
      });
    } else if (DEFAULT_PART2_PLACEHOLDERS.includes(itemText.toLowerCase())) {
      issues.push({
        id: `p2_${index}_placeholder_item_${lbl}`,
        part: '2',
        questionIndex: index,
        questionNumber: qNum,
        field: `item_${lbl}`,
        fieldLabel: `Mệnh đề ${lbl})`,
        severity: 'warning',
        category: 'missing_option',
        message: `Mệnh đề ý ${lbl}) đang để nội dung mẫu ("${itemText}").`,
      });
    } else {
      for (const lIssue of detectLatexSyntaxIssues(itemText)) {
        issues.push({
          id: `p2_${index}_latex_item_${lbl}_${issues.length}`,
          part: '2',
          questionIndex: index,
          questionNumber: qNum,
          field: `item_${lbl}`,
          fieldLabel: `Mệnh đề ${lbl})`,
          severity: lIssue.severity,
          category: 'unparsed_latex',
          message: `Ý ${lbl}): ${lIssue.message}`,
          canAutoFixLatex: lIssue.canAutoFix,
        });
      }
    }
  });

  return issues;
}

/**
 * Validates a Part III Short-Answer Question
 */
export function validatePart3Question(
  q: Part3Question,
  index: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const qNum = index + 1;
  const stem = (q.content || '').trim();

  if (!stem) {
    issues.push({
      id: `p3_${index}_empty_stem`,
      part: '3',
      questionIndex: index,
      questionNumber: qNum,
      field: 'content',
      fieldLabel: 'Nội dung câu hỏi',
      severity: 'error',
      category: 'missing_content',
      message: 'Chưa nhập nội dung câu hỏi trả lời ngắn.',
    });
  } else if (DEFAULT_STEM_PLACEHOLDERS.includes(stem.toLowerCase())) {
    issues.push({
      id: `p3_${index}_placeholder_stem`,
      part: '3',
      questionIndex: index,
      questionNumber: qNum,
      field: 'content',
      fieldLabel: 'Nội dung câu hỏi',
      severity: 'warning',
      category: 'missing_content',
      message: 'Nội dung câu hỏi trả lời ngắn đang để văn bản mẫu mặc định.',
    });
  }

  for (const lIssue of detectLatexSyntaxIssues(stem)) {
    issues.push({
      id: `p3_${index}_latex_stem_${issues.length}`,
      part: '3',
      questionIndex: index,
      questionNumber: qNum,
      field: 'content',
      fieldLabel: 'Nội dung câu hỏi',
      severity: lIssue.severity,
      category: 'unparsed_latex',
      message: `Nội dung câu hỏi: ${lIssue.message}`,
      canAutoFixLatex: lIssue.canAutoFix,
    });
  }

  const ans = (q.correctAnswer || '').trim();
  if (!ans) {
    issues.push({
      id: `p3_${index}_empty_ans`,
      part: '3',
      questionIndex: index,
      questionNumber: qNum,
      field: 'correctAnswer',
      fieldLabel: 'Đáp án chuẩn',
      severity: 'error',
      category: 'missing_answer',
      message: 'Chưa nhập đáp án số cho câu hỏi trả lời ngắn.',
    });
  } else if (!/^-?\d+(?:[.,]\d+)?$/.test(ans)) {
    issues.push({
      id: `p3_${index}_non_numeric_ans`,
      part: '3',
      questionIndex: index,
      questionNumber: qNum,
      field: 'correctAnswer',
      fieldLabel: 'Đáp án chuẩn',
      severity: 'warning',
      category: 'invalid_answer',
      message: `Đáp án Phần III ("${ans}") nên là giá trị số nguyên hoặc số thập phân (vd: 12,5 hoặc 12.5).`,
    });
  }

  if (q.explanation) {
    for (const lIssue of detectLatexSyntaxIssues(q.explanation)) {
      issues.push({
        id: `p3_${index}_latex_exp_${issues.length}`,
        part: '3',
        questionIndex: index,
        questionNumber: qNum,
        field: 'explanation',
        fieldLabel: 'Lời giải',
        severity: lIssue.severity,
        category: 'unparsed_latex',
        message: `Lời giải: ${lIssue.message}`,
        canAutoFixLatex: lIssue.canAutoFix,
      });
    }
  }

  return issues;
}

/**
 * Validates an Essay Question
 */
export function validateEssayQuestion(
  q: EssayQuestion,
  index: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const qNum = index + 1;
  const stem = (q.content || '').trim();

  if (!stem) {
    issues.push({
      id: `essay_${index}_empty_stem`,
      part: 'essay',
      questionIndex: index,
      questionNumber: qNum,
      field: 'content',
      fieldLabel: 'Đề bài tự luận',
      severity: 'error',
      category: 'missing_content',
      message: 'Chưa nhập đề bài cho câu hỏi tự luận.',
    });
  } else if (DEFAULT_STEM_PLACEHOLDERS.includes(stem.toLowerCase())) {
    issues.push({
      id: `essay_${index}_placeholder_stem`,
      part: 'essay',
      questionIndex: index,
      questionNumber: qNum,
      field: 'content',
      fieldLabel: 'Đề bài tự luận',
      severity: 'warning',
      category: 'missing_content',
      message: 'Đề bài tự luận đang để nội dung mẫu mặc định.',
    });
  }

  for (const lIssue of detectLatexSyntaxIssues(stem)) {
    issues.push({
      id: `essay_${index}_latex_stem_${issues.length}`,
      part: 'essay',
      questionIndex: index,
      questionNumber: qNum,
      field: 'content',
      fieldLabel: 'Đề bài tự luận',
      severity: lIssue.severity,
      category: 'unparsed_latex',
      message: `Đề bài: ${lIssue.message}`,
      canAutoFixLatex: lIssue.canAutoFix,
    });
  }

  const guide = (q.guide || '').trim();
  if (!guide || guide.toLowerCase() === 'hướng dẫn chấm điểm từng ý...') {
    issues.push({
      id: `essay_${index}_empty_guide`,
      part: 'essay',
      questionIndex: index,
      questionNumber: qNum,
      field: 'guide',
      fieldLabel: 'Hướng dẫn chấm',
      severity: 'warning',
      category: 'missing_answer',
      message: 'Chưa cập nhật hướng dẫn chấm & thang điểm chi tiết (Barem).',
    });
  }

  return issues;
}

/**
 * Validates all questions across Part I, Part II, Part III, and Essay
 */
export function validateExamQuestions(
  part1: Part1Question[],
  part2: Part2Question[],
  part3: Part3Question[],
  essay: EssayQuestion[]
): ExamValidationSummary {
  const byPart: Record<'1' | '2' | '3' | 'essay', ValidationIssue[]> = {
    '1': [],
    '2': [],
    '3': [],
    essay: [],
  };
  const byQuestionKey: Record<string, ValidationIssue[]> = {};
  const allIssues: ValidationIssue[] = [];

  part1.forEach((q, idx) => {
    const qIssues = validatePart1Question(q, idx);
    if (qIssues.length > 0) {
      byPart['1'].push(...qIssues);
      byQuestionKey[`1-${idx}`] = qIssues;
      allIssues.push(...qIssues);
    }
  });

  part2.forEach((q, idx) => {
    const qIssues = validatePart2Question(q, idx);
    if (qIssues.length > 0) {
      byPart['2'].push(...qIssues);
      byQuestionKey[`2-${idx}`] = qIssues;
      allIssues.push(...qIssues);
    }
  });

  part3.forEach((q, idx) => {
    const qIssues = validatePart3Question(q, idx);
    if (qIssues.length > 0) {
      byPart['3'].push(...qIssues);
      byQuestionKey[`3-${idx}`] = qIssues;
      allIssues.push(...qIssues);
    }
  });

  essay.forEach((q, idx) => {
    const qIssues = validateEssayQuestion(q, idx);
    if (qIssues.length > 0) {
      byPart.essay.push(...qIssues);
      byQuestionKey[`essay-${idx}`] = qIssues;
      allIssues.push(...qIssues);
    }
  });

  const errorCount = allIssues.filter((i) => i.severity === 'error').length;
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length;
  const autoFixableCount = allIssues.filter((i) => i.canAutoFixLatex).length;
  const questionCountWithIssues = Object.keys(byQuestionKey).length;

  return {
    issues: allIssues,
    byPart,
    byQuestionKey,
    errorCount,
    warningCount,
    autoFixableCount,
    questionCountWithIssues,
  };
}
