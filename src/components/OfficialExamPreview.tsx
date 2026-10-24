import React from 'react';
import { Printer, Download, Eye, CheckCircle2 } from 'lucide-react';
import { ExamData } from '../types/exam';
import { MathChemView } from './MathChemView';

interface OfficialExamPreviewProps {
  exam: ExamData;
  onPrint: () => void;
  onExportDocx: () => void;
}

export const OfficialExamPreview: React.FC<OfficialExamPreviewProps> = ({
  exam,
  onPrint,
  onExportDocx,
}) => {
  const meta = exam.metadata;

  return (
    <div className="space-y-6">
      {/* Top Banner with Action Buttons */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            XEM TRƯỚC ĐỀ THI CHUẨN ĐỊNH DẠNG BỘ GIÁO DỤC & ĐÀO TẠO
          </h3>
          <p className="text-xs text-slate-500">
            Font chữ Times New Roman • Căn lề chuẩn • Sẵn sàng in ấn hoặc xuất bản
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onPrint}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>In Đề Thi / Xuất PDF</span>
          </button>

          <button
            onClick={onExportDocx}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Tải File Word (.docx)</span>
          </button>
        </div>
      </div>

      {/* PAPER CANVAS - STYLED EXACTLY LIKE A PRINTED EXAM */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-xl p-8 sm:p-12 max-w-4xl mx-auto font-serif text-slate-900 leading-relaxed print:border-none print:shadow-none print:p-0 print:m-0">
        {/* Header Table */}
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-300 text-center">
          <div>
            <p className="font-bold text-xs uppercase tracking-wide">{meta.schoolName}</p>
            <p className="font-bold text-xs uppercase text-slate-700">{meta.departmentName}</p>
            <p className="text-[11px] text-slate-500">-----------------------</p>
          </div>
          <div>
            <p className="font-bold text-sm uppercase text-slate-900">{meta.examTitle}</p>
            <p className="font-bold text-xs uppercase text-slate-800">
              {meta.academicYear} - MÔN: {meta.subject.toUpperCase()} {meta.grade}
            </p>
            <p className="text-xs italic text-slate-600">
              Thời gian làm bài: {meta.durationMinutes} phút (Không kể phát đề)
            </p>
            <p className="font-bold text-xs text-slate-900 mt-1">Mã đề: {meta.examCode || '101'}</p>
          </div>
        </div>

        {/* Student info box */}
        <div className="my-4 py-2 border-b border-slate-200 text-xs flex justify-between">
          <div>
            Họ và tên thí sinh: .....................................................................................
          </div>
          <div>Số báo danh: .............................</div>
        </div>

        {/* PHẦN I */}
        {exam.part1.length > 0 && (
          <div className="my-6">
            <div className="mb-3">
              <span className="font-bold text-sm">
                PHẦN I. Thí sinh trả lời từ câu 1 đến câu {exam.part1.length}.
              </span>{' '}
              <span className="italic text-xs text-slate-700">
                Mỗi câu hỏi thí sinh chỉ chọn một phương án.
              </span>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              {exam.part1.map((q, idx) => (
                <div key={q.id}>
                  <p className="font-medium text-slate-900">
                    <span className="font-bold">Câu {idx + 1}. </span>
                    <MathChemView content={q.content} />
                  </p>

                  {/* Chemistry Diagram / Image */}
                  {q.imageUrl && (
                    <div className="exam-diagram-wrapper my-2 text-center max-w-full overflow-x-auto">
                      <img
                        src={q.imageUrl}
                        alt={q.imageCaption || `Hình thí nghiệm Câu ${idx + 1}`}
                        className="exam-diagram-img max-w-full h-auto max-h-52 mx-auto object-contain rounded border border-slate-200"
                      />
                      {q.imageCaption && (
                        <p className="text-xs italic text-slate-700 mt-1 font-serif">
                          {q.imageCaption}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-4 mt-1.5 font-medium">
                    <div>
                      <span className="font-bold">A. </span>
                      <MathChemView content={q.options.A} />
                    </div>
                    <div>
                      <span className="font-bold">B. </span>
                      <MathChemView content={q.options.B} />
                    </div>
                    <div>
                      <span className="font-bold">C. </span>
                      <MathChemView content={q.options.C} />
                    </div>
                    <div>
                      <span className="font-bold">D. </span>
                      <MathChemView content={q.options.D} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PHẦN II */}
        {exam.part2.length > 0 && (
          <div className="my-6">
            <div className="mb-3">
              <span className="font-bold text-sm">
                PHẦN II. Thí sinh trả lời từ câu 1 đến câu {exam.part2.length}.
              </span>{' '}
              <span className="italic text-xs text-slate-700">
                Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.
              </span>
            </div>

            <div className="space-y-5 text-xs sm:text-sm">
              {exam.part2.map((q, idx) => (
                <div key={q.id}>
                  <p className="font-medium text-slate-900 mb-1.5">
                    <span className="font-bold">Câu {idx + 1}. </span>
                    <MathChemView content={q.content} />
                  </p>

                  {/* Chemistry Diagram / Image */}
                  {q.imageUrl && (
                    <div className="exam-diagram-wrapper my-2 text-center max-w-full overflow-x-auto">
                      <img
                        src={q.imageUrl}
                        alt={q.imageCaption || `Hình thí nghiệm Câu ${idx + 1}`}
                        className="exam-diagram-img max-w-full h-auto max-h-52 mx-auto object-contain rounded border border-slate-200"
                      />
                      {q.imageCaption && (
                        <p className="text-xs italic text-slate-700 mt-1 font-serif">
                          {q.imageCaption}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1 pl-4">
                    {q.items.map((item) => (
                      <p key={item.label} className="text-slate-800">
                        <span className="font-bold">{item.label}) </span>
                        <MathChemView content={item.text} />
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PHẦN III */}
        {exam.part3.length > 0 && (
          <div className="my-6">
            <div className="mb-3">
              <span className="font-bold text-sm">
                PHẦN III. Thí sinh trả lời từ câu 1 đến câu {exam.part3.length}.
              </span>{' '}
              <span className="italic text-xs text-slate-700">
                Mỗi câu hỏi thí sinh viết câu trả lời vào ô tương ứng trên phiếu làm bài.
              </span>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              {exam.part3.map((q, idx) => (
                <div key={q.id}>
                  <p className="font-medium text-slate-900">
                    <span className="font-bold">Câu {idx + 1}. </span>
                    <MathChemView content={q.content} />
                  </p>

                  {/* Chemistry Diagram / Image */}
                  {q.imageUrl && (
                    <div className="exam-diagram-wrapper my-2 text-center max-w-full overflow-x-auto">
                      <img
                        src={q.imageUrl}
                        alt={q.imageCaption || `Hình thí nghiệm Câu ${idx + 1}`}
                        className="exam-diagram-img max-w-full h-auto max-h-52 mx-auto object-contain rounded border border-slate-200"
                      />
                      {q.imageCaption && (
                        <p className="text-xs italic text-slate-700 mt-1 font-serif">
                          {q.imageCaption}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PHẦN TỰ LUẬN */}
        {exam.essay.length > 0 && (
          <div className="my-6">
            <div className="mb-3">
              <span className="font-bold text-sm">
                PHẦN IV. TỰ LUẬN (Dành cho kiểm tra định kỳ)
              </span>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              {exam.essay.map((q, idx) => (
                <div key={q.id}>
                  <p className="font-medium text-slate-900">
                    <span className="font-bold">
                      Câu {idx + 1} ({q.points} điểm).{' '}
                    </span>
                    <MathChemView content={q.content} />
                  </p>

                  {/* Chemistry Diagram / Image */}
                  {q.imageUrl && (
                    <div className="exam-diagram-wrapper my-2 text-center max-w-full overflow-x-auto">
                      <img
                        src={q.imageUrl}
                        alt={q.imageCaption || `Hình thí nghiệm Câu ${idx + 1}`}
                        className="exam-diagram-img max-w-full h-auto max-h-52 mx-auto object-contain rounded border border-slate-200"
                      />
                      {q.imageCaption && (
                        <p className="text-xs italic text-slate-700 mt-1 font-serif">
                          {q.imageCaption}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center font-bold text-xs tracking-widest my-8">
          ---------- HẾT ----------
        </div>

        {/* ĐÁP ÁN & HƯỚNG DẪN CHẤM */}
        <div className="mt-12 pt-8 border-t-2 border-slate-300 page-break-before">
          <h4 className="text-center font-bold text-sm uppercase mb-6">
            ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM (MÃ ĐỀ {meta.examCode || '101'})
          </h4>

          {/* Part 1 key */}
          {exam.part1.length > 0 && (
            <div className="mb-6">
              <p className="font-bold text-xs mb-2 text-sky-900">
                1. ĐÁP ÁN PHẦN I (0.25đ / câu):
              </p>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 text-center text-xs">
                {exam.part1.map((q, idx) => (
                  <div key={q.id} className="border border-slate-200 p-1 rounded">
                    <span className="text-[10px] text-slate-500 block">C{idx + 1}</span>
                    <span className="font-bold text-blue-700">{q.correctAnswer}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Part 2 key */}
          {exam.part2.length > 0 && (
            <div className="mb-6">
              <p className="font-bold text-xs mb-2 text-indigo-900">
                2. ĐÁP ÁN PHẦN II (Đúng 1 ý: 0.1đ; 2 ý: 0.25đ; 3 ý: 0.5đ; 4 ý: 1.0đ):
              </p>
              <table className="w-full text-xs text-center border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-200 p-1">Câu</th>
                    <th className="border border-slate-200 p-1">Lệnh hỏi a</th>
                    <th className="border border-slate-200 p-1">Lệnh hỏi b</th>
                    <th className="border border-slate-200 p-1">Lệnh hỏi c</th>
                    <th className="border border-slate-200 p-1">Lệnh hỏi d</th>
                  </tr>
                </thead>
                <tbody>
                  {exam.part2.map((q, idx) => (
                    <tr key={q.id}>
                      <td className="border border-slate-200 p-1 font-bold">Câu {idx + 1}</td>
                      {q.items.map((item) => (
                        <td
                          key={item.label}
                          className={`border border-slate-200 p-1 font-bold ${
                            item.isCorrect ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {item.isCorrect ? 'Đ' : 'S'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Part 3 key */}
          {exam.part3.length > 0 && (
            <div className="mb-6">
              <p className="font-bold text-xs mb-2 text-emerald-900">
                3. ĐÁP ÁN PHẦN III (Trả lời ngắn):
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                {exam.part3.map((q, idx) => (
                  <div key={q.id} className="border border-slate-200 p-2 rounded bg-slate-50">
                    <span className="text-[10px] text-slate-500 block">Câu {idx + 1}</span>
                    <span className="font-bold text-emerald-700 text-sm">{q.correctAnswer}</span>
                    {q.unit && <span className="text-[10px] text-slate-500 block">{q.unit}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Essay guide */}
          {exam.essay.length > 0 && (
            <div>
              <p className="font-bold text-xs mb-2 text-purple-900">
                4. HƯỚNG DẪN CHẤM PHẦN TỰ LUẬN:
              </p>
              <div className="space-y-2 text-xs">
                {exam.essay.map((q, idx) => (
                  <div key={q.id} className="p-2 border border-slate-200 rounded">
                    <p className="font-bold">
                      Câu {idx + 1} ({q.points} điểm):
                    </p>
                    <p className="text-slate-700 whitespace-pre-line">{q.guide}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
