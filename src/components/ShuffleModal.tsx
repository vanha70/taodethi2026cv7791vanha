import React, { useState } from 'react';
import JSZip from 'jszip';
import {
  Shuffle,
  X,
  Download,
  Copy,
  Check,
  FileText,
  Printer,
  Table as TableIcon,
  FolderDown,
  Files,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react';
import { ExamData, ShuffledExamCode } from '../types/exam';
import { generateShuffledExams } from '../utils/shuffler';
import {
  exportExamToDocx,
  exportMasterAnswerMatrixToDocx,
  exportCombinedShuffledExamsToDocx,
  WordExportOptions,
} from '../utils/docxExport';

interface ShuffleModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: ExamData;
}

export const ShuffleModal: React.FC<ShuffleModalProps> = ({
  isOpen,
  onClose,
  exam,
}) => {
  const [numCodes, setNumCodes] = useState<number>(4);
  const [baseCode, setBaseCode] = useState<number>(101);
  const [shuffledList, setShuffledList] = useState<ShuffledExamCode[]>([]);
  const [selectedCodeView, setSelectedCodeView] = useState<string | null>(null);
  const [selectedBatchCodes, setSelectedBatchCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [batchProgressText, setBatchProgressText] = useState<string | null>(null);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);

  // Word export content options for shuffled exam codes
  const [includeMatrixInDocx, setIncludeMatrixInDocx] = useState<boolean>(false);
  const [includeAnswersInDocx, setIncludeAnswersInDocx] = useState<boolean>(true);
  const [includeDetailedInDocx, setIncludeDetailedInDocx] = useState<boolean>(true);
  const [includeInstructionsInDocx, setIncludeInstructionsInDocx] = useState<boolean>(true);
  const [includeMasterAnswerDocx, setIncludeMasterAnswerDocx] = useState<boolean>(true);

  if (!isOpen) return null;

  const getExportOptions = (): WordExportOptions => ({
    includeExamQuestions: true,
    includeSectionInstructions: includeInstructionsInDocx,
    includeMatrix: includeMatrixInDocx,
    includeSpecification: includeMatrixInDocx,
    includeAnswerKeyTable: includeAnswersInDocx,
    includeDetailedExplanations: includeDetailedInDocx,
  });

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleGenerate = () => {
    const list = generateShuffledExams(exam, numCodes, baseCode);
    setShuffledList(list);
    setSelectedBatchCodes(list.map((c) => c.code));
    setBatchSuccessMessage(null);
    if (list.length > 0) {
      setSelectedCodeView(list[0].code);
    }
  };

  const toggleSelectCodeForBatch = (code: string) => {
    setSelectedBatchCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSelectAllCodes = () => {
    setSelectedBatchCodes(shuffledList.map((c) => c.code));
  };

  const handleClearSelectedCodes = () => {
    setSelectedBatchCodes([]);
  };

  const handleDownloadSingleCode = async (codeItem: ShuffledExamCode) => {
    try {
      setIsExporting(true);
      setBatchProgressText(`Đang tạo file Word Mã đề ${codeItem.code}...`);
      const blob = await exportExamToDocx(exam, codeItem, getExportOptions());
      const sanitizedSubject = exam.metadata.subject.replace(/\s+/g, '_');
      triggerBlobDownload(blob, `De_Thi_${sanitizedSubject}_Ma_${codeItem.code}.docx`);
      setBatchSuccessMessage(`Đã tải file Word Mã đề ${codeItem.code} thành công!`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
      setBatchProgressText(null);
    }
  };

  // Mode 1: Download multiple individual .docx files sequentially
  const handleBatchDownloadMultipleDocx = async () => {
    const targetExams = shuffledList.filter((c) => selectedBatchCodes.includes(c.code));
    if (targetExams.length === 0) return;

    try {
      setIsExporting(true);
      setBatchSuccessMessage(null);
      const sanitizedSubject = exam.metadata.subject.replace(/\s+/g, '_');
      const opts = getExportOptions();

      for (let i = 0; i < targetExams.length; i++) {
        const item = targetExams[i];
        setBatchProgressText(
          `Đang xuất file Word (${i + 1}/${targetExams.length}): Mã đề ${item.code}...`
        );
        const blob = await exportExamToDocx(exam, item, opts);
        triggerBlobDownload(blob, `De_Thi_${sanitizedSubject}_Ma_${item.code}.docx`);
        // Small pause so browsers allow sequential multi-file downloads cleanly
        await new Promise((r) => setTimeout(r, 320));
      }

      if (includeMasterAnswerDocx) {
        setBatchProgressText('Đang xuất file Bảng Ma Trận Đáp Án Tổng Hợp...');
        const masterBlob = await exportMasterAnswerMatrixToDocx(exam, targetExams);
        triggerBlobDownload(
          masterBlob,
          `Bang_Dap_An_Tong_Hop_${sanitizedSubject}_${targetExams.length}_Ma_De.docx`
        );
      }

      setBatchSuccessMessage(
        `Đã xuất thành công ${targetExams.length} file Word (.docx)${
          includeMasterAnswerDocx ? ' kèm file Bảng đáp án tổng hợp' : ''
        }!`
      );
    } catch (err) {
      console.error('Batch multi-file docx export error:', err);
    } finally {
      setIsExporting(false);
      setBatchProgressText(null);
    }
  };

  // Mode 2: Package all selected individual .docx files into a single .ZIP archive
  const handleBatchDownloadZipArchive = async () => {
    const targetExams = shuffledList.filter((c) => selectedBatchCodes.includes(c.code));
    if (targetExams.length === 0) return;

    try {
      setIsExporting(true);
      setBatchSuccessMessage(null);
      const zip = new JSZip();
      const sanitizedSubject = exam.metadata.subject.replace(/\s+/g, '_');
      const opts = getExportOptions();

      for (let i = 0; i < targetExams.length; i++) {
        const item = targetExams[i];
        setBatchProgressText(
          `Đang đóng gói file Word (${i + 1}/${targetExams.length}): Mã đề ${item.code}...`
        );
        const blob = await exportExamToDocx(exam, item, opts);
        zip.file(`De_Thi_${sanitizedSubject}_Ma_${item.code}.docx`, blob);
      }

      if (includeMasterAnswerDocx) {
        setBatchProgressText('Đang tạo Bảng Ma Trận Đáp Án Tổng Hợp...');
        const masterBlob = await exportMasterAnswerMatrixToDocx(exam, targetExams);
        zip.file(
          `00_Bang_Dap_An_Tong_Hop_${targetExams.length}_Ma_De.docx`,
          masterBlob
        );
      }

      setBatchProgressText('Đang nén gói .ZIP hoàn chỉnh...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(
        zipBlob,
        `Bo_De_Thi_${sanitizedSubject}_${targetExams.length}_Ma_De.zip`
      );

      setBatchSuccessMessage(
        `Đã tải gói nén (.ZIP) gồm ${targetExams.length} file Word riêng biệt thành công!`
      );
    } catch (err) {
      console.error('Batch ZIP export error:', err);
    } finally {
      setIsExporting(false);
      setBatchProgressText(null);
    }
  };

  // Mode 3: Combine all selected exam codes into 1 single multi-section Word file for 1-click printing
  const handleBatchDownloadCombinedDocx = async () => {
    const targetExams = shuffledList.filter((c) => selectedBatchCodes.includes(c.code));
    if (targetExams.length === 0) return;

    try {
      setIsExporting(true);
      setBatchSuccessMessage(null);
      setBatchProgressText(
        `Đang gộp ${targetExams.length} mã đề vào 1 file Word in hàng loạt...`
      );
      const sanitizedSubject = exam.metadata.subject.replace(/\s+/g, '_');
      const combinedBlob = await exportCombinedShuffledExamsToDocx(
        exam,
        targetExams,
        getExportOptions(),
        includeMasterAnswerDocx
      );
      triggerBlobDownload(
        combinedBlob,
        `Bo_De_In_Hang_Loat_${sanitizedSubject}_${targetExams.length}_Ma_De.docx`
      );
      setBatchSuccessMessage(
        `Đã tải file Word gộp ${targetExams.length} mã đề (ngắt trang tự động) sẵn sàng in hàng loạt!`
      );
    } catch (err) {
      console.error('Combined docx export error:', err);
    } finally {
      setIsExporting(false);
      setBatchProgressText(null);
    }
  };

  const handleCopyAnswerMatrix = () => {
    if (shuffledList.length === 0) return;

    let text = `BẢNG MA TRẬN ĐÁP ÁN TRẮC NGHIỆM (${exam.metadata.subject.toUpperCase()} - ${exam.metadata.academicYear})\n\n`;
    text += `PHẦN I (TRẮC NGHIỆM 4 LỰA CHỌN):\n`;
    text += `Câu\t` + shuffledList.map((c) => `Mã ${c.code}`).join('\t') + '\n';

    exam.part1.forEach((_, qIdx) => {
      const qNum = qIdx + 1;
      text += `${qNum}\t` + shuffledList.map((c) => c.answerKeyPart1[qNum] || '-').join('\t') + '\n';
    });

    text += `\nPHẦN II (ĐÚNG/SAI):\n`;
    exam.part2.forEach((_, qIdx) => {
      const qNum = qIdx + 1;
      ['a', 'b', 'c', 'd'].forEach((sub) => {
        text +=
          `${qNum}.${sub}\t` +
          shuffledList.map((c) => (c.answerKeyPart2[qNum]?.[sub] ? 'Đ' : 'S')).join('\t') +
          '\n';
      });
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentViewedExam = shuffledList.find((c) => c.code === selectedCodeView);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                TRỘN ĐỀ THI HOÁN VỊ & XUẤT NHIỀU FILE WORD CÙNG LÚC
              </h2>
              <p className="text-xs text-purple-200">
                Tự động tạo nhiều mã đề độc lập và xuất hàng loạt ra file Word (.docx) hoặc gói .ZIP phục vụ in ấn nhanh
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">Số lượng mã đề:</label>
              <select
                value={numCodes}
                onChange={(e) => setNumCodes(Number(e.target.value))}
                className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800"
              >
                <option value={2}>2 mã đề</option>
                <option value={4}>4 mã đề (101 - 104)</option>
                <option value={6}>6 mã đề (101 - 106)</option>
                <option value={8}>8 mã đề (101 - 108)</option>
                <option value={12}>12 mã đề (101 - 112)</option>
                <option value={24}>24 mã đề (Chuẩn kỳ thi lớn)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">Mã đề bắt đầu:</label>
              <input
                type="number"
                value={baseCode}
                onChange={(e) => setBaseCode(Number(e.target.value))}
                className="w-20 text-xs font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-center"
              />
            </div>

            <button
              onClick={handleGenerate}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <Shuffle className="w-3.5 h-3.5" />
              Bắt Đầu Trộn Đề ({numCodes} Mã)
            </button>
          </div>

          {shuffledList.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyAnswerMatrix}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã sao chép' : 'Sao chép ma trận đáp án'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {shuffledList.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Shuffle className="w-12 h-12 mx-auto mb-3 opacity-40 text-purple-600" />
              <p className="text-sm font-medium text-slate-600">
                Chọn số lượng mã đề và nhấn nút <strong>"Bắt Đầu Trộn Đề"</strong>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Hệ thống sẽ sinh ngẫu nhiên các mã đề độc lập và cho phép tải đồng loạt nhiều file Word cùng lúc
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* ============================================================================
                  BATCH WORD EXPORT PANEL (XUẤT NHIỀU FILE WORD CÙNG LÚC)
                  ============================================================================ */}
              <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-purple-50/80 rounded-xl border border-indigo-200 shadow-2xs p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-200/70 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <Files className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase">
                        XUẤT NHIỀU FILE WORD CÙNG LÚC (TIẾT KIỆM THỜI GIAN IN ẤN HÀNG LOẠT)
                      </h3>
                      <p className="text-[11px] text-slate-600">
                        Đã chọn <strong>{selectedBatchCodes.length}/{shuffledList.length}</strong> mã đề để xuất hàng loạt
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAllCodes}
                      className="px-2.5 py-1 rounded-md font-semibold bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 cursor-pointer flex items-center gap-1"
                    >
                      <CheckSquare className="w-3.5 h-3.5" /> Chọn tất cả ({shuffledList.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSelectedCodes}
                      className="px-2.5 py-1 rounded-md font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 cursor-pointer flex items-center gap-1"
                    >
                      <Square className="w-3.5 h-3.5" /> Bỏ chọn
                    </button>
                  </div>
                </div>

                {/* Selectable Exam Code Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  {shuffledList.map((c) => {
                    const isChecked = selectedBatchCodes.includes(c.code);
                    return (
                      <label
                        key={c.code}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all select-none ${
                          isChecked
                            ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectCodeForBatch(c.code)}
                          className="sr-only"
                        />
                        {isChecked ? (
                          <CheckSquare className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>Mã đề {c.code}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Content Inclusion Checkboxes for Batch Export */}
                <div className="bg-white/90 rounded-xl p-3 border border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-slate-700">Tùy chọn nội dung trong mỗi file Word:</span>
                  <div className="flex flex-wrap items-center gap-4 text-slate-700 font-medium">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeInstructionsInDocx}
                        onChange={(e) => setIncludeInstructionsInDocx(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Phần hướng dẫn làm bài</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeAnswersInDocx}
                        onChange={(e) => setIncludeAnswersInDocx(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Bảng đáp án từng mã</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeDetailedInDocx}
                        onChange={(e) => setIncludeDetailedInDocx(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Giải chi tiết & HDC</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeMatrixInDocx}
                        onChange={(e) => setIncludeMatrixInDocx(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Bảng ma trận CV 7991</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-indigo-800 font-semibold">
                      <input
                        type="checkbox"
                        checked={includeMasterAnswerDocx}
                        onChange={(e) => setIncludeMasterAnswerDocx(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Xuất kèm Bảng đáp án tổng hợp</span>
                    </label>
                  </div>
                </div>

                {/* Progress / Success Banner */}
                {batchProgressText && (
                  <div className="p-2.5 rounded-lg bg-blue-600 text-white text-xs font-semibold flex items-center gap-2 shadow-xs">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>{batchProgressText}</span>
                  </div>
                )}

                {batchSuccessMessage && !batchProgressText && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{batchSuccessMessage}</span>
                  </div>
                )}

                {/* 3 Batch Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    type="button"
                    disabled={isExporting || selectedBatchCodes.length === 0}
                    onClick={handleBatchDownloadMultipleDocx}
                    className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-left shadow-sm transition-all cursor-pointer flex items-center gap-3"
                  >
                    <Files className="w-5 h-5 shrink-0 text-blue-100" />
                    <div>
                      <div className="text-xs font-bold">
                        Tải đồng loạt {selectedBatchCodes.length} file Word (.docx)
                      </div>
                      <div className="text-[10px] text-blue-100 mt-0.5">
                        Tải lần lượt từng file Mã đề riêng biệt về máy
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isExporting || selectedBatchCodes.length === 0}
                    onClick={handleBatchDownloadZipArchive}
                    className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-left shadow-sm transition-all cursor-pointer flex items-center gap-3"
                  >
                    <FolderDown className="w-5 h-5 shrink-0 text-indigo-100" />
                    <div>
                      <div className="text-xs font-bold">
                        Tải gói nén (.ZIP) tất cả file Word
                      </div>
                      <div className="text-[10px] text-indigo-100 mt-0.5">
                        Đóng gói {selectedBatchCodes.length} file .docx + Bảng đáp án vào 1 file .ZIP
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isExporting || selectedBatchCodes.length === 0}
                    onClick={handleBatchDownloadCombinedDocx}
                    className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-left shadow-sm transition-all cursor-pointer flex items-center gap-3"
                  >
                    <Printer className="w-5 h-5 shrink-0 text-emerald-100" />
                    <div>
                      <div className="text-xs font-bold">
                        Gộp {selectedBatchCodes.length} mã đề vào 1 file Word
                      </div>
                      <div className="text-[10px] text-emerald-100 mt-0.5">
                        Tự động ngắt trang từng mã đề để nhấn Ctrl+P in 1 lần
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* MASTER ANSWER MATRIX TABLE */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-3 bg-purple-50/80 border-b border-purple-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-purple-700" />
                    <h3 className="text-xs font-bold text-purple-900 uppercase">
                      BẢNG MA TRẬN ĐÁP ÁN TRẮC NGHIỆM TOÀN BỘ CÁC MÃ ĐỀ
                    </h3>
                  </div>
                  <span className="text-xs font-medium text-purple-700">
                    Phục vụ giáo viên chấm bài nhanh & in đáp án
                  </span>
                </div>

                <div className="overflow-x-auto p-2">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th className="p-2 border-r border-slate-200 text-left font-bold text-slate-700 w-20">
                          Câu
                        </th>
                        {shuffledList.map((c) => (
                          <th
                            key={c.code}
                            className="p-2 border-r border-slate-200 font-bold text-indigo-700 bg-indigo-50/50"
                          >
                            Mã {c.code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Part 1 rows */}
                      {exam.part1.map((_, idx) => {
                        const qNum = idx + 1;
                        return (
                          <tr key={`p1-${qNum}`} className="hover:bg-slate-50">
                            <td className="p-1.5 border-r border-slate-200 font-semibold text-left text-slate-600">
                              P.I - Câu {qNum}
                            </td>
                            {shuffledList.map((c) => (
                              <td
                                key={c.code}
                                className="p-1.5 border-r border-slate-200 font-bold text-blue-600"
                              >
                                {c.answerKeyPart1[qNum]}
                              </td>
                            ))}
                          </tr>
                        );
                      })}

                      {/* Part 2 rows */}
                      {exam.part2.map((_, idx) => {
                        const qNum = idx + 1;
                        return (['a', 'b', 'c', 'd'] as const).map((sub) => (
                          <tr key={`p2-${qNum}-${sub}`} className="hover:bg-slate-50 bg-indigo-50/20">
                            <td className="p-1 border-r border-slate-200 text-left text-slate-500 font-medium">
                              P.II - C{qNum}.{sub}
                            </td>
                            {shuffledList.map((c) => {
                              const val = c.answerKeyPart2[qNum]?.[sub];
                              return (
                                <td
                                  key={c.code}
                                  className={`p-1 border-r border-slate-200 font-bold ${
                                    val ? 'text-emerald-600' : 'text-rose-600'
                                  }`}
                                >
                                  {val ? 'Đ' : 'S'}
                                </td>
                              );
                            })}
                          </tr>
                        ));
                      })}

                      {/* Part 3 rows */}
                      {exam.part3.map((_, idx) => {
                        const qNum = idx + 1;
                        return (
                          <tr key={`p3-${qNum}`} className="hover:bg-slate-50 bg-emerald-50/20">
                            <td className="p-1.5 border-r border-slate-200 font-semibold text-left text-slate-600">
                              P.III - C{qNum}
                            </td>
                            {shuffledList.map((c) => (
                              <td
                                key={c.code}
                                className="p-1.5 border-r border-slate-200 font-bold text-emerald-700"
                              >
                                {c.answerKeyPart3[qNum]}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CODE TABS & PREVIEW */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 overflow-x-auto">
                    <span className="text-xs font-bold text-slate-700">Xem trước từng mã đề:</span>
                    {shuffledList.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => setSelectedCodeView(c.code)}
                        className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                          selectedCodeView === c.code
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        Mã {c.code}
                      </button>
                    ))}
                  </div>

                  {currentViewedExam && (
                    <button
                      onClick={() => handleDownloadSingleCode(currentViewedExam)}
                      disabled={isExporting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải lẻ Word Mã {currentViewedExam.code}</span>
                    </button>
                  )}
                </div>

                {currentViewedExam && (
                  <div className="p-5 text-xs space-y-4 max-h-[320px] overflow-y-auto">
                    <div className="font-bold text-slate-800 text-sm border-b pb-2 flex items-center justify-between">
                      <span>
                        ĐỀ THI MÔN {exam.metadata.subject.toUpperCase()} - MÃ ĐỀ {currentViewedExam.code}
                      </span>
                      <span className="text-xs text-slate-500 font-normal">
                        Xem trước 4 câu đầu Phần I
                      </span>
                    </div>

                    <div className="font-semibold text-sky-800">
                      PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn
                    </div>
                    {currentViewedExam.part1.slice(0, 4).map((q, idx) => (
                      <div key={q.id} className="p-2.5 bg-slate-50 rounded border border-slate-200">
                        <span className="font-bold text-slate-900 mr-1">Câu {idx + 1}.</span>
                        <span>{q.content}</span>
                        <div className="grid grid-cols-2 gap-2 mt-2 font-medium text-slate-700">
                          <div>A. {q.options.A}</div>
                          <div>B. {q.options.B}</div>
                          <div>C. {q.options.C}</div>
                          <div>D. {q.options.D}</div>
                        </div>
                      </div>
                    ))}
                    <div className="text-slate-400 italic">
                      ... và {Math.max(0, currentViewedExam.part1.length - 4)} câu còn lại của Phần I, các câu Phần II và Phần III đã được hoán vị hoàn hảo.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Hệ thống tuân thủ quy tắc hoán vị không làm thay đổi ngữ nghĩa chuyên môn.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
