import React from 'react';
import {
  FileText,
  Sparkles,
  Shuffle,
  Download,
  Printer,
  PlayCircle,
  FileCode,
  BookOpen,
  Settings,
  Users,
  ShieldCheck,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { ExamMetadata } from '../types/exam';
import { TeacherAccountDoc } from '../services/authService';

interface ExamHeaderProps {
  metadata: ExamMetadata;
  onUpdateMetadata: (meta: ExamMetadata) => void;
  activeTab: 'editor' | 'matrix' | 'test' | 'preview' | 'rooms';
  setActiveTab: (tab: 'editor' | 'matrix' | 'test' | 'preview' | 'rooms') => void;
  onOpenAiModal: () => void;
  onOpenRawImport: () => void;
  onOpenShuffleModal: () => void;
  onExportDocx: () => void;
  onPrintExam: () => void;
  onSelectSample: (type: 'chem12' | 'math12') => void;
  totalQuestions: number;
  lastSavedTime?: string;
  isSaving?: boolean;
  onOpenShortcutsModal: () => void;
  onOpenCloudConfigModal?: () => void;
  currentUser?: TeacherAccountDoc | null;
  onOpenTeacherManagementModal?: () => void;
  onOpenChangePasswordModal?: () => void;
  onLogout?: () => void;
}

export const ExamHeader: React.FC<ExamHeaderProps> = ({
  metadata,
  onUpdateMetadata,
  activeTab,
  setActiveTab,
  onOpenAiModal,
  onOpenRawImport,
  onOpenShuffleModal,
  onExportDocx,
  onPrintExam,
  onSelectSample,
  totalQuestions,
  lastSavedTime,
  isSaving = false,
  onOpenShortcutsModal,
  onOpenCloudConfigModal,
  currentUser,
  onOpenTeacherManagementModal,
  onOpenChangePasswordModal,
  onLogout,
}) => {
  const isAdmin = currentUser?.role === 'admin';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs print:hidden">
      {/* Top Banner with App Brand and Quick Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 min-h-[4rem]">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight tracking-tight">
                  TẠO ĐỀ THI 2026
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Chuẩn CV 7991
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Định dạng 2025-2026
                </span>

                {/* LocalStorage Visual Save Indicator (Ctrl+S) */}
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 transition-all shadow-2xs cursor-pointer hover:bg-slate-100"
                  title="Nhấn Ctrl + S để lưu tức thì"
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isSaving ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-ping'
                      }`}
                    ></span>
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isSaving ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    ></span>
                  </span>
                  <span className="text-[11px] text-slate-600 font-medium">
                    {isSaving ? 'Đang lưu...' : lastSavedTime ? `Đã lưu ${lastSavedTime}` : 'Đã lưu'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="truncate max-w-xs sm:max-w-md">
                  {metadata.subject} • Khối {metadata.grade} • {metadata.durationMinutes} phút • {totalQuestions} câu hỏi
                </span>
                <span className="hidden sm:inline text-slate-300">|</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-indigo-700 font-semibold bg-indigo-50/80 px-2 py-0.2 rounded border border-indigo-100">
                  Thầy: Nguyễn Văn Hà • 0766.649.979
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* ADMIN ONLY: Teacher Account Management Button */}
            {isAdmin && onOpenTeacherManagementModal && (
              <button
                onClick={onOpenTeacherManagementModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold text-amber-950 bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-300 hover:from-amber-400 hover:to-yellow-400 border border-amber-500/60 shadow-xs transition-all cursor-pointer"
                title="Cấp quyền & quản lý tài khoản giáo viên trên Firebase (teacher_accounts) & Google Sheets"
              >
                <span>👥 Quản lý Giáo viên (Cấp quyền)</span>
              </button>
            )}

            {/* Dual Cloud Config Button */}
            {onOpenCloudConfigModal && (
              <button
                onClick={onOpenCloudConfigModal}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-800 hover:text-indigo-950 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                title="⚙️ Cấu hình Cloud Kép: Firebase & Google Sheets + Google Drive"
              >
                <span>⚙️ Cấu hình Cloud</span>
              </button>
            )}

            {/* Keyboard Shortcuts Trigger Button */}
            <button
              onClick={onOpenShortcutsModal}
              className="hidden xl:inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
              title="Xem danh sách phím tắt toàn cục (Phím ?)"
            >
              <span>⌨️ Phím tắt</span>
            </button>

            {/* Sample Selector */}
            <div className="hidden xl:flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs">
              <span className="px-2 text-slate-500 flex items-center gap-1 font-medium">
                <BookOpen className="w-3.5 h-3.5" /> Mẫu:
              </span>
              <button
                onClick={() => onSelectSample('chem12')}
                className="px-2.5 py-1 rounded-md font-medium text-slate-700 hover:text-indigo-600 hover:bg-white transition-colors"
                title="Đề mẫu Hóa học 12 (Ester - Lipid - Carbohydrate)"
              >
                Hóa 12
              </button>
              <button
                onClick={() => onSelectSample('math12')}
                className="px-2.5 py-1 rounded-md font-medium text-slate-700 hover:text-indigo-600 hover:bg-white transition-colors"
                title="Đề mẫu Toán học 12 (Đạo hàm, Oxyz)"
              >
                Toán 12
              </button>
            </div>

            {/* AI Generator Button */}
            <button
              onClick={onOpenAiModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 shadow-xs shadow-indigo-300 transition-all cursor-pointer"
              title="Phím tắt: Ctrl + G"
            >
              <Sparkles className="w-4 h-4 text-amber-200 animate-pulse" />
              <span>Tạo Đề AI</span>
            </button>

            {/* PDF & Raw Import Button */}
            <button
              onClick={onOpenRawImport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 shadow-2xs transition-colors cursor-pointer"
              title="Tải lên file PDF đề thi có sẵn đáp án (PDF.js + KaTeX mhchem + Cắt hình vẽ Canvas)"
            >
              <FileCode className="w-4 h-4 text-emerald-600" />
              <span>Tải Đề PDF / OCR</span>
            </button>

            {/* Shuffle Button */}
            <button
              onClick={onOpenShuffleModal}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
              title="Trộn đề và tạo nhiều mã đề (Ctrl + Shift + S)"
            >
              <Shuffle className="w-4 h-4 text-purple-600" />
              <span className="hidden md:inline">Trộn Đề Thi</span>
            </button>

            {/* Export Word Button */}
            <button
              onClick={onExportDocx}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
              title="Xuất file Word (Ctrl + Shift + E)"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span className="font-semibold">Word (.docx)</span>
            </button>

            {/* Print Button */}
            <button
              onClick={onPrintExam}
              className="inline-flex items-center p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              title="In đề thi hoặc xuất PDF (Ctrl + P)"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Logged-in User Profile Badge + Change Password + Logout */}
            {currentUser && (
              <div className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-2.5 py-1 rounded-xl border border-slate-700 text-xs shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="font-bold text-amber-200 max-w-[165px] truncate" title={currentUser.fullName}>
                  {currentUser.fullName}
                </span>
                {onOpenChangePasswordModal && (
                  <button
                    type="button"
                    onClick={onOpenChangePasswordModal}
                    className="px-1.5 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Đổi mật khẩu tài khoản"
                  >
                    <KeyRound className="w-3 h-3 text-amber-300" />
                    <span className="hidden sm:inline">Đổi MK</span>
                  </button>
                )}
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="px-1.5 py-0.5 rounded bg-rose-500/80 hover:bg-rose-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Đăng xuất khỏi chế độ Giáo viên / Admin (Quay về Cổng Học sinh)"
                  >
                    <LogOut className="w-3 h-3" />
                    <span className="hidden sm:inline">Thoát</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 border-t border-slate-200/80 pt-1 pb-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'editor'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Soạn Đề Thi (Phần I, II, III, Tự luận)</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'matrix'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Ma Trận & Bản Đặc Tả (CV 7991)</span>
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'preview'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Xem Đề Chuẩn Bộ GD&ĐT & Đáp Án</span>
          </button>

          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'rooms'
                ? 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-xs'
                : 'text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80'
            }`}
          >
            <Users className="w-4 h-4 text-amber-300" />
            <span>Phòng Thi &amp; Quản Lý Học Sinh (Dual Cloud)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>

          <button
            onClick={() => setActiveTab('test')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'test'
                ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>Làm Bài Thi Thử</span>
          </button>
        </div>
      </div>
    </header>
  );
};

