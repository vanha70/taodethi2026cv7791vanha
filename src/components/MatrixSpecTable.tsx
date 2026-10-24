import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  HelpCircle,
  BarChart3,
  PieChart as PieChartIcon,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  MatrixRow,
  SpecificationRow,
  Part1Question,
  Part2Question,
  Part3Question,
  EssayQuestion,
} from '../types/exam';
import { AiCognitiveAdvisorPanel } from './AiCognitiveAdvisorPanel';

interface MatrixSpecTableProps {
  matrix: MatrixRow[];
  specification: SpecificationRow[];
  subject?: string;
  grade?: string;
  durationMinutes?: number;
  part1?: Part1Question[];
  part2?: Part2Question[];
  part3?: Part3Question[];
  essay?: EssayQuestion[];
  onUpdateMatrix: (matrix: MatrixRow[]) => void;
  onUpdateSpecification: (spec: SpecificationRow[]) => void;
  onUpdateDuration?: (durationMinutes: number) => void;
  onSyncQuestionsLevel?: (updated: {
    part1: Part1Question[];
    part2: Part2Question[];
    part3: Part3Question[];
    essay: EssayQuestion[];
  }) => void;
}

const LEVEL_COLORS = {
  know: '#0284c7', // Sky-600 (Nhận biết)
  understand: '#4f46e5', // Indigo-600 (Thông hiểu)
  apply: '#059669', // Emerald-600 (Vận dụng)
  highApply: '#d97706', // Amber-600 (Vận dụng cao)
};

export const MatrixSpecTable: React.FC<MatrixSpecTableProps> = ({
  matrix,
  specification,
  subject = 'Hóa học',
  grade = 'Lớp 12',
  durationMinutes = 50,
  part1 = [],
  part2 = [],
  part3 = [],
  essay = [],
  onUpdateMatrix,
  onUpdateSpecification,
  onUpdateDuration,
  onSyncQuestionsLevel,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'spec'>('matrix');
  const [showCharts, setShowCharts] = useState<boolean>(true);
  const [showAiAdvisor, setShowAiAdvisor] = useState<boolean>(true);
  const [barChartMode, setBarChartMode] = useState<'by_part' | 'by_topic'>('by_part');

  // Compute totals for matrix across all 4 cognitive levels
  const totals = matrix.reduce(
    (acc, row) => ({
      knowPart1: acc.knowPart1 + Number(row.knowPart1 || 0),
      understandPart1: acc.understandPart1 + Number(row.understandPart1 || 0),
      applyPart1: acc.applyPart1 + Number(row.applyPart1 || 0),
      highApplyPart1: acc.highApplyPart1 + Number(row.highApplyPart1 || 0),

      knowPart2: acc.knowPart2 + Number(row.knowPart2 || 0),
      understandPart2: acc.understandPart2 + Number(row.understandPart2 || 0),
      applyPart2: acc.applyPart2 + Number(row.applyPart2 || 0),
      highApplyPart2: acc.highApplyPart2 + Number(row.highApplyPart2 || 0),

      knowPart3: acc.knowPart3 + Number(row.knowPart3 || 0),
      understandPart3: acc.understandPart3 + Number(row.understandPart3 || 0),
      applyPart3: acc.applyPart3 + Number(row.applyPart3 || 0),
      highApplyPart3: acc.highApplyPart3 + Number(row.highApplyPart3 || 0),

      essayScore: acc.essayScore + Number(row.essayScore || 0),
      totalPoints: acc.totalPoints + Number(row.totalPoints || 0),
    }),
    {
      knowPart1: 0,
      understandPart1: 0,
      applyPart1: 0,
      highApplyPart1: 0,
      knowPart2: 0,
      understandPart2: 0,
      applyPart2: 0,
      highApplyPart2: 0,
      knowPart3: 0,
      understandPart3: 0,
      applyPart3: 0,
      highApplyPart3: 0,
      essayScore: 0,
      totalPoints: 0,
    }
  );

  const totalKnow = totals.knowPart1 + totals.knowPart2 + totals.knowPart3;
  const totalUnderstand =
    totals.understandPart1 + totals.understandPart2 + totals.understandPart3;
  const totalApply = totals.applyPart1 + totals.applyPart2 + totals.applyPart3;
  const totalHighApply =
    totals.highApplyPart1 + totals.highApplyPart2 + totals.highApplyPart3;
  const totalQuestions = totalKnow + totalUnderstand + totalApply + totalHighApply;

  const getPercent = (val: number) =>
    totalQuestions > 0 ? Number(((val / totalQuestions) * 100).toFixed(1)) : 0;

  // Data for PieChart (4 Cognitive Levels)
  const pieChartData = [
    {
      name: 'Nhận biết',
      value: totalKnow,
      percent: getPercent(totalKnow),
      target: 40,
      color: LEVEL_COLORS.know,
    },
    {
      name: 'Thông hiểu',
      value: totalUnderstand,
      percent: getPercent(totalUnderstand),
      target: 30,
      color: LEVEL_COLORS.understand,
    },
    {
      name: 'Vận dụng',
      value: totalApply,
      percent: getPercent(totalApply),
      target: 20,
      color: LEVEL_COLORS.apply,
    },
    {
      name: 'Vận dụng cao',
      value: totalHighApply,
      percent: getPercent(totalHighApply),
      target: 10,
      color: LEVEL_COLORS.highApply,
    },
  ];

  // Data for BarChart by Exam Part (Phần I, Phần II, Phần III)
  const partBarData = [
    {
      name: 'Phần I (TN 4 lựa chọn)',
      'Nhận biết': totals.knowPart1,
      'Thông hiểu': totals.understandPart1,
      'Vận dụng': totals.applyPart1,
      'Vận dụng cao': totals.highApplyPart1,
      total:
        totals.knowPart1 +
        totals.understandPart1 +
        totals.applyPart1 +
        totals.highApplyPart1,
    },
    {
      name: 'Phần II (TN Đúng/Sai)',
      'Nhận biết': totals.knowPart2,
      'Thông hiểu': totals.understandPart2,
      'Vận dụng': totals.applyPart2,
      'Vận dụng cao': totals.highApplyPart2,
      total:
        totals.knowPart2 +
        totals.understandPart2 +
        totals.applyPart2 +
        totals.highApplyPart2,
    },
    {
      name: 'Phần III (Trả lời ngắn)',
      'Nhận biết': totals.knowPart3,
      'Thông hiểu': totals.understandPart3,
      'Vận dụng': totals.applyPart3,
      'Vận dụng cao': totals.highApplyPart3,
      total:
        totals.knowPart3 +
        totals.understandPart3 +
        totals.applyPart3 +
        totals.highApplyPart3,
    },
  ];

  // Data for BarChart by Topic (Chủ đề kiến thức)
  const topicBarData = matrix.map((row, index) => {
    const shortTopic =
      row.topic.length > 28 ? `${row.topic.slice(0, 28)}...` : row.topic || `Chủ đề ${index + 1}`;
    const know =
      Number(row.knowPart1 || 0) + Number(row.knowPart2 || 0) + Number(row.knowPart3 || 0);
    const understand =
      Number(row.understandPart1 || 0) +
      Number(row.understandPart2 || 0) +
      Number(row.understandPart3 || 0);
    const apply =
      Number(row.applyPart1 || 0) + Number(row.applyPart2 || 0) + Number(row.applyPart3 || 0);
    const highApply =
      Number(row.highApplyPart1 || 0) +
      Number(row.highApplyPart2 || 0) +
      Number(row.highApplyPart3 || 0);

    return {
      name: `CĐ ${index + 1}: ${shortTopic}`,
      fullTopic: row.topic,
      'Nhận biết': know,
      'Thông hiểu': understand,
      'Vận dụng': apply,
      'Vận dụng cao': highApply,
      points: Number(row.totalPoints || 0),
    };
  });

  const handleAddMatrixRow = () => {
    const newRow: MatrixRow = {
      id: `m_${Date.now()}`,
      topic: 'Chủ đề mới...',
      knowPart1: 2,
      understandPart1: 1,
      applyPart1: 1,
      highApplyPart1: 0,
      knowPart2: 1,
      understandPart2: 1,
      applyPart2: 0,
      highApplyPart2: 0,
      knowPart3: 0,
      understandPart3: 1,
      applyPart3: 1,
      highApplyPart3: 1,
      essayScore: 0,
      totalPoints: 2.5,
    };
    onUpdateMatrix([...matrix, newRow]);
  };

  const handleBalanceStandard4Levels = () => {
    if (matrix.length === 0) return;
    const updated = matrix.map((row) => ({
      ...row,
      highApplyPart1: Number(row.highApplyPart1 || 0),
      highApplyPart2:
        row.highApplyPart2 !== undefined && row.highApplyPart2 > 0 ? row.highApplyPart2 : 1,
      highApplyPart3:
        row.highApplyPart3 !== undefined && row.highApplyPart3 > 0 ? row.highApplyPart3 : 1,
    }));
    onUpdateMatrix(updated);
  };

  const handleDeleteMatrixRow = (index: number) => {
    const updated = matrix.filter((_, i) => i !== index);
    onUpdateMatrix(updated);
  };

  const handleUpdateMatrixCell = (
    index: number,
    field: keyof MatrixRow,
    value: any
  ) => {
    const updated = [...matrix];
    updated[index] = { ...updated[index], [field]: value };
    onUpdateMatrix(updated);
  };

  const handleAddSpecRow = () => {
    const newSpec: SpecificationRow = {
      id: `s_${Date.now()}`,
      topic: 'Chủ đề / Đơn vị kiến thức mới',
      competency: 'Mô tả yêu cầu cần đạt của chuẩn chương trình GDPT 2018...',
      knowDesc: 'Nhận biết các khái niệm, định nghĩa cơ bản...',
      understandDesc: 'Giải thích, phân biệt các hiện tượng, tính chất...',
      applyDesc: 'Vận dụng tính toán bài toán hoặc giải thích hiện tượng thực tế...',
      highApplyDesc: 'Vận dụng cao giải quyết bài toán tổng hợp, thực tiễn phức tạp...',
      questionMapping: 'Phần I: C1; Phần II: C1',
    };
    onUpdateSpecification([...specification, newSpec]);
  };

  const handleDeleteSpecRow = (index: number) => {
    const updated = specification.filter((_, i) => i !== index);
    onUpdateSpecification(updated);
  };

  const handleUpdateSpecCell = (
    index: number,
    field: keyof SpecificationRow,
    value: string
  ) => {
    const updated = [...specification];
    updated[index] = { ...updated[index], [field]: value };
    onUpdateSpecification(updated);
  };

  return (
    <div className="space-y-6">
      {/* Sub tabs and explanation notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveSubTab('matrix')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'matrix'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            1. Ma Trận Đề Kiểm Tra (CV 7991)
          </button>
          <button
            onClick={() => setActiveSubTab('spec')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'spec'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            2. Bản Đặc Tả Đề Kiểm Tra
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAiAdvisor((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              showAiAdvisor
                ? 'text-amber-900 bg-amber-100 hover:bg-amber-200 border-amber-300'
                : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>{showAiAdvisor ? 'Ẩn Trợ lý AI Phân bổ' : 'Mở Trợ lý AI Phân bổ'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCharts((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
          >
            {showCharts ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showCharts ? 'Ẩn biểu đồ thống kê' : 'Hiện biểu đồ thống kê'}</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200/80">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Theo dõi trực quan 4 mức độ: <strong>Nhận biết - Thông hiểu - Vận dụng - Vận dụng cao</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================================
          AI COGNITIVE LEVEL DISTRIBUTION ADVISOR PANEL
          ============================================================================ */}
      {showAiAdvisor && (
        <AiCognitiveAdvisorPanel
          subject={subject}
          grade={grade}
          durationMinutes={durationMinutes}
          matrix={matrix}
          part1={part1}
          part2={part2}
          part3={part3}
          essay={essay}
          onApplyToMatrix={(newMatrix, newDuration) => {
            onUpdateMatrix(newMatrix);
            if (onUpdateDuration && newDuration !== durationMinutes) {
              onUpdateDuration(newDuration);
            }
          }}
          onSyncQuestionsLevel={onSyncQuestionsLevel}
        />
      )}

      {/* ============================================================================
          RECHARTS COGNITIVE LEVEL STATISTICAL DASHBOARD
          ============================================================================ */}
      {showCharts && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-sky-50/40 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  BIỂU ĐỒ THỐNG KÊ MỨC ĐỘ NHẬN THỨC (THEO DỮ LIỆU MA TRẬN HIỆN TẠI)
                </h3>
                <p className="text-xs text-slate-500">
                  Tự động cập nhật thời gian thực khi giáo viên điều chỉnh số lượng câu hỏi trên bảng ma trận ({totalQuestions} câu/lệnh hỏi • {totals.totalPoints} điểm)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {totalHighApply === 0 && (
                <button
                  type="button"
                  onClick={handleBalanceStandard4Levels}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                  title="Tự động bổ sung mẫu câu hỏi Vận dụng cao vào ma trận"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  <span>Gợi ý phân bổ Vận dụng cao</span>
                </button>
              )}

              <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setBarChartMode('by_part')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    barChartMode === 'by_part'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Theo Phần Thi (I, II, III)
                </button>
                <button
                  type="button"
                  onClick={() => setBarChartMode('by_topic')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    barChartMode === 'by_topic'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Theo Chủ Đề Kiến Thức
                </button>
              </div>
            </div>
          </div>

          {/* 4 KPI Summary Cards */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/50 border-b border-slate-200">
            {/* Card 1: Nhận biết */}
            <div className="p-3.5 bg-white rounded-xl border border-sky-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-700 uppercase tracking-wide">
                  1. Nhận biết (NB)
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
                  {getPercent(totalKnow)}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{totalKnow}</span>
                <span className="text-[11px] text-slate-500">
                  P.I: {totals.knowPart1} • P.II: {totals.knowPart2} • P.III: {totals.knowPart3}
                </span>
              </div>
              <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, getPercent(totalKnow))}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-slate-400 flex justify-between">
                <span>Khuyến nghị: ~40%</span>
                <span>{totalKnow} câu/lệnh hỏi</span>
              </div>
            </div>

            {/* Card 2: Thông hiểu */}
            <div className="p-3.5 bg-white rounded-xl border border-indigo-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                  2. Thông hiểu (TH)
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                  {getPercent(totalUnderstand)}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{totalUnderstand}</span>
                <span className="text-[11px] text-slate-500">
                  P.I: {totals.understandPart1} • P.II: {totals.understandPart2} • P.III: {totals.understandPart3}
                </span>
              </div>
              <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, getPercent(totalUnderstand))}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-slate-400 flex justify-between">
                <span>Khuyến nghị: ~30%</span>
                <span>{totalUnderstand} câu/lệnh hỏi</span>
              </div>
            </div>

            {/* Card 3: Vận dụng */}
            <div className="p-3.5 bg-white rounded-xl border border-emerald-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                  3. Vận dụng (VD)
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  {getPercent(totalApply)}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{totalApply}</span>
                <span className="text-[11px] text-slate-500">
                  P.I: {totals.applyPart1} • P.II: {totals.applyPart2} • P.III: {totals.applyPart3}
                </span>
              </div>
              <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, getPercent(totalApply))}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-slate-400 flex justify-between">
                <span>Khuyến nghị: ~20%</span>
                <span>{totalApply} câu/lệnh hỏi</span>
              </div>
            </div>

            {/* Card 4: Vận dụng cao */}
            <div className="p-3.5 bg-white rounded-xl border border-amber-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                  4. Vận dụng cao (VDC)
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  {getPercent(totalHighApply)}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{totalHighApply}</span>
                <span className="text-[11px] text-slate-500">
                  P.I: {totals.highApplyPart1} • P.II: {totals.highApplyPart2} • P.III: {totals.highApplyPart3}
                </span>
              </div>
              <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, getPercent(totalHighApply))}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-slate-400 flex justify-between">
                <span>Khuyến nghị: ~10%</span>
                <span>{totalHighApply} câu/lệnh hỏi</span>
              </div>
            </div>
          </div>

          {/* Charts Grid: Left = Donut Chart (Overall Ratio), Right = Bar Chart (By Part or By Topic) */}
          <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Donut / Pie Chart */}
            <div className="lg:col-span-5 flex flex-col items-center border border-slate-100 rounded-xl p-4 bg-slate-50/30">
              <div className="w-full flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <PieChartIcon className="w-4 h-4 text-indigo-600" />
                  <span>Tỷ lệ Cơ cấu Nhận thức Toàn đề (%)</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  Tổng: {totalQuestions} lệnh hỏi
                </span>
              </div>

              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={84}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        percent && percent > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''
                      }
                      labelLine={false}
                    >
                      {pieChartData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any, props: any) => [
                        `${value} câu/lệnh hỏi (${props?.payload?.percent ?? 0}%)`,
                        name,
                      ]}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={32}
                      wrapperStyle={{ fontSize: '12px', fontWeight: 600 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Grouped / Stacked Bar Chart */}
            <div className="lg:col-span-7 flex flex-col border border-slate-100 rounded-xl p-4 bg-slate-50/30">
              <div className="w-full flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>
                    {barChartMode === 'by_part'
                      ? 'Phân bổ Số lượng Câu hỏi theo Phần thi (Phần I, II, III)'
                      : 'Phân bổ Mức độ Nhận thức theo từng Chủ đề Kiến thức'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Đơn vị: Số câu / lệnh hỏi
                </span>
              </div>

              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {barChartMode === 'by_part' ? (
                    <BarChart
                      data={partBarData}
                      margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                      <Bar
                        dataKey="Nhận biết"
                        fill={LEVEL_COLORS.know}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="Thông hiểu"
                        fill={LEVEL_COLORS.understand}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="Vận dụng"
                        fill={LEVEL_COLORS.apply}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="Vận dụng cao"
                        fill={LEVEL_COLORS.highApply}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  ) : (
                    <BarChart
                      data={topicBarData}
                      margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                      <Bar
                        dataKey="Nhận biết"
                        stackId="a"
                        fill={LEVEL_COLORS.know}
                      />
                      <Bar
                        dataKey="Thông hiểu"
                        stackId="a"
                        fill={LEVEL_COLORS.understand}
                      />
                      <Bar
                        dataKey="Vận dụng"
                        stackId="a"
                        fill={LEVEL_COLORS.apply}
                      />
                      <Bar
                        dataKey="Vận dụng cao"
                        stackId="a"
                        fill={LEVEL_COLORS.highApply}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MATRIX TAB */}
      {activeSubTab === 'matrix' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                KHUNG MA TRẬN ĐỀ KIỂM TRA ĐỊNH KỲ THEO CÔNG VĂN 7991
              </h3>
              <p className="text-xs text-slate-500">
                Thang điểm 10 • Đầy đủ 4 mức độ nhận thức (Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao)
              </p>
            </div>
            <button
              onClick={handleAddMatrixRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Thêm Chủ Đề
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                  <th rowSpan={2} className="p-2 border-r border-slate-200 text-left min-w-[200px]">
                    Chủ đề / Đơn vị kiến thức
                  </th>
                  <th colSpan={4} className="p-2 border-r border-slate-200 bg-sky-50 text-sky-800">
                    Phần I: TN 4 lựa chọn (số câu)
                  </th>
                  <th colSpan={4} className="p-2 border-r border-slate-200 bg-indigo-50 text-indigo-800">
                    Phần II: TN Đúng/Sai (số ý)
                  </th>
                  <th colSpan={4} className="p-2 border-r border-slate-200 bg-emerald-50 text-emerald-800">
                    Phần III: Trả lời ngắn (số câu)
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-slate-200 bg-purple-50 text-purple-800 w-16">
                    Tự luận (điểm)
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-slate-200 bg-slate-200 text-slate-800 w-16">
                    Tổng điểm
                  </th>
                  <th rowSpan={2} className="p-2 text-center w-10">
                    Xóa
                  </th>
                </tr>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px]">
                  <th className="p-1 border-r border-slate-200 bg-sky-50/50">NB</th>
                  <th className="p-1 border-r border-slate-200 bg-sky-50/50">TH</th>
                  <th className="p-1 border-r border-slate-200 bg-sky-50/50">VD</th>
                  <th className="p-1 border-r border-slate-200 bg-amber-50/70 text-amber-800">VDC</th>

                  <th className="p-1 border-r border-slate-200 bg-indigo-50/50">NB</th>
                  <th className="p-1 border-r border-slate-200 bg-indigo-50/50">TH</th>
                  <th className="p-1 border-r border-slate-200 bg-indigo-50/50">VD</th>
                  <th className="p-1 border-r border-slate-200 bg-amber-50/70 text-amber-800">VDC</th>

                  <th className="p-1 border-r border-slate-200 bg-emerald-50/50">NB</th>
                  <th className="p-1 border-r border-slate-200 bg-emerald-50/50">TH</th>
                  <th className="p-1 border-r border-slate-200 bg-emerald-50/50">VD</th>
                  <th className="p-1 border-r border-slate-200 bg-amber-50/70 text-amber-800">VDC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {matrix.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2 border-r border-slate-200 text-left font-medium text-slate-800">
                      <input
                        type="text"
                        value={row.topic}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'topic', e.target.value)}
                        className="w-full bg-transparent border-0 focus:ring-1 focus:ring-indigo-500 rounded px-1 text-xs"
                      />
                    </td>

                    {/* Part 1 */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.knowPart1}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'knowPart1', Number(e.target.value))}
                        className="w-9 text-center border border-slate-200 rounded p-1"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.understandPart1}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'understandPart1', Number(e.target.value))}
                        className="w-9 text-center border border-slate-200 rounded p-1"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.applyPart1}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'applyPart1', Number(e.target.value))}
                        className="w-9 text-center border border-slate-200 rounded p-1"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200 bg-amber-50/20">
                      <input
                        type="number"
                        min="0"
                        value={row.highApplyPart1 || 0}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'highApplyPart1', Number(e.target.value))}
                        className="w-9 text-center border border-amber-200 rounded p-1 text-amber-900 font-semibold"
                      />
                    </td>

                    {/* Part 2 */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.knowPart2}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'knowPart2', Number(e.target.value))}
                        className="w-9 text-center border border-slate-200 rounded p-1"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.understandPart2}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'understandPart2', Number(e.target.value))}
                        className="w-9 text-center border border-slate-200 rounded p-1"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.applyPart2}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'applyPart2', Number(e.target.value))}
                        className="w-9 text-center border border-slate-200 rounded p-1"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200 bg-amber-50/20">
                      <input
                        type="number"
                        min="0"
                        value={row.highApplyPart2 || 0}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'highApplyPart2', Number(e.target.value))}
                        className="w-9 text-center border border-amber-200 rounded p-1 text-amber-900 font-semibold"
                      />
                    </td>

                    {/* Part 3 */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.knowPart3}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'knowPart3', Number(e.target.value))}
                        className="w-9 text-center border border-slate-200 rounded p-1"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.understandPart3}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'understandPart3', Number(e.target.value))}
                        className="w-9 text-center border border-slate-200 rounded p-1"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.applyPart3}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'applyPart3', Number(e.target.value))}
                        className="w-9 text-center border border-slate-200 rounded p-1"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200 bg-amber-50/20">
                      <input
                        type="number"
                        min="0"
                        value={row.highApplyPart3 || 0}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'highApplyPart3', Number(e.target.value))}
                        className="w-9 text-center border border-amber-200 rounded p-1 text-amber-900 font-semibold"
                      />
                    </td>

                    {/* Essay & Points */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={row.essayScore}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'essayScore', Number(e.target.value))}
                        className="w-12 text-center border border-slate-200 rounded p-1"
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200 font-bold text-indigo-700 bg-slate-50">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={row.totalPoints}
                        onChange={(e) => handleUpdateMatrixCell(idx, 'totalPoints', Number(e.target.value))}
                        className="w-12 text-center border border-slate-200 rounded p-1 font-bold text-indigo-700"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        onClick={() => handleDeleteMatrixRow(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="p-2 border-r border-slate-300 text-left">TỔNG CỘNG</td>
                  <td className="p-1 border-r border-slate-200 text-sky-800">{totals.knowPart1}</td>
                  <td className="p-1 border-r border-slate-200 text-sky-800">{totals.understandPart1}</td>
                  <td className="p-1 border-r border-slate-200 text-sky-800">{totals.applyPart1}</td>
                  <td className="p-1 border-r border-slate-200 text-amber-800">{totals.highApplyPart1}</td>

                  <td className="p-1 border-r border-slate-200 text-indigo-800">{totals.knowPart2}</td>
                  <td className="p-1 border-r border-slate-200 text-indigo-800">{totals.understandPart2}</td>
                  <td className="p-1 border-r border-slate-200 text-indigo-800">{totals.applyPart2}</td>
                  <td className="p-1 border-r border-slate-200 text-amber-800">{totals.highApplyPart2}</td>

                  <td className="p-1 border-r border-slate-200 text-emerald-800">{totals.knowPart3}</td>
                  <td className="p-1 border-r border-slate-200 text-emerald-800">{totals.understandPart3}</td>
                  <td className="p-1 border-r border-slate-200 text-emerald-800">{totals.applyPart3}</td>
                  <td className="p-1 border-r border-slate-200 text-amber-800">{totals.highApplyPart3}</td>

                  <td className="p-1 border-r border-slate-200 text-purple-800">{totals.essayScore}</td>
                  <td className="p-1 border-r border-slate-200 text-indigo-700 font-black">
                    {totals.totalPoints}đ
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* SPECIFICATION TAB */}
      {activeSubTab === 'spec' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KỲ THEO CÔNG VĂN 7991
              </h3>
              <p className="text-xs text-slate-500">
                Mô tả chi tiết các yêu cầu cần đạt (năng lực, phẩm chất) theo các mức độ nhận thức
              </p>
            </div>
            <button
              onClick={handleAddSpecRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Thêm Mục Đặc Tả
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                  <th className="p-2 border-r border-slate-200 w-12 text-center">TT</th>
                  <th className="p-2 border-r border-slate-200 w-44 text-left">Chủ đề</th>
                  <th className="p-2 border-r border-slate-200 text-left min-w-[200px]">Yêu cầu cần đạt</th>
                  <th className="p-2 border-r border-slate-200 text-left bg-sky-50/50 min-w-[160px]">Nhận biết</th>
                  <th className="p-2 border-r border-slate-200 text-left bg-indigo-50/50 min-w-[160px]">Thông hiểu</th>
                  <th className="p-2 border-r border-slate-200 text-left bg-emerald-50/50 min-w-[160px]">Vận dụng & VDC</th>
                  <th className="p-2 border-r border-slate-200 w-32 text-center">Câu hỏi</th>
                  <th className="p-2 w-10 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {specification.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-slate-50/80">
                    <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="p-2 border-r border-slate-200 font-medium">
                      <textarea
                        rows={3}
                        value={row.topic}
                        onChange={(e) => handleUpdateSpecCell(idx, 'topic', e.target.value)}
                        className="w-full border-0 focus:ring-1 focus:ring-indigo-500 rounded p-1 text-xs"
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200">
                      <textarea
                        rows={3}
                        value={row.competency}
                        onChange={(e) => handleUpdateSpecCell(idx, 'competency', e.target.value)}
                        className="w-full border-0 focus:ring-1 focus:ring-indigo-500 rounded p-1 text-xs"
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 bg-sky-50/30">
                      <textarea
                        rows={3}
                        value={row.knowDesc}
                        onChange={(e) => handleUpdateSpecCell(idx, 'knowDesc', e.target.value)}
                        className="w-full border-0 focus:ring-1 focus:ring-indigo-500 rounded p-1 text-xs"
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 bg-indigo-50/30">
                      <textarea
                        rows={3}
                        value={row.understandDesc}
                        onChange={(e) => handleUpdateSpecCell(idx, 'understandDesc', e.target.value)}
                        className="w-full border-0 focus:ring-1 focus:ring-indigo-500 rounded p-1 text-xs"
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 bg-emerald-50/30">
                      <textarea
                        rows={3}
                        value={row.applyDesc}
                        onChange={(e) => handleUpdateSpecCell(idx, 'applyDesc', e.target.value)}
                        className="w-full border-0 focus:ring-1 focus:ring-indigo-500 rounded p-1 text-xs"
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center">
                      <input
                        type="text"
                        value={row.questionMapping}
                        onChange={(e) => handleUpdateSpecCell(idx, 'questionMapping', e.target.value)}
                        className="w-full text-center border border-slate-200 rounded p-1 text-xs"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => handleDeleteSpecRow(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
