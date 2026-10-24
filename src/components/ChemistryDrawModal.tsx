import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload,
  Clipboard,
  Type,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Move,
  Layers,
  ArrowRight,
  HelpCircle,
  Maximize2,
  Minimize2,
  Palette,
  Undo2,
  Redo2,
  Download,
} from 'lucide-react';

export interface ChemistryDrawModalProps {
  isOpen: boolean;
  initialImage?: string;
  initialCaption?: string;
  onClose: () => void;
  onSave: (imageDataUrl: string, caption: string) => void;
}

// Visual Element Types
type ElementType =
  | 'test_tube'
  | 'test_tube_sidearm'
  | 'round_flask'
  | 'round_flask_branch'
  | 'erlenmeyer'
  | 'beaker'
  | 'burette'
  | 'separating_funnel'
  | 'condenser'
  | 'alcohol_lamp'
  | 'tripod_wire'
  | 'iron_stand'
  | 'trough_water'
  | 'tube_l'
  | 'tube_u'
  | 'tube_straight'
  | 'rubber_stopper'
  | 'thermometer'
  | 'cotton_plug'
  | 'bubbles'
  | 'precipitate'
  | 'arrow'
  | 'text'
  | 'benzene'
  | 'battery_zn_cu'
  | 'custom_image';

interface CanvasItem {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color?: string; // liquid or tint color
  liquidHeightPercent?: number; // 0 to 100
  text?: string;
  fontSize?: number;
  imageData?: string;
  zIndex: number;
}

// Preset experiment templates
interface PresetTemplate {
  name: string;
  description: string;
  caption: string;
  items: CanvasItem[];
}

export const ChemistryDrawModal: React.FC<ChemistryDrawModalProps> = ({
  isOpen,
  initialImage,
  initialCaption = '',
  onClose,
  onSave,
}) => {
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>(initialCaption);
  const [activeTab, setActiveTab] = useState<'apparatus' | 'heat_stand' | 'tubes' | 'presets'>('presets');
  const [history, setHistory] = useState<CanvasItem[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [liquidColor, setLiquidColor] = useState<string>('#9333ea'); // default permanganate purple

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset
  useEffect(() => {
    if (isOpen) {
      if (initialImage) {
        // If question already has an image, put it on canvas
        const imgItem: CanvasItem = {
          id: 'initial_img',
          type: 'custom_image',
          x: 150,
          y: 80,
          width: 480,
          height: 320,
          rotation: 0,
          imageData: initialImage,
          zIndex: 1,
        };
        setItems([imgItem]);
        setHistory([[imgItem]]);
        setHistoryIndex(0);
      } else {
        // Load Preset 1 (Điều chế C2H4) by default for inspiration
        loadPreset(PRESETS[0]);
      }
      setCaption(initialCaption || '');
    }
  }, [isOpen, initialImage]);

  // Handle global paste (Ctrl+V) directly into canvas!
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen) return;
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        if (clipboardItems[i].type.indexOf('image') !== -1) {
          const blob = clipboardItems[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                addImageToCanvas(event.target.result as string);
              }
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, items]);

  // Save history state for Undo/Redo
  const pushHistory = (newItems: CanvasItem[]) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(newItems);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setItems(newItems);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setItems(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setItems(history[historyIndex + 1]);
    }
  };

  const addImageToCanvas = (dataUrl: string) => {
    const newItem: CanvasItem = {
      id: `img_${Date.now()}`,
      type: 'custom_image',
      x: 160,
      y: 80,
      width: 450,
      height: 300,
      rotation: 0,
      imageData: dataUrl,
      zIndex: items.length + 1,
    };
    pushHistory([...items, newItem]);
    setSelectedId(newItem.id);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          addImageToCanvas(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Add Item to canvas
  const addItem = (type: ElementType, defaultText?: string, customX?: number, customY?: number) => {
    let width = 80;
    let height = 140;

    if (type === 'erlenmeyer') { width = 110; height = 140; }
    else if (type === 'round_flask' || type === 'round_flask_branch') { width = 110; height = 150; }
    else if (type === 'beaker') { width = 100; height = 120; }
    else if (type === 'burette') { width = 40; height = 240; }
    else if (type === 'alcohol_lamp') { width = 90; height = 90; }
    else if (type === 'tripod_wire') { width = 120; height = 120; }
    else if (type === 'iron_stand') { width = 140; height = 280; }
    else if (type === 'trough_water') { width = 180; height = 90; }
    else if (type === 'text') { width = 130; height = 40; }
    else if (type === 'arrow') { width = 90; height = 30; }
    else if (type === 'benzene') { width = 90; height = 90; }
    else if (type === 'battery_zn_cu') { width = 280; height = 180; }

    const newItem: CanvasItem = {
      id: `${type}_${Date.now()}`,
      type,
      x: customX !== undefined ? customX : (240 + Math.random() * 40),
      y: customY !== undefined ? customY : (120 + Math.random() * 40),
      width,
      height,
      rotation: 0,
      liquidHeightPercent: 45,
      color: liquidColor,
      text: defaultText || (type === 'text' ? 'Ghi chú hóa chất...' : undefined),
      fontSize: 13,
      zIndex: items.length + 1,
    };

    pushHistory([...items, newItem]);
    setSelectedId(newItem.id);
  };

  const loadPreset = (preset: PresetTemplate) => {
    setItems(preset.items);
    setCaption(preset.caption);
    setHistory([preset.items]);
    setHistoryIndex(0);
    setSelectedId(null);
  };

  // Selection & dragging
  const handleMouseDown = (e: React.MouseEvent, item: CanvasItem) => {
    e.stopPropagation();
    setSelectedId(item.id);
    setIsDragging(true);

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setDragOffset({
        x: mouseX - item.x,
        y: mouseY - item.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = Math.max(10, Math.min(760, mouseX - dragOffset.x));
    const newY = Math.max(10, Math.min(480, mouseY - dragOffset.y));

    setItems((prev) =>
      prev.map((it) => (it.id === selectedId ? { ...it, x: Math.round(newX), y: Math.round(newY) } : it))
    );
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      pushHistory([...items]);
    }
  };

  const updateSelectedItem = (updater: (item: CanvasItem) => CanvasItem) => {
    if (!selectedId) return;
    const next = items.map((it) => (it.id === selectedId ? updater(it) : it));
    pushHistory(next);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const next = items.filter((it) => it.id !== selectedId);
    pushHistory(next);
    setSelectedId(null);
  };

  const clearCanvas = () => {
    pushHistory([]);
    setSelectedId(null);
  };

  // Export Canvas to Base64 PNG using HTML5 Canvas
  const handleSaveAndExport = () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 800;
    exportCanvas.height = 520;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // White crisp background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 520);

    // Subtle border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 800, 520);

    // Convert SVG dom elements to image draw
    const svgElements = canvasRef.current?.querySelectorAll('svg');
    const promises: Promise<void>[] = [];

    // Sort items by zIndex
    const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex);

    sorted.forEach((item) => {
      if (item.type === 'custom_image' && item.imageData) {
        const p = new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.save();
            ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
            ctx.rotate((item.rotation * Math.PI) / 180);
            ctx.drawImage(img, -item.width / 2, -item.height / 2, item.width, item.height);
            ctx.restore();
            resolve();
          };
          img.onerror = () => resolve();
          img.src = item.imageData!;
        });
        promises.push(p);
      } else if (item.type === 'text' && item.text) {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.font = `600 ${item.fontSize || 13}px "Times New Roman", Times, serif`;
        ctx.fillStyle = item.color || '#0f172a';
        ctx.fillText(item.text, 5, 20);
        ctx.restore();
      }
    });

    // If canvas has SVG elements, render via XMLSerializer
    if (canvasRef.current) {
      const p = new Promise<void>((resolve) => {
        // Clone canvas content without selection indicators
        const cloned = canvasRef.current!.cloneNode(true) as HTMLElement;
        const selectionRings = cloned.querySelectorAll('.selection-indicator');
        selectionRings.forEach((el) => el.remove());

        // Get inner SVG or create SVG from cloned markup
        const svgData = new XMLSerializer().serializeToString(cloned);
        const svgBlob = new Blob(
          [
            `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520">
              <foreignObject width="100%" height="100%">
                <div xmlns="http://www.w3.org/1999/xhtml">
                  ${cloned.innerHTML}
                </div>
              </foreignObject>
            </svg>`,
          ],
          { type: 'image/svg+xml;charset=utf-8' }
        );

        const URL = window.URL || window.webkitURL || window;
        const blobURL = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 800, 520);
          URL.revokeObjectURL(blobURL);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(blobURL);
          resolve();
        };
        img.src = blobURL;
      });
      promises.push(p);
    }

    Promise.all(promises).then(() => {
      const dataUrl = exportCanvas.toDataURL('image/png', 0.95);
      onSave(dataUrl, caption);
      onClose();
    });
  };

  if (!isOpen) return null;

  const selectedItem = items.find((it) => it.id === selectedId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                STUDIO VẼ HÌNH THÍ NGHIỆM & SƠ ĐỒ HÓA HỌC (GDPT 2018)
                <span className="text-[10px] bg-emerald-500 text-slate-950 font-bold px-2 py-0.5 rounded-full uppercase">
                  Chuẩn Sư Phạm
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Thầy: Nguyễn Văn Hà • Kéo thả dụng cụ thủy tinh, chèn nhãn hóa chất, dán ảnh Ctrl+V hoặc tải từ máy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Subheader */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => setActiveTab('presets')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'presets'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              ⭐ 6 Thí Nghiệm Mẫu SGK
            </button>
            <button
              onClick={() => setActiveTab('apparatus')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'apparatus'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              🧪 Dụng Cụ Thủy Tinh
            </button>
            <button
              onClick={() => setActiveTab('heat_stand')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'heat_stand'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              🔥 Nguồn Nhiệt & Giá Kẹp
            </button>
            <button
              onClick={() => setActiveTab('tubes')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'tubes'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              🏷️ Nhãn & Ống Dẫn Khí
            </button>
          </div>

          {/* Quick Actions (Undo, Redo, Paste, Upload, Clear) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-md disabled:opacity-30 cursor-pointer"
              title="Hoàn tác (Undo)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-md disabled:opacity-30 cursor-pointer"
              title="Làm lại (Redo)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-slate-300 mx-1" />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Tải ảnh sơ đồ từ máy tính"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>Tải file ảnh</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            <button
              onClick={clearCanvas}
              className="px-2.5 py-1.5 rounded-md bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 font-medium flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Xóa trắng canvas"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Dọn sạch</span>
            </button>
          </div>
        </div>

        {/* Main Body: Left Palette + Center Canvas + Right Inspector */}
        <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden bg-slate-100">
          {/* LEFT PALETTE: Items picker */}
          <div className="col-span-12 md:col-span-3 bg-white border-r border-slate-200 p-3 overflow-y-auto max-h-[520px]">
            {activeTab === 'presets' && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  6 Mẫu SGK Hóa Học GDPT 2018
                </p>
                {PRESETS.map((preset, idx) => (
                  <div
                    key={idx}
                    onClick={() => loadPreset(preset)}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 cursor-pointer transition-all shadow-2xs group"
                  >
                    <div className="flex items-center justify-between font-bold text-xs text-slate-900 group-hover:text-emerald-800">
                      <span>{preset.name}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono">
                        Mẫu {idx + 1}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'apparatus' && (
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Dụng cụ thủy tinh (Bấm để chèn)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => addItem('test_tube')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-sky-500 hover:bg-sky-50 text-left cursor-pointer transition-colors"
                  >
                    <div className="text-xs font-bold text-slate-800">Ống nghiệm</div>
                    <span className="text-[10px] text-slate-500">Test tube</span>
                  </button>
                  <button
                    onClick={() => addItem('test_tube_sidearm')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-sky-500 hover:bg-sky-50 text-left cursor-pointer transition-colors"
                  >
                    <div className="text-xs font-bold text-slate-800">Ống nhánh</div>
                    <span className="text-[10px] text-slate-500">Có nhánh dẫn khí</span>
                  </button>
                  <button
                    onClick={() => addItem('round_flask')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-sky-500 hover:bg-sky-50 text-left cursor-pointer transition-colors"
                  >
                    <div className="text-xs font-bold text-slate-800">Bình cầu tròn</div>
                    <span className="text-[10px] text-slate-500">Đun sôi hóa chất</span>
                  </button>
                  <button
                    onClick={() => addItem('round_flask_branch')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-sky-500 hover:bg-sky-50 text-left cursor-pointer transition-colors"
                  >
                    <div className="text-xs font-bold text-slate-800">Bình cầu nhánh</div>
                    <span className="text-[10px] text-slate-500">Chưng cất dẫn khí</span>
                  </button>
                  <button
                    onClick={() => addItem('erlenmeyer')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-sky-500 hover:bg-sky-50 text-left cursor-pointer transition-colors"
                  >
                    <div className="text-xs font-bold text-slate-800">Bình tam giác</div>
                    <span className="text-[10px] text-slate-500">Erlenmeyer</span>
                  </button>
                  <button
                    onClick={() => addItem('beaker')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-sky-500 hover:bg-sky-50 text-left cursor-pointer transition-colors"
                  >
                    <div className="text-xs font-bold text-slate-800">Cốc thủy tinh</div>
                    <span className="text-[10px] text-slate-500">Chia vạch ml</span>
                  </button>
                  <button
                    onClick={() => addItem('burette')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-sky-500 hover:bg-sky-50 text-left cursor-pointer transition-colors"
                  >
                    <div className="text-xs font-bold text-slate-800">Buret chuẩn độ</div>
                    <span className="text-[10px] text-slate-500">Có khóa và vạch</span>
                  </button>
                  <button
                    onClick={() => addItem('separating_funnel')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-sky-500 hover:bg-sky-50 text-left cursor-pointer transition-colors"
                  >
                    <div className="text-xs font-bold text-slate-800">Phễu chiết</div>
                    <span className="text-[10px] text-slate-500">Chiết chất lỏng</span>
                  </button>
                  <button
                    onClick={() => addItem('condenser')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-sky-500 hover:bg-sky-50 text-left cursor-pointer transition-colors"
                  >
                    <div className="text-xs font-bold text-slate-800">Ống sinh hàn</div>
                    <span className="text-[10px] text-slate-500">Làm lạnh ngưng tụ</span>
                  </button>
                  <button
                    onClick={() => addItem('trough_water')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-sky-500 hover:bg-sky-50 text-left cursor-pointer transition-colors"
                  >
                    <div className="text-xs font-bold text-slate-800">Chậu nước</div>
                    <span className="text-[10px] text-slate-500">Thu khí qua nước</span>
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200">
                  <p className="text-[11px] font-bold text-slate-500 mb-2">Đổi màu dung dịch mẫu:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: 'Tím KMnO4', color: '#9333ea' },
                      { name: 'Xanh CuSO4', color: '#0284c7' },
                      { name: 'Da cam Br2', color: '#ea580c' },
                      { name: 'Vàng Fe3+', color: '#eab308' },
                      { name: 'Nước trong', color: '#94a3b8' },
                      { name: 'Hồng phenol', color: '#ec4899' },
                    ].map((c) => (
                      <button
                        key={c.color}
                        onClick={() => {
                          setLiquidColor(c.color);
                          if (selectedItem) {
                            updateSelectedItem((it) => ({ ...it, color: c.color }));
                          }
                        }}
                        className="px-2 py-1 rounded text-[10px] font-medium border flex items-center gap-1 cursor-pointer"
                        style={{ borderColor: c.color }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'heat_stand' && (
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Nguồn nhiệt & Phụ kiện
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => addItem('alcohol_lamp')}
                    className="w-full p-2.5 border border-slate-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 text-left cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">Đèn cồn có lửa</div>
                      <span className="text-[10px] text-slate-500">Nhiệt phân, đun sôi</span>
                    </div>
                    <span className="text-amber-500 text-lg">🔥</span>
                  </button>
                  <button
                    onClick={() => addItem('tripod_wire')}
                    className="w-full p-2.5 border border-slate-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 text-left cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">Kiềng sắt + Lưới amiăng</div>
                      <span className="text-[10px] text-slate-500">Tản nhiệt đáy bình</span>
                    </div>
                    <span className="text-slate-600 text-lg">⛩️</span>
                  </button>
                  <button
                    onClick={() => addItem('iron_stand')}
                    className="w-full p-2.5 border border-slate-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 text-left cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">Giá sắt & Kẹp thí nghiệm</div>
                      <span className="text-[10px] text-slate-500">Giữ ống nghiệm, bình cầu</span>
                    </div>
                    <span className="text-slate-600 text-lg">⚓</span>
                  </button>
                  <button
                    onClick={() => addItem('thermometer')}
                    className="w-full p-2.5 border border-slate-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 text-left cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">Nhiệt kế thủy ngân</div>
                      <span className="text-[10px] text-slate-500">Đo nhiệt độ (170°C)</span>
                    </div>
                    <span className="text-rose-500 text-lg">🌡️</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'tubes' && (
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Ống dẫn khí & Hiện tượng
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => addItem('tube_l')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 text-left cursor-pointer"
                  >
                    <div className="text-xs font-bold text-slate-800">Ống dẫn khí L</div>
                    <span className="text-[10px] text-slate-500">Chữ L 90 độ</span>
                  </button>
                  <button
                    onClick={() => addItem('tube_u')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 text-left cursor-pointer"
                  >
                    <div className="text-xs font-bold text-slate-800">Ống chữ U</div>
                    <span className="text-[10px] text-slate-500">Cầu muối, làm khô</span>
                  </button>
                  <button
                    onClick={() => addItem('rubber_stopper')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 text-left cursor-pointer"
                  >
                    <div className="text-xs font-bold text-slate-800">Nút cao su</div>
                    <span className="text-[10px] text-slate-500">Đậy kín bình</span>
                  </button>
                  <button
                    onClick={() => addItem('cotton_plug')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 text-left cursor-pointer"
                  >
                    <div className="text-xs font-bold text-slate-800">Bông tẩm NaOH</div>
                    <span className="text-[10px] text-slate-500">Ngăn khí độc</span>
                  </button>
                  <button
                    onClick={() => addItem('bubbles')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 text-left cursor-pointer"
                  >
                    <div className="text-xs font-bold text-slate-800">Bọt khí</div>
                    <span className="text-[10px] text-slate-500">Sủi tăm chất khí</span>
                  </button>
                  <button
                    onClick={() => addItem('precipitate')}
                    className="p-2 border border-slate-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 text-left cursor-pointer"
                  >
                    <div className="text-xs font-bold text-slate-800">Kết tủa đáy</div>
                    <span className="text-[10px] text-slate-500">Chất rắn lắng</span>
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
                  <p className="text-[11px] font-bold text-slate-500">Chèn ký hiệu & Chú thích:</p>
                  <button
                    onClick={() => addItem('text', 'dd KMnO4 loãng')}
                    className="w-full py-1.5 px-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-medium text-left flex items-center gap-1.5 cursor-pointer"
                  >
                    <Type className="w-3.5 h-3.5" /> Thêm nhãn chữ ghi chú
                  </button>
                  <button
                    onClick={() => addItem('arrow')}
                    className="w-full py-1.5 px-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-xs font-medium text-left flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" /> Mũi tên chỉ hướng
                  </button>
                  <button
                    onClick={() => addItem('benzene')}
                    className="w-full py-1.5 px-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-xs font-medium text-left flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>⬡</span> Vòng Benzen hữu cơ
                  </button>
                  <button
                    onClick={() => addItem('battery_zn_cu')}
                    className="w-full py-1.5 px-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-medium text-left flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>⚡</span> Pin điện hóa Zn - Cu (1.10V)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CENTER CANVAS: 800x520 interactive drawing canvas */}
          <div className="col-span-12 md:col-span-9 p-4 flex flex-col items-center justify-center overflow-auto">
            <div
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={() => setSelectedId(null)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => {
                e.preventDefault();
                try {
                  const raw = e.dataTransfer.getData('application/json');
                  if (!raw) return;
                  const data = JSON.parse(raw);
                  if (data.type === 'chem-apparatus' && canvasRef.current) {
                    const rect = canvasRef.current.getBoundingClientRect();
                    const dropX = Math.max(20, Math.min(680, e.clientX - rect.left - 40));
                    const dropY = Math.max(20, Math.min(420, e.clientY - rect.top - 40));

                    const typeMap: Record<string, ElementType> = {
                      erlenmeyer: 'erlenmeyer',
                      test_tube: 'test_tube',
                      test_tube_sidearm: 'test_tube_sidearm',
                      alcohol_lamp: 'alcohol_lamp',
                      separating_funnel: 'separating_funnel',
                      beaker: 'beaker',
                      burette: 'burette',
                      tripod_wire: 'tripod_wire',
                      iron_stand: 'iron_stand',
                      tube_l: 'tube_l',
                      trough_water: 'trough_water',
                      cotton_plug: 'cotton_plug',
                      thermometer: 'thermometer',
                      battery_zn_cu: 'battery_zn_cu',
                      benzene: 'benzene',
                    };

                    const mapped = typeMap[data.id];
                    if (mapped) {
                      addItem(mapped, undefined, dropX, dropY);
                    } else if (data.dataUrl) {
                      addImageToCanvas(data.dataUrl);
                    }
                  }
                } catch (err) {
                  console.error('Error dropping on canvas:', err);
                }
              }}
              className="relative w-[800px] h-[520px] bg-white rounded-xl shadow-lg border border-slate-300 select-none overflow-hidden cursor-crosshair"
              style={{
                backgroundImage:
                  'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            >
              {items.map((item) => {
                const isSelected = item.id === selectedId;

                return (
                  <div
                    key={item.id}
                    onMouseDown={(e) => handleMouseDown(e, item)}
                    style={{
                      position: 'absolute',
                      left: item.x,
                      top: item.y,
                      width: item.width,
                      height: item.height,
                      transform: `rotate(${item.rotation}deg)`,
                      zIndex: item.zIndex,
                    }}
                    className={`cursor-move transition-shadow ${
                      isSelected
                        ? 'ring-2 ring-emerald-500 ring-offset-1 rounded selection-indicator'
                        : ''
                    }`}
                  >
                    {/* Render according to ElementType */}
                    {item.type === 'custom_image' && item.imageData && (
                      <img
                        src={item.imageData}
                        alt="Custom attachment"
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    )}

                    {item.type === 'test_tube' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 40 100" className="w-full h-full">
                          <defs>
                            <clipPath id={`clip-${item.id}`}>
                              <path d="M 5,2 L 5,80 A 15,15 0 0,0 35,80 L 35,2 Z" />
                            </clipPath>
                          </defs>
                          {/* Liquid fill */}
                          <rect
                            x="5"
                            y={100 - (item.liquidHeightPercent || 40)}
                            width="30"
                            height="100"
                            fill={item.color || '#9333ea'}
                            opacity="0.8"
                            clipPath={`url(#clip-${item.id})`}
                          />
                          {/* Glass tube outline */}
                          <path
                            d="M 2,2 L 38,2 M 5,2 L 5,80 A 15,15 0 0,0 35,80 L 35,2"
                            fill="none"
                            stroke="#334155"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    )}

                    {item.type === 'test_tube_sidearm' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 55 100" className="w-full h-full">
                          <defs>
                            <clipPath id={`clip-${item.id}`}>
                              <path d="M 5,2 L 5,80 A 15,15 0 0,0 35,80 L 35,2 Z" />
                            </clipPath>
                          </defs>
                          <rect
                            x="5"
                            y={100 - (item.liquidHeightPercent || 40)}
                            width="30"
                            height="100"
                            fill={item.color || '#9333ea'}
                            opacity="0.8"
                            clipPath={`url(#clip-${item.id})`}
                          />
                          {/* Tube outline + branch */}
                          <path
                            d="M 2,2 L 38,2 M 5,2 L 5,80 A 15,15 0 0,0 35,80 L 35,25 L 52,18 L 52,24 L 35,31 L 35,2"
                            fill="none"
                            stroke="#334155"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    )}

                    {item.type === 'round_flask' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 100 120" className="w-full h-full">
                          <defs>
                            <clipPath id={`clip-${item.id}`}>
                              <circle cx="50" cy="78" r="38" />
                            </clipPath>
                          </defs>
                          {/* Liquid */}
                          <rect
                            x="10"
                            y={120 - (item.liquidHeightPercent || 45) * 0.9}
                            width="80"
                            height="80"
                            fill={item.color || '#9333ea'}
                            opacity="0.8"
                            clipPath={`url(#clip-${item.id})`}
                          />
                          {/* Flask Neck and bulb */}
                          <path
                            d="M 40,2 L 60,2 M 42,2 L 42,42 C 30,50 12,62 12,78 C 12,99 29,116 50,116 C 71,116 88,99 88,78 C 88,62 70,50 58,42 L 58,2"
                            fill="none"
                            stroke="#334155"
                            strokeWidth="2.5"
                          />
                        </svg>
                      </div>
                    )}

                    {item.type === 'round_flask_branch' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 120 120" className="w-full h-full">
                          <defs>
                            <clipPath id={`clip-${item.id}`}>
                              <circle cx="50" cy="78" r="38" />
                            </clipPath>
                          </defs>
                          <rect
                            x="10"
                            y={120 - (item.liquidHeightPercent || 45) * 0.9}
                            width="80"
                            height="80"
                            fill={item.color || '#9333ea'}
                            opacity="0.8"
                            clipPath={`url(#clip-${item.id})`}
                          />
                          {/* Neck with side branch */}
                          <path
                            d="M 40,2 L 60,2 M 42,2 L 42,42 C 30,50 12,62 12,78 C 12,99 29,116 50,116 C 71,116 88,99 88,78 C 88,62 70,50 58,42 L 58,26 L 85,18 L 85,24 L 58,32 L 58,2"
                            fill="none"
                            stroke="#334155"
                            strokeWidth="2.5"
                          />
                        </svg>
                      </div>
                    )}

                    {item.type === 'erlenmeyer' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 100 120" className="w-full h-full">
                          <defs>
                            <clipPath id={`clip-${item.id}`}>
                              <path d="M 40,40 L 10,112 L 90,112 L 60,40 Z" />
                            </clipPath>
                          </defs>
                          <rect
                            x="5"
                            y={120 - (item.liquidHeightPercent || 45) * 0.8}
                            width="90"
                            height="80"
                            fill={item.color || '#9333ea'}
                            opacity="0.8"
                            clipPath={`url(#clip-${item.id})`}
                          />
                          <path
                            d="M 38,2 L 62,2 M 40,2 L 40,35 L 10,112 C 9,114 11,116 14,116 L 86,116 C 89,116 91,114 90,112 L 60,35 L 60,2"
                            fill="none"
                            stroke="#334155"
                            strokeWidth="2.5"
                          />
                        </svg>
                      </div>
                    )}

                    {item.type === 'beaker' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 90 100" className="w-full h-full">
                          <defs>
                            <clipPath id={`clip-${item.id}`}>
                              <rect x="8" y="10" width="74" height="85" rx="5" />
                            </clipPath>
                          </defs>
                          <rect
                            x="8"
                            y={100 - (item.liquidHeightPercent || 50)}
                            width="74"
                            height="85"
                            fill={item.color || '#0284c7'}
                            opacity="0.8"
                            clipPath={`url(#clip-${item.id})`}
                          />
                          <path
                            d="M 3,6 L 8,10 L 8,92 C 8,96 11,98 15,98 L 75,98 C 79,98 82,96 82,92 L 82,10 L 87,10"
                            fill="none"
                            stroke="#334155"
                            strokeWidth="2.5"
                          />
                          {/* Graduation tick marks */}
                          <line x1="14" y1="30" x2="28" y2="30" stroke="#64748b" strokeWidth="1.5" />
                          <line x1="14" y1="50" x2="35" y2="50" stroke="#64748b" strokeWidth="1.5" />
                          <line x1="14" y1="70" x2="28" y2="70" stroke="#64748b" strokeWidth="1.5" />
                        </svg>
                      </div>
                    )}

                    {item.type === 'burette' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 30 180" className="w-full h-full">
                          <rect x="11" y="5" width="8" height="135" fill={item.color || '#9333ea'} opacity="0.6" />
                          <path
                            d="M 8,5 L 22,5 M 10,5 L 10,140 L 7,148 L 7,155 L 11,157 L 11,175 L 15,180 L 19,175 L 19,157 L 23,155 L 23,148 L 20,140 L 20,5"
                            fill="none"
                            stroke="#334155"
                            strokeWidth="2"
                          />
                          {/* Stopcock */}
                          <circle cx="15" cy="152" r="4" fill="#ef4444" />
                          {/* Burette graduations */}
                          {[20, 35, 50, 65, 80, 95, 110, 125].map((gy) => (
                            <line key={gy} x1="10" y1={gy} x2="16" y2={gy} stroke="#64748b" strokeWidth="1" />
                          ))}
                        </svg>
                      </div>
                    )}

                    {item.type === 'alcohol_lamp' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 80 80" className="w-full h-full">
                          {/* Flame */}
                          <path
                            d="M 40,6 C 30,16 35,26 40,32 C 45,26 50,16 40,6 Z"
                            fill="#f59e0b"
                            stroke="#ea580c"
                            strokeWidth="1.5"
                          />
                          <path
                            d="M 40,14 C 36,20 38,26 40,30 C 42,26 44,20 40,14 Z"
                            fill="#38bdf8"
                          />
                          {/* Lamp glass base */}
                          <rect x="34" y="32" width="12" height="6" fill="#64748b" rx="1" />
                          <path
                            d="M 32,38 L 48,38 L 65,65 C 68,70 65,76 60,76 L 20,76 C 15,76 12,70 15,65 Z"
                            fill="#e2e8f0"
                            stroke="#334155"
                            strokeWidth="2"
                          />
                          {/* Alcohol liquid */}
                          <path
                            d="M 20,54 L 60,54 L 63,68 C 64,72 61,74 58,74 L 22,74 C 19,74 16,72 17,68 Z"
                            fill="#bae6fd"
                            opacity="0.8"
                          />
                        </svg>
                      </div>
                    )}

                    {item.type === 'tripod_wire' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                          {/* Gauze mesh */}
                          <rect x="15" y="10" width="70" height="8" fill="#94a3b8" rx="2" stroke="#334155" strokeWidth="1.5" />
                          <circle cx="50" cy="14" r="10" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                          {/* 3 Legs */}
                          <line x1="22" y1="18" x2="5" y2="95" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
                          <line x1="50" y1="18" x2="50" y2="95" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
                          <line x1="78" y1="18" x2="95" y2="95" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      </div>
                    )}

                    {item.type === 'iron_stand' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 100 200" className="w-full h-full">
                          {/* Base plate */}
                          <rect x="5" y="185" width="80" height="12" fill="#334155" rx="3" />
                          {/* Vertical rod */}
                          <rect x="25" y="5" width="6" height="182" fill="#64748b" rx="2" />
                          {/* Clamp 1 */}
                          <rect x="20" y="60" width="16" height="12" fill="#0f172a" rx="2" />
                          <path d="M 36,66 L 75,66 C 85,60 85,72 75,66" stroke="#0f172a" strokeWidth="3" fill="none" />
                          <path d="M 68,52 C 85,52 85,80 68,80" stroke="#0f172a" strokeWidth="3" fill="none" />
                        </svg>
                      </div>
                    )}

                    {item.type === 'tube_l' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 60 60" className="w-full h-full">
                          <path
                            d="M 5,55 L 5,20 C 5,10 10,5 20,5 L 55,5"
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="5"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 5,55 L 5,20 C 5,10 10,5 20,5 L 55,5"
                            fill="none"
                            stroke="#0284c7"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </div>
                    )}

                    {item.type === 'tube_u' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 60 60" className="w-full h-full">
                          <path
                            d="M 12,5 L 12,40 C 12,52 48,52 48,40 L 48,5"
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    )}

                    {item.type === 'rubber_stopper' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 40 25" className="w-full h-full">
                          <polygon points="5,5 35,5 30,22 10,22" fill="#78350f" stroke="#451a03" strokeWidth="1.5" />
                        </svg>
                      </div>
                    )}

                    {item.type === 'cotton_plug' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 40 25" className="w-full h-full">
                          <ellipse cx="20" cy="12" rx="16" ry="8" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2,2" />
                          <text x="20" y="15" textAnchor="middle" fontSize="7" fill="#0f172a" fontWeight="bold">
                            Bông NaOH
                          </text>
                        </svg>
                      </div>
                    )}

                    {item.type === 'trough_water' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 120 60" className="w-full h-full">
                          <rect x="5" y="15" width="110" height="40" rx="4" fill="#38bdf8" opacity="0.3" />
                          <path d="M 5,5 L 5,52 C 5,56 8,58 12,58 L 108,58 C 112,58 115,56 115,52 L 115,5" fill="none" stroke="#334155" strokeWidth="2.5" />
                          <text x="60" y="40" textAnchor="middle" fontSize="10" fill="#0369a1" fontWeight="bold">
                            Chậu nước
                          </text>
                        </svg>
                      </div>
                    )}

                    {item.type === 'bubbles' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 40 60" className="w-full h-full">
                          <circle cx="20" cy="50" r="3" fill="#bae6fd" stroke="#0284c7" strokeWidth="1" />
                          <circle cx="14" cy="38" r="4" fill="#bae6fd" stroke="#0284c7" strokeWidth="1" />
                          <circle cx="26" cy="24" r="5" fill="#bae6fd" stroke="#0284c7" strokeWidth="1" />
                          <circle cx="18" cy="10" r="4.5" fill="#bae6fd" stroke="#0284c7" strokeWidth="1" />
                        </svg>
                      </div>
                    )}

                    {item.type === 'precipitate' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 50 20" className="w-full h-full">
                          <ellipse cx="25" cy="10" rx="20" ry="7" fill={item.color || '#fef08a'} stroke="#ca8a04" strokeWidth="1" />
                          <text x="25" y="13" textAnchor="middle" fontSize="8" fill="#854d0e" fontWeight="bold">
                            Kết tủa ↓
                          </text>
                        </svg>
                      </div>
                    )}

                    {item.type === 'benzene' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 80 80" className="w-full h-full">
                          <polygon points="40,5 72,23 72,60 40,78 8,60 8,23" fill="none" stroke="#0f172a" strokeWidth="2.5" />
                          <circle cx="40" cy="41" r="20" fill="none" stroke="#0f172a" strokeWidth="2" strokeDasharray="3,3" />
                        </svg>
                      </div>
                    )}

                    {item.type === 'arrow' && (
                      <div className="w-full h-full flex items-center pointer-events-none">
                        <svg viewBox="0 0 80 20" className="w-full h-full">
                          <line x1="2" y1="10" x2="68" y2="10" stroke="#0f172a" strokeWidth="2" />
                          <polygon points="68,5 78,10 68,15" fill="#0f172a" />
                        </svg>
                      </div>
                    )}

                    {item.type === 'battery_zn_cu' && (
                      <div className="w-full h-full relative pointer-events-none">
                        <svg viewBox="0 0 200 120" className="w-full h-full">
                          {/* Beaker 1 (Zn) */}
                          <rect x="10" y="45" width="60" height="65" fill="#bae6fd" opacity="0.5" stroke="#334155" strokeWidth="1.5" rx="3" />
                          <rect x="25" y="25" width="12" height="65" fill="#94a3b8" stroke="#334155" strokeWidth="1" />
                          <text x="31" y="20" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#0f172a">Zn</text>
                          <text x="40" y="80" textAnchor="middle" fontSize="8" fill="#0369a1">dd ZnSO4</text>

                          {/* Beaker 2 (Cu) */}
                          <rect x="130" y="45" width="60" height="65" fill="#93c5fd" opacity="0.7" stroke="#334155" strokeWidth="1.5" rx="3" />
                          <rect x="163" y="25" width="12" height="65" fill="#ea580c" stroke="#334155" strokeWidth="1" />
                          <text x="169" y="20" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#0f172a">Cu</text>
                          <text x="160" y="80" textAnchor="middle" fontSize="8" fill="#1e3a8a">dd CuSO4</text>

                          {/* Salt bridge */}
                          <path d="M 55,55 L 55,30 C 55,20 145,20 145,30 L 145,55" fill="none" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" />
                          <text x="100" y="16" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#b45309">Cầu muối KCl</text>

                          {/* Voltmeter wire & device */}
                          <path d="M 31,25 L 31,5 L 100,5" fill="none" stroke="#dc2626" strokeWidth="1.5" />
                          <path d="M 169,25 L 169,5 L 100,5" fill="none" stroke="#dc2626" strokeWidth="1.5" />
                          <circle cx="100" cy="5" r="9" fill="#ffffff" stroke="#dc2626" strokeWidth="1.5" />
                          <text x="100" y="8" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#dc2626">1.10V</text>
                        </svg>
                      </div>
                    )}

                    {item.type === 'text' && (
                      <div className="w-full h-full flex items-center">
                        <span
                          className="font-serif font-bold text-slate-900 pointer-events-none select-none px-1"
                          style={{ fontSize: item.fontSize || 13, color: item.color || '#0f172a' }}
                        >
                          {item.text}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Caption Input inside Canvas area */}
            <div className="w-[800px] mt-3 flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 shrink-0">Chú thích sơ đồ:</span>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Ví dụ: Hình 1. Sơ đồ điều chế và thử tính chất của etilen trong phòng thí nghiệm"
                className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 font-serif italic"
              />
            </div>
          </div>
        </div>

        {/* Selected Item Properties Inspector (Bar below Canvas) */}
        {selectedItem && (
          <div className="px-5 py-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Đang chọn: {selectedItem.type}</span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-500">
                Tọa độ: ({selectedItem.x}, {selectedItem.y})
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* If text item, allow direct edit */}
              {selectedItem.type === 'text' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600">Nội dung:</span>
                  <input
                    type="text"
                    value={selectedItem.text || ''}
                    onChange={(e) =>
                      updateSelectedItem((it) => ({ ...it, text: e.target.value }))
                    }
                    className="border border-slate-300 rounded px-2 py-1 text-xs w-48 font-serif"
                  />
                  <input
                    type="number"
                    value={selectedItem.fontSize || 13}
                    min={9}
                    max={28}
                    onChange={(e) =>
                      updateSelectedItem((it) => ({
                        ...it,
                        fontSize: parseInt(e.target.value) || 13,
                      }))
                    }
                    className="border border-slate-300 rounded px-2 py-1 text-xs w-14"
                  />
                  <span className="text-slate-400 text-[10px]">px</span>
                </div>
              )}

              {/* Liquid height slider */}
              {selectedItem.liquidHeightPercent !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600">Mực dd:</span>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={selectedItem.liquidHeightPercent}
                    onChange={(e) =>
                      updateSelectedItem((it) => ({
                        ...it,
                        liquidHeightPercent: parseInt(e.target.value),
                      }))
                    }
                    className="w-20 accent-emerald-600"
                  />
                </div>
              )}

              {/* Rotation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    updateSelectedItem((it) => ({
                      ...it,
                      rotation: (it.rotation - 15) % 360,
                    }))
                  }
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                  title="Xoay trái 15 độ"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <span className="text-slate-600 w-8 text-center font-mono">
                  {selectedItem.rotation}°
                </span>
                <button
                  onClick={() =>
                    updateSelectedItem((it) => ({
                      ...it,
                      rotation: (it.rotation + 15) % 360,
                    }))
                  }
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                  title="Xoay phải 15 độ"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Resize */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    updateSelectedItem((it) => ({
                      ...it,
                      width: Math.round(it.width * 1.1),
                      height: Math.round(it.height * 1.1),
                    }))
                  }
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                  title="Phóng to 10%"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateSelectedItem((it) => ({
                      ...it,
                      width: Math.max(20, Math.round(it.width * 0.9)),
                      height: Math.max(20, Math.round(it.height * 0.9)),
                    }))
                  }
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                  title="Thu nhỏ 10%"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Layer order */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    updateSelectedItem((it) => ({ ...it, zIndex: it.zIndex + 1 }))
                  }
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                  title="Đưa lên trên (Bring Forward)"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateSelectedItem((it) => ({
                      ...it,
                      zIndex: Math.max(1, it.zIndex - 1),
                    }))
                  }
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                  title="Hạ xuống dưới (Send Backward)"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Delete item */}
              <button
                onClick={deleteSelected}
                className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                title="Xóa đối tượng này"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Modal Bottom Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Mẹo: Thầy Cô có thể bấm <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded font-mono">Ctrl+V</kbd> để dán ảnh chụp đề thi bất kỳ lúc nào.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleSaveAndExport}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Áp Dụng Vào Câu Hỏi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 6 PRESET EXPERIMENTS (GDPT 2018)
const PRESETS: PresetTemplate[] = [
  {
    name: 'Điều chế & thử C2H4',
    description: 'C2H5OH + H2SO4 đặc (đá bọt, 170°C) dẫn vào dd KMnO4 làm mất màu tím',
    caption: 'Hình 1. Thí nghiệm điều chế và thử tính chất của etilen (C2H4) trong phòng thí nghiệm',
    items: [
      // Heat & Stand
      { id: 'p1_lamp', type: 'alcohol_lamp', x: 190, y: 310, width: 85, height: 85, rotation: 0, zIndex: 1 },
      { id: 'p1_stand', type: 'iron_stand', x: 130, y: 130, width: 140, height: 270, rotation: 0, zIndex: 2 },
      // Reaction test tube
      { id: 'p1_tube1', type: 'test_tube', x: 200, y: 170, width: 65, height: 160, rotation: -20, liquidHeightPercent: 40, color: '#f59e0b', zIndex: 3 },
      { id: 'p1_bubbles', type: 'bubbles', x: 210, y: 230, width: 30, height: 50, rotation: 0, zIndex: 4 },
      // Stopper
      { id: 'p1_stopper', type: 'rubber_stopper', x: 195, y: 160, width: 45, height: 25, rotation: -20, zIndex: 5 },
      // Delivery tube
      { id: 'p1_tube_l', type: 'tube_l', x: 235, y: 145, width: 220, height: 120, rotation: 0, zIndex: 6 },
      // Receiving test tube with KMnO4
      { id: 'p1_tube2', type: 'test_tube', x: 440, y: 220, width: 60, height: 150, rotation: 0, liquidHeightPercent: 55, color: '#9333ea', zIndex: 7 },
      // Text annotations
      { id: 'p1_t1', type: 'text', x: 60, y: 210, width: 130, height: 35, rotation: 0, text: 'C2H5OH + H2SO4 đặc + Đá bọt', fontSize: 12, zIndex: 10 },
      { id: 'p1_t2', type: 'text', x: 215, y: 125, width: 60, height: 30, rotation: 0, text: 't° ≈ 170°C', fontSize: 11, zIndex: 10 },
      { id: 'p1_t3', type: 'text', x: 430, y: 380, width: 120, height: 30, rotation: 0, text: 'dd KMnO4 loãng', fontSize: 12, zIndex: 10 },
      { id: 'p1_t4', type: 'text', x: 310, y: 135, width: 70, height: 30, rotation: 0, text: 'Khí C2H4 →', fontSize: 12, zIndex: 10 },
    ],
  },
  {
    name: 'Điều chế khí Clo (Cl2)',
    description: 'MnO2 + HCl đặc đun nóng, dẫn qua bình NaCl (giữ HCl), bình H2SO4 đn (làm khô), thu khí đậy bông tẩm kiềm',
    caption: 'Hình 2. Sơ đồ điều chế và thu khí clo (Cl2) trong phòng thí nghiệm',
    items: [
      // Round flask with MnO2 + HCl
      { id: 'p2_stand', type: 'iron_stand', x: 70, y: 120, width: 140, height: 280, rotation: 0, zIndex: 1 },
      { id: 'p2_lamp', type: 'alcohol_lamp', x: 130, y: 315, width: 85, height: 85, rotation: 0, zIndex: 2 },
      { id: 'p2_flask', type: 'round_flask_branch', x: 120, y: 170, width: 105, height: 145, rotation: 0, liquidHeightPercent: 50, color: '#334155', zIndex: 3 },
      // Washing bottle 1 (dd NaCl)
      { id: 'p2_erlen1', type: 'erlenmeyer', x: 260, y: 220, width: 85, height: 125, rotation: 0, liquidHeightPercent: 45, color: '#38bdf8', zIndex: 4 },
      // Washing bottle 2 (dd H2SO4 đặc)
      { id: 'p2_erlen2', type: 'erlenmeyer', x: 380, y: 220, width: 85, height: 125, rotation: 0, liquidHeightPercent: 45, color: '#94a3b8', zIndex: 5 },
      // Collecting flask (Cl2)
      { id: 'p2_erlen3', type: 'erlenmeyer', x: 500, y: 220, width: 90, height: 130, rotation: 0, liquidHeightPercent: 70, color: '#84cc16', zIndex: 6 },
      { id: 'p2_cotton', type: 'cotton_plug', x: 525, y: 215, width: 40, height: 25, rotation: 0, zIndex: 7 },
      // Text annotations
      { id: 'p2_t1', type: 'text', x: 90, y: 135, width: 120, height: 30, rotation: 0, text: 'MnO2 + dd HCl đặc', fontSize: 11, zIndex: 10 },
      { id: 'p2_t2', type: 'text', x: 260, y: 355, width: 90, height: 30, rotation: 0, text: 'Bình dd NaCl (giữ HCl)', fontSize: 11, zIndex: 10 },
      { id: 'p2_t3', type: 'text', x: 375, y: 355, width: 100, height: 30, rotation: 0, text: 'Bình H2SO4 đặc (làm khô)', fontSize: 11, zIndex: 10 },
      { id: 'p2_t4', type: 'text', x: 505, y: 355, width: 90, height: 30, rotation: 0, text: 'Bình thu Cl2', fontSize: 11, zIndex: 10 },
    ],
  },
  {
    name: 'Chuẩn độ Acid - Base',
    description: 'Chuẩn độ dung dịch HCl bằng dung dịch chuẩn NaOH dùng buret và chỉ thị phenolphthalein',
    caption: 'Hình 3. Thí nghiệm chuẩn độ dung dịch HCl bằng dung dịch chuẩn NaOH',
    items: [
      { id: 'p3_stand', type: 'iron_stand', x: 260, y: 80, width: 150, height: 330, rotation: 0, zIndex: 1 },
      { id: 'p3_burette', type: 'burette', x: 330, y: 95, width: 35, height: 230, rotation: 0, color: '#9333ea', zIndex: 4 },
      { id: 'p3_erlen', type: 'erlenmeyer', x: 295, y: 290, width: 100, height: 130, rotation: 0, liquidHeightPercent: 35, color: '#fbcfe8', zIndex: 5 },
      // Annotations
      { id: 'p3_t1', type: 'text', x: 380, y: 130, width: 140, height: 30, rotation: 0, text: 'Buret chứa dd NaOH chuẩn', fontSize: 12, zIndex: 10 },
      { id: 'p3_t2', type: 'text', x: 405, y: 330, width: 180, height: 35, rotation: 0, text: 'Bình tam giác chứa dd HCl + phenolphthalein (hóa hồng)', fontSize: 11, zIndex: 10 },
    ],
  },
  {
    name: 'Xà phòng hóa chất béo',
    description: 'Đun sôi nhẹ mỡ động vật/dầu thực vật với dung dịch NaOH 40%, sau đó thêm dung dịch NaCl bão hòa',
    caption: 'Hình 4. Thí nghiệm xà phòng hóa chất béo (điều chế xà phòng)',
    items: [
      { id: 'p4_lamp', type: 'alcohol_lamp', x: 300, y: 295, width: 90, height: 90, rotation: 0, zIndex: 1 },
      { id: 'p4_tripod', type: 'tripod_wire', x: 285, y: 230, width: 120, height: 120, rotation: 0, zIndex: 2 },
      { id: 'p4_beaker', type: 'beaker', x: 295, y: 140, width: 100, height: 120, rotation: 0, liquidHeightPercent: 50, color: '#fef08a', zIndex: 3 },
      { id: 'p4_precip', type: 'precipitate', x: 315, y: 165, width: 60, height: 25, rotation: 0, color: '#ffffff', zIndex: 4 },
      { id: 'p4_t1', type: 'text', x: 410, y: 155, width: 170, height: 35, rotation: 0, text: 'Mỡ lợn/Dầu ăn + dd NaOH 40% (đun sôi nhẹ 30 phút)', fontSize: 11, zIndex: 10 },
      { id: 'p4_t2', type: 'text', x: 410, y: 195, width: 170, height: 35, rotation: 0, text: 'Thêm NaCl bão hòa → Muối natri của axit béo nổi lên', fontSize: 11, zIndex: 10 },
    ],
  },
  {
    name: 'Pin điện hóa Zn - Cu',
    description: 'Sơ đồ pin Galvanic Zn-Cu: Điện cực Zn nhúng trong ZnSO4, Cu trong CuSO4, nối bằng cầu muối KCl',
    caption: 'Hình 5. Sơ đồ cấu tạo và hoạt động của pin điện hóa Zn - Cu (E° = 1.10 V)',
    items: [
      { id: 'p5_battery', type: 'battery_zn_cu', x: 230, y: 140, width: 330, height: 220, rotation: 0, zIndex: 1 },
      { id: 'p5_t1', type: 'text', x: 130, y: 200, width: 100, height: 40, rotation: 0, text: 'Anot (-): Quá trình oxi hóa Zn → Zn2+ + 2e', fontSize: 11, zIndex: 10 },
      { id: 'p5_t2', type: 'text', x: 570, y: 200, width: 100, height: 40, rotation: 0, text: 'Catot (+): Quá trình khử Cu2+ + 2e → Cu', fontSize: 11, zIndex: 10 },
    ],
  },
  {
    name: 'Phản ứng tráng bạc (AgNO3/NH3)',
    description: 'CH3CHO phản ứng với thuốc thử Tollens [Ag(NH3)2]OH đun nóng trong cốc nước ấm tạo gương bạc',
    caption: 'Hình 6. Thí nghiệm phản ứng tráng bạc của acetaldehyde (CH3CHO)',
    items: [
      { id: 'p6_beaker', type: 'beaker', x: 280, y: 180, width: 140, height: 160, rotation: 0, liquidHeightPercent: 65, color: '#bae6fd', zIndex: 1 },
      { id: 'p6_tube', type: 'test_tube', x: 320, y: 140, width: 55, height: 150, rotation: 0, liquidHeightPercent: 40, color: '#cbd5e1', zIndex: 2 },
      { id: 'p6_precip', type: 'precipitate', x: 325, y: 245, width: 45, height: 20, rotation: 0, color: '#e2e8f0', zIndex: 3 },
      { id: 'p6_t1', type: 'text', x: 440, y: 170, width: 180, height: 35, rotation: 0, text: 'Ống nghiệm chứa: CH3CHO + [Ag(NH3)2]OH', fontSize: 11, zIndex: 10 },
      { id: 'p6_t2', type: 'text', x: 440, y: 220, width: 180, height: 35, rotation: 0, text: 'Cốc nước nóng (60 - 70°C)', fontSize: 11, zIndex: 10 },
      { id: 'p6_t3', type: 'text', x: 440, y: 260, width: 180, height: 35, rotation: 0, text: 'Hiện tượng: Lớp bạc sáng bóng bám thành ống nghiệm', fontSize: 11, zIndex: 10 },
    ],
  },
];
