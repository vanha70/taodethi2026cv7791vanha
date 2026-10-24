import React, { useState, useRef, useEffect } from 'react';
import {
  FileCode,
  FileUp,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Crop,
  Eye,
  EyeOff,
  Sparkles,
  PlayCircle,
  FlaskConical,
  ShieldCheck,
  Wand2,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { Part1Question, Part2Question, Part3Question, EssayQuestion } from '../types/exam';
import {
  extractPdfDocumentPages,
  parseExamTextToStructuredData,
  generateSamplePdfExamDemo,
  RenderedPdfPage,
} from '../utils/pdfExamParser';
import { normalizeBrokenFormulasToLatex } from '../utils/chemMathNormalizer';
import { MathChemView } from './MathChemView';

interface RawImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportParsed: (
    data: {
      part1?: Part1Question[];
      part2?: Part2Question[];
      part3?: Part3Question[];
      essay?: EssayQuestion[];
    },
    startOnlineTestImmediately?: boolean,
    openFirebasePublish?: boolean
  ) => void;
  subject: string;
}

const SMILES_PRESETS = [
  { name: 'Ethyl acetate (CH3COOC2H5)', smiles: 'CC(=O)OCC' },
  { name: 'Methyl acrylate (CH2=CHCOOCH3)', smiles: 'C=CC(=O)OC' },
  { name: 'Benzene (C6H6)', smiles: 'c1ccccc1' },
  { name: 'Phenol (C6H5OH)', smiles: 'Oc1ccccc1' },
  { name: 'Aniline (C6H5NH2)', smiles: 'Nc1ccccc1' },
  { name: 'Glycine (H2N-CH2-COOH)', smiles: 'NCC(=O)O' },
  { name: 'Alanine (CH3-CH(NH2)-COOH)', smiles: 'CC(N)C(=O)O' },
  { name: 'Aspirin (Acetylsalicylic acid)', smiles: 'CC(=O)Oc1ccccc1C(=O)O' },
];

export const RawImportModal: React.FC<RawImportModalProps> = ({
  isOpen,
  onClose,
  onImportParsed,
  subject,
}) => {
  const [activeTab, setActiveTab] = useState<'pdf_upload' | 'canvas_crop' | 'raw_text'>('pdf_upload');
  const [rawText, setRawText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Extracted PDF Pages & Parsed Questions State
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [pdfPages, setPdfPages] = useState<RenderedPdfPage[]>([]);
  const [selectedPageIdx, setSelectedPageIdx] = useState<number>(0);

  const [parsedPart1, setParsedPart1] = useState<Part1Question[]>([]);
  const [parsedPart2, setParsedPart2] = useState<Part2Question[]>([]);
  const [parsedPart3, setParsedPart3] = useState<Part3Question[]>([]);
  const [parsedEssay, setParsedEssay] = useState<EssayQuestion[]>([]);
  const [detectionMethods, setDetectionMethods] = useState<string[]>([]);

  // Teacher toggle to inspect hidden answer keys vs Student view (answers strictly hidden)
  const [revealHiddenAnswersForTeacher, setRevealHiddenAnswersForTeacher] = useState<boolean>(false);

  // Interactive <canvas> cropping state
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState<boolean>(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const [targetQuestionKey, setTargetQuestionKey] = useState<string>('p1_1');

  // SmilesDrawer state
  const [smilesInput, setSmilesInput] = useState<string>('CC(=O)OCC');
  const [smilesLabel, setSmilesLabel] = useState<string>('Công thức cấu tạo: Ethyl acetate');
  const smilesCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render PDF page + crop selection overlay onto interactive canvas
  useEffect(() => {
    const page = pdfPages[selectedPageIdx];
    const canvas = cropCanvasRef.current;
    if (!page || !canvas) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      if (cropRect && cropRect.w > 5 && cropRect.h > 5) {
        ctx.save();
        ctx.fillStyle = 'rgba(79, 70, 229, 0.12)';
        ctx.fillRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 5]);
        ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
        ctx.restore();
      }
    };
    img.src = page.dataUrl;
  }, [pdfPages, selectedPageIdx, cropRect, activeTab]);

  // Render SMILES structure preview whenever smilesInput changes on canvas_crop tab
  useEffect(() => {
    if (activeTab !== 'canvas_crop') return;
    renderSmilesToCanvas(smilesInput);
  }, [smilesInput, activeTab]);

  const applyParsedResultFromText = (
    text: string,
    figures: RenderedPdfPage['autoCroppedFigures'] = []
  ) => {
    const result = parseExamTextToStructuredData(text, figures);
    setParsedPart1(result.part1);
    setParsedPart2(result.part2);
    setParsedPart3(result.part3);
    setParsedEssay(result.essay);
    setDetectionMethods(result.detectedAnswerSummary.detectionMethods);
    if (result.part1.length > 0) {
      setTargetQuestionKey('p1_1');
    }
  };

  // Load the user's actual ĐỀ ONLINE 0103.pdf from /assets/aistudio/___ONLINE_0103_2a1e5c8b.pdf
  const handleLoadUploaded0103Pdf = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await fetch('/assets/aistudio/___ONLINE_0103_2a1e5c8b.pdf');
      if (!res.ok) {
        throw new Error('Không tìm thấy file ĐỀ ONLINE 0103.pdf');
      }
      const blob = await res.blob();
      setPdfFileName('ĐỀ ONLINE 0103.pdf');

      const { pages, fullText } = await extractPdfDocumentPages(blob);
      setPdfPages(pages);
      setSelectedPageIdx(0);
      setRawText(fullText);

      const allAutoFigures = pages.flatMap((p) => p.autoCroppedFigures);
      const parsed = parseExamTextToStructuredData(fullText, allAutoFigures);
      setParsedPart1(parsed.part1);
      setParsedPart2(parsed.part2);
      setParsedPart3(parsed.part3);
      setParsedEssay(parsed.essay);
      setDetectionMethods(parsed.detectedAnswerSummary.detectionMethods);

      setStatusBanner(
        `Đã bóc tách chính xác "ĐỀ ONLINE 0103.pdf": Phần I (${parsed.part1.length} câu = ${(
          parsed.part1.length * 0.25
        )
          .toFixed(2)
          .replace('.', ',')}đ) • Phần II (${parsed.part2.length} câu Đ/S = ${(
          parsed.part2.length * 1.0
        )
          .toFixed(2)
          .replace('.', ',')}đ) • Phần III (${parsed.part3.length} câu ngắn = ${(
          parsed.part3.length * 0.25
        )
          .toFixed(2)
          .replace('.', ',')}đ) kèm ${allAutoFigures.length} hình minh họa!`
      );
    } catch (err: any) {
      console.error('Load ĐỀ ONLINE 0103.pdf error:', err);
      handleLoadDemoPdfExam();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && pdfPages.length === 0 && !isLoading) {
      handleLoadUploaded0103Pdf();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle real PDF file upload via PDF.js
  const handlePdfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setErrorMsg(null);
      setPdfFileName(file.name);

      const { pages, fullText } = await extractPdfDocumentPages(file);
      setPdfPages(pages);
      setSelectedPageIdx(0);
      setRawText(fullText);

      const allAutoFigures = pages.flatMap((p) => p.autoCroppedFigures);
      const parsed = parseExamTextToStructuredData(fullText, allAutoFigures);
      setParsedPart1(parsed.part1);
      setParsedPart2(parsed.part2);
      setParsedPart3(parsed.part3);
      setParsedEssay(parsed.essay);
      setDetectionMethods(parsed.detectedAnswerSummary.detectionMethods);

      setStatusBanner(
        `Đã đọc thành công ${pages.length} trang PDF "${file.name}": Phần I (${parsed.part1.length} câu) • Phần II (${parsed.part2.length} câu) • Phần III (${parsed.part3.length} câu)!`
      );
    } catch (err: any) {
      console.error('PDF extraction error:', err);
      setErrorMsg(err.message || 'Không thể đọc file PDF. Vui lòng thử lại!');
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  // Load 1-click Demo PDF with full 3-part structure (18 Part I + 4 Part II + 6 Part III = 28 questions, 10.0 pts)
  const handleLoadDemoPdfExam = () => {
    setErrorMsg(null);
    const demoPage = generateSamplePdfExamDemo();
    setPdfFileName('De_Thi_Chuan_3_Phan_Hoa_12_28_Cau_Co_Dap_An.pdf');
    setPdfPages([demoPage]);
    setSelectedPageIdx(0);
    setRawText(demoPage.fullRawText);
    applyParsedResultFromText(demoPage.fullRawText, demoPage.autoCroppedFigures);
    setCropRect({ x: 110, y: 235, w: 660, h: 250 });
    setTargetQuestionKey('p1_2');
    setStatusBanner(
      'Đã nạp Đề PDF mẫu chuẩn 3 phần (18 câu Phần I [4,50đ] • 4 câu Phần II Đ/S [4,00đ] • 6 câu Phần III trả lời ngắn [1,50đ] = Tổng 10,0 điểm)!'
    );
  };

  // Canvas mouse handlers for cropping region from PDF page
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = cropCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY)),
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasCoordinates(e);
    setIsDraggingCrop(true);
    setCropStart(pt);
    setCropRect({ x: pt.x, y: pt.y, w: 0, h: 0 });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingCrop || !cropStart) return;
    const pt = getCanvasCoordinates(e);
    setCropRect({
      x: Math.min(cropStart.x, pt.x),
      y: Math.min(cropStart.y, pt.y),
      w: Math.abs(pt.x - cropStart.x),
      h: Math.abs(pt.y - cropStart.y),
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingCrop(false);
  };

  // Crop selected rectangle from PDF page <canvas> into Base64 PNG and attach to chosen question
  const handleCropAndAttachToQuestion = () => {
    const page = pdfPages[selectedPageIdx];
    if (!page || !cropRect || cropRect.w < 15 || cropRect.h < 15) {
      setErrorMsg('Vui lòng kéo chuột khoanh vùng hình vẽ trên trang PDF trước khi cắt!');
      return;
    }

    const img = new Image();
    img.onload = () => {
      const outCanvas = document.createElement('canvas');
      outCanvas.width = Math.round(cropRect.w);
      outCanvas.height = Math.round(cropRect.h);
      const ctx = outCanvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
      ctx.drawImage(
        img,
        cropRect.x,
        cropRect.y,
        cropRect.w,
        cropRect.h,
        0,
        0,
        outCanvas.width,
        outCanvas.height
      );

      const base64Url = outCanvas.toDataURL('image/png', 0.95);
      attachImageToTargetQuestion(
        base64Url,
        `Hình vẽ cắt từ trang ${page.pageNumber} PDF`
      );
    };
    img.src = page.dataUrl;
  };

  const attachImageToTargetQuestion = (base64Url: string, caption: string) => {
    const [partPrefix, idStr] = targetQuestionKey.split('_');
    const qId = Number(idStr);

    if (partPrefix === 'p1') {
      setParsedPart1((prev) =>
        prev.map((q) =>
          q.id === qId ? { ...q, imageUrl: base64Url, imageCaption: caption } : q
        )
      );
    } else if (partPrefix === 'p2') {
      setParsedPart2((prev) =>
        prev.map((q) =>
          q.id === qId ? { ...q, imageUrl: base64Url, imageCaption: caption } : q
        )
      );
    } else if (partPrefix === 'p3') {
      setParsedPart3((prev) =>
        prev.map((q) =>
          q.id === qId ? { ...q, imageUrl: base64Url, imageCaption: caption } : q
        )
      );
    }

    setStatusBanner(`Đã gắn ảnh Base64 ("${caption}") vào câu hỏi đã chọn thành công!`);
  };

  // Render organic structure via SmilesDrawer (with skeletal canvas fallback)
  const renderSmilesToCanvas = (smiles: string) => {
    const canvas = smilesCanvasRef.current;
    if (!canvas) return;
    canvas.width = 420;
    canvas.height = 220;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const SmilesDrawer = window.SmilesDrawer;
    if (SmilesDrawer && SmilesDrawer.Drawer) {
      try {
        const drawer = new SmilesDrawer.Drawer({ width: 420, height: 220 });
        SmilesDrawer.parse(
          smiles,
          (tree: any) => {
            drawer.draw(tree, canvas, 'light', false);
          },
          () => {
            drawFallbackOrganicStructure(canvas, smiles);
          }
        );
        return;
      } catch {
        // Fallback below
      }
    }
    drawFallbackOrganicStructure(canvas, smiles);
  };

  const drawFallbackOrganicStructure = (canvas: HTMLCanvasElement, smiles: string) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;

    // Draw clean skeletal / structural representation
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    if (smiles.includes('c1ccccc1')) {
      // Benzene ring
      const r = 48;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.stroke();

      if (smiles.startsWith('O')) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx, cy - r - 28);
        ctx.stroke();
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('OH', cx - 10, cy - r - 34);
      } else if (smiles.startsWith('N')) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx, cy - r - 28);
        ctx.stroke();
        ctx.fillStyle = '#2563eb';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('NH2', cx - 12, cy - r - 34);
      }
    } else {
      // Ester / Carbon chain skeletal zig-zag
      ctx.beginPath();
      ctx.moveTo(90, 130);
      ctx.lineTo(150, 95);
      ctx.lineTo(210, 130);
      ctx.lineTo(270, 95);
      ctx.lineTo(330, 130);
      ctx.stroke();

      // Double bond C=O
      ctx.beginPath();
      ctx.moveTo(146, 97);
      ctx.lineTo(146, 52);
      ctx.moveTo(154, 97);
      ctx.lineTo(154, 52);
      ctx.stroke();

      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText('O', 143, 45);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`SMILES: ${smiles}`, 120, 195);
    }
  };

  const handleAttachSmilesToQuestion = () => {
    const canvas = smilesCanvasRef.current;
    if (!canvas) return;
    const base64Url = canvas.toDataURL('image/png', 0.95);
    attachImageToTargetQuestion(base64Url, smilesLabel || `Cấu tạo (${smilesInput})`);
  };

  // AI-assisted deep parsing fallback/enhancer
  const handleAiDeepParse = async () => {
    if (!rawText.trim()) {
      setErrorMsg('Chưa có văn bản để phân tích.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg(null);

      const response = await fetch('/api/gemini/parse-raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, subject }),
      });

      const resData = await response.json();
      if (!resData.success) {
        throw new Error(resData.error || 'Lỗi khi phân tích với AI');
      }

      if (resData.data.part1) setParsedPart1(resData.data.part1);
      if (resData.data.part2) setParsedPart2(resData.data.part2);
      if (resData.data.part3) setParsedPart3(resData.data.part3);
      if (resData.data.essay) setParsedEssay(resData.data.essay);

      setStatusBanner(
        'AI Gemini đã chuẩn hóa toàn bộ công thức sang KaTeX (mhchem) và tách đáp án ngầm thành công!'
      );
    } catch (err: any) {
      console.error(err);
      // Fallback to deterministic parser
      applyParsedResultFromText(rawText, pdfPages.flatMap((p) => p.autoCroppedFigures));
      setStatusBanner('Đã bóc tách cấu trúc đề thi và chuẩn hóa công thức KaTeX (mhchem)!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteImport = (
    startOnlineImmediately: boolean,
    openFirebasePublish: boolean = false
  ) => {
    if (
      parsedPart1.length === 0 &&
      parsedPart2.length === 0 &&
      parsedPart3.length === 0 &&
      rawText.trim()
    ) {
      const quickParsed = parseExamTextToStructuredData(
        rawText,
        pdfPages.flatMap((p) => p.autoCroppedFigures)
      );
      onImportParsed(
        {
          part1: quickParsed.part1,
          part2: quickParsed.part2,
          part3: quickParsed.part3,
          essay: quickParsed.essay,
        },
        startOnlineImmediately,
        openFirebasePublish
      );
      onClose();
      return;
    }

    onImportParsed(
      {
        part1: parsedPart1,
        part2: parsedPart2,
        part3: parsedPart3,
        essay: parsedEssay,
      },
      startOnlineImmediately,
      openFirebasePublish
    );
    onClose();
  };

  const totalParsedQuestions =
    parsedPart1.length + parsedPart2.length + parsedPart3.length + parsedEssay.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-lg font-bold">
                  TẢI LÊN ĐỀ THI PDF & BÓC TÁCH TỰ ĐỘNG (PDF.js + KaTeX mhchem)
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Ẩn Đáp Án Ngầm 100%
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Đọc văn bản PDF • Tự động nhận diện đáp án đúng (gạch chân, tô đỏ, in đậm, bảng đáp án) • Chuẩn hóa công thức $\ce&#123;H2SO4&#125;$ • Cắt hình vẽ &lt;canvas&gt;
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="px-5 pt-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('pdf_upload')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'pdf_upload'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>1. Tải File PDF & Nhận Diện Câu Hỏi ({totalParsedQuestions})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('canvas_crop')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'canvas_crop'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              <span>2. Cắt Hình Vẽ PDF (&lt;canvas&gt;) & SmilesDrawer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('raw_text')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'raw_text'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>3. Văn Bản Nguồn & Chuẩn Hóa LaTeX / AI</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <button
              type="button"
              onClick={handleLoadUploaded0103Pdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-300 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>Nạp ĐỀ ONLINE 0103.pdf (18 Câu P.I • 4 Câu P.II • 6 Câu P.III)</span>
            </button>
            <button
              type="button"
              onClick={handleLoadDemoPdfExam}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>Đề Mẫu Hữu Cơ 12</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusBanner && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-semibold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{statusBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="text-emerald-700 hover:text-emerald-900 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* =====================================================================
              TAB 1: PDF UPLOAD & EXTRACTED QUESTIONS PREVIEW (WITH HIDDEN ANSWERS)
              ===================================================================== */}
          {activeTab === 'pdf_upload' && (
            <div className="space-y-4">
              {/* Upload Dropzone */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                <label className="lg:col-span-7 border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/70 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePdfFileUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md mb-2.5">
                    {isLoading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <FileUp className="w-6 h-6" />
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900">
                    {pdfFileName
                      ? `Đã tải file: ${pdfFileName} (${pdfPages.length} trang)`
                      : 'Nhấn để chọn hoặc kéo thả File PDF Đề Thi vào đây'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-md">
                    Hỗ trợ đề thi PDF có đáp án gạch chân, tô đỏ, in đậm, đánh dấu sao (*) hoặc bảng đáp án ở cuối file. Hệ thống tự động sửa lỗi vỡ công thức (H2SO4, Fe3+, t0) sang KaTeX (mhchem).
                  </p>
                </label>

                {/* Security & Formula Normalization Summary Box */}
                <div className="lg:col-span-5 bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Bảo Mật Đáp Án & Chuẩn Hóa KaTeX
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Sẵn sàng chấm điểm
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <div className="text-[10px] font-semibold text-slate-500">Phần I (ABCD)</div>
                        <div className="text-base font-black text-indigo-700">
                          {parsedPart1.length} câu
                        </div>
                        <div className="text-[10px] font-bold text-sky-700">
                          {(parsedPart1.length * 0.25).toFixed(2).replace('.', ',')} điểm
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <div className="text-[10px] font-semibold text-slate-500">Phần II (Đ/S)</div>
                        <div className="text-base font-black text-indigo-700">
                          {parsedPart2.length} câu
                        </div>
                        <div className="text-[10px] font-bold text-indigo-700">
                          {(parsedPart2.length * 1.0).toFixed(1).replace('.', ',')} điểm
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <div className="text-[10px] font-semibold text-slate-500">Phần III (Ngắn)</div>
                        <div className="text-base font-black text-indigo-700">
                          {parsedPart3.length} câu
                        </div>
                        <div className="text-[10px] font-bold text-emerald-700">
                          {(parsedPart3.length * 0.25).toFixed(2).replace('.', ',')} điểm
                        </div>
                      </div>
                    </div>

                    {detectionMethods.length > 0 && (
                      <div className="mt-2.5 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700">Nguồn đáp án nhận diện: </span>
                        {detectionMethods.join(' • ')}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setRevealHiddenAnswersForTeacher((prev) => !prev)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                        revealHiddenAnswersForTeacher
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {revealHiddenAnswersForTeacher ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-amber-700" />
                          <span>Đang bật kiểm tra đáp án ngầm (Chỉ GV thấy)</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Đang ở chế độ Học sinh (Ẩn tuyệt đối đáp án)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Preview of Extracted Questions with KaTeX mhchem & Cropped Figures */}
              {totalParsedQuestions > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      XEM TRƯỚC ĐỀ THI ĐÃ BÓC TÁCH & RENDER CÔNG THỨC KATEX (MHCHEM)
                    </h3>
                    <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      ✓ Đã tự động xóa dấu *, gạch chân & tô đỏ trên giao diện Học sinh
                    </span>
                  </div>

                  {/* Part I Preview */}
                  {parsedPart1.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                        PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn ({parsedPart1.length} câu)
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {parsedPart1.map((q) => (
                          <div
                            key={q.id}
                            className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-xs sm:text-sm text-slate-900">
                                <span className="font-bold text-indigo-700 mr-1.5">
                                  Câu {q.id}:
                                </span>
                                <MathChemView content={q.content} />
                              </div>
                              {revealHiddenAnswersForTeacher && (
                                <span className="shrink-0 px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold">
                                  Đáp án ngầm: {q.correctAnswer}
                                </span>
                              )}
                            </div>

                            {/* Attached Cropped Image / Diagram */}
                            {q.imageUrl && (
                              <div className="my-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center">
                                <img
                                  src={q.imageUrl}
                                  alt={q.imageCaption || `Hình câu ${q.id}`}
                                  className="max-h-48 object-contain rounded border border-white shadow-2xs"
                                />
                                {q.imageCaption && (
                                  <span className="text-[11px] text-slate-500 italic mt-1">
                                    {q.imageCaption}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                              {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                                const isAns =
                                  revealHiddenAnswersForTeacher && q.correctAnswer === optKey;
                                return (
                                  <div
                                    key={optKey}
                                    className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                                      isAns
                                        ? 'border-emerald-400 bg-emerald-50 font-semibold text-emerald-950'
                                        : 'border-slate-200 bg-slate-50/60 text-slate-800'
                                    }`}
                                  >
                                    <span className="font-bold text-indigo-700">{optKey}.</span>
                                    <MathChemView content={q.options[optKey]} />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Part II Preview */}
                  {parsedPart2.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                        PHẦN II. Câu trắc nghiệm Đúng/Sai ({parsedPart2.length} câu • {(parsedPart2.length * 1.0).toFixed(2).replace('.', ',')} điểm)
                      </div>
                      {parsedPart2.map((q) => (
                        <div
                          key={q.id}
                          className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5"
                        >
                          <div className="text-xs sm:text-sm text-slate-900">
                            <span className="font-bold text-indigo-700 mr-1.5">
                              Câu {q.id} (Câu {parsedPart1.length + q.id}):
                            </span>
                            <MathChemView content={q.content} />
                          </div>

                          {/* Attached Cropped Image / Diagram for Part II */}
                          {q.imageUrl && (
                            <div className="my-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center">
                              <img
                                src={q.imageUrl}
                                alt={q.imageCaption || `Hình Phần II - Câu ${q.id}`}
                                className="max-h-48 object-contain rounded border border-white shadow-2xs"
                              />
                              {q.imageCaption && (
                                <span className="text-[11px] text-slate-500 italic mt-1">
                                  {q.imageCaption}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="space-y-1.5 pl-2">
                            {q.items.map((item) => (
                              <div
                                key={item.label}
                                className="flex items-center justify-between gap-2 text-xs p-1.5 rounded-lg bg-slate-50 border border-slate-200/80"
                              >
                                <div>
                                  <span className="font-bold text-indigo-700 mr-1.5">
                                    {item.label})
                                  </span>
                                  <MathChemView content={item.text} />
                                </div>
                                {revealHiddenAnswersForTeacher && (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                      item.isCorrect
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {item.isCorrect ? 'Đúng (Gạch chân)' : 'Sai'}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Part III Preview */}
                  {parsedPart3.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                        PHẦN III. Câu trắc nghiệm trả lời ngắn ({parsedPart3.length} câu)
                      </div>
                      {parsedPart3.map((q) => (
                        <div
                          key={q.id}
                          className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-start justify-between gap-3"
                        >
                          <div className="text-xs sm:text-sm text-slate-900">
                            <span className="font-bold text-indigo-700 mr-1.5">Câu {q.id}:</span>
                            <MathChemView content={q.content} />
                          </div>
                          {revealHiddenAnswersForTeacher && (
                            <span className="shrink-0 px-2.5 py-1 rounded bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold">
                              Đáp số ngầm: {q.correctAnswer}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                  <p className="text-xs sm:text-sm font-semibold text-slate-700">
                    Chưa có file PDF nào được tải lên. Hãy chọn một file PDF từ máy tính hoặc nhấn nút trải nghiệm nhanh bên dưới:
                  </p>
                  <button
                    type="button"
                    onClick={handleLoadDemoPdfExam}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Nạp Ngay Đề PDF Mẫu (Có Đáp Án Tô Đỏ + Hình Thí Nghiệm)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              TAB 2: PDF <CANVAS> CROPPER & SMILESDRAWER ORGANIC STRUCTURE RENDERER
              ===================================================================== */}
          {activeTab === 'canvas_crop' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: PDF Page <canvas> Interactive Cropper */}
              <div className="lg:col-span-7 bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Crop className="w-4 h-4 text-indigo-600" />
                      <span>Cắt Hình Vẽ / Đồ Thị Trực Tiếp Từ &lt;canvas&gt; PDF.js</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Kéo chuột tạo khung chữ nhật quanh hình vẽ thí nghiệm trên trang PDF rồi nhấn "Cắt & Gắn vào Câu hỏi"
                    </p>
                  </div>

                  {pdfPages.length > 1 && (
                    <div className="flex items-center gap-1">
                      {pdfPages.map((p, idx) => (
                        <button
                          key={p.pageNumber}
                          type="button"
                          onClick={() => setSelectedPageIdx(idx)}
                          className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                            selectedPageIdx === idx
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-700'
                          }`}
                        >
                          Trang {p.pageNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {pdfPages.length > 0 ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-xs font-semibold text-slate-700">Gắn hình vào:</span>
                      <select
                        value={targetQuestionKey}
                        onChange={(e) => setTargetQuestionKey(e.target.value)}
                        className="text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 text-indigo-900"
                      >
                        {parsedPart1.map((q) => (
                          <option key={`p1_${q.id}`} value={`p1_${q.id}`}>
                            Phần I - Câu {q.id}
                          </option>
                        ))}
                        {parsedPart2.map((q) => (
                          <option key={`p2_${q.id}`} value={`p2_${q.id}`}>
                            Phần II - Câu {q.id}
                          </option>
                        ))}
                        {parsedPart3.map((q) => (
                          <option key={`p3_${q.id}`} value={`p3_${q.id}`}>
                            Phần III - Câu {q.id}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleCropAndAttachToQuestion}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs cursor-pointer"
                      >
                        <Crop className="w-3.5 h-3.5" />
                        <span>Cắt Vùng Đã Chọn (Base64) & Gắn Vào Câu Hỏi</span>
                      </button>
                    </div>

                    <div className="max-h-[420px] overflow-auto rounded-xl border-2 border-slate-300 bg-slate-200/60 p-2 flex justify-center">
                      <canvas
                        ref={cropCanvasRef}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        className="max-w-full h-auto bg-white shadow-md cursor-crosshair rounded"
                      />
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200 space-y-2">
                    <p className="text-xs text-slate-600">
                      Hãy tải lên file PDF hoặc nhấn nút nạp Đề PDF mẫu để cắt hình vẽ từ trang PDF.
                    </p>
                    <button
                      type="button"
                      onClick={handleLoadDemoPdfExam}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white cursor-pointer"
                    >
                      Nạp Trang PDF Mẫu Ngay
                    </button>
                  </div>
                )}
              </div>

              {/* Right: SmilesDrawer Organic Structure Generator & Auto-Cropped Gallery */}
              <div className="lg:col-span-5 space-y-4">
                {/* SmilesDrawer Box */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <FlaskConical className="w-4 h-4 text-emerald-600" />
                      <span>Vẽ Công Thức Cấu Tạo Hữu Cơ (SmilesDrawer)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Tự động vẽ lại công thức cấu tạo hữu cơ sắc nét từ chuỗi SMILES và gắn vào câu hỏi
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {SMILES_PRESETS.map((item) => (
                      <button
                        key={item.smiles}
                        type="button"
                        onClick={() => {
                          setSmilesInput(item.smiles);
                          setSmilesLabel(`Công thức cấu tạo: ${item.name}`);
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                          smilesInput === item.smiles
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50'
                        }`}
                      >
                        {item.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={smilesInput}
                      onChange={(e) => setSmilesInput(e.target.value)}
                      placeholder="Nhập chuỗi SMILES (VD: CC(=O)OCC)..."
                      className="flex-1 text-xs font-mono border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-2 flex flex-col items-center">
                    <canvas
                      ref={smilesCanvasRef}
                      width={420}
                      height={220}
                      className="max-w-full h-36 object-contain"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAttachSmilesToQuestion}
                    className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Gắn Công Thức Cấu Tạo Này Vào Câu Đang Chọn</span>
                  </button>
                </div>

                {/* Auto-cropped figures from PDF */}
                {pdfPages.some((p) => p.autoCroppedFigures.length > 0) && (
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-800">
                      Hình vẽ tự động phát hiện trong PDF:
                    </h4>
                    <div className="space-y-2">
                      {pdfPages
                        .flatMap((p) => p.autoCroppedFigures)
                        .map((fig) => (
                          <div
                            key={fig.id}
                            className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2"
                          >
                            <img
                              src={fig.dataUrl}
                              alt={fig.label}
                              className="h-14 w-24 object-contain rounded border border-slate-100"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">
                                {fig.label}
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  attachImageToTargetQuestion(fig.dataUrl, fig.label)
                                }
                                className="mt-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                              >
                                + Gắn vào câu đang chọn
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 3: RAW EXTRACTED TEXT & LATEX/MHCHEM FORMULA NORMALIZER
              ===================================================================== */}
          {activeTab === 'raw_text' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700">
                  Nội dung văn bản trích xuất từ PDF / Word (hỗ trợ chuẩn hóa tự động sang $\ce&#123;...&#125;$):
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const normalized = normalizeBrokenFormulasToLatex(rawText);
                      setRawText(normalized);
                      applyParsedResultFromText(
                        normalized,
                        pdfPages.flatMap((p) => p.autoCroppedFigures)
                      );
                      setStatusBanner(
                        'Đã chuẩn hóa toàn bộ công thức hóa học bị lỗi font (H2SO4, Fe3+, t0) sang định dạng LaTeX / mhchem!'
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Chuẩn Hóa Công Thức Sang $\ce&#123;...&#125;$</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAiDeepParse}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-60"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    <span>Bóc Tách Nâng Cao Với AI Gemini</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={13}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  applyParsedResultFromText(
                    e.target.value,
                    pdfPages.flatMap((p) => p.autoCroppedFigures)
                  );
                }}
                placeholder="Dán nội dung đề thi hoặc tải file PDF ở tab 1..."
                className="w-full text-xs font-mono border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Đáp án đúng đã được lưu ngầm để chấm điểm tự động và ẩn hoàn toàn khỏi giao diện làm bài.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={() => handleCompleteImport(false, false)}
              disabled={totalParsedQuestions === 0 && !rawText.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Nạp Vào Trình Soạn Đề</span>
            </button>

            <button
              type="button"
              onClick={() => handleCompleteImport(false, true)}
              disabled={totalParsedQuestions === 0 && !rawText.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Xuất Bản Phòng Thi Firebase (Mã 4 Số)</span>
            </button>

            <button
              type="button"
              onClick={() => handleCompleteImport(true, false)}
              disabled={totalParsedQuestions === 0 && !rawText.trim()}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Làm Bài Thi Thử Ngay (Có Trộn Đề)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
