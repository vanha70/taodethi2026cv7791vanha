import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class MobileSafeErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    console.error('App ErrorBoundary caught error:', error);
  }

  handleResetAndReload = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('taodethi2026_exam_state');
        window.localStorage.removeItem('taodethi2026_custom_public_url');
      }
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-white rounded-3xl border-2 border-indigo-100 shadow-xl overflow-hidden text-center">
            <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-teal-900 text-white p-6">
              <span className="inline-block px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-white/10 text-emerald-300 border border-white/15 mb-2">
                HỆ THỐNG KIỂM TRA TRỰC TUYẾN CHUẨN CV 7991
              </span>
              <h2 className="text-xl font-black uppercase">CỔNG VÀO PHÒNG THI TRỰC TUYẾN</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs sm:text-sm text-slate-700 font-semibold">
                Trình duyệt vừa làm mới bộ nhớ đệm. Nhấn nút bên dưới để vào ngay phòng thi:
              </p>
              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="w-full py-3.5 px-4 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-600 to-indigo-600 text-white shadow-md cursor-pointer"
              >
                🔄 Tải lại Cổng Vào Phòng Thi
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <MobileSafeErrorBoundary>
    <App />
  </MobileSafeErrorBoundary>
);

