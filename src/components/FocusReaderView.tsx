import React, { useState } from 'react';
import {
  BookOpen,
  Eye,
  EyeOff,
  Tag,
  Edit2,
  CheckCircle2,
  X,
  Type,
  FileCheck,
  Sparkles,
} from 'lucide-react';
import {
  Part1Question,
  Part2Question,
  Part3Question,
  EssayQuestion,
} from '../types/exam';
import { MathChemView } from './MathChemView';

interface FocusReaderViewProps {
  part1: Part1Question[];
  part2: Part2Question[];
  part3: Part3Question[];
  essay: EssayQuestion[];
  subject: string;
  onExitFocusReader: () => void;
  onJumpToEditQuestion: (part: '1' | '2' | '3' | 'essay', index: number) => void;
}

export const FocusReaderView: React.FC<FocusReaderViewProps> = ({
  part1,
  part2,
  part3,
  essay,
  subject,
  onExitFocusReader,
  onJumpToEditQuestion,
}) => {
  const [sectionFilter, setSectionFilter] = useState<'all' | '1' | '2' | '3' | 'essay'>('all');
  const [showAnswers, setShowAnswers] = useState<boolean>(true);
  const [showMetadata, setShowMetadata] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');

  const totalQuestions = part1.length + part2.length + part3.length + essay.length;

  const fontSizeClass =
    fontSize === 'sm'
      ? 'text-sm leading-relaxed'
      : fontSize === 'lg'
      ? 'text-lg leading-relaxed'
      : 'text-base leading-relaxed';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Sticky Reader Control Bar */}
      <div className="sticky top-2 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-md px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Mode Indicator & Section Filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-2xs">
              <BookOpen className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Focus Reader
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  Chế độ duyệt bản thảo
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Tổng cộng {totalQuestions} câu hỏi • Giao diện đọc tập trung trước khi in
              </p>
            </div>
          </div>

          {/* Section Switcher */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSectionFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                sectionFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Toàn bộ đề ({totalQuestions})
            </button>
            <button
              type="button"
              onClick={() => setSectionFilter('1')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                sectionFilter === '1'
                  ? 'bg-white text-sky-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Phần I ({part1.length})
            </button>
            <button
              type="button"
              onClick={() => setSectionFilter('2')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                sectionFilter === '2'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Phần II ({part2.length})
            </button>
            <button
              type="button"
              onClick={() => setSectionFilter('3')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                sectionFilter === '3'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Phần III ({part3.length})
            </button>
            {essay.length > 0 && (
              <button
                type="button"
                onClick={() => setSectionFilter('essay')}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  sectionFilter === 'essay'
                    ? 'bg-white text-purple-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tự luận ({essay.length})
              </button>
            )}
          </div>
        </div>

        {/* Right: Reader Preferences & Exit Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Font size switcher */}
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <span className="px-2 text-slate-500 flex items-center gap-1 text-[11px]">
              <Type className="w-3 h-3" /> Cỡ chữ:
            </span>
            <button
              type="button"
              onClick={() => setFontSize('sm')}
              className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                fontSize === 'sm' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Nhỏ
            </button>
            <button
              type="button"
              onClick={() => setFontSize('base')}
              className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                fontSize === 'base' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Vừa
            </button>
            <button
              type="button"
              onClick={() => setFontSize('lg')}
              className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                fontSize === 'lg' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Lớn
            </button>
          </div>

          {/* Toggle Answers & Explanations */}
          <button
            type="button"
            onClick={() => setShowAnswers(!showAnswers)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors ${
              showAnswers
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Ẩn/hiện đáp án đúng và lời giải chi tiết"
          >
            {showAnswers ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showAnswers ? 'Đang hiện Đáp án' : 'Ẩn Đáp án (Bản HS)'}</span>
          </button>

          {/* Toggle Metadata tags */}
          <button
            type="button"
            onClick={() => setShowMetadata(!showMetadata)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors ${
              showMetadata
                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Ẩn/hiện mức độ nhận thức và chủ đề của từng câu"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>{showMetadata ? 'Hiện Mức độ' : 'Ẩn Mức độ'}</span>
          </button>

          {/* Exit Focus Reader */}
          <button
            type="button"
            onClick={onExitFocusReader}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            title="Quay lại giao diện chỉnh sửa đầy đủ"
          >
            <Edit2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Thoát Focus Reader</span>
          </button>
        </div>
      </div>

      {/* Main Clean Reading Sheet */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200/90 shadow-xs px-6 py-8 sm:px-12 sm:py-10 space-y-10">
        {/* Clean Sheet Header */}
        <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
              BẢN ĐỌC KIỂM TRA NỘI DUNG TRƯỚC KHI IN • MÔN {subject.toUpperCase()}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">
              Đề kiểm tra chuẩn cấu trúc Công văn 7991/BGDĐT-GDTrH
            </h2>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <span>Di chuột vào câu bất kỳ và nhấn &ldquo;Sửa câu này&rdquo; nếu cần chỉnh sửa</span>
          </div>
        </div>

        {/* ==================== PHẦN I ==================== */}
        {(sectionFilter === 'all' || sectionFilter === '1') && part1.length > 0 && (
          <section className="space-y-6">
            <div className="border-l-4 border-sky-600 pl-3.5 py-0.5">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-tight">
                PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn ({part1.length} câu)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Thí sinh trả lời từ câu 1 đến câu {part1.length}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {part1.map((q, idx) => (
                <article
                  key={q.id || idx}
                  className={`py-5 first:pt-2 last:pb-2 group relative rounded-xl transition-colors hover:bg-slate-50/70 px-3 -mx-3 ${fontSizeClass}`}
                >
                  {/* Quick jump to edit button on hover */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="text-slate-900 flex-1">
                      <span className="font-bold text-slate-950 mr-2">Câu {idx + 1}.</span>
                      <MathChemView content={q.content} />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {showMetadata && (
                        <>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {q.level}
                          </span>
                          {q.topic && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-sky-50 text-sky-800 border border-sky-200 max-w-44 truncate">
                              {q.topic}
                            </span>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onJumpToEditQuestion('1', idx)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:text-sky-700 hover:border-sky-300 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                        title={`Mở trình chỉnh sửa tại Câu ${idx + 1} (Phần I)`}
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Sửa câu này</span>
                      </button>
                    </div>
                  </div>

                  {/* Attached Question Image */}
                  {q.imageUrl && (
                    <figure className="my-3 flex flex-col items-center justify-center bg-white border border-slate-200/80 rounded-xl p-3 max-w-lg mx-auto">
                      <img
                        src={q.imageUrl}
                        alt={q.imageCaption || `Hình minh họa câu ${idx + 1}`}
                        className="max-h-56 w-auto object-contain"
                      />
                      {q.imageCaption && (
                        <figcaption className="mt-2 text-xs italic text-slate-600 text-center">
                          {q.imageCaption}
                        </figcaption>
                      )}
                    </figure>
                  )}

                  {/* 4 Multiple Choice Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3 pl-1">
                    {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                      const isCorrect = showAnswers && q.correctAnswer === optKey;
                      return (
                        <div
                          key={optKey}
                          className={`flex items-baseline gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                            isCorrect
                              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                              : 'bg-white border-transparent text-slate-800'
                          }`}
                        >
                          <span
                            className={`font-bold shrink-0 ${
                              isCorrect ? 'text-emerald-700 underline' : 'text-slate-900'
                            }`}
                          >
                            {optKey}.
                          </span>
                          <div className="flex-1">
                            <MathChemView content={q.options[optKey]} />
                          </div>
                          {isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 self-center" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {showAnswers && q.explanation && (
                    <div className="mt-3 pl-3 border-l-2 border-emerald-400 bg-emerald-50/40 py-2 px-3 rounded-r-lg text-xs text-slate-700">
                      <span className="font-bold text-emerald-800 mr-1.5">
                        Đáp án: {q.correctAnswer} — Lời giải:
                      </span>
                      <MathChemView content={q.explanation} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ==================== PHẦN II ==================== */}
        {(sectionFilter === 'all' || sectionFilter === '2') && part2.length > 0 && (
          <section className="space-y-6">
            <div className="border-l-4 border-indigo-600 pl-3.5 py-0.5">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-tight">
                PHẦN II. Câu trắc nghiệm đúng sai ({part2.length} câu)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Thí sinh trả lời từ câu 1 đến câu {part2.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {part2.map((q, idx) => (
                <article
                  key={q.id || idx}
                  className={`py-5 first:pt-2 last:pb-2 group relative rounded-xl transition-colors hover:bg-slate-50/70 px-3 -mx-3 ${fontSizeClass}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="text-slate-900 flex-1">
                      <span className="font-bold text-slate-950 mr-2">Câu {idx + 1}.</span>
                      <MathChemView content={q.content} />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {showMetadata && (
                        <>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {q.level}
                          </span>
                          {q.topic && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-800 border border-indigo-200 max-w-44 truncate">
                              {q.topic}
                            </span>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onJumpToEditQuestion('2', idx)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:text-indigo-700 hover:border-indigo-300 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                        title={`Mở trình chỉnh sửa tại Câu ${idx + 1} (Phần II)`}
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Sửa câu này</span>
                      </button>
                    </div>
                  </div>

                  {/* Attached Question Image */}
                  {q.imageUrl && (
                    <figure className="my-3 flex flex-col items-center justify-center bg-white border border-slate-200/80 rounded-xl p-3 max-w-lg mx-auto">
                      <img
                        src={q.imageUrl}
                        alt={q.imageCaption || `Hình minh họa câu ${idx + 1}`}
                        className="max-h-56 w-auto object-contain"
                      />
                      {q.imageCaption && (
                        <figcaption className="mt-2 text-xs italic text-slate-600 text-center">
                          {q.imageCaption}
                        </figcaption>
                      )}
                    </figure>
                  )}

                  {/* Statements a, b, c, d */}
                  <div className="space-y-2 mt-3 pl-2">
                    {q.items.map((item, itemIdx) => (
                      <div
                        key={item.label || itemIdx}
                        className="py-2 px-3 rounded-lg bg-slate-50/70 border border-slate-200/60 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-baseline gap-2 flex-1">
                            <span className="font-bold text-slate-900 shrink-0">{item.label})</span>
                            <div className="text-slate-800 flex-1">
                              <MathChemView content={item.text} />
                            </div>
                          </div>

                          {showAnswers && (
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${
                                item.isCorrect
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}
                            >
                              {item.isCorrect ? 'Đúng' : 'Sai'}
                            </span>
                          )}
                        </div>

                        {showAnswers && item.explanation && (
                          <div className="pl-5 text-xs text-slate-600 border-l-2 border-indigo-300 ml-1">
                            <span className="font-semibold text-indigo-800 mr-1">Giải thích:</span>
                            <MathChemView content={item.explanation} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ==================== PHẦN III ==================== */}
        {(sectionFilter === 'all' || sectionFilter === '3') && part3.length > 0 && (
          <section className="space-y-6">
            <div className="border-l-4 border-emerald-600 pl-3.5 py-0.5">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-tight">
                PHẦN III. Câu trắc nghiệm trả lời ngắn ({part3.length} câu)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Thí sinh trả lời từ câu 1 đến câu {part3.length}.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {part3.map((q, idx) => (
                <article
                  key={q.id || idx}
                  className={`py-5 first:pt-2 last:pb-2 group relative rounded-xl transition-colors hover:bg-slate-50/70 px-3 -mx-3 ${fontSizeClass}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="text-slate-900 flex-1">
                      <span className="font-bold text-slate-950 mr-2">Câu {idx + 1}.</span>
                      <MathChemView content={q.content} />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {showMetadata && (
                        <>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {q.level}
                          </span>
                          {q.topic && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 max-w-44 truncate">
                              {q.topic}
                            </span>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onJumpToEditQuestion('3', idx)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                        title={`Mở trình chỉnh sửa tại Câu ${idx + 1} (Phần III)`}
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Sửa câu này</span>
                      </button>
                    </div>
                  </div>

                  {/* Attached Question Image */}
                  {q.imageUrl && (
                    <figure className="my-3 flex flex-col items-center justify-center bg-white border border-slate-200/80 rounded-xl p-3 max-w-lg mx-auto">
                      <img
                        src={q.imageUrl}
                        alt={q.imageCaption || `Hình minh họa câu ${idx + 1}`}
                        className="max-h-56 w-auto object-contain"
                      />
                      {q.imageCaption && (
                        <figcaption className="mt-2 text-xs italic text-slate-600 text-center">
                          {q.imageCaption}
                        </figcaption>
                      )}
                    </figure>
                  )}

                  {/* Short Answer Box */}
                  <div className="mt-2.5 flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600">
                      Đáp số điền phiếu:
                    </span>
                    {showAnswers ? (
                      <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 font-mono font-bold text-sm">
                        {q.correctAnswer} {q.unit ? `(${q.unit})` : ''}
                      </span>
                    ) : (
                      <span className="inline-block w-32 h-7 border border-dashed border-slate-300 rounded bg-slate-50" />
                    )}
                  </div>

                  {showAnswers && q.explanation && (
                    <div className="mt-3 pl-3 border-l-2 border-emerald-400 bg-emerald-50/40 py-2 px-3 rounded-r-lg text-xs text-slate-700">
                      <span className="font-bold text-emerald-900 mr-1.5">Hướng dẫn giải:</span>
                      <MathChemView content={q.explanation} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ==================== PHẦN TỰ LUẬN ==================== */}
        {(sectionFilter === 'all' || sectionFilter === 'essay') && essay.length > 0 && (
          <section className="space-y-6">
            <div className="border-l-4 border-purple-600 pl-3.5 py-0.5">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-tight">
                PHẦN TỰ LUẬN ({essay.length} câu)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Thí sinh trình bày lời giải chi tiết vào giấy thi.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {essay.map((q, idx) => (
                <article
                  key={q.id || idx}
                  className={`py-5 first:pt-2 last:pb-2 group relative rounded-xl transition-colors hover:bg-slate-50/70 px-3 -mx-3 ${fontSizeClass}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="text-slate-900 flex-1">
                      <span className="font-bold text-slate-950 mr-2">
                        Câu {idx + 1} ({q.points} điểm).
                      </span>
                      <MathChemView content={q.content} />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {showMetadata && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {q.level}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onJumpToEditQuestion('essay', idx)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:text-purple-700 hover:border-purple-300 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                        title={`Mở trình chỉnh sửa tại Câu ${idx + 1} (Tự luận)`}
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Sửa câu này</span>
                      </button>
                    </div>
                  </div>

                  {/* Attached Question Image */}
                  {q.imageUrl && (
                    <figure className="my-3 flex flex-col items-center justify-center bg-white border border-slate-200/80 rounded-xl p-3 max-w-lg mx-auto">
                      <img
                        src={q.imageUrl}
                        alt={q.imageCaption || `Hình minh họa câu tự luận ${idx + 1}`}
                        className="max-h-56 w-auto object-contain"
                      />
                      {q.imageCaption && (
                        <figcaption className="mt-2 text-xs italic text-slate-600 text-center">
                          {q.imageCaption}
                        </figcaption>
                      )}
                    </figure>
                  )}

                  {showAnswers && q.guide && (
                    <div className="mt-3 pl-3 border-l-2 border-purple-400 bg-purple-50/40 py-2 px-3 rounded-r-lg text-xs text-slate-700">
                      <span className="font-bold text-purple-900 mr-1.5">
                        Hướng dẫn chấm ({q.points}đ):
                      </span>
                      <MathChemView content={q.guide} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Footer End Marker */}
        <div className="pt-6 border-t border-slate-200 text-center space-y-1">
          <div className="text-xs font-bold tracking-widest uppercase text-slate-500">
            ——— HẾT ———
          </div>
          <p className="text-[11px] text-slate-400 italic">
            Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm.
          </p>
        </div>
      </div>
    </div>
  );
};
