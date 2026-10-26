import React from 'react';
import {
  FileText,
  Settings,
  ShieldCheck,
  KeyRound,
  LogOut,
  MessageCircle,
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
  activeTab,
  setActiveTab,
  totalQuestions,
  lastSavedTime,
  isSaving = false,
  onOpenCloudConfigModal,
  currentUser,
  onOpenTeacherManagementModal,
  onOpenChangePasswordModal,
  onLogout,
}) => {
  const isAdmin = currentUser?.role === 'admin';

  const marqueeText =
    '🌟 Chào mừng các Thầy Cô đến với trang Web tạo đề thi và thi trực tiếp của Thầy: Nguyễn Văn Hà. 📞 Zalo: 0766.649.979 🌟';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md shadow-xs print:hidden">
      {/* =====================================================================
          TẦNG 1: BĂNG CHỮ CHẠY CHÀO MỪNG (TOP MARQUEE BANNER NỔI BẬT TRÊN CÙNG)
          ===================================================================== */}
      <div className="bg-gradient-to-r from-indigo-900 via-blue-800 to-indigo-900 text-white py-2 px-4 shadow-md border-b border-indigo-700/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Scrolling Marquee Container (pauses on hover) */}
          <div className="relative flex-1 overflow-hidden group-marquee mask-fade">
            <div className="animate-top-marquee flex items-center whitespace-nowrap text-xs sm:text-sm font-bold tracking-wide text-amber-100">
              <span className="mx-6 inline-flex items-center gap-2">
                {marqueeText}
              </span>
              <span className="mx-6 inline-flex items-center gap-2 text-sky-200">
                •
              </span>
              <span className="mx-6 inline-flex items-center gap-2">
                {marqueeText}
              </span>
              <span className="mx-6 inline-flex items-center gap-2 text-sky-200">
                •
              </span>
              <span className="mx-6 inline-flex items-center gap-2">
                {marqueeText}
              </span>
            </div>
          </div>

          {/* Right Quick Action Button: Liên hệ Zalo */}
          <a
            href="https://zalo.me/0766649979"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-300 text-slate-950 hover:from-amber-300 hover:to-yellow-200 shadow-sm border border-amber-200 transition-all whitespace-nowrap"
            title="Nhắn tin Zalo trực tiếp với Thầy Nguyễn Văn Hà (0766.649.979)"
          >
            <MessageCircle className="w-3.5 h-3.5 text-indigo-950 shrink-0" />
            <span>💬 Liên hệ Zalo: 0766.649.979</span>
          </a>
        </div>
      </div>

      {/* =====================================================================
          TẦNG 2: THANH ĐẦU TRANG CHÍNH (MAIN HEADER BAR - GỌN GÀNG TRÊN 1 HÀNG NGANG)
          ===================================================================== */}
      <div className="border-b border-slate-200/90 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
            {/* Bên trái (Thương hiệu & Trạng thái hệ thống) */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-200/80 border border-indigo-400/30 shrink-0">
                <FileText className="w-5 h-5 drop-shadow-xs" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h1 className="text-sm sm:text-base xl:text-lg font-extrabold text-slate-900 leading-tight tracking-tight whitespace-nowrap">
                    HỆ THỐNG TẠO ĐỀ &amp; THI ONLINE 2026
                  </h1>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                    Chuẩn CV 7991
                  </span>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 whitespace-nowrap">
                    Định dạng 2025-2026
                  </span>

                  {/* LocalStorage Visual Save Indicator */}
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200 transition-all shadow-2xs cursor-pointer hover:bg-slate-100 whitespace-nowrap"
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
                      {isSaving
                        ? 'Đang lưu...'
                        : lastSavedTime
                        ? `Đã lưu tự động (${lastSavedTime})`
                        : 'Đã lưu tự động'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="truncate font-medium text-slate-600">
                    {metadata.subject} • Khối {metadata.grade} • {metadata.durationMinutes} phút • {totalQuestions} câu hỏi
                  </span>
                </div>
              </div>
            </div>

            {/* Bên phải (Cụm Quản trị & Hệ thống - Căn thẳng hàng ngang, KHÔNG bị rớt dòng) */}
            <div className="flex items-center justify-end gap-2 shrink-0 overflow-x-auto scrollbar-none py-0.5">
              {/* 1. Nút 👥 Quản lý Giáo viên (Cấp quyền) - Chỉ xuất hiện DUY NHẤT 1 LẦN tại đây */}
              {isAdmin && onOpenTeacherManagementModal && (
                <button
                  type="button"
                  onClick={onOpenTeacherManagementModal}
                  className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold text-amber-950 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-300 hover:from-amber-400 hover:to-orange-400 border border-amber-500/70 shadow-xs transition-all cursor-pointer"
                  title="Cấp quyền & quản lý tài khoản giáo viên trên Firebase (teacher_accounts) & Google Sheets"
                >
                  <span>👥 Quản lý Giáo viên (Cấp quyền)</span>
                </button>
              )}

              {/* 2. Nút ⚙️ Cấu hình Cloud */}
              {onOpenCloudConfigModal && (
                <button
                  type="button"
                  onClick={onOpenCloudConfigModal}
                  className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-indigo-900 hover:text-indigo-950 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/90 shadow-2xs transition-colors cursor-pointer"
                  title="⚙️ Cấu hình Cloud Kép: Firebase & Google Sheets + Google Drive"
                >
                  <Settings className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                  <span>⚙️ Cấu hình Cloud</span>
                </button>
              )}

              {/* 3. Cụm Tài khoản người dùng (Badge bo tròn sang trọng rounded-full trên cùng 1 hàng ngang) */}
              {currentUser && (
                <div className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 bg-slate-900 text-white pl-3 pr-1.5 py-1 rounded-full border border-slate-700 text-xs shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span
                    className="font-bold text-amber-200 whitespace-nowrap"
                    title={currentUser.fullName}
                  >
                    🛡️ {currentUser.fullName}
                  </span>

                  {onOpenChangePasswordModal && (
                    <button
                      type="button"
                      onClick={onOpenChangePasswordModal}
                      className="shrink-0 whitespace-nowrap px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      title="Đổi mật khẩu tài khoản"
                    >
                      <KeyRound className="w-3 h-3 text-amber-300 shrink-0" />
                      <span>🔑 Đổi MK</span>
                    </button>
                  )}

                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      className="shrink-0 whitespace-nowrap px-2 py-0.5 rounded-full bg-rose-500/90 hover:bg-rose-600 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      title="Đăng xuất khỏi chế độ Giáo viên / Admin (Quay về Cổng Học sinh)"
                    >
                      <LogOut className="w-3 h-3 shrink-0" />
                      <span>🚪 Thoát</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TẦNG 3: THANH ĐIỀU HƯỚNG TAB CHỨC NĂNG (NAVIGATION TABS - RÕ RÀNG, KHÔNG KHUẤT CHỮ)
          ===================================================================== */}
      <div className="border-b border-slate-200 bg-slate-50/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'editor'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-700 hover:text-indigo-700 hover:bg-white border border-transparent hover:border-slate-200/80 font-medium'
            }`}
          >
            <span>📝 Soạn Đề Thi (Phần I, II, III, Tự luận)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'matrix'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-700 hover:text-indigo-700 hover:bg-white border border-transparent hover:border-slate-200/80 font-medium'
            }`}
          >
            <span>📊 Ma Trận &amp; Bản Đặc Tả (CV 7991)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'preview'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-700 hover:text-indigo-700 hover:bg-white border border-transparent hover:border-slate-200/80 font-medium'
            }`}
          >
            <span>📖 Xem Đề Chuẩn Bộ GD&amp;ĐT &amp; Đáp Án</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rooms')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'rooms'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/80 font-semibold'
            }`}
          >
            <span>🏛️ Phòng Thi &amp; Quản Lý Học Sinh (Dual Cloud)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('test')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'test'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-emerald-800 bg-emerald-50/90 hover:bg-emerald-100 border border-emerald-200/80 font-semibold'
            }`}
          >
            <span>▶️ Làm Bài Thử (Giao diện HS)</span>
          </button>
        </div>
      </div>
    </header>
  );
};
