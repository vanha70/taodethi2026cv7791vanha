import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  Shuffle,
  Download,
  Printer,
  PlayCircle,
  HelpCircle,
  Settings,
  BookOpen,
  Share2,
  Check,
} from 'lucide-react';
import { ExamData, ExamMetadata } from './types/exam';
import { sampleChemistry12Exam, sampleMath12Exam } from './utils/sampleExams';
import { ExamHeader } from './components/ExamHeader';
import { MatrixSpecTable } from './components/MatrixSpecTable';
import { QuestionEditor } from './components/QuestionEditor';
import { OnlineTestRoom } from './components/OnlineTestRoom';
import { OfficialExamPreview } from './components/OfficialExamPreview';
import { ShuffleModal } from './components/ShuffleModal';
import { AiExamModal } from './components/AiExamModal';
import { RawImportModal } from './components/RawImportModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { OnlineRoomManager } from './components/OnlineRoomManager';
import { WordExportModal } from './components/WordExportModal';
import {
  ExamRoomDoc,
  extractRoomCodeFromLocation,
  isStudentPortalLocation,
} from './services/roomService';
import { safeLocalStorage } from './utils/browserSafeguards';

const STORAGE_KEY = 'taodethi2026_exam_state';

export default function App() {
  // Load saved state or default to chemistry 12 exam (safely wrapped for Zalo/iOS Safari WebViews)
  const [exam, setExam] = useState<ExamData>(() => {
    try {
      const saved = safeLocalStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return sampleChemistry12Exam;
  });

  const [urlRoomCode, setUrlRoomCode] = useState<string | null>(() =>
    extractRoomCodeFromLocation()
  );
  const [isStudentPortalMode, setIsStudentPortalMode] = useState<boolean>(() =>
    isStudentPortalLocation()
  );

  const [activeTab, setActiveTab] = useState<'editor' | 'matrix' | 'test' | 'preview' | 'rooms'>(
    () => (isStudentPortalLocation() ? 'rooms' : 'editor')
  );
  const [studentSession, setStudentSession] = useState<{
    room: ExamRoomDoc;
    studentInfo: { name: string; className: string; sbd: string };
  } | null>(null);
  const [isShuffleOpen, setIsShuffleOpen] = useState<boolean>(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [isRawImportOpen, setIsRawImportOpen] = useState<boolean>(false);
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isWordExportModalOpen, setIsWordExportModalOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string>(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Auto save to safeLocalStorage with immediate visual feedback
  useEffect(() => {
    setIsSaving(true);
    try {
      safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(exam));
      const now = new Date();
      setLastSavedTime(
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      );
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    } finally {
      const timer = setTimeout(() => setIsSaving(false), 500);
      return () => clearTimeout(timer);
    }
  }, [exam]);

  // Listen for ?room= / #room= / ?mode=student in window.location (including hashchange / popstate)
  // Always route student links to the standalone CỔNG VÀO PHÒNG THI TRỰC TUYẾN first (never bypass login)
  useEffect(() => {
    const syncRoomFromUrl = () => {
      const detectedCode = extractRoomCodeFromLocation();
      const detectedStudentMode = isStudentPortalLocation();
      if (detectedCode) {
        setUrlRoomCode(detectedCode);
      }
      if (detectedStudentMode) {
        setIsStudentPortalMode(true);
        setActiveTab((prev) => (prev === 'test' ? 'test' : 'rooms'));
      }
    };
    window.addEventListener('hashchange', syncRoomFromUrl);
    window.addEventListener('popstate', syncRoomFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncRoomFromUrl);
      window.removeEventListener('popstate', syncRoomFromUrl);
    };
  }, []);

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+P, Ctrl+Shift+E, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      // Ctrl + S / Cmd + S: Manual Save
      if (isCtrlOrCmd && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        try {
          safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(exam));
          const now = new Date();
          setLastSavedTime(
            `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
          );
          showToast('Đã lưu dữ liệu đề thi thành công! (Ctrl + S)');
        } catch (err) {
          console.error(err);
        }
        return;
      }

      // Ctrl + P / Cmd + P: Print
      if (isCtrlOrCmd && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        window.print();
        return;
      }

      // Ctrl + Shift + E: Export Word .docx
      if (isCtrlOrCmd && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        handleExportDocx();
        return;
      }

      // Ctrl + Shift + S: Open Shuffle Modal
      if (isCtrlOrCmd && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setIsShuffleOpen(true);
        return;
      }

      // Ctrl + G / Cmd + G: Open AI Exam Generator
      if (isCtrlOrCmd && !e.shiftKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        setIsAiModalOpen(true);
        return;
      }

      // Ctrl + M / Cmd + M: Switch to Matrix & Spec Tab
      if (isCtrlOrCmd && !e.shiftKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setActiveTab('matrix');
        showToast('Chuyển sang Ma trận & Bản đặc tả CV 7991 (Ctrl + M)');
        return;
      }

      // Press ? to toggle shortcuts modal (when not focused on input)
      if (!isInput && e.key === '?') {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exam]);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Sample switch
  const handleSelectSample = (type: 'chem12' | 'math12') => {
    if (type === 'chem12') {
      setExam(sampleChemistry12Exam);
      showToast('Đã nạp đề mẫu Hóa học 12 (Ester - Lipid - Carbohydrate)');
    } else {
      setExam(sampleMath12Exam);
      showToast('Đã nạp đề mẫu Toán học 12 (Ứng dụng đạo hàm, Tọa độ Oxyz)');
    }
  };

  // AI Exam generated
  const handleExamGenerated = (newExamData: Partial<ExamData>) => {
    setExam((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        subject: newExamData.metadata?.subject || (newExamData as any)?.subject || prev.metadata.subject,
        grade: newExamData.metadata?.grade || (newExamData as any)?.grade || prev.metadata.grade,
        term: newExamData.metadata?.term || (newExamData as any)?.term || prev.metadata.term,
        durationMinutes:
          newExamData.metadata?.durationMinutes || (newExamData as any)?.duration || prev.metadata.durationMinutes,
      },
      matrix: newExamData.matrix || prev.matrix,
      specification: newExamData.specification || prev.specification,
      part1: newExamData.part1 || prev.part1,
      part2: newExamData.part2 || prev.part2,
      part3: newExamData.part3 || prev.part3,
      essay: newExamData.essay || prev.essay,
    }));
    showToast('Tạo đề thi mới bằng AI thành công!');
    setActiveTab('editor');
  };

  // PDF / Raw Import parsed
  const handleRawImport = (
    data: any,
    startOnlineTestImmediately?: boolean,
    openFirebasePublish?: boolean
  ) => {
    setExam((prev) => ({
      ...prev,
      part1: data.part1 && data.part1.length > 0 ? data.part1 : prev.part1,
      part2: data.part2 && data.part2.length > 0 ? data.part2 : prev.part2,
      part3: data.part3 && data.part3.length > 0 ? data.part3 : prev.part3,
      essay: data.essay && data.essay.length > 0 ? data.essay : prev.essay,
    }));
    if (openFirebasePublish) {
      setActiveTab('rooms');
      showToast(
        'Đã nạp đề PDF 3 phần! Hãy kiểm tra Mã đề 4 số, Lớp và nhấn "Xuất bản & Lưu Firebase".'
      );
    } else if (startOnlineTestImmediately) {
      setStudentSession(null);
      setActiveTab('test');
      showToast(
        'Đã bóc tách PDF, ẩn đáp án ngầm, chuẩn hóa KaTeX (mhchem) & trộn đề thi Online!'
      );
    } else {
      setActiveTab('editor');
      showToast('Đã bóc tách PDF/văn bản và cập nhật các câu hỏi vào đề thi!');
    }
  };

  // Open Word Export customization modal
  const handleExportDocx = () => {
    setIsWordExportModalOpen(true);
  };

  // Direct print
  const handlePrint = () => {
    window.print();
  };

  const totalQuestions = exam.part1.length + exam.part2.length + exam.part3.length + exam.essay.length;

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col font-sans overflow-x-clip">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs sm:text-sm font-medium flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Top Header (Completely hidden in Independent Student Portal Mode or when Student is taking an exam) */}
      {!isStudentPortalMode && !studentSession && (
        <ExamHeader
          metadata={exam.metadata}
          onUpdateMetadata={(meta) => setExam({ ...exam, metadata: meta })}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenAiModal={() => setIsAiModalOpen(true)}
          onOpenRawImport={() => setIsRawImportOpen(true)}
          onOpenShuffleModal={() => setIsShuffleOpen(true)}
          onExportDocx={handleExportDocx}
          onPrintExam={handlePrint}
          onSelectSample={handleSelectSample}
          totalQuestions={totalQuestions}
          lastSavedTime={lastSavedTime}
          isSaving={isSaving}
          onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Quick Header Config Bar (Editable Title, School, Time) - Hidden in Student Mode */}
        {!isStudentPortalMode && !studentSession && activeTab !== 'test' && (
          <div className="mb-6 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 print:hidden">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-slate-900">{exam.metadata.schoolName}</span>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-indigo-700">{exam.metadata.examTitle}</span>
              <span className="text-slate-300">•</span>
              <span>{exam.metadata.academicYear}</span>
              <span className="text-slate-300">•</span>
              <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded font-semibold">
                ⏱ {exam.metadata.durationMinutes} phút
              </span>
              <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-medium">
                Mã đề: {exam.metadata.examCode || '101'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsRawImportOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg border border-emerald-300 transition-colors cursor-pointer"
                title="Tải lên file PDF đề thi có sẵn đáp án (PDF.js + KaTeX mhchem + Cắt hình vẽ)"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-700" />
                <span>Tải Đề PDF Có Đáp Án & Tạo Bài Thi Online</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('matrix');
                  showToast('Đã mở Trợ lý AI Gợi ý Phân bổ Mức độ Nhận thức!');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg border border-amber-300 transition-colors cursor-pointer"
                title="AI tự động gợi ý phân bổ số lượng câu hỏi Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao theo thời lượng & độ khó"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>AI Gợi Ý Phân Bổ Mức Độ</span>
              </button>

              <button
                onClick={() => setIsMetadataModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Chỉnh Sửa Thông Tin Đề Thi</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: QUESTION EDITOR */}
        {activeTab === 'editor' && (
          <QuestionEditor
            part1={exam.part1}
            part2={exam.part2}
            part3={exam.part3}
            essay={exam.essay}
            subject={exam.metadata.subject}
            onUpdatePart1={(part1) => setExam({ ...exam, part1 })}
            onUpdatePart2={(part2) => setExam({ ...exam, part2 })}
            onUpdatePart3={(part3) => setExam({ ...exam, part3 })}
            onUpdateEssay={(essay) => setExam({ ...exam, essay })}
          />
        )}

        {/* TAB 2: MATRIX & SPECIFICATION */}
        {activeTab === 'matrix' && (
          <MatrixSpecTable
            matrix={exam.matrix}
            specification={exam.specification}
            subject={exam.metadata.subject}
            grade={exam.metadata.grade}
            durationMinutes={exam.metadata.durationMinutes}
            part1={exam.part1}
            part2={exam.part2}
            part3={exam.part3}
            essay={exam.essay}
            onUpdateMatrix={(matrix) => {
              setExam((prev) => ({ ...prev, matrix }));
              showToast('Đã cập nhật bảng Ma trận đề kiểm tra!');
            }}
            onUpdateSpecification={(specification) =>
              setExam((prev) => ({ ...prev, specification }))
            }
            onUpdateDuration={(durationMinutes) =>
              setExam((prev) => ({
                ...prev,
                metadata: { ...prev.metadata, durationMinutes },
              }))
            }
            onSyncQuestionsLevel={({ part1, part2, part3, essay }) => {
              setExam((prev) => ({ ...prev, part1, part2, part3, essay }));
              showToast('Đã đồng bộ mức độ nhận thức cho danh sách câu hỏi!');
            }}
          />
        )}

        {/* TAB 3: OFFICIAL EXAM PREVIEW (PRINTABLE) */}
        {activeTab === 'preview' && (
          <OfficialExamPreview
            exam={exam}
            onPrint={handlePrint}
            onExportDocx={handleExportDocx}
          />
        )}

        {/* TAB 4: ONLINE TEST ROOM (TESTING OR STUDENT TAKING EXAM) */}
        {activeTab === 'test' && (
          <OnlineTestRoom
            exam={studentSession ? studentSession.room.examData : exam}
            onUpdateExam={(updatedExam) => {
              if (studentSession) {
                setStudentSession({
                  ...studentSession,
                  room: { ...studentSession.room, examData: updatedExam },
                });
              } else {
                setExam(updatedExam);
              }
            }}
            studentInfo={studentSession ? studentSession.studentInfo : undefined}
            roomId={studentSession ? studentSession.room.id : undefined}
            roomCode={studentSession ? studentSession.room.roomCode : undefined}
            allowReview={studentSession ? studentSession.room.allowReview : true}
            onExitTest={() => {
              if (studentSession) {
                setStudentSession(null);
                setActiveTab('rooms');
              } else {
                setActiveTab('editor');
              }
            }}
          />
        )}

        {/* TAB 5: ONLINE ROOM MANAGER & FIREBASE DASHBOARD (OR STANDALONE STUDENT PORTAL) */}
        {(activeTab === 'rooms' || (isStudentPortalMode && !studentSession)) &&
          activeTab !== 'test' && (
            <OnlineRoomManager
              currentExam={exam}
              initialRoomCode={urlRoomCode}
              standaloneStudentMode={isStudentPortalMode}
              onExitStandaloneStudentMode={() => {
                setIsStudentPortalMode(false);
                if (typeof window !== 'undefined' && window.history?.replaceState) {
                  window.history.replaceState({}, '', window.location.pathname);
                }
                setActiveTab('rooms');
              }}
              onUpdateExamMetadata={(examCode, grade, durationMinutes, examTitle) => {
                setExam((prev) => ({
                  ...prev,
                  metadata: {
                    ...prev.metadata,
                    examCode,
                    grade,
                    durationMinutes,
                    examTitle,
                  },
                }));
              }}
              onStudentStartTest={(room, studentInfo) => {
                setStudentSession({ room, studentInfo });
                setActiveTab('test');
                showToast(`Chào mừng ${studentInfo.name} (${studentInfo.className}) vào phòng thi ${room.roomCode}!`);
              }}
            />
          )}
      </main>

      {/* METADATA EDIT MODAL */}
      {isMetadataModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b pb-2">
              THIẾT LẬP THÔNG TIN TIÊU ĐỀ ĐỀ THI
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên Trường / Đơn vị:</label>
                <input
                  type="text"
                  value={exam.metadata.schoolName}
                  onChange={(e) =>
                    setExam({
                      ...exam,
                      metadata: { ...exam.metadata, schoolName: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tổ bộ môn:</label>
                <input
                  type="text"
                  value={exam.metadata.departmentName}
                  onChange={(e) =>
                    setExam({
                      ...exam,
                      metadata: { ...exam.metadata, departmentName: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên kỳ thi / Đề kiểm tra:</label>
                <input
                  type="text"
                  value={exam.metadata.examTitle}
                  onChange={(e) =>
                    setExam({
                      ...exam,
                      metadata: { ...exam.metadata, examTitle: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Năm học:</label>
                  <input
                    type="text"
                    value={exam.metadata.academicYear}
                    onChange={(e) =>
                      setExam({
                        ...exam,
                        metadata: { ...exam.metadata, academicYear: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thời gian (phút):</label>
                  <input
                    type="number"
                    value={exam.metadata.durationMinutes}
                    onChange={(e) =>
                      setExam({
                        ...exam,
                        metadata: {
                          ...exam.metadata,
                          durationMinutes: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã đề gốc:</label>
                  <input
                    type="text"
                    value={exam.metadata.examCode}
                    onChange={(e) =>
                      setExam({
                        ...exam,
                        metadata: { ...exam.metadata, examCode: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bộ sách:</label>
                  <input
                    type="text"
                    value={exam.metadata.curriculum}
                    onChange={(e) =>
                      setExam({
                        ...exam,
                        metadata: { ...exam.metadata, curriculum: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => setIsMetadataModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHUFFLE MODAL */}
      <ShuffleModal
        isOpen={isShuffleOpen}
        onClose={() => setIsShuffleOpen(false)}
        exam={exam}
      />

      {/* AI GENERATOR MODAL */}
      <AiExamModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onExamGenerated={handleExamGenerated}
      />

      {/* RAW TEXT IMPORT MODAL */}
      <RawImportModal
        isOpen={isRawImportOpen}
        onClose={() => setIsRawImportOpen(false)}
        onImportParsed={handleRawImport}
        subject={exam.metadata.subject}
      />

      {/* KEYBOARD SHORTCUTS MODAL */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* WORD (.DOCX) EXPORT OPTIONS MODAL */}
      <WordExportModal
        isOpen={isWordExportModalOpen}
        onClose={() => setIsWordExportModalOpen(false)}
        exam={exam}
        onExportSuccess={(msg) => showToast(msg)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <p className="font-semibold text-slate-800">
              TẠO ĐỀ THI 2026 - Phần mềm tạo đề thi, ma trận & bản đặc tả theo Công văn 7991/BGDĐT-GDTrH
            </p>
            <p className="text-slate-500 mt-0.5">
              Phát triển phục vụ cộng đồng giáo viên và học sinh Việt Nam theo Chương trình GDPT 2018
            </p>
          </div>

          {/* Author Badge & Contact Info */}
          <div className="flex flex-wrap items-center gap-2 bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-100 rounded-xl px-4 py-2 text-indigo-950 font-medium shadow-2xs">
            <span className="text-slate-600">Tác giả:</span>
            <span className="font-bold text-indigo-900">Thầy: Nguyễn Văn Hà</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">Liên hệ:</span>
            <a
              href="tel:0766649979"
              className="font-bold text-indigo-700 hover:text-indigo-900 transition-colors"
            >
              0766.649.979
            </a>
            <button
              onClick={() => setIsShortcutsModalOpen(true)}
              className="ml-2 text-[11px] font-semibold text-slate-500 hover:text-indigo-700 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs cursor-pointer"
            >
              ⌨️ Phím tắt (Ctrl+S, Ctrl+P)
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
