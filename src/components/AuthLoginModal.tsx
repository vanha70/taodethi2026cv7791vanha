import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Check,
  X,
  Eye,
  EyeOff,
  LogIn,
  Loader2,
} from 'lucide-react';
import {
  TeacherAccountDoc,
  loginWithCredentials,
  changeAccountPassword,
} from '../services/authService';

interface AuthLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: TeacherAccountDoc | null;
  initialMode?: 'login' | 'change_password';
  onLoginSuccess: (user: TeacherAccountDoc) => void;
  onPasswordChanged?: (updatedUser: TeacherAccountDoc) => void;
}

export const AuthLoginModal: React.FC<AuthLoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialMode = 'login',
  onLoginSuccess,
  onPasswordChanged,
}) => {
  const [mode, setMode] = useState<'login' | 'change_password'>(initialMode);
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Change password states
  const [currentPasswordCheck, setCurrentPasswordCheck] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMode(currentUser && initialMode === 'change_password' ? 'change_password' : 'login');
    setErrorMsg(null);
    setSuccessMsg(null);
    setCurrentPasswordCheck('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
  }, [isOpen, initialMode, currentUser]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      const res = await loginWithCredentials(usernameInput, passwordInput);
      if (!res.ok || !res.user) {
        setErrorMsg(res.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin!');
        return;
      }
      setPasswordInput('');
      onLoginSuccess(res.user);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (currentPasswordCheck.trim() !== currentUser.password) {
      setErrorMsg('Mật khẩu hiện tại không đúng!');
      return;
    }
    if (newPasswordInput.trim().length < 4) {
      setErrorMsg('Mật khẩu mới phải có ít nhất 4 ký tự!');
      return;
    }
    if (newPasswordInput.trim() !== confirmPasswordInput.trim()) {
      setErrorMsg('Xác nhận mật khẩu mới không khớp!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changeAccountPassword(currentUser.username, newPasswordInput.trim());
      if (!res.ok || !res.account) {
        setErrorMsg(res.error || 'Không thể đổi mật khẩu!');
        return;
      }
      setSuccessMsg(
        `Đã đổi mật khẩu thành công và đồng bộ lên Firebase (${
          currentUser.username === 'admin' ? 'users/admin' : `teacher_accounts/${currentUser.username}`
        })!`
      );
      onPasswordChanged?.(res.account);
      setTimeout(() => {
        onClose();
      }, 1200);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-950 via-indigo-900 to-teal-900 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shadow-lg shrink-0">
              {mode === 'login' ? (
                <ShieldCheck className="w-7 h-7" />
              ) : (
                <KeyRound className="w-7 h-7" />
              )}
            </div>
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                HỆ THỐNG BẢO MẬT &amp; PHÂN QUYỀN CLOUD
              </span>
              <h2 className="text-lg font-black tracking-tight mt-0.5">
                {mode === 'login'
                  ? '🔐 Đăng nhập Giáo viên / Admin'
                  : '🔑 Đổi mật khẩu tài khoản'}
              </h2>
            </div>
          </div>
          <p className="text-xs text-indigo-200 mt-2">
            {mode === 'login'
              ? 'Chỉ Quản trị viên (Admin) hoặc Giáo viên đã được cấp quyền mới có thể truy cập giao diện Tạo đề PDF, Ma trận & Quản lý phòng thi.'
              : `Đang đổi mật khẩu cho tài khoản: ${currentUser?.fullName} (${currentUser?.username})`}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-bold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-900 font-bold flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase mb-1.5">
                  Tên đăng nhập (Username / Email) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="Nhập tên đăng nhập (VD: admin, vanha hoặc tài khoản GV)"
                    className="w-full pl-10 pr-4 py-3 text-base sm:text-sm font-bold text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase mb-1.5">
                  Mật khẩu <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="Nhập mật khẩu..."
                    className="w-full pl-10 pr-10 py-3 text-base sm:text-sm font-bold text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-5 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-indigo-600 via-indigo-700 to-teal-600 hover:from-indigo-700 hover:to-teal-700 text-white shadow-md shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  <span>
                    {isSubmitting ? 'Đang xác thực tài khoản...' : 'Đăng nhập vào Hệ thống'}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase mb-1">
                  Mật khẩu hiện tại <span className="text-rose-600">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPasswordCheck}
                  onChange={(e) => {
                    setCurrentPasswordCheck(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="Nhập mật khẩu hiện tại..."
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm font-bold text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase mb-1">
                  Mật khẩu mới <span className="text-rose-600">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPasswordInput}
                  onChange={(e) => {
                    setNewPasswordInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="Nhập mật khẩu mới (ít nhất 4 ký tự)..."
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm font-bold text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase mb-1">
                  Xác nhận mật khẩu mới <span className="text-rose-600">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPasswordInput}
                  onChange={(e) => {
                    setConfirmPasswordInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm font-bold text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="inline-flex items-center gap-1.5 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Hiện mật khẩu</span>
                </label>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4" />
                  )}
                  <span>Lưu mật khẩu mới lên Firebase</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
