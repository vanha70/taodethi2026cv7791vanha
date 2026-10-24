import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Clock,
  Gauge,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Sliders,
  Info,
  RefreshCw,
  Layers,
  Check,
} from 'lucide-react';
import {
  MatrixRow,
  Part1Question,
  Part2Question,
  Part3Question,
  EssayQuestion,
  CognitiveLevel,
} from '../types/exam';

export interface AiCognitiveDistributionData {
  summaryTitle: string;
  rationale: string;
  ratios: {
    knowPercent: number;
    understandPercent: number;
    applyPercent: number;
    highApplyPercent: number;
  };
  counts: {
    know: number;
    understand: number;
    apply: number;
    highApply: number;
    totalCommands: number;
  };
  byPart: {
    part1: {
      know: number;
      understand: number;
      apply: number;
      highApply: number;
      total: number;
      estimatedMinutes: number;
    };
    part2: {
      know: number;
      understand: number;
      apply: number;
      highApply: number;
      total: number;
      questionCount: number;
      estimatedMinutes: number;
    };
    part3: {
      know: number;
      understand: number;
      apply: number;
      highApply: number;
      total: number;
      estimatedMinutes: number;
    };
    essay: {
      count: number;
      totalScore: number;
      estimatedMinutes: number;
    };
  };
  matrixRows: MatrixRow[];
}

interface AiCognitiveAdvisorPanelProps {
  subject: string;
  grade: string;
  durationMinutes: number;
  matrix: MatrixRow[];
  part1?: Part1Question[];
  part2?: Part2Question[];
  part3?: Part3Question[];
  essay?: EssayQuestion[];
  onApplyToMatrix: (newMatrix: MatrixRow[], newDuration: number) => void;
  onSyncQuestionsLevel?: (updated: {
    part1: Part1Question[];
    part2: Part2Question[];
    part3: Part3Question[];
    essay: EssayQuestion[];
  }) => void;
}

export const DIFFICULTY_PRESETS = [
  {
    id: 'basic',
    label: 'Cơ bản / Đại trà',
    value: 'Cơ bản / Đại trà (50% Nhận biết - 30% Thông hiểu - 15% Vận dụng - 5% Vận dụng cao)',
    badge: '50 : 30 : 15 : 5',
    desc: 'Ưu tiên củng cố kiến thức nền tảng, phù hợp kiểm tra thường xuyên & lớp đại trà',
    color: 'border-sky-300 bg-sky-50/70 text-sky-900',
  },
  {
    id: 'standard',
    label: 'Chuẩn CV 7991 Bộ GD&ĐT',
    value: 'Chuẩn CV 7991 (40% Nhận biết - 30% Thông hiểu - 20% Vận dụng - 10% Vận dụng cao)',
    badge: '40 : 30 : 20 : 10',
    desc: 'Tỉ lệ vàng chuẩn kiểm tra định kỳ Giữa kì / Cuối kì theo GDPT 2018',
    color: 'border-indigo-300 bg-indigo-50/70 text-indigo-900',
  },
  {
    id: 'advanced',
    label: 'Khá - Giỏi / Phân hóa',
    value: 'Khá - Giỏi / Phân hóa (30% Nhận biết - 30% Thông hiểu - 25% Vận dụng - 15% Vận dụng cao)',
    badge: '30 : 30 : 25 : 15',
    desc: 'Tăng cường câu hỏi tư duy, tính toán thực tiễn & phân loại thi Tốt nghiệp THPT',
    color: 'border-emerald-300 bg-emerald-50/70 text-emerald-900',
  },
  {
    id: 'gifted',
    label: 'Nâng cao / Chuyên - HSG',
    value: 'Nâng cao / Chuyên & HSG (20% Nhận biết - 25% Thông hiểu - 30% Vận dụng - 25% Vận dụng cao)',
    badge: '20 : 25 : 30 : 25',
    desc: 'Phân hóa sâu ở mức Vận dụng & Vận dụng cao cho lớp chọn, đội tuyển HSG',
    color: 'border-amber-300 bg-amber-50/70 text-amber-900',
  },
];

export const DURATION_PRESETS = [15, 45, 50, 60, 90];

export const AiCognitiveAdvisorPanel: React.FC<AiCognitiveAdvisorPanelProps> = ({
  subject,
  grade,
  durationMinutes,
  matrix,
  part1 = [],
  part2 = [],
  part3 = [],
  essay = [],
  onApplyToMatrix,
  onSyncQuestionsLevel,
}) => {
  const [duration, setDuration] = useState<number>(durationMinutes || 50);
  const [difficulty, setDifficulty] = useState<string>(DIFFICULTY_PRESETS[1].value);
  const [essayRatio, setEssayRatio] = useState<string>(
    '70% Trắc nghiệm (7.0đ) - 30% Tự luận (3.0đ)'
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [suggestion, setSuggestion] = useState<AiCognitiveDistributionData | null>(null);
  const [appliedBanner, setAppliedBanner] = useState<string | null>(null);

  useEffect(() => {
    if (durationMinutes && durationMinutes > 0) {
      setDuration(durationMinutes);
    }
  }, [durationMinutes]);

  // Current matrix totals for comparison
  const currentMatrixStats = matrix.reduce(
    (acc, r) => ({
      know:
        acc.know +
        Number(r.knowPart1 || 0) +
        Number(r.knowPart2 || 0) +
        Number(r.knowPart3 || 0),
      understand:
        acc.understand +
        Number(r.understandPart1 || 0) +
        Number(r.understandPart2 || 0) +
        Number(r.understandPart3 || 0),
      apply:
        acc.apply +
        Number(r.applyPart1 || 0) +
        Number(r.applyPart2 || 0) +
        Number(r.applyPart3 || 0),
      highApply:
        acc.highApply +
        Number(r.highApplyPart1 || 0) +
        Number(r.highApplyPart2 || 0) +
        Number(r.highApplyPart3 || 0),
    }),
    { know: 0, understand: 0, apply: 0, highApply: 0 }
  );

  const handleRequestAiSuggestion = async () => {
    try {
      setIsLoading(true);
      setAppliedBanner(null);

      const topics = matrix.map((m) => m.topic).filter(Boolean);
      const response = await fetch('/api/gemini/suggest-distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration,
          difficulty,
          subject,
          grade,
          essayRatio,
          topics,
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        setSuggestion(resData.data);
      }
    } catch (error) {
      console.error('Error fetching AI cognitive suggestion:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Allow teacher to fine-tune individual part counts in the AI suggestion before applying
  const handleAdjustPartLevel = (
    partKey: 'part1' | 'part2' | 'part3',
    levelKey: 'know' | 'understand' | 'apply' | 'highApply',
    newVal: number
  ) => {
    if (!suggestion) return;
    const safeVal = Math.max(0, Math.round(newVal));

    const updatedPart = {
      ...suggestion.byPart[partKey],
      [levelKey]: safeVal,
    };
    updatedPart.total =
      updatedPart.know + updatedPart.understand + updatedPart.apply + updatedPart.highApply;

    if (partKey === 'part2') {
      (updatedPart as any).questionCount = Math.max(1, Math.ceil(updatedPart.total / 4));
    }

    const newByPart = {
      ...suggestion.byPart,
      [partKey]: updatedPart,
    };

    const totalKnow = newByPart.part1.know + newByPart.part2.know + newByPart.part3.know;
    const totalUnderstand =
      newByPart.part1.understand + newByPart.part2.understand + newByPart.part3.understand;
    const totalApply = newByPart.part1.apply + newByPart.part2.apply + newByPart.part3.apply;
    const totalHighApply =
      newByPart.part1.highApply + newByPart.part2.highApply + newByPart.part3.highApply;
    const totalCommands = Math.max(1, totalKnow + totalUnderstand + totalApply + totalHighApply);

    // Recompute matrixRows evenly across existing topics
    const topicList =
      matrix.length > 0
        ? matrix.map((m) => m.topic)
        : suggestion.matrixRows.map((m) => m.topic);
    const nTopics = Math.max(1, topicList.length);
    const hasEssay = !essayRatio.includes('100%');
    const essayScoreTotal = hasEssay ? newByPart.essay.totalScore || 3.0 : 0;

    const distributeInt = (total: number, idx: number) => {
      const base = Math.floor(total / nTopics);
      const rem = total % nTopics;
      return base + (idx < rem ? 1 : 0);
    };

    const updatedMatrixRows: MatrixRow[] = topicList.map((topic, idx) => ({
      id: matrix[idx]?.id || `m_ai_${idx + 1}`,
      topic,
      knowPart1: distributeInt(newByPart.part1.know, idx),
      understandPart1: distributeInt(newByPart.part1.understand, idx),
      applyPart1: distributeInt(newByPart.part1.apply, idx),
      highApplyPart1: distributeInt(newByPart.part1.highApply, idx),
      knowPart2: distributeInt(newByPart.part2.know, idx),
      understandPart2: distributeInt(newByPart.part2.understand, idx),
      applyPart2: distributeInt(newByPart.part2.apply, idx),
      highApplyPart2: distributeInt(newByPart.part2.highApply, idx),
      knowPart3: distributeInt(newByPart.part3.know, idx),
      understandPart3: distributeInt(newByPart.part3.understand, idx),
      applyPart3: distributeInt(newByPart.part3.apply, idx),
      highApplyPart3: distributeInt(newByPart.part3.highApply, idx),
      essayScore: hasEssay ? Number((essayScoreTotal / nTopics).toFixed(2)) : 0,
      totalPoints: Number((10 / nTopics).toFixed(2)),
    }));

    setSuggestion({
      ...suggestion,
      byPart: newByPart,
      counts: {
        know: totalKnow,
        understand: totalUnderstand,
        apply: totalApply,
        highApply: totalHighApply,
        totalCommands,
      },
      ratios: {
        knowPercent: Number(((totalKnow / totalCommands) * 100).toFixed(1)),
        understandPercent: Number(((totalUnderstand / totalCommands) * 100).toFixed(1)),
        applyPercent: Number(((totalApply / totalCommands) * 100).toFixed(1)),
        highApplyPercent: Number(((totalHighApply / totalCommands) * 100).toFixed(1)),
      },
      matrixRows: updatedMatrixRows,
    });
  };

  // Apply AI suggestion to Matrix & Chart
  const handleApplyMatrix = () => {
    if (!suggestion) return;
    onApplyToMatrix(suggestion.matrixRows, duration);
    setAppliedBanner(
      `Đã áp dụng phân bổ AI (${suggestion.counts.know} NB • ${suggestion.counts.understand} TH • ${suggestion.counts.apply} VD • ${suggestion.counts.highApply} VDC) vào Ma trận & Biểu đồ!`
    );
    setTimeout(() => setAppliedBanner(null), 5000);
  };

  // Sync cognitive levels to existing questions in Part I, II, III, Essay
  const handleSyncQuestions = () => {
    if (!suggestion || !onSyncQuestionsLevel) return;

    const buildLevelQueue = (counts: {
      know: number;
      understand: number;
      apply: number;
      highApply: number;
    }): CognitiveLevel[] => {
      const list: CognitiveLevel[] = [];
      for (let i = 0; i < counts.know; i++) list.push('Biết');
      for (let i = 0; i < counts.understand; i++) list.push('Hiểu');
      for (let i = 0; i < counts.apply; i++) list.push('Vận dụng');
      for (let i = 0; i < counts.highApply; i++) list.push('Vận dụng cao');
      return list;
    };

    const p1Levels = buildLevelQueue(suggestion.byPart.part1);
    const updatedPart1 = part1.map((q, idx) => ({
      ...q,
      level:
        p1Levels[idx] ||
        (idx < part1.length * 0.45
          ? 'Biết'
          : idx < part1.length * 0.75
          ? 'Hiểu'
          : idx < part1.length * 0.9
          ? 'Vận dụng'
          : 'Vận dụng cao'),
    }));

    const p2Levels: CognitiveLevel[] = ['Hiểu', 'Vận dụng', 'Biết', 'Vận dụng cao'];
    const updatedPart2 = part2.map((q, idx) => ({
      ...q,
      level: p2Levels[idx % p2Levels.length],
    }));

    const p3Levels = buildLevelQueue(suggestion.byPart.part3);
    const updatedPart3 = part3.map((q, idx) => ({
      ...q,
      level:
        p3Levels[idx] ||
        (idx === 0
          ? 'Hiểu'
          : idx < part3.length - 1
          ? 'Vận dụng'
          : 'Vận dụng cao'),
    }));

    const updatedEssay = essay.map((q, idx) => ({
      ...q,
      level: (idx === essay.length - 1 ? 'Vận dụng cao' : 'Vận dụng') as CognitiveLevel,
    }));

    onSyncQuestionsLevel({
      part1: updatedPart1,
      part2: updatedPart2,
      part3: updatedPart3,
      essay: updatedEssay,
    });

    setAppliedBanner(
      'Đã đồng bộ mức độ nhận thức (Biết, Hiểu, Vận dụng, Vận dụng cao) cho toàn bộ câu hỏi trong đề thi!'
    );
    setTimeout(() => setAppliedBanner(null), 5000);
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-200/90 shadow-2xs overflow-hidden">
      {/* Header Banner */}
      <div className="p-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-sky-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 shadow-xs shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm sm:text-base tracking-tight text-white">
                TRỢ LÝ AI GỢI Ý PHÂN BỔ MỨC ĐỘ NHẬN THỨC
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-slate-950 rounded-md">
                AI Cố Vấn Ma Trận CV 7991
              </span>
            </div>
            <p className="text-xs text-indigo-100 mt-0.5">
              Tự động tính toán số lượng câu hỏi <strong>Nhận biết • Thông hiểu • Vận dụng • Vận dụng cao</strong> tối ưu theo thời lượng kiểm tra và độ khó tổng thể
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRequestAiSuggestion}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-md transition-all cursor-pointer disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              <span>AI đang tính toán phân bổ...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>{suggestion ? 'AI Gợi Ý Lại Phân Bổ' : 'AI Gợi Ý Phân Bổ Ngay'}</span>
            </>
          )}
        </button>
      </div>

      {/* Configuration Controls: Duration + Overall Difficulty + Exam Format */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-200 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Column 1: Exam Duration */}
          <div className="lg:col-span-4 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>1. Thời lượng kiểm tra (phút):</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
              {DURATION_PRESETS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDuration(mins)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    duration === mins
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'
                  }`}
                >
                  {mins} phút
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-medium">Tùy chỉnh:</span>
              <input
                type="number"
                min={10}
                max={180}
                value={duration}
                onChange={(e) => setDuration(Math.max(5, Number(e.target.value) || 45))}
                className="w-20 text-xs font-bold text-center border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-slate-500">phút • Hình thức:</span>
              <select
                value={essayRatio}
                onChange={(e) => setEssayRatio(e.target.value)}
                className="flex-1 text-[11px] font-semibold border border-slate-300 rounded-lg px-2 py-1 bg-white"
              >
                <option value="70% Trắc nghiệm (7.0đ) - 30% Tự luận (3.0đ)">
                  70% TN - 30% Tự luận
                </option>
                <option value="100% Trắc nghiệm khách quan (10.0đ)">
                  100% Trắc nghiệm
                </option>
              </select>
            </div>
          </div>

          {/* Column 2: Overall Difficulty Level */}
          <div className="lg:col-span-8 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
              <Gauge className="w-4 h-4 text-emerald-600" />
              <span>2. Độ khó tổng thể của đề thi (Tỷ lệ Nhận biết : Thông hiểu : Vận dụng : Vận dụng cao):</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DIFFICULTY_PRESETS.map((preset) => {
                const isSelected = difficulty === preset.value;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setDifficulty(preset.value)}
                    className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isSelected ? 'bg-indigo-600' : 'bg-slate-300'
                          }`}
                        />
                        {preset.label}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white border border-slate-200 text-indigo-700">
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                      {preset.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Toast / Confirmation Banner after applying */}
      {appliedBanner && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{appliedBanner}</span>
        </div>
      )}

      {/* AI Suggestion Result Content */}
      {suggestion ? (
        <div className="p-4 space-y-4">
          {/* AI Pedagogical Rationale & Time Budget Bar */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50/80 via-sky-50/60 to-emerald-50/60 border border-indigo-100 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-xs font-bold text-indigo-950">
                   Đề xuất từ AI: {suggestion.summaryTitle}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                  Tổng: <strong>{suggestion.counts.totalCommands}</strong> lệnh hỏi trắc nghiệm
                  {suggestion.byPart.essay.count > 0
                    ? ` + ${suggestion.byPart.essay.count} câu Tự luận (${suggestion.byPart.essay.totalScore}đ)`
                    : ''}
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                  Quỹ thời gian: {duration} phút
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">{suggestion.rationale}</p>

            {/* Time Allocation Breakdown */}
            <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-bold text-slate-600">Phân bổ thời gian dự kiến:</span>
              <span className="px-2 py-0.5 rounded bg-sky-100/80 text-sky-900 font-medium">
                Phần I ({suggestion.byPart.part1.total} câu): ~{suggestion.byPart.part1.estimatedMinutes} phút
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-100/80 text-indigo-900 font-medium">
                Phần II ({suggestion.byPart.part2.questionCount} câu / {suggestion.byPart.part2.total} ý): ~
                {suggestion.byPart.part2.estimatedMinutes} phút
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-900 font-medium">
                Phần III ({suggestion.byPart.part3.total} câu): ~{suggestion.byPart.part3.estimatedMinutes} phút
              </span>
              {suggestion.byPart.essay.count > 0 && (
                <span className="px-2 py-0.5 rounded bg-purple-100/80 text-purple-900 font-medium">
                  Tự luận ({suggestion.byPart.essay.count} câu): ~{suggestion.byPart.essay.estimatedMinutes} phút
                </span>
              )}
            </div>
          </div>

          {/* 4 Cognitive Levels Breakdown + Interactive Fine-Tuning */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Level 1: Nhận biết */}
            <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-800 uppercase">1. Nhận biết (NB)</span>
                  <span className="px-2 py-0.5 rounded-md text-xs font-black bg-sky-600 text-white">
                    {suggestion.ratios.knowPercent}%
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-black text-slate-900">
                      {suggestion.counts.know}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">lệnh hỏi</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Hiện tại: <strong>{currentMatrixStats.know}</strong>
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-sky-200/60 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Phần I (TN 4 lựa chọn):</span>
                  <input
                    type="number"
                    min={0}
                    value={suggestion.byPart.part1.know}
                    onChange={(e) =>
                      handleAdjustPartLevel('part1', 'know', Number(e.target.value))
                    }
                    className="w-12 text-center font-bold border border-sky-300 rounded px-1 py-0.5 bg-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Phần II (Ý Đúng/Sai):</span>
                  <input
                    type="number"
                    min={0}
                    value={suggestion.byPart.part2.know}
                    onChange={(e) =>
                      handleAdjustPartLevel('part2', 'know', Number(e.target.value))
                    }
                    className="w-12 text-center font-bold border border-sky-300 rounded px-1 py-0.5 bg-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Phần III (Trả lời ngắn):</span>
                  <input
                    type="number"
                    min={0}
                    value={suggestion.byPart.part3.know}
                    onChange={(e) =>
                      handleAdjustPartLevel('part3', 'know', Number(e.target.value))
                    }
                    className="w-12 text-center font-bold border border-sky-300 rounded px-1 py-0.5 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Level 2: Thông hiểu */}
            <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-800 uppercase">2. Thông hiểu (TH)</span>
                  <span className="px-2 py-0.5 rounded-md text-xs font-black bg-indigo-600 text-white">
                    {suggestion.ratios.understandPercent}%
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-black text-slate-900">
                      {suggestion.counts.understand}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">lệnh hỏi</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Hiện tại: <strong>{currentMatrixStats.understand}</strong>
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-indigo-200/60 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Phần I (TN 4 lựa chọn):</span>
                  <input
                    type="number"
                    min={0}
                    value={suggestion.byPart.part1.understand}
                    onChange={(e) =>
                      handleAdjustPartLevel('part1', 'understand', Number(e.target.value))
                    }
                    className="w-12 text-center font-bold border border-indigo-300 rounded px-1 py-0.5 bg-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Phần II (Ý Đúng/Sai):</span>
                  <input
                    type="number"
                    min={0}
                    value={suggestion.byPart.part2.understand}
                    onChange={(e) =>
                      handleAdjustPartLevel('part2', 'understand', Number(e.target.value))
                    }
                    className="w-12 text-center font-bold border border-indigo-300 rounded px-1 py-0.5 bg-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Phần III (Trả lời ngắn):</span>
                  <input
                    type="number"
                    min={0}
                    value={suggestion.byPart.part3.understand}
                    onChange={(e) =>
                      handleAdjustPartLevel('part3', 'understand', Number(e.target.value))
                    }
                    className="w-12 text-center font-bold border border-indigo-300 rounded px-1 py-0.5 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Level 3: Vận dụng */}
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 uppercase">3. Vận dụng (VD)</span>
                  <span className="px-2 py-0.5 rounded-md text-xs font-black bg-emerald-600 text-white">
                    {suggestion.ratios.applyPercent}%
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-black text-slate-900">
                      {suggestion.counts.apply}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">lệnh hỏi</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Hiện tại: <strong>{currentMatrixStats.apply}</strong>
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-emerald-200/60 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Phần I (TN 4 lựa chọn):</span>
                  <input
                    type="number"
                    min={0}
                    value={suggestion.byPart.part1.apply}
                    onChange={(e) =>
                      handleAdjustPartLevel('part1', 'apply', Number(e.target.value))
                    }
                    className="w-12 text-center font-bold border border-emerald-300 rounded px-1 py-0.5 bg-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Phần II (Ý Đúng/Sai):</span>
                  <input
                    type="number"
                    min={0}
                    value={suggestion.byPart.part2.apply}
                    onChange={(e) =>
                      handleAdjustPartLevel('part2', 'apply', Number(e.target.value))
                    }
                    className="w-12 text-center font-bold border border-emerald-300 rounded px-1 py-0.5 bg-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Phần III (Trả lời ngắn):</span>
                  <input
                    type="number"
                    min={0}
                    value={suggestion.byPart.part3.apply}
                    onChange={(e) =>
                      handleAdjustPartLevel('part3', 'apply', Number(e.target.value))
                    }
                    className="w-12 text-center font-bold border border-emerald-300 rounded px-1 py-0.5 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Level 4: Vận dụng cao */}
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800 uppercase">4. Vận dụng cao (VDC)</span>
                  <span className="px-2 py-0.5 rounded-md text-xs font-black bg-amber-600 text-white">
                    {suggestion.ratios.highApplyPercent}%
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-black text-slate-900">
                      {suggestion.counts.highApply}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">lệnh hỏi</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Hiện tại: <strong>{currentMatrixStats.highApply}</strong>
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-amber-200/60 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Phần I (TN 4 lựa chọn):</span>
                  <input
                    type="number"
                    min={0}
                    value={suggestion.byPart.part1.highApply}
                    onChange={(e) =>
                      handleAdjustPartLevel('part1', 'highApply', Number(e.target.value))
                    }
                    className="w-12 text-center font-bold border border-amber-300 rounded px-1 py-0.5 bg-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Phần II (Ý Đúng/Sai):</span>
                  <input
                    type="number"
                    min={0}
                    value={suggestion.byPart.part2.highApply}
                    onChange={(e) =>
                      handleAdjustPartLevel('part2', 'highApply', Number(e.target.value))
                    }
                    className="w-12 text-center font-bold border border-amber-300 rounded px-1 py-0.5 bg-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Phần III (Trả lời ngắn):</span>
                  <input
                    type="number"
                    min={0}
                    value={suggestion.byPart.part3.highApply}
                    onChange={(e) =>
                      handleAdjustPartLevel('part3', 'highApply', Number(e.target.value))
                    }
                    className="w-12 text-center font-bold border border-amber-300 rounded px-1 py-0.5 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar to Apply Suggestion */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
            <p className="text-[11px] text-slate-500">
              💡 Giáo viên có thể tinh chỉnh trực tiếp các ô số lượng ở trên trước khi nhấn áp dụng vào Ma trận hoặc Đề thi.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {onSyncQuestionsLevel && (
                <button
                  type="button"
                  onClick={handleSyncQuestions}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Đồng Bộ Mức Độ Vào Câu Hỏi Đề Thi</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleApplyMatrix}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Áp Dụng Phân Bổ Vào Ma Trận & Biểu Đồ</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              Chọn <strong>Thời lượng kiểm tra ({duration} phút)</strong> và <strong>Độ khó tổng thể</strong> ở trên, sau đó nhấn nút <strong>"AI Gợi Ý Phân Bổ Ngay"</strong> để AI tính toán cơ cấu câu hỏi chuẩn xác nhất.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
