import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  HelpCircle,
  Eye,
  Edit2,
  BookOpen,
  Image as ImageIcon,
  FlaskConical,
  Move,
  Check,
  X,
  Clipboard,
  Upload,
  Zap,
  GripVertical,
  ListOrdered,
  AlertTriangle,
  Wrench,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import {
  Part1Question,
  Part2Question,
  Part3Question,
  EssayQuestion,
  CognitiveLevel,
} from '../types/exam';
import { MathChemView } from './MathChemView';
import { ChemistryDrawModal } from './ChemistryDrawModal';
import { LaboratoryToolbox, ApparatusItem } from './LaboratoryToolbox';
import { ReactionBuilderModal } from './ReactionBuilderModal';
import { ChemSvgToolbar, ChemSvgToolbarItem } from './ChemSvgToolbar';
import { FocusReaderView } from './FocusReaderView';
import {
  validateExamQuestions,
  autoFixLatexInText,
  ValidationIssue,
} from '../utils/questionValidator';

export { validateExamQuestions, autoFixLatexInText };

// Helper: Convert an image Blob / File to base64 PNG data URL with optimized dimensions
export const processImageBlobToBase64 = (file: Blob | File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        reject(new Error('Failed to read image data'));
        return;
      }

      // Load into HTML Image to ensure clean dimensions & convert to standard high-quality PNG
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1200;
        const maxHeight = 900;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Fill crisp white background in case screenshot has transparent areas
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const pngDataUrl = canvas.toDataURL('image/png', 0.95);
          resolve(pngDataUrl);
        } else {
          resolve(result);
        }
      };
      img.onerror = () => resolve(result);
      img.src = result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

interface QuestionImageBlockProps {
  imageUrl?: string;
  imageCaption?: string;
  questionNumber: number;
  onOpenDraw: () => void;
  onOpenReactionBuilder?: () => void;
  onRemove: () => void;
  onUpdateCaption: (caption: string) => void;
  previewMode?: boolean;
  onDropApparatus?: (e: React.DragEvent) => void;
  onPasteImage?: (file: File | Blob) => void;
  onManualPasteClick?: () => void;
  isDragOver?: boolean;
}

const QuestionImageBlock: React.FC<QuestionImageBlockProps> = ({
  imageUrl,
  imageCaption,
  questionNumber,
  onOpenDraw,
  onOpenReactionBuilder,
  onRemove,
  onUpdateCaption,
  previewMode,
  onDropApparatus,
  onPasteImage,
  onManualPasteClick,
  isDragOver = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onPasteImage) {
      onPasteImage(file);
    }
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLocalPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file && onPasteImage) {
          onPasteImage(file);
        }
        return;
      }
    }
  };

  if (!imageUrl) {
    if (previewMode) return null;
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={onDropApparatus}
        onPaste={handleLocalPaste}
        tabIndex={0}
        className={`mb-3 p-3 rounded-xl border-2 transition-all flex flex-wrap items-center justify-between gap-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
          isDragOver
            ? 'border-emerald-500 bg-emerald-100/80 ring-2 ring-emerald-400/60 scale-[1.01]'
            : 'border-dashed border-emerald-300 bg-emerald-50/60 hover:bg-emerald-50 hover:border-emerald-400'
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenDraw}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>📷 Mở Studio vẽ thí nghiệm</span>
          </button>

          {/* Quick ReactionBuilder button */}
          <button
            type="button"
            onClick={onOpenReactionBuilder}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Tạo sơ đồ chuyển hóa & chuỗi phản ứng hóa học (ReactionBuilder)"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>⚡ Sơ đồ phản ứng (ReactionBuilder)</span>
          </button>

          {/* Quick Paste from Clipboard (Ctrl+V) button */}
          <button
            type="button"
            onClick={onManualPasteClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Dán hình ảnh từ clipboard vừa sao chép hoặc chụp màn hình (Ctrl+V)"
          >
            <Clipboard className="w-3.5 h-3.5 text-indigo-600" />
            <span>📋 Dán ảnh (Ctrl+V)</span>
          </button>

          {/* Upload file button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-colors cursor-pointer"
            title="Tải ảnh từ máy tính (PNG, JPG, WEBP)"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Tải ảnh từ máy</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-emerald-900 hidden md:inline font-medium">
            Kéo thả từ Toolbox hoặc <strong>nhấn Ctrl+V</strong> để dán ảnh
          </span>
          <div className="text-[10px] text-emerald-800 font-semibold bg-white/90 px-2 py-0.5 rounded-md border border-emerald-200 shadow-2xs flex items-center gap-1">
            <Move className="w-3 h-3 text-emerald-600" />
            <span>Vùng thả / dán</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={onDropApparatus}
      onPaste={handleLocalPaste}
      tabIndex={0}
      className={`mb-4 p-3 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
        isDragOver
          ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-400/60'
          : 'bg-slate-50/80 border-slate-200 shadow-2xs'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative group shrink-0">
          <img
            src={imageUrl}
            alt={imageCaption || `Hình Câu ${questionNumber}`}
            className="max-h-44 max-w-[260px] object-contain rounded-lg border border-slate-300 bg-white p-1 shadow-2xs"
          />
        </div>
        <div className="flex-1 space-y-2 w-full">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Chú thích hình ảnh (Hiển thị dưới ảnh trong đề thi):
            </label>
            {previewMode ? (
              <p className="text-xs font-serif italic text-slate-700">
                {imageCaption || '(Chưa có chú thích)'}
              </p>
            ) : (
              <input
                type="text"
                value={imageCaption || ''}
                onChange={(e) => onUpdateCaption(e.target.value)}
                placeholder={`Ví dụ: Hình ${questionNumber}. Sơ đồ thí nghiệm...`}
                className="w-full text-xs font-serif italic border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>
          {!previewMode && (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={onOpenDraw}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" /> Chỉnh sửa / Vẽ tiếp
              </button>
              <button
                type="button"
                onClick={onOpenReactionBuilder}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 flex items-center gap-1 cursor-pointer transition-colors"
                title="Mở ReactionBuilder để vẽ sơ đồ chuỗi phản ứng"
              >
                <Zap className="w-3.5 h-3.5 text-teal-600" /> Sơ đồ phản ứng
              </button>
              <button
                type="button"
                onClick={onManualPasteClick}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1 cursor-pointer transition-colors"
                title="Dán đè ảnh mới từ clipboard (Ctrl+V)"
              >
                <Clipboard className="w-3.5 h-3.5" /> Dán đè (Ctrl+V)
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 text-xs font-medium rounded-lg bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3 h-3 text-slate-500" /> Đổi ảnh từ máy
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={onRemove}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa hình
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface QuestionValidationBannerProps {
  issues: ValidationIssue[];
  onAutoFixLatex?: () => void;
}

const QuestionValidationBanner: React.FC<QuestionValidationBannerProps> = ({
  issues,
  onAutoFixLatex,
}) => {
  if (!issues || issues.length === 0) return null;

  const hasError = issues.some((i) => i.severity === 'error');
  const hasAutoFixableLatex = issues.some((i) => i.canAutoFixLatex);

  return (
    <div
      className={`mb-3 p-3 rounded-xl border text-xs transition-all ${
        hasError
          ? 'bg-rose-50/90 border-rose-300 text-rose-900'
          : 'bg-amber-50/90 border-amber-300 text-amber-900'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 font-bold">
          <AlertTriangle
            className={`w-4 h-4 shrink-0 ${
              hasError ? 'text-rose-600' : 'text-amber-600'
            }`}
          />
          <span>
            Phát hiện {issues.length} điểm cần kiểm tra trong câu hỏi này:
          </span>
        </div>

        {hasAutoFixableLatex && onAutoFixLatex && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAutoFixLatex();
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-2xs cursor-pointer transition-colors"
            title="Tự động đóng cặp dấu $...$, ngoặc nhọn {...} và chuẩn hóa công thức Hóa/Toán sang KaTeX"
          >
            <Wrench className="w-3 h-3" />
            <span>Tự động sửa LaTeX / Công thức</span>
          </button>
        )}
      </div>

      <ul className="space-y-1 pl-5 list-disc">
        {issues.map((issue) => (
          <li key={issue.id} className="leading-relaxed">
            <span
              className={`inline-block font-semibold mr-1 px-1.5 py-0.2 rounded text-[10px] uppercase ${
                issue.severity === 'error'
                  ? 'bg-rose-200/80 text-rose-900'
                  : 'bg-amber-200/80 text-amber-900'
              }`}
            >
              {issue.fieldLabel}
            </span>
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

interface QuestionEditorProps {
  part1: Part1Question[];
  part2: Part2Question[];
  part3: Part3Question[];
  essay: EssayQuestion[];
  subject: string;
  onUpdatePart1: (questions: Part1Question[]) => void;
  onUpdatePart2: (questions: Part2Question[]) => void;
  onUpdatePart3: (questions: Part3Question[]) => void;
  onUpdateEssay: (questions: EssayQuestion[]) => void;
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  part1,
  part2,
  part3,
  essay,
  subject,
  onUpdatePart1,
  onUpdatePart2,
  onUpdatePart3,
  onUpdateEssay,
}) => {
  const [activePart, setActivePart] = useState<'1' | '2' | '3' | 'essay'>('1');
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [focusReaderMode, setFocusReaderMode] = useState<boolean>(false);
  const [drawModalOpen, setDrawModalOpen] = useState<boolean>(false);
  const [isToolboxOpen, setIsToolboxOpen] = useState<boolean>(true);
  const [dragOverTarget, setDragOverTarget] = useState<{
    part: '1' | '2' | '3' | 'essay';
    index: number;
  } | null>(null);
  const [focusedQuestion, setFocusedQuestion] = useState<{
    part: '1' | '2' | '3' | 'essay';
    index: number;
  }>({ part: '1', index: 0 });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [autoRenumber, setAutoRenumber] = useState<boolean>(true);
  const [draggingQuestion, setDraggingQuestion] = useState<{
    part: '1' | '2' | '3' | 'essay';
    index: number;
  } | null>(null);

  const [currentDrawTarget, setCurrentDrawTarget] = useState<{
    part: '1' | '2' | '3' | 'essay';
    index: number;
    initialImage?: string;
    initialCaption?: string;
  } | null>(null);

  const [reactionModalOpen, setReactionModalOpen] = useState<boolean>(false);
  const [currentReactionTarget, setCurrentReactionTarget] = useState<{
    part: '1' | '2' | '3' | 'essay';
    index: number;
    initialCaption?: string;
  } | null>(null);

  const [showValidationPanel, setShowValidationPanel] = useState<boolean>(true);
  const [showOnlyFlagged, setShowOnlyFlagged] = useState<boolean>(false);

  // Real-time validation summary across all 4 parts
  const validationSummary = useMemo(
    () => validateExamQuestions(part1, part2, part3, essay),
    [part1, part2, part3, essay]
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Auto-fix LaTeX & chemical formulas for a single question
  const handleAutoFixQuestionLatex = (
    part: '1' | '2' | '3' | 'essay',
    index: number
  ) => {
    if (part === '1' && part1[index]) {
      const updated = [...part1];
      const q = updated[index];
      updated[index] = {
        ...q,
        content: autoFixLatexInText(q.content),
        options: {
          A: autoFixLatexInText(q.options.A),
          B: autoFixLatexInText(q.options.B),
          C: autoFixLatexInText(q.options.C),
          D: autoFixLatexInText(q.options.D),
        },
        ...(q.explanation ? { explanation: autoFixLatexInText(q.explanation) } : {}),
      };
      onUpdatePart1(updated);
      showToast(`✨ Đã tự động sửa cú pháp LaTeX & công thức cho Câu ${index + 1} (Phần I)!`);
    } else if (part === '2' && part2[index]) {
      const updated = [...part2];
      const q = updated[index];
      updated[index] = {
        ...q,
        content: autoFixLatexInText(q.content),
        items: q.items.map((it) => ({
          ...it,
          text: autoFixLatexInText(it.text),
        })),
      };
      onUpdatePart2(updated);
      showToast(`✨ Đã tự động sửa cú pháp LaTeX & công thức cho Câu ${index + 1} (Phần II)!`);
    } else if (part === '3' && part3[index]) {
      const updated = [...part3];
      const q = updated[index];
      updated[index] = {
        ...q,
        content: autoFixLatexInText(q.content),
        ...(q.explanation ? { explanation: autoFixLatexInText(q.explanation) } : {}),
      };
      onUpdatePart3(updated);
      showToast(`✨ Đã tự động sửa cú pháp LaTeX & công thức cho Câu ${index + 1} (Phần III)!`);
    } else if (part === 'essay' && essay[index]) {
      const updated = [...essay];
      const q = updated[index];
      updated[index] = {
        ...q,
        content: autoFixLatexInText(q.content),
        guide: autoFixLatexInText(q.guide),
      };
      onUpdateEssay(updated);
      showToast(`✨ Đã tự động sửa cú pháp LaTeX & công thức cho Câu ${index + 1} (Tự luận)!`);
    }
  };

  // Auto-fix LaTeX & chemical formulas across all questions in the exam
  const handleAutoFixAllLatex = () => {
    const fixedP1 = part1.map((q) => ({
      ...q,
      content: autoFixLatexInText(q.content),
      options: {
        A: autoFixLatexInText(q.options.A),
        B: autoFixLatexInText(q.options.B),
        C: autoFixLatexInText(q.options.C),
        D: autoFixLatexInText(q.options.D),
      },
      ...(q.explanation ? { explanation: autoFixLatexInText(q.explanation) } : {}),
    }));

    const fixedP2 = part2.map((q) => ({
      ...q,
      content: autoFixLatexInText(q.content),
      items: q.items.map((it) => ({
        ...it,
        text: autoFixLatexInText(it.text),
      })),
    }));

    const fixedP3 = part3.map((q) => ({
      ...q,
      content: autoFixLatexInText(q.content),
      ...(q.explanation ? { explanation: autoFixLatexInText(q.explanation) } : {}),
    }));

    const fixedEssay = essay.map((q) => ({
      ...q,
      content: autoFixLatexInText(q.content),
      guide: autoFixLatexInText(q.guide),
    }));

    onUpdatePart1(fixedP1);
    onUpdatePart2(fixedP2);
    onUpdatePart3(fixedP3);
    onUpdateEssay(fixedEssay);

    showToast('✨ Đã chuẩn hóa và sửa lỗi cú pháp LaTeX / Công thức trên toàn bộ đề thi!');
  };

  // Jump to a specific question with validation issues
  const handleJumpToIssue = (
    part: '1' | '2' | '3' | 'essay',
    index: number
  ) => {
    setActivePart(part);
    setFocusedQuestion({ part, index });
    setTimeout(() => {
      const el = document.getElementById(`question-card-${part}-${index}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
  };

  const handleOpenDrawModal = (
    part: '1' | '2' | '3' | 'essay',
    index: number,
    initialImage?: string,
    initialCaption?: string
  ) => {
    setCurrentDrawTarget({ part, index, initialImage, initialCaption });
    setDrawModalOpen(true);
  };

  const handleOpenReactionModal = (
    part: '1' | '2' | '3' | 'essay',
    index: number,
    initialCaption?: string
  ) => {
    setCurrentReactionTarget({ part, index, initialCaption });
    setReactionModalOpen(true);
  };

  const handleSaveReactionFromModal = (imageDataUrl: string, captionText: string) => {
    if (!currentReactionTarget) return;
    const { part, index } = currentReactionTarget;
    if (part === '1') {
      const updated = [...part1];
      if (index < updated.length) {
        updated[index] = { ...updated[index], imageUrl: imageDataUrl, imageCaption: captionText };
        onUpdatePart1(updated);
      }
    } else if (part === '2') {
      const updated = [...part2];
      if (index < updated.length) {
        updated[index] = { ...updated[index], imageUrl: imageDataUrl, imageCaption: captionText };
        onUpdatePart2(updated);
      }
    } else if (part === '3') {
      const updated = [...part3];
      if (index < updated.length) {
        updated[index] = { ...updated[index], imageUrl: imageDataUrl, imageCaption: captionText };
        onUpdatePart3(updated);
      }
    } else if (part === 'essay') {
      const updated = [...essay];
      if (index < updated.length) {
        updated[index] = { ...updated[index], imageUrl: imageDataUrl, imageCaption: captionText };
        onUpdateEssay(updated);
      }
    }
    showToast(`Đã chèn sơ đồ phản ứng vào Câu ${index + 1} (Phần ${part.toUpperCase()}) thành công!`);
  };

  const handleSaveImageFromModal = (imageDataUrl: string, captionText: string) => {
    if (!currentDrawTarget) return;
    const { part, index } = currentDrawTarget;
    if (part === '1') {
      const updated = [...part1];
      updated[index] = { ...updated[index], imageUrl: imageDataUrl, imageCaption: captionText };
      onUpdatePart1(updated);
    } else if (part === '2') {
      const updated = [...part2];
      updated[index] = { ...updated[index], imageUrl: imageDataUrl, imageCaption: captionText };
      onUpdatePart2(updated);
    } else if (part === '3') {
      const updated = [...part3];
      updated[index] = { ...updated[index], imageUrl: imageDataUrl, imageCaption: captionText };
      onUpdatePart3(updated);
    } else if (part === 'essay') {
      const updated = [...essay];
      updated[index] = { ...updated[index], imageUrl: imageDataUrl, imageCaption: captionText };
      onUpdateEssay(updated);
    }
  };

  const handleRemoveQuestionImage = (part: '1' | '2' | '3' | 'essay', index: number) => {
    if (part === '1') {
      const updated = [...part1];
      updated[index] = { ...updated[index], imageUrl: undefined, imageCaption: undefined };
      onUpdatePart1(updated);
    } else if (part === '2') {
      const updated = [...part2];
      updated[index] = { ...updated[index], imageUrl: undefined, imageCaption: undefined };
      onUpdatePart2(updated);
    } else if (part === '3') {
      const updated = [...part3];
      updated[index] = { ...updated[index], imageUrl: undefined, imageCaption: undefined };
      onUpdatePart3(updated);
    } else if (part === 'essay') {
      const updated = [...essay];
      updated[index] = { ...updated[index], imageUrl: undefined, imageCaption: undefined };
      onUpdateEssay(updated);
    }
  };

  const handleUpdateQuestionCaption = (
    part: '1' | '2' | '3' | 'essay',
    index: number,
    caption: string
  ) => {
    if (part === '1') {
      const updated = [...part1];
      updated[index] = { ...updated[index], imageCaption: caption };
      onUpdatePart1(updated);
    } else if (part === '2') {
      const updated = [...part2];
      updated[index] = { ...updated[index], imageCaption: caption };
      onUpdatePart2(updated);
    } else if (part === '3') {
      const updated = [...part3];
      updated[index] = { ...updated[index], imageCaption: caption };
      onUpdatePart3(updated);
    } else if (part === 'essay') {
      const updated = [...essay];
      updated[index] = { ...updated[index], imageCaption: caption };
      onUpdateEssay(updated);
    }
  };

  // Attach processed image file/blob to target question in state
  const handleAttachImageFile = async (
    file: File | Blob,
    part: '1' | '2' | '3' | 'essay',
    index: number
  ) => {
    try {
      const base64Data = await processImageBlobToBase64(file);
      const defaultCaption = `Hình ${index + 1}. Thí nghiệm / hình ảnh minh họa`;

      if (part === '1') {
        const updated = [...part1];
        if (index < updated.length) {
          updated[index] = {
            ...updated[index],
            imageUrl: base64Data,
            imageCaption: updated[index].imageCaption || defaultCaption,
          };
          onUpdatePart1(updated);
        }
      } else if (part === '2') {
        const updated = [...part2];
        if (index < updated.length) {
          updated[index] = {
            ...updated[index],
            imageUrl: base64Data,
            imageCaption: updated[index].imageCaption || defaultCaption,
          };
          onUpdatePart2(updated);
        }
      } else if (part === '3') {
        const updated = [...part3];
        if (index < updated.length) {
          updated[index] = {
            ...updated[index],
            imageUrl: base64Data,
            imageCaption: updated[index].imageCaption || defaultCaption,
          };
          onUpdatePart3(updated);
        }
      } else if (part === 'essay') {
        const updated = [...essay];
        if (index < updated.length) {
          updated[index] = {
            ...updated[index],
            imageUrl: base64Data,
            imageCaption: updated[index].imageCaption || defaultCaption,
          };
          onUpdateEssay(updated);
        }
      }

      showToast(`📋 Đã dán ảnh từ Clipboard thành công vào Câu ${index + 1}!`);
    } catch (error) {
      console.error('Error processing pasted image:', error);
      showToast('Lỗi khi đọc hình ảnh từ clipboard.');
    }
  };

  // Paste event handler on question cards/inputs
  const handlePasteEvent = async (
    e: React.ClipboardEvent,
    part: '1' | '2' | '3' | 'essay',
    index: number
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          await handleAttachImageFile(file, part, index);
        }
        return;
      }
    }
  };

  // Manual click to paste from clipboard
  const handleManualPasteFromClipboard = async (
    part: '1' | '2' | '3' | 'essay',
    index: number
  ) => {
    setFocusedQuestion({ part, index });
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            await handleAttachImageFile(blob, part, index);
            return;
          }
        }
      }
    } catch (err) {
      // Browser permission prompt declined or unsupported
    }

    showToast(`💡 Bạn hãy sao chép ảnh (Ctrl+C hoặc Chụp màn hình) rồi nhấn Ctrl+V để dán trực tiếp vào Câu ${index + 1}!`);
  };

  // Global window paste listener for seamless Ctrl+V anywhere in QuestionEditor
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Do not intercept if drawing modal or reaction builder modal is open
      if (drawModalOpen || reactionModalOpen) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            const target = focusedQuestion || { part: activePart, index: 0 };
            handleAttachImageFile(file, target.part, target.index);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [focusedQuestion, activePart, part1, part2, part3, essay, drawModalOpen, reactionModalOpen]);

  // Helper to renumber a question list sequentially (Câu 1, Câu 2, ...)
  // Updates question `id`, cleans redundant "Câu X." prefixes in content, and syncs "Hình X." captions
  const renumberQuestionList = <
    T extends { id: number; content: string; imageCaption?: string }
  >(
    list: T[]
  ): T[] => {
    return list.map((item, idx) => {
      const newNum = idx + 1;
      // Strip any hardcoded "Câu 5.", "Câu 5:" prefix inside content so it stays clean
      const cleanedContent = item.content.replace(/^(Câu|Bài)\s+\d+\s*[.:/-]\s*/i, '');
      let updatedCaption = item.imageCaption;
      if (updatedCaption) {
        updatedCaption = updatedCaption
          .replace(/^(Hình|Sơ đồ)\s+\d+/i, `$1 ${newNum}`)
          .replace(/Câu\s+\d+/gi, `Câu ${newNum}`);
      }
      return {
        ...item,
        id: newNum,
        content: cleanedContent,
        ...(updatedCaption !== undefined ? { imageCaption: updatedCaption } : {}),
      };
    });
  };

  // Manual trigger: "Đánh số lại tự động" across current or all parts
  const handleAutoRenumberAll = () => {
    const newP1 = renumberQuestionList(part1);
    const newP2 = renumberQuestionList(part2);
    const newP3 = renumberQuestionList(part3);
    const newEssay = renumberQuestionList(essay);

    onUpdatePart1(newP1);
    onUpdatePart2(newP2);
    onUpdatePart3(newP3);
    onUpdateEssay(newEssay);

    showToast(
      `🔢 Đã đánh số lại tự động toàn bộ câu hỏi (Phần I: ${newP1.length} câu, Phần II: ${newP2.length} câu, Phần III: ${newP3.length} câu, Tự luận: ${newEssay.length} câu)!`
    );
  };

  // Reorder question from `fromIndex` to `toIndex` within a part
  const handleMoveQuestion = (
    part: '1' | '2' | '3' | 'essay',
    fromIndex: number,
    toIndex: number
  ) => {
    if (fromIndex === toIndex || toIndex < 0) return;

    const reorderAndMaybeRenumber = <
      T extends { id: number; content: string; imageCaption?: string }
    >(
      list: T[]
    ): T[] | null => {
      if (toIndex >= list.length) return null;
      const cloned = [...list];
      const [moved] = cloned.splice(fromIndex, 1);
      cloned.splice(toIndex, 0, moved);
      return autoRenumber ? renumberQuestionList(cloned) : cloned;
    };

    if (part === '1') {
      const updated = reorderAndMaybeRenumber(part1);
      if (!updated) return;
      onUpdatePart1(updated);
    } else if (part === '2') {
      const updated = reorderAndMaybeRenumber(part2);
      if (!updated) return;
      onUpdatePart2(updated);
    } else if (part === '3') {
      const updated = reorderAndMaybeRenumber(part3);
      if (!updated) return;
      onUpdatePart3(updated);
    } else if (part === 'essay') {
      const updated = reorderAndMaybeRenumber(essay);
      if (!updated) return;
      onUpdateEssay(updated);
    }

    setFocusedQuestion({ part, index: toIndex });
    showToast(
      autoRenumber
        ? `🔢 Đã di chuyển Câu ${fromIndex + 1} → vị trí Câu ${toIndex + 1} và đánh số lại tự động!`
        : `Đã di chuyển câu hỏi sang vị trí ${toIndex + 1}. Nhấn "Đánh số lại tự động" để đồng bộ mã câu.`
    );
  };

  // Delete question at `index` and auto-renumber remaining questions
  const handleDeleteQuestion = (part: '1' | '2' | '3' | 'essay', index: number) => {
    if (part === '1') {
      const filtered = part1.filter((_, i) => i !== index);
      onUpdatePart1(autoRenumber ? renumberQuestionList(filtered) : filtered);
    } else if (part === '2') {
      const filtered = part2.filter((_, i) => i !== index);
      onUpdatePart2(autoRenumber ? renumberQuestionList(filtered) : filtered);
    } else if (part === '3') {
      const filtered = part3.filter((_, i) => i !== index);
      onUpdatePart3(autoRenumber ? renumberQuestionList(filtered) : filtered);
    } else if (part === 'essay') {
      const filtered = essay.filter((_, i) => i !== index);
      onUpdateEssay(autoRenumber ? renumberQuestionList(filtered) : filtered);
    }

    setFocusedQuestion({ part, index: Math.max(0, index - 1) });
    showToast(
      autoRenumber
        ? `🗑️ Đã xóa Câu ${index + 1} và tự động đánh số lại thứ tự các câu còn lại!`
        : `Đã xóa Câu ${index + 1}.`
    );
  };

  const handleQuestionDragStart = (
    e: React.DragEvent,
    part: '1' | '2' | '3' | 'essay',
    index: number
  ) => {
    setDraggingQuestion({ part, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'question-reorder',
        part,
        fromIndex: index,
      })
    );
  };

  const handleQuestionDragEnd = () => {
    setDraggingQuestion(null);
    setDragOverTarget(null);
  };

  // Drop apparatus OR reorder question onto a question card
  const handleDropApparatus = (
    e: React.DragEvent,
    part: '1' | '2' | '3' | 'essay',
    index: number
  ) => {
    e.preventDefault();
    setDragOverTarget(null);
    setDraggingQuestion(null);
    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (!rawData) return;
      const data = JSON.parse(rawData);

      // Case 1: Reordering a question card via drag-and-drop
      if (data.type === 'question-reorder' && data.part === part && typeof data.fromIndex === 'number') {
        handleMoveQuestion(part, data.fromIndex, index);
        return;
      }

      // Case 2: Dropping chemistry apparatus from LaboratoryToolbox OR ChemSvgToolbar onto question card
      if ((data.type === 'chem-apparatus' || data.type === 'chem-svg-toolbar-item') && data.dataUrl) {
        if (part === '1') {
          const updated = [...part1];
          updated[index] = {
            ...updated[index],
            imageUrl: data.dataUrl,
            imageCaption: data.caption,
          };
          onUpdatePart1(updated);
        } else if (part === '2') {
          const updated = [...part2];
          updated[index] = {
            ...updated[index],
            imageUrl: data.dataUrl,
            imageCaption: data.caption,
          };
          onUpdatePart2(updated);
        } else if (part === '3') {
          const updated = [...part3];
          updated[index] = {
            ...updated[index],
            imageUrl: data.dataUrl,
            imageCaption: data.caption,
          };
          onUpdatePart3(updated);
        } else if (part === 'essay') {
          const updated = [...essay];
          updated[index] = {
            ...updated[index],
            imageUrl: data.dataUrl,
            imageCaption: data.caption,
          };
          onUpdateEssay(updated);
        }
        showToast(`Đã gắn hình SVG "${data.name}" vào Câu ${index + 1}!`);
      }
    } catch (err) {
      console.error('Error handling drop:', err);
    }
  };

  // Drop SVG item directly into question content textarea (inserts [svg:id] inline token)
  const handleDropOnContentTextarea = (
    e: React.DragEvent<HTMLTextAreaElement>,
    part: '1' | '2' | '3' | 'essay',
    index: number
  ) => {
    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (!rawData) return;
      const data = JSON.parse(rawData);
      if (data.type === 'chem-svg-toolbar-item' && data.token) {
        e.preventDefault();
        e.stopPropagation();
        setDragOverTarget(null);
        const token = ` ${data.token} `;
        const target = e.currentTarget;
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;

        const insertAtCursor = (currentText: string) =>
          currentText.slice(0, start) + token + currentText.slice(end);

        if (part === '1') {
          const updated = [...part1];
          updated[index] = {
            ...updated[index],
            content: insertAtCursor(updated[index].content || ''),
          };
          onUpdatePart1(updated);
        } else if (part === '2') {
          const updated = [...part2];
          updated[index] = {
            ...updated[index],
            content: insertAtCursor(updated[index].content || ''),
          };
          onUpdatePart2(updated);
        } else if (part === '3') {
          const updated = [...part3];
          updated[index] = {
            ...updated[index],
            content: insertAtCursor(updated[index].content || ''),
          };
          onUpdatePart3(updated);
        } else if (part === 'essay') {
          const updated = [...essay];
          updated[index] = {
            ...updated[index],
            content: insertAtCursor(updated[index].content || ''),
          };
          onUpdateEssay(updated);
        }
        showToast(`Đã chèn hình SVG "${data.name}" trực tiếp vào nội dung Câu ${index + 1}!`);
      }
    } catch (err) {
      // Ignore non-JSON text drops so default browser text drop still works
    }
  };

  // Insert SVG inline token into focused question content from ChemSvgToolbar button
  const handleInsertSvgInlineToContent = (item: ChemSvgToolbarItem) => {
    const { part, index } = focusedQuestion;
    const token = ` [svg:${item.id}] `;
    if (part === '1' && part1[index]) {
      const updated = [...part1];
      updated[index] = {
        ...updated[index],
        content: (updated[index].content || '') + token,
      };
      onUpdatePart1(updated);
      showToast(`Đã chèn SVG "${item.name}" vào nội dung Câu ${index + 1} (Phần I)!`);
    } else if (part === '2' && part2[index]) {
      const updated = [...part2];
      updated[index] = {
        ...updated[index],
        content: (updated[index].content || '') + token,
      };
      onUpdatePart2(updated);
      showToast(`Đã chèn SVG "${item.name}" vào nội dung Câu ${index + 1} (Phần II)!`);
    } else if (part === '3' && part3[index]) {
      const updated = [...part3];
      updated[index] = {
        ...updated[index],
        content: (updated[index].content || '') + token,
      };
      onUpdatePart3(updated);
      showToast(`Đã chèn SVG "${item.name}" vào nội dung Câu ${index + 1} (Phần III)!`);
    } else if (part === 'essay' && essay[index]) {
      const updated = [...essay];
      updated[index] = {
        ...updated[index],
        content: (updated[index].content || '') + token,
      };
      onUpdateEssay(updated);
      showToast(`Đã chèn SVG "${item.name}" vào nội dung Câu ${index + 1} (Tự luận)!`);
    }
  };

  // Attach SVG as standalone image of focused question from ChemSvgToolbar button
  const handleAttachSvgAsQuestionImage = (item: ChemSvgToolbarItem) => {
    const { part, index } = focusedQuestion;
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      item.standaloneSvg.trim()
    )}`;
    if (part === '1' && part1[index]) {
      const updated = [...part1];
      updated[index] = {
        ...updated[index],
        imageUrl: svgDataUrl,
        imageCaption: item.defaultCaption,
      };
      onUpdatePart1(updated);
      showToast(`Đã đính kèm hình SVG "${item.name}" vào Câu ${index + 1} (Phần I)!`);
    } else if (part === '2' && part2[index]) {
      const updated = [...part2];
      updated[index] = {
        ...updated[index],
        imageUrl: svgDataUrl,
        imageCaption: item.defaultCaption,
      };
      onUpdatePart2(updated);
      showToast(`Đã đính kèm hình SVG "${item.name}" vào Câu ${index + 1} (Phần II)!`);
    } else if (part === '3' && part3[index]) {
      const updated = [...part3];
      updated[index] = {
        ...updated[index],
        imageUrl: svgDataUrl,
        imageCaption: item.defaultCaption,
      };
      onUpdatePart3(updated);
      showToast(`Đã đính kèm hình SVG "${item.name}" vào Câu ${index + 1} (Phần III)!`);
    } else if (part === 'essay' && essay[index]) {
      const updated = [...essay];
      updated[index] = {
        ...updated[index],
        imageUrl: svgDataUrl,
        imageCaption: item.defaultCaption,
      };
      onUpdateEssay(updated);
      showToast(`Đã đính kèm hình SVG "${item.name}" vào Câu ${index + 1} (Tự luận)!`);
    }
  };

  // Quick insert apparatus from toolbox click
  const handleInsertApparatusFromToolbox = (
    apparatus: ApparatusItem,
    part: '1' | '2' | '3' | 'essay',
    index: number
  ) => {
    const rawSvg = apparatus.generateStandaloneSvg();
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawSvg.trim())}`;

    if (part === '1') {
      const updated = [...part1];
      if (index < updated.length) {
        updated[index] = {
          ...updated[index],
          imageUrl: dataUrl,
          imageCaption: apparatus.defaultCaption,
        };
        onUpdatePart1(updated);
      }
    } else if (part === '2') {
      const updated = [...part2];
      if (index < updated.length) {
        updated[index] = {
          ...updated[index],
          imageUrl: dataUrl,
          imageCaption: apparatus.defaultCaption,
        };
        onUpdatePart2(updated);
      }
    } else if (part === '3') {
      const updated = [...part3];
      if (index < updated.length) {
        updated[index] = {
          ...updated[index],
          imageUrl: dataUrl,
          imageCaption: apparatus.defaultCaption,
        };
        onUpdatePart3(updated);
      }
    } else if (part === 'essay') {
      const updated = [...essay];
      if (index < updated.length) {
        updated[index] = {
          ...updated[index],
          imageUrl: dataUrl,
          imageCaption: apparatus.defaultCaption,
        };
        onUpdateEssay(updated);
      }
    }
  };

  // Open apparatus in ChemistryDrawModal to customize or combine
  const handleOpenDrawModalWithApparatus = (apparatus: ApparatusItem) => {
    const rawSvg = apparatus.generateStandaloneSvg();
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawSvg.trim())}`;
    handleOpenDrawModal(activePart, 0, dataUrl, apparatus.defaultCaption);
  };

  // AI generate explanation for a question
  const handleGenerateExplanation = async (
    qId: number,
    partKey: '1' | '2' | '3',
    questionData: any
  ) => {
    try {
      setExplainingId(`${partKey}-${qId}`);
      const response = await fetch('/api/gemini/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionData,
          type: `Phần ${partKey}`,
          subject,
        }),
      });
      const data = await response.json();
      if (data.success && data.explanation) {
        if (partKey === '1') {
          const updated = part1.map((q) =>
            q.id === qId ? { ...q, explanation: data.explanation } : q
          );
          onUpdatePart1(updated);
        } else if (partKey === '3') {
          const updated = part3.map((q) =>
            q.id === qId ? { ...q, explanation: data.explanation } : q
          );
          onUpdatePart3(updated);
        }
      }
    } catch (err) {
      console.error('Error generating explanation:', err);
    } finally {
      setExplainingId(null);
    }
  };

  // Add handlers
  const handleAddPart1 = () => {
    const newQ: Part1Question = {
      id: part1.length + 1,
      content: 'Nội dung câu hỏi mới...',
      options: {
        A: 'Phương án A',
        B: 'Phương án B',
        C: 'Phương án C',
        D: 'Phương án D',
      },
      correctAnswer: 'A',
      level: 'Biết',
      topic: 'Chủ đề',
      explanation: 'Lời giải chi tiết...',
    };
    onUpdatePart1([...part1, newQ]);
  };

  const handleAddPart2 = () => {
    const newQ: Part2Question = {
      id: part2.length + 1,
      content: 'Đoạn thông tin / ngữ cảnh câu hỏi mới...',
      items: [
        { label: 'a', text: 'Mệnh đề ý a...', isCorrect: true },
        { label: 'b', text: 'Mệnh đề ý b...', isCorrect: false },
        { label: 'c', text: 'Mệnh đề ý c...', isCorrect: true },
        { label: 'd', text: 'Mệnh đề ý d...', isCorrect: false },
      ],
      level: 'Hiểu',
      topic: 'Chủ đề',
    };
    onUpdatePart2([...part2, newQ]);
  };

  const handleAddPart3 = () => {
    const newQ: Part3Question = {
      id: part3.length + 1,
      content: 'Nội dung câu hỏi trả lời ngắn (yêu cầu điền số)...',
      correctAnswer: '0',
      unit: '',
      level: 'Vận dụng',
      topic: 'Chủ đề',
      explanation: 'Các bước tính toán...',
    };
    onUpdatePart3([...part3, newQ]);
  };

  const handleAddEssay = () => {
    const newQ: EssayQuestion = {
      id: essay.length + 1,
      content: 'Nội dung câu hỏi tự luận...',
      points: 1.0,
      guide: 'Hướng dẫn chấm điểm từng ý...',
      level: 'Vận dụng',
    };
    onUpdateEssay([...essay, newQ]);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-400 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {focusReaderMode ? (
        <FocusReaderView
          part1={part1}
          part2={part2}
          part3={part3}
          essay={essay}
          subject={subject}
          onExitFocusReader={() => setFocusReaderMode(false)}
          onJumpToEditQuestion={(part, index) => {
            setFocusReaderMode(false);
            setActivePart(part);
            setFocusedQuestion({ part, index });
            showToast(
              `Đã chuyển về chế độ chỉnh sửa tại Câu ${index + 1} (${
                part === 'essay' ? 'Tự luận' : `Phần ${part}`
              })!`
            );
          }}
        />
      ) : (
        <>
          {/* Top Section Nav and Controls */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        {/* Parts switcher */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => {
              setActivePart('1');
              setFocusedQuestion({ part: '1', index: 0 });
            }}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activePart === '1'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
            }`}
          >
            <span>Phần I: TN 4 Lựa chọn</span>
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-white/20">
              {part1.length}
            </span>
            {validationSummary.byPart['1'].length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 flex items-center gap-0.5 shadow-2xs"
                title={`${validationSummary.byPart['1'].length} cảnh báo ở Phần I`}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                {validationSummary.byPart['1'].length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActivePart('2');
              setFocusedQuestion({ part: '2', index: 0 });
            }}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activePart === '2'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
            }`}
          >
            <span>Phần II: Đúng / Sai</span>
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-white/20">
              {part2.length}
            </span>
            {validationSummary.byPart['2'].length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 flex items-center gap-0.5 shadow-2xs"
                title={`${validationSummary.byPart['2'].length} cảnh báo ở Phần II`}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                {validationSummary.byPart['2'].length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActivePart('3');
              setFocusedQuestion({ part: '3', index: 0 });
            }}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activePart === '3'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <span>Phần III: Trả Lời Ngắn</span>
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-white/20">
              {part3.length}
            </span>
            {validationSummary.byPart['3'].length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 flex items-center gap-0.5 shadow-2xs"
                title={`${validationSummary.byPart['3'].length} cảnh báo ở Phần III`}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                {validationSummary.byPart['3'].length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActivePart('essay');
              setFocusedQuestion({ part: 'essay', index: 0 });
            }}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activePart === 'essay'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
            }`}
          >
            <span>Phần Tự Luận</span>
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-white/20">
              {essay.length}
            </span>
            {validationSummary.byPart.essay.length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 flex items-center gap-0.5 shadow-2xs"
                title={`${validationSummary.byPart.essay.length} cảnh báo ở Phần Tự luận`}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                {validationSummary.byPart.essay.length}
              </span>
            )}
          </button>
        </div>

        {/* Preview, Auto-Renumber, Validation Toggle, Toolbox Toggle, and Quick Add */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Validation Helper Toggle Button */}
          <button
            type="button"
            onClick={() => setShowValidationPanel(!showValidationPanel)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
              validationSummary.issues.length > 0
                ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100 shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
            }`}
            title="Bật/tắt bảng Rà soát lỗi câu hỏi (thiếu đáp án A/B/C/D, công thức LaTeX lỗi...)"
          >
            {validationSummary.issues.length > 0 ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>
                  Kiểm tra lỗi ({validationSummary.questionCountWithIssues} câu / {validationSummary.issues.length} mục)
                </span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đề chuẩn (0 lỗi)</span>
              </>
            )}
          </button>

          {/* Auto-Renumber Button & Toggle */}
          <div className="inline-flex items-center bg-amber-50/90 border border-amber-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handleAutoRenumberAll}
              className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              title="Cập nhật lại toàn bộ số thứ tự câu hỏi (Câu 1, Câu 2...) và đồng bộ chú thích hình ảnh"
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Đánh số lại tự động</span>
            </button>
            <label
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-900 cursor-pointer select-none"
              title="Tự động đánh số lại Câu 1, Câu 2... ngay sau khi kéo thả đổi vị trí hoặc xóa câu hỏi"
            >
              <input
                type="checkbox"
                checked={autoRenumber}
                onChange={(e) => setAutoRenumber(e.target.checked)}
                className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
              />
              <span className="hidden xl:inline">Tự động khi kéo/xóa</span>
            </label>
          </div>

          {/* Laboratory Toolbox Toggle */}
          <button
            onClick={() => setIsToolboxOpen(!isToolboxOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all border ${
              isToolboxOpen
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
            }`}
            title="Bật/tắt Hộp dụng cụ thí nghiệm hóa học (kéo thả SVGs)"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>{isToolboxOpen ? 'Đang mở Toolbox' : '🧰 Hộp dụng cụ thí nghiệm'}</span>
          </button>

          {/* ReactionBuilder Studio Button */}
          <button
            onClick={() => handleOpenReactionModal(activePart, focusedQuestion.index)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
            title="Mở trình ReactionBuilder để tạo sơ đồ chuỗi phản ứng cho câu đang chọn"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>⚡ Sơ đồ phản ứng (ReactionBuilder)</span>
          </button>

          {/* Focus Reader Mode Button */}
          <button
            type="button"
            onClick={() => setFocusReaderMode(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
            title="Bật chế độ Focus Reader: Ẩn toàn bộ thanh công cụ chỉnh sửa để đọc duyệt nội dung sạch sẽ trước khi in"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>Focus Reader</span>
          </button>

          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 cursor-pointer transition-colors ${
              previewMode
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{previewMode ? 'Chế độ Chỉnh sửa' : 'Xem công thức (KaTeX)'}</span>
          </button>

          {activePart === '1' && (
            <button
              onClick={handleAddPart1}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm câu Phần I
            </button>
          )}

          {activePart === '2' && (
            <button
              onClick={handleAddPart2}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm câu Phần II
            </button>
          )}

          {activePart === '3' && (
            <button
              onClick={handleAddPart3}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm câu Phần III
            </button>
          )}

          {activePart === 'essay' && (
            <button
              onClick={handleAddEssay}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm câu Tự luận
            </button>
          )}
        </div>
      </div>

      {/* Validation Helper & Diagnostics Panel */}
      {showValidationPanel && (
        <div
          className={`rounded-xl border p-4 shadow-2xs transition-all ${
            validationSummary.issues.length === 0
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : validationSummary.errorCount > 0
              ? 'bg-rose-50/70 border-rose-200 text-rose-950'
              : 'bg-amber-50/80 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  validationSummary.issues.length === 0
                    ? 'bg-emerald-600 text-white'
                    : validationSummary.errorCount > 0
                    ? 'bg-rose-600 text-white'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {validationSummary.issues.length === 0 ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold flex items-center gap-2 flex-wrap">
                  <span>Trợ lý Rà soát &amp; Kiểm tra Câu hỏi (Validation Helper)</span>
                  {validationSummary.errorCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-rose-600 text-white font-bold">
                      {validationSummary.errorCount} lỗi thiếu dữ liệu / LaTeX
                    </span>
                  )}
                  {validationSummary.warningCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500 text-white font-bold">
                      {validationSummary.warningCount} cảnh báo cần lưu ý
                    </span>
                  )}
                </div>
                <p className="text-xs opacity-85 mt-0.5">
                  {validationSummary.issues.length === 0
                    ? 'Tất cả câu hỏi trong đề đã có đầy đủ phương án lựa chọn, đáp án chuẩn và cú pháp công thức LaTeX / KaTeX hợp lệ!'
                    : 'Tự động phát hiện câu hỏi thiếu phương án A/B/C/D, trùng đáp án, thiếu mệnh đề Đúng/Sai hoặc biểu thức LaTeX chưa đóng cặp dấu $...$ / ngoặc nhọn {...}.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {validationSummary.autoFixableCount > 0 && (
                <button
                  type="button"
                  onClick={handleAutoFixAllLatex}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>
                    Tự động sửa toàn bộ LaTeX ({validationSummary.autoFixableCount})
                  </span>
                </button>
              )}

              {validationSummary.issues.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOnlyFlagged(!showOnlyFlagged)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                    showOnlyFlagged
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>
                    {showOnlyFlagged ? 'Đang lọc: Chỉ câu có lỗi' : 'Lọc câu có lỗi'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowValidationPanel(false)}
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded cursor-pointer"
                title="Thu gọn bảng kiểm tra"
              >
                Ẩn
              </button>
            </div>
          </div>

          {validationSummary.issues.length > 0 && (
            <div className="mt-3 pt-3 border-t border-black/10 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {validationSummary.issues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => handleJumpToIssue(issue.part, issue.questionIndex)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border text-left transition-all cursor-pointer ${
                    issue.severity === 'error'
                      ? 'bg-white border-rose-300 text-rose-900 hover:bg-rose-100'
                      : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'
                  }`}
                  title="Nhấn để nhảy tới câu hỏi này"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      issue.severity === 'error' ? 'bg-rose-600' : 'bg-amber-500'
                    }`}
                  />
                  <span className="font-bold">
                    {issue.part === 'essay' ? 'Tự luận' : `Phần ${issue.part}`} • Câu{' '}
                    {issue.questionNumber}:
                  </span>
                  <span className="truncate max-w-[280px]">{issue.message}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Global Shortcut & Paste Guidance Banner */}
      <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 border border-indigo-100 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-2xs">
            <Clipboard className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-indigo-950">
              Hỗ trợ dán ảnh trực tiếp từ Clipboard (Ctrl + V):
            </span>
            <span className="text-slate-600 ml-1.5">
              Chụp màn hình (Snipping Tool / PrtSc) hoặc copy ảnh bất kỳ, sau đó bấm chọn câu hỏi và nhấn{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono font-bold text-slate-800 shadow-2xs">
                Ctrl + V
              </kbd>{' '}
              để dán ngay vào đề thi!
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-indigo-800 font-medium bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs">
            Đang trỏ vào: <strong>Câu {focusedQuestion.index + 1} (Phần {focusedQuestion.part.toUpperCase()})</strong>
          </span>
        </div>
      </div>

      {/* NEW: Chemistry SVG Quick-Insert & Drag-and-Drop Toolbar */}
      <ChemSvgToolbar
        activeQuestionLabel={`Câu ${focusedQuestion.index + 1} (${
          focusedQuestion.part === 'essay' ? 'Tự luận' : `Phần ${focusedQuestion.part}`
        })`}
        onInsertInlineToContent={handleInsertSvgInlineToContent}
        onAttachAsQuestionImage={handleAttachSvgAsQuestionImage}
      />

      {/* Main Container: Question Cards + Docked Laboratory Toolbox */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* LEFT COLUMN: Questions List */}
        <div className="flex-1 w-full min-w-0 space-y-4">
          {/* PART 1 QUESTIONS */}
          {activePart === '1' && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-800 flex items-center justify-between">
                <span>
                  <strong>PHẦN I (Trắc nghiệm nhiều lựa chọn):</strong> Thí sinh chọn 1 trong 4 đáp án A, B, C, D. Mỗi câu đúng được 0.25 điểm. Hỗ trợ dán ảnh (Ctrl+V) &amp; kéo thả dụng cụ từ Toolbox!
                </span>
                <span className="font-bold">Tổng: {part1.length} câu ({(part1.length * 0.25).toFixed(2)} điểm)</span>
              </div>

              {part1.map((q, idx) => {
                const isOver = dragOverTarget?.part === '1' && dragOverTarget?.index === idx;
                const isFocused = focusedQuestion.part === '1' && focusedQuestion.index === idx;
                const qIssues = validationSummary.byQuestionKey[`1-${idx}`] || [];
                const hasError = qIssues.some((i) => i.severity === 'error');
                const stemHasIssue = qIssues.some((i) => i.field === 'content');

                if (showOnlyFlagged && qIssues.length === 0) return null;

                return (
                  <div
                    id={`question-card-1-${idx}`}
                    key={q.id || idx}
                    onClick={() => setFocusedQuestion({ part: '1', index: idx })}
                    onFocus={() => setFocusedQuestion({ part: '1', index: idx })}
                    onPaste={(e) => handlePasteEvent(e, '1', idx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                      if (dragOverTarget?.part !== '1' || dragOverTarget?.index !== idx) {
                        setDragOverTarget({ part: '1', index: idx });
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverTarget(null);
                      }
                    }}
                    onDrop={(e) => handleDropApparatus(e, '1', idx)}
                    className={`bg-white rounded-xl border shadow-2xs p-5 transition-all relative ${
                      isOver
                        ? 'border-2 border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-400/25'
                        : hasError
                        ? 'border-rose-300 ring-2 ring-rose-100'
                        : qIssues.length > 0
                        ? 'border-amber-300 ring-2 ring-amber-100/70'
                        : isFocused
                        ? 'border-sky-300 ring-2 ring-sky-200/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {isOver && (
                      <div className="mb-3 py-1.5 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
                        <Move className="w-3.5 h-3.5" />
                        <span>
                          {draggingQuestion?.part === '1'
                            ? `🔢 Thả vào đây để đổi sang vị trí Câu ${idx + 1} và đánh số lại tự động!`
                            : `🎯 Thả dụng cụ thí nghiệm vào đây để gán vào Câu ${idx + 1}!`}
                        </span>
                      </div>
                    )}

                    <QuestionValidationBanner
                      issues={qIssues}
                      onAutoFixLatex={() => handleAutoFixQuestionLatex('1', idx)}
                    />

                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Drag Handle & Up/Down Reorder Controls */}
                        <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                          <div
                            draggable
                            onDragStart={(e) => handleQuestionDragStart(e, '1', idx)}
                            onDragEnd={handleQuestionDragEnd}
                            className="p-1 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing"
                            title="Kéo thả để thay đổi vị trí câu hỏi (tự động đánh số lại)"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveQuestion('1', idx, idx - 1)}
                            className="p-0.5 text-slate-500 hover:text-sky-700 disabled:opacity-30 cursor-pointer"
                            title="Chuyển câu hỏi lên trên"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === part1.length - 1}
                            onClick={() => handleMoveQuestion('1', idx, idx + 1)}
                            className="p-0.5 text-slate-500 hover:text-sky-700 disabled:opacity-30 cursor-pointer"
                            title="Chuyển câu hỏi xuống dưới"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="px-2.5 h-7 rounded-lg bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-xs">
                          Câu {idx + 1}
                        </span>
                        {q.id !== idx + 1 && (
                          <span
                            onClick={handleAutoRenumberAll}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer hover:bg-amber-200"
                            title="Nhấn để đánh số lại tự động"
                          >
                            Mã cũ #{q.id} → Đánh số lại
                          </span>
                        )}

                        {/* Cognitive Level Selector */}
                        <select
                          value={q.level}
                          onChange={(e) => {
                            const updated = [...part1];
                            updated[idx].level = e.target.value as CognitiveLevel;
                            onUpdatePart1(updated);
                          }}
                          className={`text-xs font-semibold rounded-md px-2 py-1 border ${
                            q.level === 'Biết'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : q.level === 'Hiểu'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : q.level === 'Vận dụng cao'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <option value="Biết">Mức: Biết (Nhận biết)</option>
                          <option value="Hiểu">Mức: Hiểu (Thông hiểu)</option>
                          <option value="Vận dụng">Mức: Vận dụng</option>
                          <option value="Vận dụng cao">Mức: Vận dụng cao</option>
                        </select>

                        {/* Topic tag */}
                        <input
                          type="text"
                          value={q.topic || ''}
                          placeholder="Chủ đề..."
                          onChange={(e) => {
                            const updated = [...part1];
                            updated[idx].topic = e.target.value;
                            onUpdatePart1(updated);
                          }}
                          className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1 w-36"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {isFocused && (
                          <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 flex items-center gap-1">
                            <Clipboard className="w-3 h-3 text-sky-600" />
                            <span>Bấm Ctrl+V để dán ảnh vào đây</span>
                          </span>
                        )}

                        <button
                          onClick={() => handleGenerateExplanation(q.id, '1', q)}
                          disabled={explainingId === `1-${q.id}`}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                          title="Dùng Gemini AI viết lời giải chi tiết"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{explainingId === `1-${q.id}` ? 'Đang viết...' : 'AI Lời Giải'}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteQuestion('1', idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Xóa câu hỏi này và tự động đánh số lại"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Question Content */}
                    {previewMode ? (
                      <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-800 mb-4 border border-slate-200">
                        <span className="font-semibold text-slate-900 mr-2">Câu {idx + 1}:</span>
                        <MathChemView content={q.content} />
                      </div>
                    ) : (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-medium text-slate-600">
                            Nội dung câu hỏi (hỗ trợ công thức $...$ hoặc kéo thả hình SVG `[svg:...]` vào ô):
                          </label>
                          <span className="text-[11px] text-teal-600 font-medium">
                            Hỗ trợ thả trực tiếp hình SVG từ thanh công cụ
                          </span>
                        </div>
                        <textarea
                          rows={2}
                          value={q.content}
                          onChange={(e) => {
                            const updated = [...part1];
                            updated[idx].content = e.target.value;
                            onUpdatePart1(updated);
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleDropOnContentTextarea(e, '1', idx)}
                          onPaste={(e) => handlePasteEvent(e, '1', idx)}
                          className={`w-full text-sm border rounded-lg p-2.5 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${
                            stemHasIssue
                              ? 'border-amber-400 bg-amber-50/30'
                              : 'border-slate-200'
                          }`}
                        />
                        {q.content?.includes('[svg:') && (
                          <div className="mt-2 p-2.5 bg-teal-50/50 border border-teal-200 rounded-lg">
                            <div className="text-[11px] font-semibold text-teal-800 mb-1">
                              Xem trước nội dung kèm hình vẽ SVG nhúng trong câu hỏi:
                            </div>
                            <div className="text-sm text-slate-800">
                              <MathChemView content={q.content} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Question Image Attachment & Dropzone */}
                    <QuestionImageBlock
                      imageUrl={q.imageUrl}
                      imageCaption={q.imageCaption}
                      questionNumber={idx + 1}
                      previewMode={previewMode}
                      isDragOver={isOver}
                      onDropApparatus={(e) => handleDropApparatus(e, '1', idx)}
                      onPasteImage={(file) => handleAttachImageFile(file, '1', idx)}
                      onManualPasteClick={() => handleManualPasteFromClipboard('1', idx)}
                      onOpenDraw={() => handleOpenDrawModal('1', idx, q.imageUrl, q.imageCaption)}
                      onOpenReactionBuilder={() => handleOpenReactionModal('1', idx, q.imageCaption)}
                      onRemove={() => handleRemoveQuestionImage('1', idx)}
                      onUpdateCaption={(caption) => handleUpdateQuestionCaption('1', idx, caption)}
                    />

                    {/* 4 Options Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                        const optIssue = qIssues.find((i) => i.field === `option_${opt}`);
                        return (
                          <div
                            key={opt}
                            onClick={() => {
                              const updated = [...part1];
                              updated[idx].correctAnswer = opt;
                              onUpdatePart1(updated);
                            }}
                            className={`flex items-start gap-2 p-2.5 rounded-lg border transition-all cursor-pointer ${
                              optIssue
                                ? optIssue.severity === 'error'
                                  ? 'bg-rose-50/70 border-rose-400 ring-1 ring-rose-300'
                                  : 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-300'
                                : q.correctAnswer === opt
                                ? 'bg-emerald-50/80 border-emerald-400 shadow-xs ring-1 ring-emerald-400'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-md font-bold flex items-center justify-center text-xs shrink-0 ${
                                optIssue
                                  ? optIssue.severity === 'error'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-amber-500 text-white'
                                  : q.correctAnswer === opt
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {opt}
                            </span>

                            <div className="flex-1 min-w-0">
                              {previewMode ? (
                                <div className="text-sm pt-0.5">
                                  <MathChemView content={q.options[opt]} />
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={q.options[opt]}
                                  placeholder={`Nhập nội dung phương án ${opt}...`}
                                  onChange={(e) => {
                                    const updated = [...part1];
                                    updated[idx].options[opt] = e.target.value;
                                    onUpdatePart1(updated);
                                  }}
                                  className="w-full text-sm border-0 bg-transparent p-0 focus:ring-0 text-slate-800"
                                />
                              )}
                            </div>

                            {optIssue && (
                              <span title={optIssue.message} className="shrink-0 mt-1">
                                <AlertTriangle
                                  className={`w-4 h-4 ${
                                    optIssue.severity === 'error'
                                      ? 'text-rose-600'
                                      : 'text-amber-600'
                                  }`}
                                />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation Section */}
                    {q.explanation && (
                      <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200 text-xs text-amber-900">
                        <span className="font-semibold">Lời giải / Hướng dẫn: </span>
                        {previewMode ? (
                          <div className="mt-1">
                            <MathChemView content={q.explanation} />
                          </div>
                        ) : (
                          <textarea
                            rows={2}
                            value={q.explanation}
                            onChange={(e) => {
                              const updated = [...part1];
                              updated[idx].explanation = e.target.value;
                              onUpdatePart1(updated);
                            }}
                            className="w-full text-xs border border-amber-200 bg-white/80 rounded p-1.5 mt-1"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* PART 2 QUESTIONS */}
          {activePart === '2' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-800 flex items-center justify-between">
                <span>
                  <strong>PHẦN II (Trắc nghiệm Đúng / Sai):</strong> Mỗi câu gồm 4 ý a, b, c, d. Thí sinh chọn Đúng hoặc Sai cho mỗi ý. Hỗ trợ dán ảnh (Ctrl+V) &amp; kéo thả dụng cụ!
                </span>
                <span className="font-bold">Tổng: {part2.length} câu ({(part2.length * 1.0).toFixed(2)} điểm)</span>
              </div>

              {part2.map((q, idx) => {
                const isOver = dragOverTarget?.part === '2' && dragOverTarget?.index === idx;
                const isFocused = focusedQuestion.part === '2' && focusedQuestion.index === idx;
                const qIssues = validationSummary.byQuestionKey[`2-${idx}`] || [];
                const hasError = qIssues.some((i) => i.severity === 'error');
                const stemHasIssue = qIssues.some((i) => i.field === 'content');

                if (showOnlyFlagged && qIssues.length === 0) return null;

                return (
                  <div
                    id={`question-card-2-${idx}`}
                    key={q.id || idx}
                    onClick={() => setFocusedQuestion({ part: '2', index: idx })}
                    onFocus={() => setFocusedQuestion({ part: '2', index: idx })}
                    onPaste={(e) => handlePasteEvent(e, '2', idx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                      if (dragOverTarget?.part !== '2' || dragOverTarget?.index !== idx) {
                        setDragOverTarget({ part: '2', index: idx });
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverTarget(null);
                      }
                    }}
                    onDrop={(e) => handleDropApparatus(e, '2', idx)}
                    className={`bg-white rounded-xl border shadow-2xs p-5 transition-all relative ${
                      isOver
                        ? 'border-2 border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-400/25'
                        : hasError
                        ? 'border-rose-300 ring-2 ring-rose-100'
                        : qIssues.length > 0
                        ? 'border-amber-300 ring-2 ring-amber-100/70'
                        : isFocused
                        ? 'border-indigo-300 ring-2 ring-indigo-200/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {isOver && (
                      <div className="mb-3 py-1.5 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
                        <Move className="w-3.5 h-3.5" />
                        <span>
                          {draggingQuestion?.part === '2'
                            ? `🔢 Thả vào đây để đổi sang vị trí Câu ${idx + 1} và đánh số lại tự động!`
                            : `🎯 Thả dụng cụ thí nghiệm vào đây để gán vào Câu ${idx + 1}!`}
                        </span>
                      </div>
                    )}

                    <QuestionValidationBanner
                      issues={qIssues}
                      onAutoFixLatex={() => handleAutoFixQuestionLatex('2', idx)}
                    />

                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Drag Handle & Up/Down Reorder Controls */}
                        <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                          <div
                            draggable
                            onDragStart={(e) => handleQuestionDragStart(e, '2', idx)}
                            onDragEnd={handleQuestionDragEnd}
                            className="p-1 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing"
                            title="Kéo thả để thay đổi vị trí câu hỏi (tự động đánh số lại)"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveQuestion('2', idx, idx - 1)}
                            className="p-0.5 text-slate-500 hover:text-indigo-700 disabled:opacity-30 cursor-pointer"
                            title="Chuyển câu hỏi lên trên"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === part2.length - 1}
                            onClick={() => handleMoveQuestion('2', idx, idx + 1)}
                            className="p-0.5 text-slate-500 hover:text-indigo-700 disabled:opacity-30 cursor-pointer"
                            title="Chuyển câu hỏi xuống dưới"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="px-2.5 h-7 rounded-lg bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-xs">
                          Câu {idx + 1}
                        </span>
                        {q.id !== idx + 1 && (
                          <span
                            onClick={handleAutoRenumberAll}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer hover:bg-amber-200"
                            title="Nhấn để đánh số lại tự động"
                          >
                            Mã cũ #{q.id} → Đánh số lại
                          </span>
                        )}

                        <select
                          value={q.level}
                          onChange={(e) => {
                            const updated = [...part2];
                            updated[idx].level = e.target.value as CognitiveLevel;
                            onUpdatePart2(updated);
                          }}
                          className="text-xs font-semibold rounded-md px-2 py-1 border bg-indigo-50 text-indigo-700 border-indigo-200"
                        >
                          <option value="Biết">Mức: Biết (Nhận biết)</option>
                          <option value="Hiểu">Mức: Hiểu (Thông hiểu)</option>
                          <option value="Vận dụng">Mức: Vận dụng</option>
                          <option value="Vận dụng cao">Mức: Vận dụng cao</option>
                        </select>

                        <input
                          type="text"
                          value={q.topic || ''}
                          placeholder="Chủ đề..."
                          onChange={(e) => {
                            const updated = [...part2];
                            updated[idx].topic = e.target.value;
                            onUpdatePart2(updated);
                          }}
                          className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1 w-36"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {isFocused && (
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                            <Clipboard className="w-3 h-3 text-indigo-600" />
                            <span>Bấm Ctrl+V để dán ảnh vào đây</span>
                          </span>
                        )}

                        <button
                          onClick={() => handleDeleteQuestion('2', idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Xóa câu hỏi này và tự động đánh số lại"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Question stem */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Đoạn thông tin / ngữ cảnh tình huống của câu hỏi:
                      </label>
                      {previewMode ? (
                        <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-800 border border-slate-200">
                          <MathChemView content={q.content} />
                        </div>
                      ) : (
                        <>
                          <textarea
                            rows={3}
                            value={q.content}
                            onChange={(e) => {
                              const updated = [...part2];
                              updated[idx].content = e.target.value;
                              onUpdatePart2(updated);
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDropOnContentTextarea(e, '2', idx)}
                            onPaste={(e) => handlePasteEvent(e, '2', idx)}
                            className={`w-full text-sm border rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 ${
                              stemHasIssue
                                ? 'border-amber-400 bg-amber-50/30'
                                : 'border-slate-200'
                            }`}
                          />
                          {q.content?.includes('[svg:') && (
                            <div className="mt-2 p-2.5 bg-teal-50/50 border border-teal-200 rounded-lg">
                              <div className="text-[11px] font-semibold text-teal-800 mb-1">
                                Xem trước nội dung kèm hình vẽ SVG nhúng trong câu hỏi:
                              </div>
                              <div className="text-sm text-slate-800">
                                <MathChemView content={q.content} />
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Question Image Attachment & Dropzone */}
                    <QuestionImageBlock
                      imageUrl={q.imageUrl}
                      imageCaption={q.imageCaption}
                      questionNumber={idx + 1}
                      previewMode={previewMode}
                      isDragOver={isOver}
                      onDropApparatus={(e) => handleDropApparatus(e, '2', idx)}
                      onPasteImage={(file) => handleAttachImageFile(file, '2', idx)}
                      onManualPasteClick={() => handleManualPasteFromClipboard('2', idx)}
                      onOpenDraw={() => handleOpenDrawModal('2', idx, q.imageUrl, q.imageCaption)}
                      onOpenReactionBuilder={() => handleOpenReactionModal('2', idx, q.imageCaption)}
                      onRemove={() => handleRemoveQuestionImage('2', idx)}
                      onUpdateCaption={(caption) => handleUpdateQuestionCaption('2', idx, caption)}
                    />

                    {/* Items a, b, c, d */}
                    <div className="space-y-2.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Các mệnh đề và tính Đúng (Đ) / Sai (S):
                      </label>
                      {q.items.map((item, itemIdx) => {
                        const itemIssue = qIssues.find(
                          (i) => i.field === `item_${item.label}`
                        );
                        return (
                          <div
                            key={item.label}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                              itemIssue
                                ? itemIssue.severity === 'error'
                                  ? 'border-rose-400 bg-rose-50/60'
                                  : 'border-amber-400 bg-amber-50/60'
                                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-md font-bold flex items-center justify-center text-xs shrink-0 ${
                                itemIssue
                                  ? itemIssue.severity === 'error'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-amber-500 text-white'
                                  : 'bg-indigo-100 text-indigo-900'
                              }`}
                            >
                              {item.label})
                            </span>

                            <div className="flex-1">
                              {previewMode ? (
                                <div className="text-sm">
                                  <MathChemView content={item.text} />
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={item.text}
                                  placeholder={`Nhập nội dung mệnh đề ${item.label})...`}
                                  onChange={(e) => {
                                    const updated = [...part2];
                                    updated[idx].items[itemIdx].text = e.target.value;
                                    onUpdatePart2(updated);
                                  }}
                                  className="w-full text-sm border-0 bg-transparent p-0 focus:ring-0 text-slate-800"
                                />
                              )}
                            </div>

                            {itemIssue && (
                              <span title={itemIssue.message} className="shrink-0">
                                <AlertTriangle
                                  className={`w-4 h-4 ${
                                    itemIssue.severity === 'error'
                                      ? 'text-rose-600'
                                      : 'text-amber-600'
                                  }`}
                                />
                              </span>
                            )}

                            {/* True / False toggles */}
                            <div className="flex items-center bg-white rounded-lg p-0.5 border border-slate-200 shadow-2xs">
                              <button
                                onClick={() => {
                                  const updated = [...part2];
                                  updated[idx].items[itemIdx].isCorrect = true;
                                  onUpdatePart2(updated);
                                }}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                                  item.isCorrect
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-emerald-700'
                                }`}
                              >
                                ĐÚNG
                              </button>
                              <button
                                onClick={() => {
                                  const updated = [...part2];
                                  updated[idx].items[itemIdx].isCorrect = false;
                                  onUpdatePart2(updated);
                                }}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                                  !item.isCorrect
                                    ? 'bg-rose-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-rose-700'
                                }`}
                              >
                                SAI
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PART 3 QUESTIONS */}
          {activePart === '3' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-center justify-between">
                <span>
                  <strong>PHẦN III (Trắc nghiệm Trả lời ngắn):</strong> Thí sinh điền kết quả số (nguyên hoặc thập phân). Hỗ trợ dán ảnh (Ctrl+V) &amp; kéo thả dụng cụ!
                </span>
                <span className="font-bold">Tổng: {part3.length} câu ({(part3.length * 0.25).toFixed(2)} điểm)</span>
              </div>

              {part3.map((q, idx) => {
                const isOver = dragOverTarget?.part === '3' && dragOverTarget?.index === idx;
                const isFocused = focusedQuestion.part === '3' && focusedQuestion.index === idx;
                const qIssues = validationSummary.byQuestionKey[`3-${idx}`] || [];
                const hasError = qIssues.some((i) => i.severity === 'error');
                const stemHasIssue = qIssues.some((i) => i.field === 'content');
                const ansIssue = qIssues.find((i) => i.field === 'correctAnswer');

                if (showOnlyFlagged && qIssues.length === 0) return null;

                return (
                  <div
                    id={`question-card-3-${idx}`}
                    key={q.id || idx}
                    onClick={() => setFocusedQuestion({ part: '3', index: idx })}
                    onFocus={() => setFocusedQuestion({ part: '3', index: idx })}
                    onPaste={(e) => handlePasteEvent(e, '3', idx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                      if (dragOverTarget?.part !== '3' || dragOverTarget?.index !== idx) {
                        setDragOverTarget({ part: '3', index: idx });
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverTarget(null);
                      }
                    }}
                    onDrop={(e) => handleDropApparatus(e, '3', idx)}
                    className={`bg-white rounded-xl border shadow-2xs p-5 transition-all relative ${
                      isOver
                        ? 'border-2 border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-400/25'
                        : hasError
                        ? 'border-rose-300 ring-2 ring-rose-100'
                        : qIssues.length > 0
                        ? 'border-amber-300 ring-2 ring-amber-100/70'
                        : isFocused
                        ? 'border-emerald-300 ring-2 ring-emerald-200/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {isOver && (
                      <div className="mb-3 py-1.5 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
                        <Move className="w-3.5 h-3.5" />
                        <span>
                          {draggingQuestion?.part === '3'
                            ? `🔢 Thả vào đây để đổi sang vị trí Câu ${idx + 1} và đánh số lại tự động!`
                            : `🎯 Thả dụng cụ thí nghiệm vào đây để gán vào Câu ${idx + 1}!`}
                        </span>
                      </div>
                    )}

                    <QuestionValidationBanner
                      issues={qIssues}
                      onAutoFixLatex={() => handleAutoFixQuestionLatex('3', idx)}
                    />

                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Drag Handle & Up/Down Reorder Controls */}
                        <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                          <div
                            draggable
                            onDragStart={(e) => handleQuestionDragStart(e, '3', idx)}
                            onDragEnd={handleQuestionDragEnd}
                            className="p-1 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing"
                            title="Kéo thả để thay đổi vị trí câu hỏi (tự động đánh số lại)"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveQuestion('3', idx, idx - 1)}
                            className="p-0.5 text-slate-500 hover:text-emerald-700 disabled:opacity-30 cursor-pointer"
                            title="Chuyển câu hỏi lên trên"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === part3.length - 1}
                            onClick={() => handleMoveQuestion('3', idx, idx + 1)}
                            className="p-0.5 text-slate-500 hover:text-emerald-700 disabled:opacity-30 cursor-pointer"
                            title="Chuyển câu hỏi xuống dưới"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="px-2.5 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                          Câu {idx + 1}
                        </span>
                        {q.id !== idx + 1 && (
                          <span
                            onClick={handleAutoRenumberAll}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer hover:bg-amber-200"
                            title="Nhấn để đánh số lại tự động"
                          >
                            Mã cũ #{q.id} → Đánh số lại
                          </span>
                        )}

                        <select
                          value={q.level}
                          onChange={(e) => {
                            const updated = [...part3];
                            updated[idx].level = e.target.value as CognitiveLevel;
                            onUpdatePart3(updated);
                          }}
                          className="text-xs font-semibold rounded-md px-2 py-1 border bg-emerald-50 text-emerald-700 border-emerald-200"
                        >
                          <option value="Biết">Mức: Biết (Nhận biết)</option>
                          <option value="Hiểu">Mức: Hiểu (Thông hiểu)</option>
                          <option value="Vận dụng">Mức: Vận dụng</option>
                          <option value="Vận dụng cao">Mức: Vận dụng cao</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        {isFocused && (
                          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                            <Clipboard className="w-3 h-3 text-emerald-600" />
                            <span>Bấm Ctrl+V để dán ảnh vào đây</span>
                          </span>
                        )}

                        <button
                          onClick={() => handleGenerateExplanation(q.id, '3', q)}
                          disabled={explainingId === `3-${q.id}`}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{explainingId === `3-${q.id}` ? 'Đang viết...' : 'AI Lời Giải'}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteQuestion('3', idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Xóa câu hỏi này và tự động đánh số lại"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Question stem */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Nội dung câu hỏi yêu cầu điền kết quả:
                      </label>
                      {previewMode ? (
                        <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-800 border border-slate-200">
                          <MathChemView content={q.content} />
                        </div>
                      ) : (
                        <>
                          <textarea
                            rows={2}
                            value={q.content}
                            onChange={(e) => {
                              const updated = [...part3];
                              updated[idx].content = e.target.value;
                              onUpdatePart3(updated);
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDropOnContentTextarea(e, '3', idx)}
                            onPaste={(e) => handlePasteEvent(e, '3', idx)}
                            className={`w-full text-sm border rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 ${
                              stemHasIssue
                                ? 'border-amber-400 bg-amber-50/30'
                                : 'border-slate-200'
                            }`}
                          />
                          {q.content?.includes('[svg:') && (
                            <div className="mt-2 p-2.5 bg-teal-50/50 border border-teal-200 rounded-lg">
                              <div className="text-[11px] font-semibold text-teal-800 mb-1">
                                Xem trước nội dung kèm hình vẽ SVG nhúng trong câu hỏi:
                              </div>
                              <div className="text-sm text-slate-800">
                                <MathChemView content={q.content} />
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Question Image Attachment & Dropzone */}
                    <QuestionImageBlock
                      imageUrl={q.imageUrl}
                      imageCaption={q.imageCaption}
                      questionNumber={idx + 1}
                      previewMode={previewMode}
                      isDragOver={isOver}
                      onDropApparatus={(e) => handleDropApparatus(e, '3', idx)}
                      onPasteImage={(file) => handleAttachImageFile(file, '3', idx)}
                      onManualPasteClick={() => handleManualPasteFromClipboard('3', idx)}
                      onOpenDraw={() => handleOpenDrawModal('3', idx, q.imageUrl, q.imageCaption)}
                      onOpenReactionBuilder={() => handleOpenReactionModal('3', idx, q.imageCaption)}
                      onRemove={() => handleRemoveQuestionImage('3', idx)}
                      onUpdateCaption={(caption) => handleUpdateQuestionCaption('3', idx, caption)}
                    />

                    {/* Correct answer & unit */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                          ansIssue
                            ? ansIssue.severity === 'error'
                              ? 'bg-rose-50 border-rose-400'
                              : 'bg-amber-50 border-amber-400'
                            : 'bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        <span
                          className={`text-xs font-bold ${
                            ansIssue
                              ? ansIssue.severity === 'error'
                                ? 'text-rose-800'
                                : 'text-amber-800'
                              : 'text-emerald-800'
                          }`}
                        >
                          Đáp án chuẩn:
                        </span>
                        <input
                          type="text"
                          value={q.correctAnswer}
                          placeholder="vd: 12,5"
                          onChange={(e) => {
                            const updated = [...part3];
                            updated[idx].correctAnswer = e.target.value;
                            onUpdatePart3(updated);
                          }}
                          className={`w-28 text-sm font-bold bg-white border rounded px-2 py-1 text-emerald-950 focus:ring-2 focus:ring-emerald-500 ${
                            ansIssue
                              ? ansIssue.severity === 'error'
                                ? 'border-rose-400'
                                : 'border-amber-400'
                              : 'border-emerald-300'
                          }`}
                        />
                        {ansIssue && (
                          <span title={ansIssue.message} className="shrink-0">
                            <AlertTriangle
                              className={`w-4 h-4 ${
                                ansIssue.severity === 'error'
                                  ? 'text-rose-600'
                                  : 'text-amber-600'
                              }`}
                            />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                        <span className="text-xs font-medium text-slate-600">Đơn vị:</span>
                        <input
                          type="text"
                          value={q.unit || ''}
                          placeholder="vd: gam, ml, %"
                          onChange={(e) => {
                            const updated = [...part3];
                            updated[idx].unit = e.target.value;
                            onUpdatePart3(updated);
                          }}
                          className="w-24 text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-700"
                        />
                      </div>
                    </div>

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700">
                        <span className="font-semibold">Lời giải: </span>
                        {previewMode ? (
                          <div className="mt-1">
                            <MathChemView content={q.explanation} />
                          </div>
                        ) : (
                          <textarea
                            rows={2}
                            value={q.explanation}
                            onChange={(e) => {
                              const updated = [...part3];
                              updated[idx].explanation = e.target.value;
                              onUpdatePart3(updated);
                            }}
                            className="w-full text-xs border border-slate-200 bg-white rounded p-1.5 mt-1"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ESSAY QUESTIONS */}
          {activePart === 'essay' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-900 flex items-center justify-between">
                <span>
                  <strong>PHẦN TỰ LUẬN:</strong> Thường chiếm 30% tổng điểm (3.0 điểm) trong đề kiểm tra định kỳ theo Công văn 7991. Hỗ trợ dán ảnh (Ctrl+V) &amp; kéo thả dụng cụ!
                </span>
                <span className="font-bold">Tổng: {essay.length} câu</span>
              </div>

              {essay.map((q, idx) => {
                const isOver = dragOverTarget?.part === 'essay' && dragOverTarget?.index === idx;
                const isFocused = focusedQuestion.part === 'essay' && focusedQuestion.index === idx;
                const qIssues = validationSummary.byQuestionKey[`essay-${idx}`] || [];
                const hasError = qIssues.some((i) => i.severity === 'error');

                if (showOnlyFlagged && qIssues.length === 0) return null;

                return (
                  <div
                    id={`question-card-essay-${idx}`}
                    key={q.id || idx}
                    onClick={() => setFocusedQuestion({ part: 'essay', index: idx })}
                    onFocus={() => setFocusedQuestion({ part: 'essay', index: idx })}
                    onPaste={(e) => handlePasteEvent(e, 'essay', idx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                      if (dragOverTarget?.part !== 'essay' || dragOverTarget?.index !== idx) {
                        setDragOverTarget({ part: 'essay', index: idx });
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverTarget(null);
                      }
                    }}
                    onDrop={(e) => handleDropApparatus(e, 'essay', idx)}
                    className={`bg-white rounded-xl border shadow-2xs p-5 transition-all relative ${
                      isOver
                        ? 'border-2 border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-400/25'
                        : hasError
                        ? 'border-rose-300 ring-2 ring-rose-100'
                        : qIssues.length > 0
                        ? 'border-amber-300 ring-2 ring-amber-100/70'
                        : isFocused
                        ? 'border-purple-300 ring-2 ring-purple-200/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {isOver && (
                      <div className="mb-3 py-1.5 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
                        <Move className="w-3.5 h-3.5" />
                        <span>
                          {draggingQuestion?.part === 'essay'
                            ? `🔢 Thả vào đây để đổi sang vị trí Câu ${idx + 1} và đánh số lại tự động!`
                            : `🎯 Thả dụng cụ thí nghiệm vào đây để gán vào Câu ${idx + 1}!`}
                        </span>
                      </div>
                    )}

                    <QuestionValidationBanner
                      issues={qIssues}
                      onAutoFixLatex={() => handleAutoFixQuestionLatex('essay', idx)}
                    />

                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Drag Handle & Up/Down Reorder Controls */}
                        <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                          <div
                            draggable
                            onDragStart={(e) => handleQuestionDragStart(e, 'essay', idx)}
                            onDragEnd={handleQuestionDragEnd}
                            className="p-1 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing"
                            title="Kéo thả để thay đổi vị trí câu hỏi (tự động đánh số lại)"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveQuestion('essay', idx, idx - 1)}
                            className="p-0.5 text-slate-500 hover:text-purple-700 disabled:opacity-30 cursor-pointer"
                            title="Chuyển câu hỏi lên trên"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === essay.length - 1}
                            onClick={() => handleMoveQuestion('essay', idx, idx + 1)}
                            className="p-0.5 text-slate-500 hover:text-purple-700 disabled:opacity-30 cursor-pointer"
                            title="Chuyển câu hỏi xuống dưới"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="px-2.5 h-7 rounded-lg bg-purple-100 text-purple-800 font-bold flex items-center justify-center text-xs">
                          Câu {idx + 1}
                        </span>
                        {q.id !== idx + 1 && (
                          <span
                            onClick={handleAutoRenumberAll}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer hover:bg-amber-200"
                            title="Nhấn để đánh số lại tự động"
                          >
                            Mã cũ #{q.id} → Đánh số lại
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                          <span>Điểm:</span>
                          <input
                            type="number"
                            step="0.25"
                            min="0.25"
                            value={q.points}
                            onChange={(e) => {
                              const updated = [...essay];
                              updated[idx].points = Number(e.target.value);
                              onUpdateEssay(updated);
                            }}
                            className="w-12 bg-white text-center font-bold border border-purple-200 rounded"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isFocused && (
                          <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1">
                            <Clipboard className="w-3 h-3 text-purple-600" />
                            <span>Bấm Ctrl+V để dán ảnh vào đây</span>
                          </span>
                        )}

                        <button
                          onClick={() => handleDeleteQuestion('essay', idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Xóa câu hỏi này và tự động đánh số lại"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Essay Content */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Đề bài câu hỏi tự luận:
                      </label>
                      {previewMode ? (
                        <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-800 border border-slate-200">
                          <MathChemView content={q.content} />
                        </div>
                      ) : (
                        <>
                          <textarea
                            rows={3}
                            value={q.content}
                            onChange={(e) => {
                              const updated = [...essay];
                              updated[idx].content = e.target.value;
                              onUpdateEssay(updated);
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDropOnContentTextarea(e, 'essay', idx)}
                            onPaste={(e) => handlePasteEvent(e, 'essay', idx)}
                            className="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500"
                          />
                          {q.content?.includes('[svg:') && (
                            <div className="mt-2 p-2.5 bg-teal-50/50 border border-teal-200 rounded-lg">
                              <div className="text-[11px] font-semibold text-teal-800 mb-1">
                                Xem trước nội dung kèm hình vẽ SVG nhúng trong câu hỏi:
                              </div>
                              <div className="text-sm text-slate-800">
                                <MathChemView content={q.content} />
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Question Image Attachment & Dropzone */}
                    <QuestionImageBlock
                      imageUrl={q.imageUrl}
                      imageCaption={q.imageCaption}
                      questionNumber={idx + 1}
                      previewMode={previewMode}
                      isDragOver={isOver}
                      onDropApparatus={(e) => handleDropApparatus(e, 'essay', idx)}
                      onPasteImage={(file) => handleAttachImageFile(file, 'essay', idx)}
                      onManualPasteClick={() => handleManualPasteFromClipboard('essay', idx)}
                      onOpenDraw={() => handleOpenDrawModal('essay', idx, q.imageUrl, q.imageCaption)}
                      onOpenReactionBuilder={() => handleOpenReactionModal('essay', idx, q.imageCaption)}
                      onRemove={() => handleRemoveQuestionImage('essay', idx)}
                      onUpdateCaption={(caption) => handleUpdateQuestionCaption('essay', idx, caption)}
                    />

                    {/* Scoring Guide */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Hướng dẫn chấm & Thang điểm chi tiết (Barem):
                      </label>
                      <textarea
                        rows={3}
                        value={q.guide}
                        onChange={(e) => {
                          const updated = [...essay];
                          updated[idx].guide = e.target.value;
                          onUpdateEssay(updated);
                        }}
                        className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50/50"
                        placeholder="Ý 1 (0.5đ): ...; Ý 2 (0.5đ): ..."
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Docked Laboratory Toolbox (if open) */}
        {isToolboxOpen && (
          <div className="w-full lg:w-80 xl:w-[380px] shrink-0">
            <LaboratoryToolbox
              onInsertToQuestion={handleInsertApparatusFromToolbox}
              onOpenInDrawModal={handleOpenDrawModalWithApparatus}
              currentActiveQuestion={{ part: activePart, index: focusedQuestion.index }}
              onToggleCollapse={() => setIsToolboxOpen(false)}
              totalQuestions={{
                part1: part1.length,
                part2: part2.length,
                part3: part3.length,
                essay: essay.length,
              }}
            />
          </div>
        )}

        {/* Collapsed floating tab button on right edge */}
        {!isToolboxOpen && (
          <LaboratoryToolbox
            isCollapsed={true}
            onToggleCollapse={() => setIsToolboxOpen(true)}
          />
        )}
      </div>
        </>
      )}

      {/* Chemistry Diagram Studio Modal */}
      {drawModalOpen && (
        <ChemistryDrawModal
          isOpen={drawModalOpen}
          initialImage={currentDrawTarget?.initialImage}
          initialCaption={currentDrawTarget?.initialCaption}
          onClose={() => {
            setDrawModalOpen(false);
            setCurrentDrawTarget(null);
          }}
          onSave={handleSaveImageFromModal}
        />
      )}

      {/* ReactionBuilder Transformation Scheme Modal */}
      {reactionModalOpen && (
        <ReactionBuilderModal
          isOpen={reactionModalOpen}
          questionNumber={currentReactionTarget ? currentReactionTarget.index + 1 : undefined}
          initialCaption={currentReactionTarget?.initialCaption}
          onClose={() => {
            setReactionModalOpen(false);
            setCurrentReactionTarget(null);
          }}
          onSaveToQuestion={handleSaveReactionFromModal}
        />
      )}
    </div>
  );
};
