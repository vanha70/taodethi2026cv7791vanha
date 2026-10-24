import React from 'react';
import { Keyboard, X, Printer, Download, Save, Shuffle, Sparkles, Table, Phone, User, Clipboard, Zap, FlaskConical } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    {
      keys: ['Ctrl', 'V'],
      macKeys: ['⌘', 'V'],
      desc: 'Dán trực tiếp hình ảnh từ Clipboard (chụp màn hình) vào câu hỏi đang chọn',
      icon: <Clipboard className="w-4 h-4 text-emerald-600" />,
      tag: 'Mới & Tiện lợi',
    },
    {
      keys: ['ReactionBuilder'],
      macKeys: ['ReactionBuilder'],
      desc: 'Tạo sơ đồ chuyển hóa hóa học tự động kéo thả công thức & xuất SVG',
      icon: <Zap className="w-4 h-4 text-teal-600" />,
      tag: 'Mới',
    },
    {
      keys: ['Toolbox'],
      macKeys: ['Toolbox'],
      desc: 'Kéo thả 18+ dụng cụ thí nghiệm SVG (bình tam giác, ống nghiệm, đèn cồn...)',
      icon: <FlaskConical className="w-4 h-4 text-emerald-600" />,
      tag: 'Mới',
    },
    {
      keys: ['Ctrl', 'S'],
      macKeys: ['⌘', 'S'],
      desc: 'Lưu tức thì toàn bộ đề thi & dữ liệu vào Local Storage',
      icon: <Save className="w-4 h-4 text-emerald-600" />,
      tag: 'Phổ biến',
    },
    {
      keys: ['Ctrl', 'P'],
      macKeys: ['⌘', 'P'],
      desc: 'Mở hộp thoại In đề thi chuẩn hoặc Xuất file PDF',
      icon: <Printer className="w-4 h-4 text-sky-600" />,
      tag: 'Phổ biến',
    },
    {
      keys: ['Ctrl', 'Shift', 'E'],
      macKeys: ['⌘', 'Shift', 'E'],
      desc: 'Xuất ngay file Word (.docx) chuẩn Bộ GD&ĐT',
      icon: <Download className="w-4 h-4 text-blue-600" />,
      tag: 'Nổi bật',
    },
    {
      keys: ['Ctrl', 'Shift', 'S'],
      macKeys: ['⌘', 'Shift', 'S'],
      desc: 'Mở cửa sổ Trộn đề thi hoán vị (tạo nhiều mã đề)',
      icon: <Shuffle className="w-4 h-4 text-purple-600" />,
    },
    {
      keys: ['Ctrl', 'G'],
      macKeys: ['⌘', 'G'],
      desc: 'Mở AI tạo trọn bộ đề thi theo Công văn 7991',
      icon: <Sparkles className="w-4 h-4 text-amber-500" />,
    },
    {
      keys: ['Ctrl', 'M'],
      macKeys: ['⌘', 'M'],
      desc: 'Chuyển nhanh sang Ma trận & Bản đặc tả CV 7991',
      icon: <Table className="w-4 h-4 text-indigo-600" />,
    },
    {
      keys: ['?'],
      macKeys: ['?'],
      desc: 'Bật / Tắt bảng hướng dẫn phím tắt này',
      icon: <Keyboard className="w-4 h-4 text-slate-600" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">HỆ THỐNG PHÍM TẮT TOÀN CỤC</h2>
              <p className="text-xs text-indigo-200">
                Thao tác nhanh trên bàn phím để soạn và xuất đề thần tốc
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {shortcuts.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                  {sc.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">{sc.desc}</p>
                  {sc.tag && (
                    <span className="inline-block mt-0.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                      {sc.tag}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-3">
                {sc.keys.map((k, kIdx) => (
                  <kbd
                    key={kIdx}
                    className="px-2 py-1 text-xs font-mono font-bold text-slate-800 bg-white border border-slate-300 rounded-md shadow-2xs"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Author info footer inside modal */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              Tác giả: <strong>Thầy Nguyễn Văn Hà</strong>
            </span>
            <span className="text-slate-300">•</span>
            <a
              href="tel:0766649979"
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              <Phone className="w-3 h-3" /> 0766.649.979
            </a>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
