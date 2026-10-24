import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Loader2,
  AlertCircle,
  Gauge,
  Clock,
  Sliders,
} from 'lucide-react';
import { ExamData } from '../types/exam';
import {
  DIFFICULTY_PRESETS,
  AiCognitiveDistributionData,
} from './AiCognitiveAdvisorPanel';

interface AiExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExamGenerated: (examData: Partial<ExamData>) => void;
}

export const AiExamModal: React.FC<AiExamModalProps> = ({
  isOpen,
  onClose,
  onExamGenerated,
}) => {
  const [subject, setSubject] = useState<string>('Hóa học');
  const [grade, setGrade] = useState<string>('Lớp 12');
  const [curriculum, setCurriculum] = useState<string>('Kết nối tri thức với cuộc sống');
  const [term, setTerm] = useState<string>('Kiểm tra giữa kì I');
  const [duration, setDuration] = useState<number>(50);
  const [difficulty, setDifficulty] = useState<string>(DIFFICULTY_PRESETS[1].value);
  const [essayRatio, setEssayRatio] = useState<string>('70% Trắc nghiệm (7.0đ) - 30% Tự luận (3.0đ)');
  const [topics, setTopics] = useState<string>(
    'Chương 1: Ester - Lipid (Xà phòng và chất giặt rửa); Chương 2: Carbohydrate (Glucose, Fructose, Saccharose, Tinh bột, Cellulose)'
  );
  const [distribution, setDistribution] = useState<AiCognitiveDistributionData | null>(null);
  const [isSuggestingDist, setIsSuggestingDist] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePreset = (sub: string, gr: string, top: string) => {
    setSubject(sub);
    setGrade(gr);
    setTopics(top);
  };

  const handleSuggestDistribution = async () => {
    try {
      setIsSuggestingDist(true);
      setErrorMsg(null);
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
        setDistribution(resData.data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSuggestingDist(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const response = await fetch('/api/gemini/generate-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          grade,
          curriculum,
          term,
          duration,
          difficulty,
          distribution,
          essayRatio,
          topics,
        }),
      });

      const resData = await response.json();
      if (!resData.success) {
        throw new Error(resData.error || 'Lỗi khi tạo đề thi với AI');
      }

      onExamGenerated(resData.data);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Không thể kết nối với dịch vụ AI. Vui lòng thử lại!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-indigo-600 via-indigo-700 to-sky-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">TẠO ĐỀ THI & MA TRẬN TỰ ĐỘNG BẰNG AI</h2>
              <p className="text-xs text-indigo-100">
                Tuân thủ chặt chẽ Công văn 7991/BGDĐT-GDTrH • Tự động gợi ý phân bổ 4 mức độ nhận thức
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs sm:text-sm">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Preset Buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Gợi ý chủ đề nhanh:
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() =>
                  handlePreset(
                    'Hóa học',
                    'Lớp 12',
                    'Chương 1: Ester - Lipid (Xà phòng & Chất giặt rửa); Chương 2: Carbohydrate'
                  )
                }
                className="px-2.5 py-1 rounded-md text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-medium transition-colors cursor-pointer"
              >
                Hóa 12: Ester & Carbohydrate
              </button>
              <button
                type="button"
                onClick={() =>
                  handlePreset(
                    'Hóa học',
                    'Lớp 11',
                    'Chương 1: Cân bằng hóa học; Chương 2: Nitrogen và Sulfur'
                  )
                }
                className="px-2.5 py-1 rounded-md text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-medium transition-colors cursor-pointer"
              >
                Hóa 11: Cân bằng, Nitrogen, Sulfur
              </button>
              <button
                type="button"
                onClick={() =>
                  handlePreset(
                    'Toán học',
                    'Lớp 12',
                    'Ứng dụng đạo hàm khảo sát hàm số; Tọa độ vectơ trong không gian Oxyz'
                  )
                }
                className="px-2.5 py-1 rounded-md text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-medium transition-colors cursor-pointer"
              >
                Toán 12: Đạo hàm & Oxyz
              </button>
              <button
                type="button"
                onClick={() =>
                  handlePreset(
                    'Vật lí',
                    'Lớp 12',
                    'Vật lí nhiệt (Nội năng, nhiệt dung riêng); Khí lí tưởng'
                  )
                }
                className="px-2.5 py-1 rounded-md text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-medium transition-colors cursor-pointer"
              >
                Vật lí 12: Nhiệt & Khí lí tưởng
              </button>
            </div>
          </div>

          {/* Grid fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Môn học:</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 bg-white"
              >
                <option value="Hóa học">Hóa học</option>
                <option value="Toán học">Toán học</option>
                <option value="Vật lí">Vật lí</option>
                <option value="Sinh học">Sinh học</option>
                <option value="Khoa học tự nhiên">Khoa học tự nhiên (KHTN THCS)</option>
                <option value="Lịch sử">Lịch sử</option>
                <option value="Địa lí">Địa lí</option>
                <option value="Giáo dục kinh tế & Pháp luật">Giáo dục kinh tế & Pháp luật</option>
                <option value="Tin học">Tin học</option>
                <option value="Tiếng Anh">Tiếng Anh</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp:</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 bg-white"
              >
                <option value="Lớp 12">Lớp 12 (Thi Tốt nghiệp THPT 2025-2026)</option>
                <option value="Lớp 11">Lớp 11</option>
                <option value="Lớp 10">Lớp 10</option>
                <option value="Lớp 9">Lớp 9 (Chương trình GDPT 2018)</option>
                <option value="Lớp 8">Lớp 8</option>
                <option value="Lớp 7">Lớp 7</option>
                <option value="Lớp 6">Lớp 6</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bộ sách giáo khoa:</label>
              <select
                value={curriculum}
                onChange={(e) => setCurriculum(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 bg-white"
              >
                <option value="Kết nối tri thức với cuộc sống">Kết nối tri thức với cuộc sống</option>
                <option value="Cánh diều">Cánh diều</option>
                <option value="Chân trời sáng tạo">Chân trời sáng tạo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kỳ kiểm tra:</label>
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 bg-white"
              >
                <option value="Kiểm tra giữa kì I">Kiểm tra giữa kì I</option>
                <option value="Kiểm tra cuối kì I">Kiểm tra cuối kì I</option>
                <option value="Kiểm tra giữa kì II">Kiểm tra giữa kì II</option>
                <option value="Kiểm tra cuối kì II">Kiểm tra cuối kì II</option>
                <option value="Ôn tập Tốt nghiệp THPT 2025 - 2026">Ôn tập Tốt nghiệp THPT 2025 - 2026</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Thời gian làm bài:</span>
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 bg-white"
              >
                <option value={15}>15 phút (Kiểm tra thường xuyên)</option>
                <option value={45}>45 phút (1 tiết chuẩn)</option>
                <option value={50}>50 phút (chuẩn môn KHTN / Hóa / Lí / Sinh)</option>
                <option value={60}>60 phút</option>
                <option value={90}>90 phút (chuẩn môn Toán / Ngữ văn)</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1">
                <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                <span>Độ khó tổng thể của đề thi:</span>
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 bg-white"
              >
                {DIFFICULTY_PRESETS.map((p) => (
                  <option key={p.id} value={p.value}>
                    {p.label} ({p.badge})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cấu trúc tỉ lệ điểm:</label>
              <select
                value={essayRatio}
                onChange={(e) => setEssayRatio(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 bg-white"
              >
                <option value="70% Trắc nghiệm (7.0đ) - 30% Tự luận (3.0đ)">
                  70% TN (7.0đ) - 30% Tự luận (3.0đ) (Chuẩn CV 7991)
                </option>
                <option value="100% Trắc nghiệm khách quan (10.0đ)">
                  100% Trắc nghiệm (Định dạng đề thi Tốt nghiệp 2025)
                </option>
              </select>
            </div>
          </div>

          {/* AI Cognitive Distribution Preview & Suggestion Box */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50/80 via-sky-50/60 to-amber-50/40 border border-indigo-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    AI Gợi Ý Phân Bổ Số Lượng Câu Hỏi Theo Mức Độ Nhận Thức
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Dựa trên thời lượng <strong>{duration} phút</strong> & độ khó đã chọn
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSuggestDistribution}
                disabled={isSuggestingDist}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              >
                {isSuggestingDist ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang tính phân bổ...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>AI Gợi Ý Phân Bổ Câu Hỏi</span>
                  </>
                )}
              </button>
            </div>

            {distribution && (
              <div className="space-y-2.5 pt-1 border-t border-indigo-100">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-white border border-sky-200">
                    <div className="text-[10px] font-bold text-sky-700 uppercase">Nhận biết</div>
                    <div className="text-base font-black text-slate-900">
                      {distribution.counts.know}{' '}
                      <span className="text-[11px] font-semibold text-sky-700">
                        ({distribution.ratios.knowPercent}%)
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-indigo-200">
                    <div className="text-[10px] font-bold text-indigo-700 uppercase">Thông hiểu</div>
                    <div className="text-base font-black text-slate-900">
                      {distribution.counts.understand}{' '}
                      <span className="text-[11px] font-semibold text-indigo-700">
                        ({distribution.ratios.understandPercent}%)
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-emerald-200">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">Vận dụng</div>
                    <div className="text-base font-black text-slate-900">
                      {distribution.counts.apply}{' '}
                      <span className="text-[11px] font-semibold text-emerald-700">
                        ({distribution.ratios.applyPercent}%)
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-amber-200">
                    <div className="text-[10px] font-bold text-amber-700 uppercase">Vận dụng cao</div>
                    <div className="text-base font-black text-slate-900">
                      {distribution.counts.highApply}{' '}
                      <span className="text-[11px] font-semibold text-amber-700">
                        ({distribution.ratios.highApplyPercent}%)
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed bg-white/80 p-2 rounded-lg border border-slate-200/80">
                  {distribution.rationale}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nội dung trọng tâm / Chương bài / Phân phối chương trình:
            </label>
            <textarea
              rows={3}
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Nhập tên các bài học hoặc chủ đề cần kiểm tra..."
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            AI Gemini sẽ tự động thiết lập ma trận, bản đặc tả và các câu hỏi Phần I, II, III.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Đang khởi tạo đề thi...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>Tạo Trọn Bộ Đề Thi Ngay</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
