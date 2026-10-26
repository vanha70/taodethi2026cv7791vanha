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
import { DualCloudConfigModal } from './components/DualCloudConfigModal';
import { AuthLoginModal } from './components/AuthLoginModal';
import { TeacherManagementModal } from './components/TeacherManagementModal';
import {
  ExamRoomDoc,
  extractRoomCodeFromLocation,
  isStudentPortalLocation,
} from './services/roomService';
import {
  TeacherAccountDoc,
  loadSavedAuthSession,
  logoutAuthSession,
  ensureSuperAdminInitializedOnCloud,
  subscribeToTeacherAccounts,
  normalizeUsername,
} from './services/authService';
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

  // Current authenticated Teacher / Admin user (null = Student / Unauthenticated visitor)
  const [currentUser, setCurrentUser] = useState<TeacherAccountDoc | null>(() =>
    loadSavedAuthSession()
  );
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginModalMode, setLoginModalMode] = useState<'login' | 'change_password'>('login');
  const [isTeacherMgmtModalOpen, setIsTeacherMgmtModalOpen] = useState<boolean>(false);

  const [urlRoomCode, setUrlRoomCode] = useState<string | null>(() =>
    extractRoomCodeFromLocation()
  );
  const [isStudentPortalMode, setIsStudentPortalMode] = useState<boolean>(() =>
    isStudentPortalLocation()
  );

  const [activeTab, setActiveTab] = useState<'editor' | 'matrix' | 'test' | 'preview' | 'rooms'>(
    () => (isStudentPortalLocation() || !loadSavedAuthSession() ? 'rooms' : 'editor')
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
  const [isCloudConfigModalOpen, setIsCloudConfigModalOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string>(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Initialize default Super Admin (`admin` / `vanha`) in background & watch if current teacher account gets locked
  useEffect(() => {
    ensureSuperAdminInitializedOnCloud().catch(() => {
      // offline-first
    });
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeToTeacherAccounts((accounts) => {
      const found = accounts.find(
        (a) => normalizeUsername(a.username) === normalizeUsername(currentUser.username)
      );
      if (found) {
        if (found.status === 'locked' && found.role !== 'admin') {
          logoutAuthSession();
          setCurrentUser(null);
          setIsStudentPortalMode(true);
          setActiveTab('rooms');
          showToast('Tài khoản của bạn đã bị Quản trị viên tạm khóa quyền truy cập!');
        } else if (
          found.fullName !== currentUser.fullName ||
          found.role !== currentUser.role ||
          found.password !== currentUser.password
        ) {
          setCurrentUser(found);
        }
      }
    });
    return () => unsubscribe();
  }, [currentUser?.username]);

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

  const safeExam: ExamData = {
    metadata: {
      ...sampleChemistry12Exam.metadata,
      ...(exam?.metadata || {}),
    },
    matrix: Array.isArray(exam?.matrix) ? exam.matrix : sampleChemistry12Exam.matrix,
    specification: Array.isArray(exam?.specification)
      ? exam.specification
      : sampleChemistry12Exam.specification,
    part1: Array.isArray(exam?.part1) ? exam.part1 : sampleChemistry12Exam.part1,
    part2: Array.isArray(exam?.part2) ? exam.part2 : sampleChemistry12Exam.part2,
    part3: Array.isArray(exam?.part3) ? exam.part3 : sampleChemistry12Exam.part3,
    essay: Array.isArray(exam?.essay) ? exam.essay : sampleChemistry12Exam.essay,
  };

  const totalQuestions =
    (safeExam.part1?.length ?? 0) +
    (safeExam.part2?.length ?? 0) +
    (safeExam.part3?.length ?? 0) +
    (safeExam.essay?.length ?? 0);

  // Security Gate: If not logged in (or explicitly opening student link ?mode=student&room=XXXX),
  // lock out Teacher/Admin views and only show the Student Portal (`CỔNG VÀO PHÒNG THI TRỰC TUYẾN`)
  const isLockedToStudentPortal = !currentUser || isStudentPortalMode;

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col font-sans overflow-x-clip">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs sm:text-sm font-medium flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Top Header (Only rendered when logged in as Teacher/Admin and not in Student Portal / Test mode) */}
      {!isLockedToStudentPortal && !studentSession && (
        <ExamHeader
          metadata={safeExam.metadata}
          onUpdateMetadata={(meta) => setExam({ ...safeExam, metadata: meta })}
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
          onOpenCloudConfigModal={() => setIsCloudConfigModalOpen(true)}
          currentUser={currentUser}
          onOpenTeacherManagementModal={() => setIsTeacherMgmtModalOpen(true)}
          onOpenChangePasswordModal={() => {
            setLoginModalMode('change_password');
            setIsLoginModalOpen(true);
          }}
          onLogout={() => {
            logoutAuthSession();
            setCurrentUser(null);
            setActiveTab('rooms');
            showToast('Đã đăng xuất khỏi tài khoản Giáo viên / Admin!');
          }}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* =====================================================================
            TẦNG 4: KHUNG THÔNG TIN ĐỀ THI & THANH CÔNG CỤ CHUYÊN MÔN (ACTION CARD)
            ===================================================================== */}
        {!isLockedToStudentPortal && !studentSession && activeTab !== 'test' && (
          <div className="mb-6 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 space-y-3 text-xs text-slate-700 print:hidden">
            {/* Hàng trên: Thông tin đề thi & Nút Chỉnh sửa thông tin đề thi */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                  {safeExam.metadata?.schoolName}
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-bold text-indigo-700 text-xs sm:text-sm">
                  {safeExam.metadata?.examTitle}
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-medium text-slate-600">
                  {safeExam.metadata?.academicYear}
                </span>
                <span className="text-slate-300">•</span>
                <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-0.5 rounded-lg font-bold">
                  ⏱️ {safeExam.metadata?.durationMinutes} phút
                </span>
                <span className="bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-0.5 rounded-lg font-bold">
                  Mã đề: {safeExam.metadata?.examCode || '101'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsMetadataModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200/90 transition-colors cursor-pointer shrink-0"
              >
                <span>✏️ Chỉnh sửa thông tin đề thi</span>
              </button>
            </div>

            {/* Hàng dưới: Các công cụ tác vụ đề thi (Gom nhóm theo màu sắc khoa học, không trùng lặp) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
              {/* Nhóm 1: Nhóm Nhập đề & AI */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Nút chính nổi bật màu xanh lá/emerald */}
                <button
                  type="button"
                  onClick={() => setIsRawImportOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm shadow-emerald-200 transition-all cursor-pointer"
                  title="Tải lên file PDF đề thi có sẵn đáp án (PDF.js + KaTeX mhchem + Cắt hình vẽ Canvas)"
                >
                  <span>📄 Tải Đề PDF Có Đáp Án &amp; Tạo Bài Thi Online</span>
                </button>

                {/* Tạo Đề AI */}
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 shadow-xs transition-all cursor-pointer"
                  title="Phím tắt: Ctrl + G"
                >
                  <span>✨ Tạo Đề AI</span>
                </button>

                {/* AI Gợi Ý Phân Bổ Mức Độ */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('matrix');
                    showToast('Đã mở Trợ lý AI Gợi ý Phân bổ Mức độ Nhận thức!');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                  title="AI tự động gợi ý phân bổ số lượng câu hỏi Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao theo thời lượng & độ khó"
                >
                  <span>✨ AI Gợi Ý Phân Bổ Mức Độ</span>
                </button>

                {/* Đề Mẫu (Hóa 12 / Toán 12) */}
                <div className="inline-flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs">
                  <span className="px-2 text-slate-600 font-bold">📚 Đề Mẫu:</span>
                  <button
                    type="button"
                    onClick={() => handleSelectSample('chem12')}
                    className="px-2.5 py-1 rounded-lg font-bold text-slate-700 hover:text-indigo-700 hover:bg-white transition-colors cursor-pointer"
                    title="Đề mẫu Hóa học 12 (Ester - Lipid - Carbohydrate)"
                  >
                    Hóa 12
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSample('math12')}
                    className="px-2.5 py-1 rounded-lg font-bold text-slate-700 hover:text-indigo-700 hover:bg-white transition-colors cursor-pointer"
                    title="Đề mẫu Toán học 12 (Đạo hàm, Oxyz)"
                  >
                    Toán 12
                  </button>
                </div>
              </div>

              {/* Nhóm 2: Nhóm Xuất bản & In ấn */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Trộn Đề Thi */}
                <button
                  type="button"
                  onClick={() => setIsShuffleOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
                  title="Trộn đề và tạo nhiều mã đề (Ctrl + Shift + S)"
                >
                  <span>🔀 Trộn Đề Thi</span>
                </button>

                {/* Xuất Word (.docx) */}
                <button
                  type="button"
                  onClick={handleExportDocx}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                  title="Xuất file Word (Ctrl + Shift + E)"
                >
                  <span>📥 Xuất Word (.docx)</span>
                </button>

                {/* In đề */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                  title="In đề thi hoặc xuất PDF (Ctrl + P)"
                >
                  <span>🖨️ In đề</span>
                </button>

                {/* Phím tắt */}
                <button
                  type="button"
                  onClick={() => setIsShortcutsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                  title="Xem danh sách phím tắt toàn cục (Phím ?)"
                >
                  <span>⌨️ Phím tắt</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: QUESTION EDITOR */}
        {!isLockedToStudentPortal && activeTab === 'editor' && (
          <QuestionEditor
            part1={safeExam.part1}
            part2={safeExam.part2}
            part3={safeExam.part3}
            essay={safeExam.essay}
            subject={safeExam.metadata?.subject || 'Hóa học'}
            onUpdatePart1={(part1) => setExam({ ...safeExam, part1 })}
            onUpdatePart2={(part2) => setExam({ ...safeExam, part2 })}
            onUpdatePart3={(part3) => setExam({ ...safeExam, part3 })}
            onUpdateEssay={(essay) => setExam({ ...safeExam, essay })}
          />
        )}

        {/* TAB 2: MATRIX & SPECIFICATION */}
        {!isLockedToStudentPortal && activeTab === 'matrix' && (
          <MatrixSpecTable
            matrix={safeExam.matrix}
            specification={safeExam.specification}
            subject={safeExam.metadata?.subject || 'Hóa học'}
            grade={safeExam.metadata?.grade || '12'}
            durationMinutes={safeExam.metadata?.durationMinutes || 45}
            part1={safeExam.part1}
            part2={safeExam.part2}
            part3={safeExam.part3}
            essay={safeExam.essay}
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
        {!isLockedToStudentPortal && activeTab === 'preview' && (
          <OfficialExamPreview
            exam={safeExam}
            onPrint={handlePrint}
            onExportDocx={handleExportDocx}
          />
        )}

        {/* TAB 4: ONLINE TEST ROOM (TESTING OR STUDENT TAKING EXAM) */}
        {activeTab === 'test' && (
          <OnlineTestRoom
            exam={studentSession?.room?.examData || safeExam}
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
            roomId={studentSession ? studentSession.room?.id : undefined}
            roomCode={studentSession ? studentSession.room?.roomCode : undefined}
            allowReview={studentSession ? studentSession.room?.allowReview : true}
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
        {(activeTab === 'rooms' || (isLockedToStudentPortal && !studentSession)) &&
          activeTab !== 'test' && (
            <OnlineRoomManager
              currentExam={safeExam}
              initialRoomCode={urlRoomCode}
              standaloneStudentMode={isLockedToStudentPortal}
              currentUser={currentUser}
              onOpenLoginModal={() => {
                setLoginModalMode('login');
                setIsLoginModalOpen(true);
              }}
              onOpenTeacherManagementModal={() => setIsTeacherMgmtModalOpen(true)}
              onExitStandaloneStudentMode={() => {
                if (!currentUser) {
                  setLoginModalMode('login');
                  setIsLoginModalOpen(true);
                  return;
                }
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

      {/* AUTH LOGIN & PASSWORD CHANGE MODAL (ALWAYS AVAILABLE) */}
      <AuthLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        initialMode={loginModalMode}
        onLoginSuccess={(loggedInUser) => {
          setCurrentUser(loggedInUser);
          setIsStudentPortalMode(false);
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState({}, '', window.location.pathname);
          }
          setActiveTab((prev) => (prev === 'test' ? 'rooms' : prev));
          showToast(
            `Đăng nhập thành công: ${loggedInUser.fullName} (${
              loggedInUser.role === 'admin' ? 'Quản trị viên' : 'Giáo viên'
            })!`
          );
        }}
        onPasswordChanged={(updatedUser) => {
          setCurrentUser(updatedUser);
          showToast(`Đã cập nhật mật khẩu mới cho tài khoản ${updatedUser.fullName}!`);
        }}
      />

      {/* ADMIN ONLY: TEACHER ACCOUNT MANAGEMENT MODAL */}
      {currentUser?.role === 'admin' && (
        <TeacherManagementModal
          isOpen={isTeacherMgmtModalOpen}
          onClose={() => setIsTeacherMgmtModalOpen(false)}
          currentUser={currentUser}
          onAccountUpdated={(msg) => showToast(msg)}
        />
      )}

      {/* METADATA EDIT MODAL */}
      {isMetadataModalOpen && !isLockedToStudentPortal && (
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
                  value={safeExam.metadata?.schoolName || ''}
                  onChange={(e) =>
                    setExam({
                      ...safeExam,
                      metadata: { ...safeExam.metadata, schoolName: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tổ bộ môn:</label>
                <input
                  type="text"
                  value={safeExam.metadata?.departmentName || ''}
                  onChange={(e) =>
                    setExam({
                      ...safeExam,
                      metadata: { ...safeExam.metadata, departmentName: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên kỳ thi / Đề kiểm tra:</label>
                <input
                  type="text"
                  value={safeExam.metadata?.examTitle || ''}
                  onChange={(e) =>
                    setExam({
                      ...safeExam,
                      metadata: { ...safeExam.metadata, examTitle: e.target.value },
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
                    value={safeExam.metadata?.academicYear || ''}
                    onChange={(e) =>
                      setExam({
                        ...safeExam,
                        metadata: { ...safeExam.metadata, academicYear: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thời gian (phút):</label>
                  <input
                    type="number"
                    value={safeExam.metadata?.durationMinutes || 45}
                    onChange={(e) =>
                      setExam({
                        ...safeExam,
                        metadata: {
                          ...safeExam.metadata,
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
                    value={safeExam.metadata?.examCode || ''}
                    onChange={(e) =>
                      setExam({
                        ...safeExam,
                        metadata: { ...safeExam.metadata, examCode: e.target.value },
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bộ sách:</label>
                  <input
                    type="text"
                    value={safeExam.metadata?.curriculum || ''}
                    onChange={(e) =>
                      setExam({
                        ...safeExam,
                        metadata: { ...safeExam.metadata, curriculum: e.target.value },
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

      {/* TEACHER MODALS (NOT MOUNTED IN STUDENT PORTAL MODE TO PREVENT PDF.JS / MOBILE WEBVIEW CONFLICTS) */}
      {!isLockedToStudentPortal && (
        <>
          <ShuffleModal
            isOpen={isShuffleOpen}
            onClose={() => setIsShuffleOpen(false)}
            exam={safeExam}
          />

          <AiExamModal
            isOpen={isAiModalOpen}
            onClose={() => setIsAiModalOpen(false)}
            onExamGenerated={handleExamGenerated}
          />

          <RawImportModal
            isOpen={isRawImportOpen}
            onClose={() => setIsRawImportOpen(false)}
            onImportParsed={handleRawImport}
            subject={safeExam.metadata?.subject || 'Hóa học'}
          />

          <KeyboardShortcutsModal
            isOpen={isShortcutsModalOpen}
            onClose={() => setIsShortcutsModalOpen(false)}
          />

          <WordExportModal
            isOpen={isWordExportModalOpen}
            onClose={() => setIsWordExportModalOpen(false)}
            exam={safeExam}
            onExportSuccess={(msg) => showToast(msg)}
          />

          <DualCloudConfigModal
            isOpen={isCloudConfigModalOpen}
            onClose={() => setIsCloudConfigModalOpen(false)}
            onConfigUpdated={() =>
              showToast('Đã cập nhật cấu hình Lưu Trữ Đám Mây Kép (Firebase & Google Sheets/Drive)!')
            }
          />
        </>
      )}

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
