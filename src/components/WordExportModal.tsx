import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import {
  FileText,
  Download,
  X,
  CheckCircle2,
  Table as TableIcon,
  BookOpen,
  FileCheck,
  Sliders,
  Sparkles,
  EyeOff,
  Files,
  FolderDown,
  Printer,
  Shuffle,
  Loader2,
} from 'lucide-react';
import { ExamData } from '../types/exam';
import { generateShuffledExams } from '../utils/shuffler';
import {
  WordExportOptions,
  DEFAULT_WORD_EXPORT_OPTIONS,
  exportExamToDocx,
  exportMasterAnswerMatrixToDocx,
  exportCombinedShuffledExamsToDocx,
} from '../utils/docxExport';

interface WordExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: ExamData;
  onExportSuccess?: (msg: string) => void;
}

type ExportPresetId =
  | 'exam_only_no_inst'
  | 'student_exam'
  | 'exam_with_answers'
  | 'full_cv7991'
  | 'custom';

export const WordExportModal: React.FC<WordExportModalProps> = ({
  isOpen,
  onClose,
  exam,
  onExportSuccess,
}) => {
  const [options, setOptions] = useState<WordExportOptions>(DEFAULT_WORD_EXPORT_OPTIONS);
  const [activePreset, setActivePreset] = useState<ExportPresetId>('full_cv7991');
  const [customFileName, setCustomFileName] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string | null>(null);

  // Batch multi-code export state
  const [exportMode, setExportMode] = useState<'single' | 'batch_shuffled'>('single');
  const [batchNumCodes, setBatchNumCodes] = useState<number>(4);
  const [batchBaseCode, setBatchBaseCode] = useState<number>(101);
  const [batchFormat, setBatchFormat] = useState<'multi_files' | 'zip_archive' | 'combined_docx'>(
    'multi_files'
  );
  const [includeMasterAnswerSheet, setIncludeMasterAnswerSheet] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      const sanitizedSubject = exam.metadata.subject.replace(/\s+/g, '_');
      setCustomFileName(
        `De_Thi_${sanitizedSubject}_Khoi_${exam.metadata.grade}_Ma_${exam.metadata.examCode || '101'}`
      );
      setBatchBaseCode(Number(exam.metadata.examCode) || 101);
      setProgressText(null);
    }
  }, [isOpen, exam.metadata.subject, exam.metadata.grade, exam.metadata.examCode]);

  if (!isOpen) return null;

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const applyPreset = (preset: ExportPresetId) => {
    setActivePreset(preset);
    if (preset === 'exam_only_no_inst') {
      setOptions({
        includeExamQuestions: true,
        includeSectionInstructions: false,
        includeMatrix: false,
        includeSpecification: false,
        includeAnswerKeyTable: false,
        includeDetailedExplanations: false,
      });
    } else if (preset === 'student_exam') {
      setOptions({
        includeExamQuestions: true,
        includeSectionInstructions: true,
        includeMatrix: false,
        includeSpecification: false,
        includeAnswerKeyTable: false,
        includeDetailedExplanations: false,
      });
    } else if (preset === 'exam_with_answers') {
      setOptions({
        includeExamQuestions: true,
        includeSectionInstructions: true,
        includeMatrix: false,
        includeSpecification: false,
        includeAnswerKeyTable: true,
        includeDetailedExplanations: true,
      });
    } else if (preset === 'full_cv7991') {
      setOptions({
        includeExamQuestions: true,
        includeSectionInstructions: true,
        includeMatrix: true,
        includeSpecification: true,
        includeAnswerKeyTable: true,
        includeDetailedExplanations: true,
      });
    }
  };

  const toggleOption = (key: keyof WordExportOptions) => {
    setActivePreset('custom');
    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleConfirmExport = async () => {
    if (
      !options.includeExamQuestions &&
      !options.includeMatrix &&
      !options.includeSpecification &&
      !options.includeAnswerKeyTable &&
      !options.includeDetailedExplanations
    ) {
      return;
    }

    try {
      setIsExporting(true);
      const sanitizedSubject = exam.metadata.subject.replace(/\s+/g, '_');

      if (exportMode === 'single') {
        setProgressText('Đang tạo file Word (.docx)...');
        const blob = await exportExamToDocx(exam, undefined, options);
        const baseName = customFileName.trim() || `De_Thi_${sanitizedSubject}_CV7991`;
        triggerDownload(blob, baseName.endsWith('.docx') ? baseName : `${baseName}.docx`);

        if (onExportSuccess) {
          onExportSuccess('Đã xuất file Word (.docx) theo cấu hình tùy chọn thành công!');
        }
      } else {
        // Generate N shuffled exam codes and batch export them
        setProgressText(`Đang trộn ${batchNumCodes} mã đề hoán vị...`);
        const shuffledList = generateShuffledExams(exam, batchNumCodes, batchBaseCode);

        if (batchFormat === 'multi_files') {
          for (let i = 0; i < shuffledList.length; i++) {
            const codeItem = shuffledList[i];
            setProgressText(
              `Đang xuất file (${i + 1}/${shuffledList.length}): Mã đề ${codeItem.code}...`
            );
            const blob = await exportExamToDocx(exam, codeItem, options);
            triggerDownload(blob, `De_Thi_${sanitizedSubject}_Ma_${codeItem.code}.docx`);
            await new Promise((r) => setTimeout(r, 320));
          }

          if (includeMasterAnswerSheet) {
            setProgressText('Đang xuất Bảng đáp án tổng hợp các mã đề...');
            const masterBlob = await exportMasterAnswerMatrixToDocx(exam, shuffledList);
            triggerDownload(
              masterBlob,
              `Bang_Dap_An_Tong_Hop_${sanitizedSubject}_${shuffledList.length}_Ma_De.docx`
            );
          }

          if (onExportSuccess) {
            onExportSuccess(
              `Đã xuất đồng loạt ${shuffledList.length} file Word (.docx) theo danh sách mã đề!`
            );
          }
        } else if (batchFormat === 'zip_archive') {
          const zip = new JSZip();
          for (let i = 0; i < shuffledList.length; i++) {
            const codeItem = shuffledList[i];
            setProgressText(
              `Đang tạo file (${i + 1}/${shuffledList.length}): Mã đề ${codeItem.code}...`
            );
            const blob = await exportExamToDocx(exam, codeItem, options);
            zip.file(`De_Thi_${sanitizedSubject}_Ma_${codeItem.code}.docx`, blob);
          }

          if (includeMasterAnswerSheet) {
            const masterBlob = await exportMasterAnswerMatrixToDocx(exam, shuffledList);
            zip.file(
              `00_Bang_Dap_An_Tong_Hop_${shuffledList.length}_Ma_De.docx`,
              masterBlob
            );
          }

          setProgressText('Đang đóng gói file nén .ZIP...');
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          triggerDownload(
            zipBlob,
            `Bo_De_Thi_${sanitizedSubject}_${shuffledList.length}_Ma_De.zip`
          );

          if (onExportSuccess) {
            onExportSuccess(
              `Đã tải gói .ZIP chứa ${shuffledList.length} file Word mã đề thành công!`
            );
          }
        } else {
          setProgressText(`Đang gộp ${shuffledList.length} mã đề vào 1 file Word in hàng loạt...`);
          const combinedBlob = await exportCombinedShuffledExamsToDocx(
            exam,
            shuffledList,
            options,
            includeMasterAnswerSheet
          );
          triggerDownload(
            combinedBlob,
            `Bo_De_In_Hang_Loat_${sanitizedSubject}_${shuffledList.length}_Ma_De.docx`
          );

          if (onExportSuccess) {
            onExportSuccess(
              `Đã xuất file Word gộp ${shuffledList.length} mã đề sẵn sàng in ấn hàng loạt!`
            );
          }
        }
      }

      onClose();
    } catch (err) {
      console.error('Error exporting Word document:', err);
    } finally {
      setIsExporting(false);
      setProgressText(null);
    }
  };

  const totalQuestions =
    exam.part1.length + exam.part2.length + exam.part3.length + exam.essay.length;
  const explainedCount =
    exam.part1.filter((q) => q.explanation?.trim()).length +
    exam.part2.filter((q) => q.items.some((i) => i.explanation?.trim())).length +
    exam.part3.filter((q) => q.explanation?.trim()).length +
    exam.essay.filter((q) => q.guide?.trim()).length;

  const isNothingSelected =
    !options.includeExamQuestions &&
    !options.includeMatrix &&
    !options.includeSpecification &&
    !options.includeAnswerKeyTable &&
    !options.includeDetailedExplanations;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                TÙY CHỌN XUẤT FILE WORD (.DOCX) & IN HÀNG LOẠT
              </h2>
              <p className="text-xs text-blue-100">
                Tùy chỉnh ẩn/hiện đáp án, bảng ma trận và xuất đồng loạt nhiều mã đề thi cùng lúc
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Mode Switcher: Single Original Exam vs Batch Shuffled Codes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setExportMode('single')}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                exportMode === 'single'
                  ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Xuất 1 Đề Thi Gốc (Mã {exam.metadata.examCode || '101'})</span>
            </button>

            <button
              type="button"
              onClick={() => setExportMode('batch_shuffled')}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                exportMode === 'batch_shuffled'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Files className="w-4 h-4" />
              <span>Xuất Nhiều File Word Cùng Lúc (Nhiều Mã Đề)</span>
            </button>
          </div>

          {/* Batch Shuffled Configuration Box (when exportMode === 'batch_shuffled') */}
          {exportMode === 'batch_shuffled' && (
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Shuffle className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-bold text-purple-950 uppercase">
                    Cấu hình xuất hàng loạt theo danh sách mã đề trộn
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Số lượng mã đề:</span>
                    <select
                      value={batchNumCodes}
                      onChange={(e) => setBatchNumCodes(Number(e.target.value))}
                      className="bg-white border border-purple-300 rounded-lg px-2 py-1 font-bold text-purple-900"
                    >
                      <option value={2}>2 mã đề</option>
                      <option value={4}>4 mã đề</option>
                      <option value={6}>6 mã đề</option>
                      <option value={8}>8 mã đề</option>
                      <option value={12}>12 mã đề</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Mã bắt đầu:</span>
                    <input
                      type="number"
                      value={batchBaseCode}
                      onChange={(e) => setBatchBaseCode(Number(e.target.value))}
                      className="w-16 bg-white border border-purple-300 rounded-lg px-2 py-1 text-center font-bold text-purple-900"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setBatchFormat('multi_files')}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer flex items-start gap-2 ${
                    batchFormat === 'multi_files'
                      ? 'bg-white border-purple-600 ring-2 ring-purple-500/20 font-bold text-purple-950'
                      : 'bg-white/70 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <Files className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <div>Tải rời từng file .docx</div>
                    <div className="text-[10px] font-normal text-slate-500">
                      Tải {batchNumCodes} file Word riêng biệt
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBatchFormat('zip_archive')}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer flex items-start gap-2 ${
                    batchFormat === 'zip_archive'
                      ? 'bg-white border-purple-600 ring-2 ring-purple-500/20 font-bold text-purple-950'
                      : 'bg-white/70 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <FolderDown className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <div>Đóng gói 1 file .ZIP</div>
                    <div className="text-[10px] font-normal text-slate-500">
                      Nén {batchNumCodes} file Word vào gói .ZIP
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBatchFormat('combined_docx')}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer flex items-start gap-2 ${
                    batchFormat === 'combined_docx'
                      ? 'bg-white border-purple-600 ring-2 ring-purple-500/20 font-bold text-purple-950'
                      : 'bg-white/70 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <Printer className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div>Gộp 1 file Word in liền</div>
                    <div className="text-[10px] font-normal text-slate-500">
                      Ngắt trang sẵn cho {batchNumCodes} mã đề
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-purple-800 font-medium">
                  Danh sách mã sẽ tạo:{' '}
                  <strong>
                    {Array.from({ length: batchNumCodes }, (_, i) => batchBaseCode + i).join(', ')}
                  </strong>
                </span>

                <label className="inline-flex items-center gap-1.5 font-semibold text-purple-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMasterAnswerSheet}
                    onChange={(e) => setIncludeMasterAnswerSheet(e.target.checked)}
                    className="rounded text-purple-600"
                  />
                  <span>Kèm Bảng ma trận đáp án tổng hợp các mã đề</span>
                </label>
              </div>
            </div>
          )}

          {/* 1. Quick Presets Bar */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>1. Chế độ xuất nhanh (Dành cho Giáo viên)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => applyPreset('exam_only_no_inst')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  activePreset === 'exam_only_no_inst'
                    ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <EyeOff
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    activePreset === 'exam_only_no_inst' ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Chỉ xuất đề thi (Không hướng dẫn)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Chỉ xuất câu hỏi thuần túy, ẩn phần hướng dẫn đầu mỗi phần, ẩn ma trận & đáp án
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('student_exam')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  activePreset === 'student_exam'
                    ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FileText
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    activePreset === 'student_exam' ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Đề thi chính thức (Phát cho học sinh)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Có tiêu đề & hướng dẫn làm bài từng phần, ẩn đáp án và ẩn ma trận
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('exam_with_answers')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  activePreset === 'exam_with_answers'
                    ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FileCheck
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    activePreset === 'exam_with_answers' ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Đề thi + Đáp án & Lời giải chi tiết
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Xuất đề thi kèm bảng đáp án trắc nghiệm và hướng dẫn chấm chi tiết
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('full_cv7991')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  activePreset === 'full_cv7991'
                    ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <TableIcon
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    activePreset === 'full_cv7991' ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Hồ sơ đầy đủ chuẩn CV 7991 (Tất cả)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Đính kèm Bảng ma trận + Bản đặc tả + Đề thi + Đáp án chi tiết
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Detailed Customization Checkboxes */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>2. Bảng tùy chọn thành phần chi tiết</span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                Tích chọn hoặc bỏ chọn từng mục theo nhu cầu
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option 1: Include Exam Questions */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  options.includeExamQuestions
                    ? 'bg-white border-blue-200 shadow-2xs'
                    : 'bg-slate-100/70 border-slate-200 opacity-75'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.includeExamQuestions}
                  onChange={() => toggleOption('includeExamQuestions')}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900">
                    Nội dung câu hỏi Đề thi ({totalQuestions} câu)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Xuất danh sách câu hỏi Phần I, Phần II, Phần III và Tự luận
                  </p>
                </div>
              </label>

              {/* Option 2: Include Section Instructions */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  options.includeSectionInstructions
                    ? 'bg-white border-blue-200 shadow-2xs'
                    : 'bg-amber-50/60 border-amber-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.includeSectionInstructions}
                  onChange={() => toggleOption('includeSectionInstructions')}
                  disabled={!options.includeExamQuestions}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Phần hướng dẫn làm bài & quy cách</span>
                    {!options.includeSectionInstructions && (
                      <span className="px-1.5 py-0.2 text-[10px] rounded bg-amber-100 text-amber-800 font-semibold">
                        Đã ẩn hướng dẫn
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bỏ chọn mục này nếu chỉ muốn xuất đề thi rút gọn không kèm câu dẫn hướng dẫn
                  </p>
                </div>
              </label>

              {/* Option 3: Quick Answer Key Table */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  options.includeAnswerKeyTable
                    ? 'bg-white border-emerald-200 shadow-2xs'
                    : 'bg-slate-100/70 border-slate-200 opacity-75'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.includeAnswerKeyTable}
                  onChange={() => toggleOption('includeAnswerKeyTable')}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900">
                    Bảng đáp án nhanh (Phần I, II, III)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Hiển thị bảng tổng hợp đáp án A, B, C, D, Đúng/Sai và Trả lời ngắn
                  </p>
                </div>
              </label>

              {/* Option 4: Detailed Explanations & Essay Guide */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  options.includeDetailedExplanations
                    ? 'bg-white border-emerald-200 shadow-2xs'
                    : 'bg-slate-100/70 border-slate-200 opacity-75'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.includeDetailedExplanations}
                  onChange={() => toggleOption('includeDetailedExplanations')}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900">
                    Đáp án chi tiết & Hướng dẫn chấm ({explainedCount} câu có giải)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ẩn/hiện lời giải chi tiết từng câu trắc nghiệm và biểu điểm chấm Tự luận
                  </p>
                </div>
              </label>

              {/* Option 5: Matrix Table */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  options.includeMatrix
                    ? 'bg-white border-purple-200 shadow-2xs'
                    : 'bg-slate-100/70 border-slate-200 opacity-75'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.includeMatrix}
                  onChange={() => toggleOption('includeMatrix')}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900">
                    Bảng Ma trận đề kiểm tra ({exam.matrix.length} chủ đề)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Đính kèm bảng phân bổ mức độ Biết / Hiểu / Vận dụng theo CV 7991
                  </p>
                </div>
              </label>

              {/* Option 6: Specification Table */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  options.includeSpecification
                    ? 'bg-white border-purple-200 shadow-2xs'
                    : 'bg-slate-100/70 border-slate-200 opacity-75'
                }`}
              >
                <input
                  type="checkbox"
                  checked={options.includeSpecification}
                  onChange={() => toggleOption('includeSpecification')}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900">
                    Bản Đặc tả đề kiểm tra ({exam.specification.length} mục)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Đính kèm bảng yêu cầu cần đạt và ánh xạ câu hỏi theo chuẩn GDPT 2018
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* 3. Live Document Structure Summary & File Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5">
            {exportMode === 'single' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên file Word (.docx) khi tải về:
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="De_Thi_Hoa_Hoc_12..."
                    className="w-full text-xs bg-white border border-slate-300 rounded-l-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="bg-slate-100 border border-l-0 border-slate-300 rounded-r-lg px-2.5 py-2 text-xs font-bold text-slate-600">
                    .docx
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <span className="block text-xs font-bold text-purple-900 mb-1">
                  Chế độ xuất hàng loạt nhiều mã đề:
                </span>
                <p className="text-xs text-slate-600">
                  Hệ thống sẽ tự động trộn và xuất <strong>{batchNumCodes} mã đề</strong> (từ mã{' '}
                  <strong>{batchBaseCode}</strong> đến{' '}
                  <strong>{batchBaseCode + batchNumCodes - 1}</strong>).
                </p>
              </div>
            )}

            <div>
              <span className="block text-xs font-bold text-slate-700 mb-1.5">
                Cấu trúc file Word sẽ xuất gồm:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {options.includeMatrix && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                    <CheckCircle2 className="w-3 h-3" /> Bảng Ma trận
                  </span>
                )}
                {options.includeSpecification && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                    <CheckCircle2 className="w-3 h-3" /> Bản Đặc tả
                  </span>
                )}
                {options.includeExamQuestions && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                    <CheckCircle2 className="w-3 h-3" /> Đề thi ({totalQuestions} câu)
                  </span>
                )}
                {options.includeExamQuestions && !options.includeSectionInstructions && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    Ẩn phần hướng dẫn
                  </span>
                )}
                {options.includeAnswerKeyTable && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Bảng đáp án
                  </span>
                )}
                {options.includeDetailedExplanations && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Giải chi tiết & HDC
                  </span>
                )}
                {isNothingSelected && (
                  <span className="text-xs text-rose-600 font-semibold">
                    Vui lòng chọn ít nhất 1 thành phần để xuất file!
                  </span>
                )}
              </div>
            </div>
          </div>

          {progressText && (
            <div className="p-3 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-2 shadow-xs">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{progressText}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Định dạng chuẩn Times New Roman, tương thích Microsoft Word & Google Docs</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmExport}
              disabled={isExporting || isNothingSelected}
              className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 shadow-md shadow-blue-200 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>
                {isExporting
                  ? 'Đang xử lý...'
                  : exportMode === 'single'
                  ? 'Xuất File Word (.docx)'
                  : `Xuất Hàng Loạt ${batchNumCodes} Mã Đề`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
