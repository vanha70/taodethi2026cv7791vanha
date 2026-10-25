import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  KeyRound,
  Lock,
  Unlock,
  Copy,
  Check,
  Trash2,
  X,
  AlertCircle,
  Share2,
  Building2,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  TeacherAccountDoc,
  UserRole,
  createOrUpdateTeacherAccount,
  changeAccountPassword,
  toggleTeacherAccountStatus,
  deleteTeacherAccount,
  subscribeToTeacherAccounts,
  buildTeacherZaloInviteMessage,
  isSuperAdminUsername,
  DEFAULT_PUBLIC_APP_DOMAIN,
} from '../services/authService';
import { copyTextToClipboard } from '../utils/browserSafeguards';
import { getResolvedPublicAppUrl } from '../services/roomService';

interface TeacherManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: TeacherAccountDoc | null;
  onAccountUpdated?: (summaryMessage: string) => void;
}

export const TeacherManagementModal: React.FC<TeacherManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAccountUpdated,
}) => {
  const [accounts, setAccounts] = useState<TeacherAccountDoc[]>([]);

  // Form states for creating / updating a Teacher account
  const [fullNameInput, setFullNameInput] = useState<string>('');
  const [schoolInput, setSchoolInput] = useState<string>('Trường THPT - Tổ Hóa Học');
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('123456');
  const [roleInput, setRoleInput] = useState<UserRole>('teacher');
  const [showFormPassword, setShowFormPassword] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Inline password edit state for an existing teacher row
  const [editingPasswordUsername, setEditingPasswordUsername] = useState<string | null>(null);
  const [newRowPassword, setNewRowPassword] = useState<string>('');
  const [isSavingRowPassword, setIsSavingRowPassword] = useState<boolean>(false);

  // Copy & feedback states
  const [copiedZaloKey, setCopiedZaloKey] = useState<string | null>(null);
  const [copiedCredKey, setCopiedCredKey] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribeToTeacherAccounts((list) => {
      setAccounts(list);
    });
    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const resolvedWebUrl =
    (typeof window !== 'undefined' && window.location.origin.includes('vercel.app')
      ? window.location.origin
      : getResolvedPublicAppUrl()) || DEFAULT_PUBLIC_APP_DOMAIN;

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setSuccessBanner(null);
    setIsCreating(true);

    try {
      const res = await createOrUpdateTeacherAccount({
        username: usernameInput,
        password: passwordInput,
        fullName: fullNameInput,
        schoolOrDepartment: schoolInput,
        role: roleInput,
        status: 'active',
        createdBy: currentUser?.username || 'admin',
      });

      if (!res.ok || !res.account) {
        setErrorBanner(res.error || 'Không thể tạo tài khoản giáo viên!');
        return;
      }

      const syncBadges: string[] = [];
      if (res.savedFirebase) syncBadges.push('Firebase (teacher_accounts)');
      if (res.savedGoogleSheets) syncBadges.push('Google Sheets');
      const syncNote =
        syncBadges.length > 0 ? ` [Đã đồng bộ: ${syncBadges.join(' + ')}]` : '';

      const msg = `Đã cấp quyền thành công cho "${res.account.fullName}" (Username: ${res.account.username})${syncNote}!`;
      setSuccessBanner(msg);
      onAccountUpdated?.(msg);

      // Reset form inputs
      setFullNameInput('');
      setUsernameInput('');
      setPasswordInput('123456');
      setRoleInput('teacher');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyZaloInvite = async (acc: TeacherAccountDoc) => {
    const text = buildTeacherZaloInviteMessage(acc, DEFAULT_PUBLIC_APP_DOMAIN);
    await copyTextToClipboard(text);
    setCopiedZaloKey(acc.username);
    setTimeout(() => setCopiedZaloKey(null), 2600);
  };

  const handleCopyUsernamePass = async (acc: TeacherAccountDoc) => {
    await copyTextToClipboard(`Username: ${acc.username} | Mật khẩu: ${acc.password}`);
    setCopiedCredKey(acc.username);
    setTimeout(() => setCopiedCredKey(null), 2200);
  };

  const handleSaveRowPassword = async (username: string) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    setIsSavingRowPassword(true);
    try {
      const res = await changeAccountPassword(username, newRowPassword);
      if (!res.ok || !res.account) {
        setErrorBanner(res.error || 'Không thể đổi mật khẩu!');
        return;
      }
      const msg = `Đã cập nhật mật khẩu mới cho tài khoản "${res.account.fullName}" (${res.account.username}) trên Firebase!`;
      setSuccessBanner(msg);
      onAccountUpdated?.(msg);
      setEditingPasswordUsername(null);
      setNewRowPassword('');
    } finally {
      setIsSavingRowPassword(false);
    }
  };

  const handleToggleLock = async (acc: TeacherAccountDoc) => {
    if (isSuperAdminUsername(acc.username)) return;
    const nextStatus = acc.status === 'active' ? 'locked' : 'active';
    const updated = await toggleTeacherAccountStatus(acc.username, nextStatus);
    if (updated) {
      const msg =
        nextStatus === 'locked'
          ? `Đã KHÓA quyền truy cập của giáo viên "${acc.fullName}" (${acc.username}).`
          : `Đã MỞ KHÓA quyền truy cập cho giáo viên "${acc.fullName}" (${acc.username}).`;
      setSuccessBanner(msg);
      onAccountUpdated?.(msg);
    }
  };

  const handleDeleteAccount = async (acc: TeacherAccountDoc) => {
    if (isSuperAdminUsername(acc.username)) return;
    await deleteTeacherAccount(acc.username);
    const msg = `Đã xóa tài khoản giáo viên "${acc.fullName}" (${acc.username}) khỏi hệ thống.`;
    setSuccessBanner(msg);
    onAccountUpdated?.(msg);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-950 via-indigo-900 to-teal-900 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  QUẢN TRỊ HỆ THỐNG • DÀNH RIÊNG CHO ADMIN ({currentUser?.fullName || 'GV: VANHA'})
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  Đồng bộ Firebase (teacher_accounts) &amp; Google Sheets
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight mt-0.5">
                👥 Quản lý Tài khoản &amp; Phân quyền Giáo viên
              </h2>
              <p className="text-xs text-indigo-200">
                Cấp tài khoản cho đồng nghiệp đăng nhập tại{' '}
                <code className="font-mono font-bold text-amber-300">{DEFAULT_PUBLIC_APP_DOMAIN}</code>{' '}
                (Tạo đề PDF, trộn đề, mở phòng thi 4 số &amp; quản lý kho đề riêng)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {errorBanner && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs sm:text-sm text-rose-800 font-bold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="text-rose-600 hover:text-rose-900 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {successBanner && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs sm:text-sm text-emerald-950 font-bold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessBanner(null)}
                className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* SECTION 1: CREATE NEW TEACHER ACCOUNT FORM */}
          <form
            onSubmit={handleCreateAccount}
            className="bg-gradient-to-br from-indigo-50/70 via-white to-emerald-50/50 rounded-2xl border-2 border-indigo-200/80 p-5 space-y-4 shadow-2xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-indigo-950 uppercase">
                    1. Cấp Tài Khoản Mới Cho Giáo Viên / Đồng Nghiệp
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    Tự động lưu lên Firebase (<code className="font-mono font-bold">teacher_accounts</code>) &amp; Google Sheets để giáo viên đăng nhập từ máy tính hoặc điện thoại của họ.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-indigo-800 bg-indigo-100 px-2.5 py-1 rounded-lg">
                Link gửi GV: {resolvedWebUrl}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 text-xs">
              {/* Full Name */}
              <div className="lg:col-span-3">
                <label className="block font-extrabold text-slate-800 mb-1">
                  Họ và tên Giáo viên <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={fullNameInput}
                  onChange={(e) => setFullNameInput(e.target.value)}
                  placeholder="VD: Cô Nguyễn Thị Mai"
                  className="w-full px-3 py-2.5 text-base sm:text-xs font-bold border border-slate-300 rounded-xl bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>

              {/* School / Department */}
              <div className="lg:col-span-3">
                <label className="block font-extrabold text-slate-800 mb-1">
                  Trường / Tổ chuyên môn
                </label>
                <input
                  type="text"
                  value={schoolInput}
                  onChange={(e) => setSchoolInput(e.target.value)}
                  placeholder="VD: THPT Chuyên - Tổ Hóa"
                  className="w-full px-3 py-2.5 text-base sm:text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>

              {/* Username */}
              <div className="lg:col-span-2">
                <label className="block font-extrabold text-slate-800 mb-1">
                  Tên đăng nhập <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="VD: gvmai"
                  className="w-full px-3 py-2.5 text-base sm:text-xs font-mono font-bold text-indigo-900 border border-slate-300 rounded-xl bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>

              {/* Password */}
              <div className="lg:col-span-2">
                <label className="block font-extrabold text-slate-800 mb-1">
                  Mật khẩu <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showFormPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="VD: 123456"
                    className="w-full pl-3 pr-8 py-2.5 text-base sm:text-xs font-mono font-bold border border-slate-300 rounded-xl bg-white focus:border-indigo-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword((p) => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showFormPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div className="lg:col-span-2">
                <label className="block font-extrabold text-slate-800 mb-1">
                  Quyền hạn (Role)
                </label>
                <select
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value as UserRole)}
                  className="w-full px-2.5 py-2.5 text-base sm:text-xs font-bold border border-slate-300 rounded-xl bg-white focus:border-indigo-600 focus:outline-none"
                >
                  <option value="teacher">Giáo viên (teacher)</option>
                  <option value="admin">Quản trị viên (admin)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-[11px] text-slate-600">
                💡 <strong>Quyền Giáo viên (teacher):</strong> Được tải đề PDF, trộn đề, tạo Mã phòng 4 số, lấy Mã QR, xem bảng điểm và quản lý các phòng thi do chính mình tạo.
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 via-indigo-700 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-60"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>
                  {isCreating
                    ? 'Đang tạo & đồng bộ Cloud...'
                    : 'Tạo Tài Khoản & Đồng Bộ Firebase + Sheets'}
                </span>
              </button>
            </div>
          </form>

          {/* SECTION 2: LIST OF GRANTED TEACHER & ADMIN ACCOUNTS */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-300" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide">
                  2. Danh Sách Tài Khoản Giáo Viên &amp; Quản Trị Viên Đã Cấp Quyền ({accounts.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-300">
                Đồng bộ thời gian thực trên Firebase <code className="font-mono text-amber-300">teacher_accounts</code> &amp; <code className="font-mono text-emerald-300">users/admin</code>
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {accounts.map((acc) => {
                const isSuper = isSuperAdminUsername(acc.username);
                const isEditingPass = editingPasswordUsername === acc.username;

                return (
                  <div
                    key={acc.username}
                    className={`p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                      acc.status === 'locked'
                        ? 'bg-rose-50/40'
                        : isSuper
                          ? 'bg-amber-50/30'
                          : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Left: Account Info */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-900">{acc.fullName}</span>

                        {acc.role === 'admin' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                            👑 Admin (Quản trị viên)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-200 uppercase">
                            👨‍🏫 Giáo viên (teacher)
                          </span>
                        )}

                        {acc.status === 'active' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Đang hoạt động
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            🔒 Đã khóa truy cập
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {acc.schoolOrDepartment || 'Tổ Chuyên Môn'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          Tên đăng nhập:{' '}
                          <code className="font-mono font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            {isSuper ? 'admin (hoặc vanha)' : acc.username}
                          </code>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          Mật khẩu:{' '}
                          <code className="font-mono font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {acc.password}
                          </code>
                        </span>
                      </div>

                      {/* Inline Password Change Input */}
                      {isEditingPass && (
                        <div className="pt-2 flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={newRowPassword}
                            onChange={(e) => setNewRowPassword(e.target.value)}
                            placeholder="Nhập mật khẩu mới..."
                            className="px-3 py-1.5 text-xs font-mono font-bold border-2 border-indigo-400 rounded-lg bg-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRowPassword(acc.username)}
                            disabled={isSavingRowPassword}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isSavingRowPassword ? 'Đang lưu...' : 'Lưu mật khẩu'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPasswordUsername(null);
                              setNewRowPassword('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Copy Zalo Invite Message */}
                      <button
                        type="button"
                        onClick={() => handleCopyZaloInvite(acc)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="Copy toàn bộ thông tin tài khoản (gồm Link Web, Username, Mật khẩu) để gửi qua Zalo cho giáo viên"
                      >
                        {copiedZaloKey === acc.username ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Đã copy gửi Zalo!</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Copy thông tin tài khoản gửi Zalo</span>
                          </>
                        )}
                      </button>

                      {/* Copy quick credentials */}
                      <button
                        type="button"
                        onClick={() => handleCopyUsernamePass(acc)}
                        className="px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Copy nhanh Username & Mật khẩu"
                      >
                        {copiedCredKey === acc.username ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Copy TK/MK</span>
                      </button>

                      {/* Change Password */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPasswordUsername(isEditingPass ? null : acc.username);
                          setNewRowPassword(acc.password);
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Đổi mật khẩu</span>
                      </button>

                      {/* Lock / Unlock Access (For non-super-admin accounts) */}
                      {!isSuper && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleLock(acc)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                              acc.status === 'active'
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            {acc.status === 'active' ? (
                              <>
                                <Lock className="w-3.5 h-3.5 text-amber-700" />
                                <span>Khóa quyền</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Mở khóa</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteAccount(acc)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                            title="Xóa tài khoản giáo viên này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            💡 Tài khoản Admin mặc định (<code className="font-mono font-bold text-slate-800">admin</code> hoặc <code className="font-mono font-bold text-slate-800">vanha</code>) luôn có toàn quyền quản trị trên mọi thiết bị.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
          >
            Đóng bảng quản lý
          </button>
        </div>
      </div>
    </div>
  );
};
