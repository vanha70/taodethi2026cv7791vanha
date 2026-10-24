import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Packer,
  ImageRun,
} from 'docx';
import { ExamData, ShuffledExamCode } from '../types/exam';

export interface WordExportOptions {
  includeExamQuestions: boolean;
  includeSectionInstructions: boolean;
  includeMatrix: boolean;
  includeSpecification: boolean;
  includeAnswerKeyTable: boolean;
  includeDetailedExplanations: boolean;
}

export const DEFAULT_WORD_EXPORT_OPTIONS: WordExportOptions = {
  includeExamQuestions: true,
  includeSectionInstructions: true,
  includeMatrix: true,
  includeSpecification: true,
  includeAnswerKeyTable: true,
  includeDetailedExplanations: true,
};

function base64ToUint8Array(base64: string): Uint8Array {
  const commaIdx = base64.indexOf(',');
  const rawBase64 = commaIdx !== -1 ? base64.slice(commaIdx + 1) : base64;
  const binaryString = atob(rawBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createImageParagraphs(
  imageUrl: string,
  caption?: string,
  defaultFont: string = 'Times New Roman'
): Paragraph[] {
  try {
    const bytes = base64ToUint8Array(imageUrl);
    const paragraphs: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: bytes,
            transformation: {
              width: 340,
              height: 220,
            },
            type: 'png',
          }),
        ],
        spacing: { before: 80, after: caption ? 40 : 100 },
      }),
    ];

    if (caption) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: caption,
              font: defaultFont,
              italics: true,
              size: 19,
            }),
          ],
          spacing: { after: 120 },
        })
      );
    }
    return paragraphs;
  } catch (err) {
    console.warn('Could not embed image into DOCX:', err);
    return [];
  }
}

function createCell(
  text: string,
  options?: {
    bold?: boolean;
    italics?: boolean;
    color?: string;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    defaultFont?: string;
  }
): TableCell {
  const font = options?.defaultFont || 'Times New Roman';
  return new TableCell({
    children: [
      new Paragraph({
        alignment: options?.align || AlignmentType.CENTER,
        children: [
          new TextRun({
            text,
            bold: options?.bold,
            italics: options?.italics,
            color: options?.color,
            font,
            size: options?.size || 19,
          }),
        ],
        spacing: { before: 40, after: 40 },
      }),
    ],
  });
}

export function buildExamCodeChildren(
  exam: ExamData,
  shuffledCode?: ShuffledExamCode,
  opts: WordExportOptions = DEFAULT_WORD_EXPORT_OPTIONS
): (Paragraph | Table)[] {
  const meta = exam.metadata;
  const currentCode = shuffledCode ? shuffledCode.code : meta.examCode || '101';
  const part1Questions = shuffledCode ? shuffledCode.part1 : exam.part1;
  const part2Questions = shuffledCode ? shuffledCode.part2 : exam.part2;
  const part3Questions = shuffledCode ? shuffledCode.part3 : exam.part3;
  const essayQuestions = shuffledCode ? shuffledCode.essay : exam.essay;

  const children: (Paragraph | Table)[] = [];
  const defaultFont = 'Times New Roman';

  // 1. HEADER TABLE (Left: School / Department, Right: Exam Title / Code)
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: meta.schoolName.toUpperCase(),
                    font: defaultFont,
                    size: 22,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: meta.departmentName.toUpperCase(),
                    font: defaultFont,
                    size: 20,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: '------------------------',
                    font: defaultFont,
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: meta.examTitle.toUpperCase(),
                    font: defaultFont,
                    size: 22,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${meta.academicYear} - MÔN: ${meta.subject.toUpperCase()}`,
                    font: defaultFont,
                    size: 20,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `Thời gian làm bài: ${meta.durationMinutes} phút (Không kể phát đề)`,
                    font: defaultFont,
                    size: 18,
                    italics: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `Mã đề thi: ${currentCode}`,
                    font: defaultFont,
                    size: 20,
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  children.push(headerTable);
  children.push(new Paragraph({ text: '', spacing: { after: 160 } }));

  // ============================================================================
  // OPTIONAL SECTION A: BẢNG MA TRẬN ĐỀ KIỂM TRA (CÔNG VĂN 7991)
  // ============================================================================
  if (opts.includeMatrix && exam.matrix && exam.matrix.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: 'BẢNG MA TRẬN ĐỀ KIỂM TRA ĐỊNH KỲ (THEO CÔNG VĂN 7991/BGDĐT-GDTrH)',
            bold: true,
            font: defaultFont,
            size: 23,
          }),
        ],
        spacing: { before: 120, after: 140 },
      })
    );

    const matrixHeaderRow = new TableRow({
      children: [
        createCell('TT', { bold: true }),
        createCell('Chủ đề / Nội dung kiến thức', { bold: true }),
        createCell('P.I Biết', { bold: true }),
        createCell('P.I Hiểu', { bold: true }),
        createCell('P.I VD', { bold: true }),
        createCell('P.II Biết', { bold: true }),
        createCell('P.II Hiểu', { bold: true }),
        createCell('P.II VD', { bold: true }),
        createCell('P.III Biết', { bold: true }),
        createCell('P.III Hiểu', { bold: true }),
        createCell('P.III VD', { bold: true }),
        createCell('Tự luận (đ)', { bold: true }),
        createCell('Tổng điểm', { bold: true }),
      ],
    });

    const matrixDataRows = exam.matrix.map((row, idx) => {
      return new TableRow({
        children: [
          createCell(String(idx + 1)),
          createCell(row.topic, { align: AlignmentType.LEFT }),
          createCell(String(row.knowPart1 || 0)),
          createCell(String(row.understandPart1 || 0)),
          createCell(String(row.applyPart1 || 0)),
          createCell(String(row.knowPart2 || 0)),
          createCell(String(row.understandPart2 || 0)),
          createCell(String(row.applyPart2 || 0)),
          createCell(String(row.knowPart3 || 0)),
          createCell(String(row.understandPart3 || 0)),
          createCell(String(row.applyPart3 || 0)),
          createCell(String(row.essayScore || 0)),
          createCell(String(row.totalPoints || 0), { bold: true }),
        ],
      });
    });

    const totals = exam.matrix.reduce(
      (acc, r) => ({
        kp1: acc.kp1 + Number(r.knowPart1 || 0),
        up1: acc.up1 + Number(r.understandPart1 || 0),
        ap1: acc.ap1 + Number(r.applyPart1 || 0),
        kp2: acc.kp2 + Number(r.knowPart2 || 0),
        up2: acc.up2 + Number(r.understandPart2 || 0),
        ap2: acc.ap2 + Number(r.applyPart2 || 0),
        kp3: acc.kp3 + Number(r.knowPart3 || 0),
        up3: acc.up3 + Number(r.understandPart3 || 0),
        ap3: acc.ap3 + Number(r.applyPart3 || 0),
        essay: acc.essay + Number(r.essayScore || 0),
        total: acc.total + Number(r.totalPoints || 0),
      }),
      { kp1: 0, up1: 0, ap1: 0, kp2: 0, up2: 0, ap2: 0, kp3: 0, up3: 0, ap3: 0, essay: 0, total: 0 }
    );

    const matrixTotalRow = new TableRow({
      children: [
        createCell('', { bold: true }),
        createCell('TỔNG CỘNG', { bold: true }),
        createCell(String(totals.kp1), { bold: true }),
        createCell(String(totals.up1), { bold: true }),
        createCell(String(totals.ap1), { bold: true }),
        createCell(String(totals.kp2), { bold: true }),
        createCell(String(totals.up2), { bold: true }),
        createCell(String(totals.ap2), { bold: true }),
        createCell(String(totals.kp3), { bold: true }),
        createCell(String(totals.up3), { bold: true }),
        createCell(String(totals.ap3), { bold: true }),
        createCell(totals.essay.toFixed(2), { bold: true }),
        createCell(totals.total.toFixed(2), { bold: true, color: '0000FF' }),
      ],
    });

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [matrixHeaderRow, ...matrixDataRows, matrixTotalRow],
      })
    );
    children.push(new Paragraph({ text: '', spacing: { after: 240 } }));
  }

  // ============================================================================
  // OPTIONAL SECTION B: BẢN ĐẶC TẢ ĐỀ KIỂM TRA (CÔNG VĂN 7991)
  // ============================================================================
  if (opts.includeSpecification && exam.specification && exam.specification.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: 'BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KỲ (THEO CÔNG VĂN 7991/BGDĐT-GDTrH)',
            bold: true,
            font: defaultFont,
            size: 23,
          }),
        ],
        spacing: { before: 120, after: 140 },
      })
    );

    const specHeaderRow = new TableRow({
      children: [
        createCell('TT', { bold: true }),
        createCell('Chủ đề / Nội dung', { bold: true }),
        createCell('Yêu cầu cần đạt (GDPT 2018)', { bold: true }),
        createCell('Mức Biết', { bold: true }),
        createCell('Mức Hiểu', { bold: true }),
        createCell('Mức Vận dụng', { bold: true }),
        createCell('Vị trí câu hỏi', { bold: true }),
      ],
    });

    const specDataRows = exam.specification.map((spec, idx) => {
      return new TableRow({
        children: [
          createCell(String(idx + 1)),
          createCell(spec.topic, { align: AlignmentType.LEFT, bold: true }),
          createCell(spec.competency, { align: AlignmentType.LEFT }),
          createCell(spec.knowDesc || '-', { align: AlignmentType.LEFT }),
          createCell(spec.understandDesc || '-', { align: AlignmentType.LEFT }),
          createCell(spec.applyDesc || '-', { align: AlignmentType.LEFT }),
          createCell(spec.questionMapping || '-'),
        ],
      });
    });

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [specHeaderRow, ...specDataRows],
      })
    );
    children.push(new Paragraph({ text: '', spacing: { after: 280 } }));
  }

  // ============================================================================
  // MAIN SECTION: NỘI DUNG ĐỀ THI CHÍNH THỨC
  // ============================================================================
  if (opts.includeExamQuestions) {
    // Student info line (included when section instructions are enabled)
    if (opts.includeSectionInstructions) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Họ và tên thí sinh: ....................................................................... ',
              font: defaultFont,
              size: 20,
            }),
            new TextRun({
              text: 'Số báo danh: .............................',
              font: defaultFont,
              size: 20,
            }),
          ],
          spacing: { after: 240 },
        })
      );
    }

    // 2. PHẦN I
    if (part1Questions.length > 0) {
      children.push(
        new Paragraph({
          children: opts.includeSectionInstructions
            ? [
                new TextRun({
                  text: 'PHẦN I. Thí sinh trả lời từ câu 1 đến câu ' + part1Questions.length + '. ',
                  font: defaultFont,
                  bold: true,
                  size: 22,
                }),
                new TextRun({
                  text: 'Mỗi câu hỏi thí sinh chỉ chọn một phương án.',
                  font: defaultFont,
                  italics: true,
                  size: 20,
                }),
              ]
            : [
                new TextRun({
                  text: `PHẦN I (Từ câu 1 đến câu ${part1Questions.length})`,
                  font: defaultFont,
                  bold: true,
                  size: 22,
                }),
              ],
          spacing: { before: 180, after: 140 },
        })
      );

      part1Questions.forEach((q, idx) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Câu ${idx + 1}. `,
                bold: true,
                font: defaultFont,
                size: 21,
              }),
              new TextRun({
                text: q.content,
                font: defaultFont,
                size: 21,
              }),
            ],
            spacing: { before: 100, after: 60 },
          })
        );

        // Attached image if present
        if (q.imageUrl) {
          children.push(...createImageParagraphs(q.imageUrl, q.imageCaption, defaultFont));
        }

        // Options
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'A. ', bold: true, font: defaultFont, size: 20 }),
              new TextRun({ text: `${q.options.A}         `, font: defaultFont, size: 20 }),
              new TextRun({ text: 'B. ', bold: true, font: defaultFont, size: 20 }),
              new TextRun({ text: `${q.options.B}         `, font: defaultFont, size: 20 }),
              new TextRun({ text: 'C. ', bold: true, font: defaultFont, size: 20 }),
              new TextRun({ text: `${q.options.C}         `, font: defaultFont, size: 20 }),
              new TextRun({ text: 'D. ', bold: true, font: defaultFont, size: 20 }),
              new TextRun({ text: `${q.options.D}`, font: defaultFont, size: 20 }),
            ],
            indent: { left: 360 },
            spacing: { after: 120 },
          })
        );
      });
    }

    // 3. PHẦN II
    if (part2Questions.length > 0) {
      children.push(
        new Paragraph({
          children: opts.includeSectionInstructions
            ? [
                new TextRun({
                  text: 'PHẦN II. Thí sinh trả lời từ câu 1 đến câu ' + part2Questions.length + '. ',
                  font: defaultFont,
                  bold: true,
                  size: 22,
                }),
                new TextRun({
                  text: 'Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.',
                  font: defaultFont,
                  italics: true,
                  size: 20,
                }),
              ]
            : [
                new TextRun({
                  text: `PHẦN II (Từ câu 1 đến câu ${part2Questions.length})`,
                  font: defaultFont,
                  bold: true,
                  size: 22,
                }),
              ],
          spacing: { before: 240, after: 140 },
        })
      );

      part2Questions.forEach((q, idx) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Câu ${idx + 1}. `,
                bold: true,
                font: defaultFont,
                size: 21,
              }),
              new TextRun({
                text: q.content,
                font: defaultFont,
                size: 21,
              }),
            ],
            spacing: { before: 100, after: 60 },
          })
        );

        // Attached image if present
        if (q.imageUrl) {
          children.push(...createImageParagraphs(q.imageUrl, q.imageCaption, defaultFont));
        }

        q.items.forEach((item) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${item.label}) `,
                  bold: true,
                  font: defaultFont,
                  size: 20,
                }),
                new TextRun({
                  text: item.text,
                  font: defaultFont,
                  size: 20,
                }),
              ],
              indent: { left: 400 },
              spacing: { after: 40 },
            })
          );
        });
        children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
      });
    }

    // 4. PHẦN III
    if (part3Questions.length > 0) {
      children.push(
        new Paragraph({
          children: opts.includeSectionInstructions
            ? [
                new TextRun({
                  text: 'PHẦN III. Thí sinh trả lời từ câu 1 đến câu ' + part3Questions.length + '. ',
                  font: defaultFont,
                  bold: true,
                  size: 22,
                }),
                new TextRun({
                  text: 'Mỗi câu hỏi thí sinh viết câu trả lời vào ô tương ứng trên phiếu làm bài.',
                  font: defaultFont,
                  italics: true,
                  size: 20,
                }),
              ]
            : [
                new TextRun({
                  text: `PHẦN III (Từ câu 1 đến câu ${part3Questions.length})`,
                  font: defaultFont,
                  bold: true,
                  size: 22,
                }),
              ],
          spacing: { before: 240, after: 140 },
        })
      );

      part3Questions.forEach((q, idx) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Câu ${idx + 1}. `,
                bold: true,
                font: defaultFont,
                size: 21,
              }),
              new TextRun({
                text: q.content,
                font: defaultFont,
                size: 21,
              }),
            ],
            spacing: { before: 100, after: 100 },
          })
        );

        // Attached image if present
        if (q.imageUrl) {
          children.push(...createImageParagraphs(q.imageUrl, q.imageCaption, defaultFont));
        }
      });
    }

    // 5. PHẦN TỰ LUẬN
    if (essayQuestions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: opts.includeSectionInstructions
                ? 'PHẦN IV. TỰ LUẬN (Dành cho kiểm tra định kỳ theo CV 7991)'
                : 'PHẦN IV. TỰ LUẬN',
              font: defaultFont,
              bold: true,
              size: 22,
            }),
          ],
          spacing: { before: 240, after: 140 },
        })
      );

      essayQuestions.forEach((q, idx) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Câu ${idx + 1} (${q.points} điểm). `,
                bold: true,
                font: defaultFont,
                size: 21,
              }),
              new TextRun({
                text: q.content,
                font: defaultFont,
                size: 21,
              }),
            ],
            spacing: { before: 100, after: 120 },
          })
        );

        // Attached image if present
        if (q.imageUrl) {
          children.push(...createImageParagraphs(q.imageUrl, q.imageCaption, defaultFont));
        }
      });
    }

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: '---------- HẾT ----------',
            bold: true,
            font: defaultFont,
            size: 22,
          }),
        ],
        spacing: { before: 300, after: 300 },
      })
    );
  }

  // ============================================================================
  // OPTIONAL SECTION C: BẢNG ĐÁP ÁN & LỜI GIẢI CHI TIẾT
  // ============================================================================
  if (opts.includeAnswerKeyTable || opts.includeDetailedExplanations) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM (MÃ ĐỀ ${currentCode})`,
            bold: true,
            font: defaultFont,
            size: 24,
          }),
        ],
        spacing: { before: 400, after: 200 },
      })
    );

    if (opts.includeAnswerKeyTable) {
      // Part 1 Answers
      if (part1Questions.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '1. ĐÁP ÁN PHẦN I (Mỗi câu đúng được 0.25 điểm)',
                bold: true,
                font: defaultFont,
                size: 21,
              }),
            ],
            spacing: { before: 100, after: 80 },
          })
        );

        const p1Rows: TableRow[] = [];
        for (let i = 0; i < part1Questions.length; i += 6) {
          const slice = part1Questions.slice(i, i + 6);
          p1Rows.push(
            new TableRow({
              children: slice.map(
                (q, qIdx) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: `Câu ${i + qIdx + 1}: `,
                            font: defaultFont,
                            size: 20,
                          }),
                          new TextRun({
                            text: q.correctAnswer,
                            bold: true,
                            font: defaultFont,
                            size: 20,
                            color: '0000FF',
                          }),
                        ],
                      }),
                    ],
                  })
              ),
            })
          );
        }

        if (p1Rows.length > 0) {
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: p1Rows,
            })
          );
        }
      }

      // Part 2 Answers
      if (part2Questions.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '2. ĐÁP ÁN PHẦN II (Thang điểm: Đúng 1 ý = 0.1đ; 2 ý = 0.25đ; 3 ý = 0.5đ; 4 ý = 1.0đ)',
                bold: true,
                font: defaultFont,
                size: 21,
              }),
            ],
            spacing: { before: 180, after: 80 },
          })
        );

        const p2Rows: TableRow[] = [
          new TableRow({
            children: [
              createCell('Câu', { bold: true, size: 20 }),
              createCell('Lệnh hỏi a', { bold: true, size: 20 }),
              createCell('Lệnh hỏi b', { bold: true, size: 20 }),
              createCell('Lệnh hỏi c', { bold: true, size: 20 }),
              createCell('Lệnh hỏi d', { bold: true, size: 20 }),
            ],
          }),
        ];

        part2Questions.forEach((q, idx) => {
          p2Rows.push(
            new TableRow({
              children: [
                createCell(`Câu ${idx + 1}`, { bold: true, size: 20 }),
                ...q.items.map((item) =>
                  createCell(item.isCorrect ? 'Đ' : 'S', {
                    bold: true,
                    size: 20,
                    color: item.isCorrect ? '008000' : 'CC0000',
                  })
                ),
              ],
            })
          );
        });

        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: p2Rows,
          })
        );
      }

      // Part 3 Answers
      if (part3Questions.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '3. ĐÁP ÁN PHẦN III (Trả lời ngắn)',
                bold: true,
                font: defaultFont,
                size: 21,
              }),
            ],
            spacing: { before: 180, after: 80 },
          })
        );

        const p3Rows: TableRow[] = [
          new TableRow({
            children: part3Questions.map(
              (q, idx) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: `Câu ${idx + 1}`, bold: true, font: defaultFont, size: 20 })],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: q.correctAnswer + (q.unit ? ` (${q.unit})` : ''),
                          bold: true,
                          font: defaultFont,
                          size: 20,
                          color: '0000FF',
                        }),
                      ],
                    }),
                  ],
                })
            ),
          }),
        ];

        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: p3Rows,
          })
        );
      }
    }

    // Detailed explanations & Essay scoring guide
    if (opts.includeDetailedExplanations) {
      // Essay Guide
      if (essayQuestions.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '4. HƯỚNG DẪN CHẤM PHẦN TỰ LUẬN CHI TIẾT',
                bold: true,
                font: defaultFont,
                size: 21,
              }),
            ],
            spacing: { before: 200, after: 80 },
          })
        );

        essayQuestions.forEach((q, idx) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Câu ${idx + 1} (${q.points} điểm): `,
                  bold: true,
                  font: defaultFont,
                  size: 20,
                }),
                new TextRun({
                  text: q.guide || 'Chưa cập nhật hướng dẫn chấm.',
                  font: defaultFont,
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            })
          );
        });
      }

      // Detailed step-by-step explanations for Part I, II, III
      const hasPart1Explanations = part1Questions.some((q) => q.explanation && q.explanation.trim());
      const hasPart2Explanations = part2Questions.some((q) =>
        q.items.some((it) => it.explanation && it.explanation.trim())
      );
      const hasPart3Explanations = part3Questions.some((q) => q.explanation && q.explanation.trim());

      if (hasPart1Explanations || hasPart2Explanations || hasPart3Explanations) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '5. LỜI GIẢI CHI TIẾT CÁC CÂU HỎI TRẮC NGHIỆM',
                bold: true,
                font: defaultFont,
                size: 21,
              }),
            ],
            spacing: { before: 200, after: 100 },
          })
        );

        // Part 1 detailed explanations
        if (hasPart1Explanations) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'A. Giải chi tiết Phần I:',
                  bold: true,
                  italics: true,
                  font: defaultFont,
                  size: 20,
                }),
              ],
              spacing: { before: 80, after: 60 },
            })
          );

          part1Questions.forEach((q, idx) => {
            if (!q.explanation || !q.explanation.trim()) return;
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Câu ${idx + 1} (Chọn ${q.correctAnswer}): `,
                    bold: true,
                    font: defaultFont,
                    size: 20,
                  }),
                  new TextRun({
                    text: q.explanation,
                    font: defaultFont,
                    size: 20,
                  }),
                ],
                spacing: { after: 60 },
              })
            );
          });
        }

        // Part 2 detailed explanations
        if (hasPart2Explanations) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'B. Giải chi tiết Phần II (Đúng/Sai):',
                  bold: true,
                  italics: true,
                  font: defaultFont,
                  size: 20,
                }),
              ],
              spacing: { before: 120, after: 60 },
            })
          );

          part2Questions.forEach((q, idx) => {
            const explainedItems = q.items.filter((it) => it.explanation && it.explanation.trim());
            if (explainedItems.length === 0) return;

            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Câu ${idx + 1}:`,
                    bold: true,
                    font: defaultFont,
                    size: 20,
                  }),
                ],
                spacing: { before: 60, after: 40 },
              })
            );

            q.items.forEach((it) => {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `  • Ý ${it.label}) [${it.isCorrect ? 'Đúng' : 'Sai'}]: `,
                      bold: true,
                      font: defaultFont,
                      size: 19,
                    }),
                    new TextRun({
                      text: it.explanation || '',
                      font: defaultFont,
                      size: 19,
                    }),
                  ],
                  indent: { left: 240 },
                  spacing: { after: 40 },
                })
              );
            });
          });
        }

        // Part 3 detailed explanations
        if (hasPart3Explanations) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'C. Giải chi tiết Phần III (Trả lời ngắn):',
                  bold: true,
                  italics: true,
                  font: defaultFont,
                  size: 20,
                }),
              ],
              spacing: { before: 120, after: 60 },
            })
          );

          part3Questions.forEach((q, idx) => {
            if (!q.explanation || !q.explanation.trim()) return;
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Câu ${idx + 1} (Đáp số: ${q.correctAnswer}${q.unit ? ' ' + q.unit : ''}): `,
                    bold: true,
                    font: defaultFont,
                    size: 20,
                  }),
                  new TextRun({
                    text: q.explanation,
                    font: defaultFont,
                    size: 20,
                  }),
                ],
                spacing: { after: 60 },
              })
            );
          });
        }
      }
    }
  }

  return children;
}

export async function exportExamToDocx(
  exam: ExamData,
  shuffledCode?: ShuffledExamCode,
  optionsOrIncludeMatrix: boolean | Partial<WordExportOptions> = true,
  includeAnswerKey: boolean = true
): Promise<Blob> {
  const opts: WordExportOptions =
    typeof optionsOrIncludeMatrix === 'object' && optionsOrIncludeMatrix !== null
      ? {
          ...DEFAULT_WORD_EXPORT_OPTIONS,
          ...optionsOrIncludeMatrix,
        }
      : {
          includeExamQuestions: true,
          includeSectionInstructions: true,
          includeMatrix: Boolean(optionsOrIncludeMatrix),
          includeSpecification: Boolean(optionsOrIncludeMatrix),
          includeAnswerKeyTable: includeAnswerKey,
          includeDetailedExplanations: includeAnswerKey,
        };

  const children = buildExamCodeChildren(exam, shuffledCode, opts);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Builds the Master Answer Key Matrix (Bảng Ma Trận Đáp Án Tổng Hợp Toàn Bộ Các Mã Đề)
 */
export function buildMasterAnswerMatrixChildren(
  exam: ExamData,
  shuffledList: ShuffledExamCode[]
): (Paragraph | Table)[] {
  const defaultFont = 'Times New Roman';
  const meta = exam.metadata;
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `BẢNG MA TRẬN ĐÁP ÁN TỔNG HỢP (${shuffledList.length} MÃ ĐỀ)`,
          bold: true,
          font: defaultFont,
          size: 26,
        }),
      ],
      spacing: { before: 120, after: 80 },
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${meta.examTitle.toUpperCase()} - MÔN: ${meta.subject.toUpperCase()} (${meta.academicYear})`,
          bold: true,
          font: defaultFont,
          size: 21,
        }),
      ],
      spacing: { after: 200 },
    })
  );

  const headerCells = [
    createCell('Câu / Ý', { bold: true, size: 20 }),
    ...shuffledList.map((c) => createCell(`Mã ${c.code}`, { bold: true, size: 20, color: '1E3A8A' })),
  ];

  const rows: TableRow[] = [new TableRow({ children: headerCells })];

  // Part 1 rows
  exam.part1.forEach((_, idx) => {
    const qNum = idx + 1;
    rows.push(
      new TableRow({
        children: [
          createCell(`Phần I - Câu ${qNum}`, { bold: true, align: AlignmentType.LEFT }),
          ...shuffledList.map((c) =>
            createCell(c.answerKeyPart1[qNum] || '-', { bold: true, color: '0000FF' })
          ),
        ],
      })
    );
  });

  // Part 2 rows
  exam.part2.forEach((_, idx) => {
    const qNum = idx + 1;
    (['a', 'b', 'c', 'd'] as const).forEach((sub) => {
      rows.push(
        new TableRow({
          children: [
            createCell(`Phần II - Câu ${qNum}.${sub}`, { align: AlignmentType.LEFT }),
            ...shuffledList.map((c) => {
              const isTrue = c.answerKeyPart2[qNum]?.[sub];
              return createCell(isTrue ? 'Đ' : 'S', {
                bold: true,
                color: isTrue ? '008000' : 'CC0000',
              });
            }),
          ],
        })
      );
    });
  });

  // Part 3 rows
  exam.part3.forEach((_, idx) => {
    const qNum = idx + 1;
    rows.push(
      new TableRow({
        children: [
          createCell(`Phần III - Câu ${qNum}`, { bold: true, align: AlignmentType.LEFT }),
          ...shuffledList.map((c) =>
            createCell(c.answerKeyPart3[qNum] || '-', { bold: true, color: '047857' })
          ),
        ],
      })
    );
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
    })
  );

  return children;
}

/**
 * Exports a standalone Word (.docx) file containing the Master Answer Key Matrix across all shuffled codes
 */
export async function exportMasterAnswerMatrixToDocx(
  exam: ExamData,
  shuffledList: ShuffledExamCode[]
): Promise<Blob> {
  const children = buildMasterAnswerMatrixChildren(exam, shuffledList);
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
  return await Packer.toBlob(doc);
}

/**
 * Exports all selected shuffled exam codes into a single combined Word (.docx) document
 * with each exam code in its own section (page break) for 1-click batch printing,
 * plus the Master Answer Key Matrix at the end.
 */
export async function exportCombinedShuffledExamsToDocx(
  exam: ExamData,
  shuffledList: ShuffledExamCode[],
  options: Partial<WordExportOptions> = {},
  includeMasterAnswerTableAtEnd: boolean = true
): Promise<Blob> {
  const opts: WordExportOptions = {
    ...DEFAULT_WORD_EXPORT_OPTIONS,
    ...options,
  };

  const sections = shuffledList.map((codeItem) => ({
    properties: {},
    children: buildExamCodeChildren(exam, codeItem, opts),
  }));

  if (includeMasterAnswerTableAtEnd && shuffledList.length > 0) {
    sections.push({
      properties: {},
      children: buildMasterAnswerMatrixChildren(exam, shuffledList),
    });
  }

  const doc = new Document({ sections });
  return await Packer.toBlob(doc);
}

