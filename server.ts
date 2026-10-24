import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// Initialize Gemini SDK with recommended user-agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper for deterministic fallback cognitive distribution based on duration and difficulty
function buildFallbackCognitiveDistribution(params: {
  duration: number;
  difficulty: string;
  subject: string;
  grade: string;
  essayRatio: string;
  topics: string[];
}) {
  const duration = Number(params.duration) || 50;
  const difficulty = params.difficulty || 'Chuẩn CV 7991 (40% NB - 30% TH - 20% VD - 10% VDC)';
  const hasEssay = !params.essayRatio?.includes('100%');
  const topicList =
    params.topics && params.topics.length > 0
      ? params.topics
      : ['Chủ đề 1: Kiến thức cơ sở', 'Chủ đề 2: Kiến thức trọng tâm', 'Chủ đề 3: Tổng hợp & thực tiễn'];

  // Determine percentage ratios by difficulty preset
  let ratios = { knowPercent: 40, understandPercent: 30, applyPercent: 20, highApplyPercent: 10 };
  let diffLabel = 'Chuẩn Công văn 7991 Bộ GD&ĐT (Trung bình - Khá)';
  if (difficulty.toLowerCase().includes('cơ bản') || difficulty.toLowerCase().includes('đại trà')) {
    ratios = { knowPercent: 50, understandPercent: 30, applyPercent: 15, highApplyPercent: 5 };
    diffLabel = 'Cơ bản / Đại trà (Ưu tiên nắm vững kiến thức nền tảng)';
  } else if (difficulty.toLowerCase().includes('khá') || difficulty.toLowerCase().includes('phân hóa')) {
    ratios = { knowPercent: 30, understandPercent: 30, applyPercent: 25, highApplyPercent: 15 };
    diffLabel = 'Khá - Giỏi / Phân hóa (Tăng cường câu hỏi tư duy & tính toán)';
  } else if (difficulty.toLowerCase().includes('nâng cao') || difficulty.toLowerCase().includes('chuyên') || difficulty.toLowerCase().includes('hsg')) {
    ratios = { knowPercent: 20, understandPercent: 25, applyPercent: 30, highApplyPercent: 25 };
    diffLabel = 'Nâng cao / Tuyển chọn HSG & Chuyên (Phân hóa sâu ở VD & VDC)';
  }

  // Scale total questions/commands based on duration
  let p1Total = 18;
  let p2Questions = 4; // 16 items
  let p3Total = 6;
  let essayCount = hasEssay ? 2 : 0;
  let essayScore = hasEssay ? 3.0 : 0;

  if (duration <= 20) {
    p1Total = 8;
    p2Questions = 1; // 4 items
    p3Total = 2;
    essayCount = hasEssay ? 1 : 0;
    essayScore = hasEssay ? 2.0 : 0;
  } else if (duration <= 45) {
    p1Total = hasEssay ? 12 : 16;
    p2Questions = hasEssay ? 2 : 3;
    p3Total = hasEssay ? 4 : 4;
    essayCount = hasEssay ? 2 : 0;
    essayScore = hasEssay ? 3.0 : 0;
  } else if (duration <= 50) {
    p1Total = hasEssay ? 12 : 18;
    p2Questions = hasEssay ? 2 : 4;
    p3Total = hasEssay ? 4 : 6;
    essayCount = hasEssay ? 2 : 0;
    essayScore = hasEssay ? 3.0 : 0;
  } else if (duration <= 65) {
    p1Total = hasEssay ? 16 : 20;
    p2Questions = 4;
    p3Total = 6;
    essayCount = hasEssay ? 2 : 0;
    essayScore = hasEssay ? 3.0 : 0;
  } else {
    // 90 minutes
    p1Total = hasEssay ? 20 : 24;
    p2Questions = 4;
    p3Total = 6;
    essayCount = hasEssay ? 3 : 0;
    essayScore = hasEssay ? 3.0 : 0;
  }

  const p2ItemsTotal = p2Questions * 4;
  const totalCommands = p1Total + p2ItemsTotal + p3Total;

  // Distribute Part 1 (mostly NB and TH, some VD/VDC)
  const p1Know = Math.max(1, Math.round(p1Total * (ratios.knowPercent / 100) * 1.25));
  const p1Understand = Math.max(1, Math.round(p1Total * (ratios.understandPercent / 100)));
  const p1HighApply = Math.max(0, Math.round(p1Total * (ratios.highApplyPercent / 100) * 0.4));
  const p1Apply = Math.max(0, p1Total - p1Know - p1Understand - p1HighApply);

  // Distribute Part 2 (16 or 8 items across NB, TH, VD, VDC)
  const p2Know = Math.max(1, Math.round(p2ItemsTotal * (ratios.knowPercent / 100) * 0.85));
  const p2Understand = Math.max(1, Math.round(p2ItemsTotal * (ratios.understandPercent / 100) * 1.05));
  const p2HighApply = Math.max(1, Math.round(p2ItemsTotal * (ratios.highApplyPercent / 100) * 1.1));
  const p2Apply = Math.max(0, p2ItemsTotal - p2Know - p2Understand - p2HighApply);

  // Distribute Part 3 (Short answer - mostly TH, VD, VDC)
  const p3Know = Math.max(0, Math.round(p3Total * (ratios.knowPercent / 100) * 0.35));
  const p3Understand = Math.max(1, Math.round(p3Total * (ratios.understandPercent / 100) * 0.9));
  const p3HighApply = Math.max(1, Math.round(p3Total * (ratios.highApplyPercent / 100) * 1.5));
  const p3Apply = Math.max(0, p3Total - p3Know - p3Understand - p3HighApply);

  const totalKnow = p1Know + p2Know + p3Know;
  const totalUnderstand = p1Understand + p2Understand + p3Understand;
  const totalApply = p1Apply + p2Apply + p3Apply;
  const totalHighApply = p1HighApply + p2HighApply + p3HighApply;

  // Time allocation
  const essayMinutes = hasEssay ? Math.round(duration * 0.28) : 0;
  const remMinutes = duration - essayMinutes;
  const p1Minutes = Math.round(remMinutes * 0.38);
  const p2Minutes = Math.round(remMinutes * 0.34);
  const p3Minutes = Math.max(3, remMinutes - p1Minutes - p2Minutes);

  // Distribute across topics for matrix rows
  const nTopics = topicList.length;
  const distributeInt = (total: number, idx: number) => {
    const base = Math.floor(total / nTopics);
    const rem = total % nTopics;
    return base + (idx < rem ? 1 : 0);
  };

  const matrixRows = topicList.map((topic, idx) => {
    const rowEssay = hasEssay ? Number((essayScore / nTopics).toFixed(2)) : 0;
    const rowPoints = Number((10 / nTopics).toFixed(2));
    return {
      id: `m_ai_${idx + 1}`,
      topic,
      knowPart1: distributeInt(p1Know, idx),
      understandPart1: distributeInt(p1Understand, idx),
      applyPart1: distributeInt(p1Apply, idx),
      highApplyPart1: distributeInt(p1HighApply, idx),
      knowPart2: distributeInt(p2Know, idx),
      understandPart2: distributeInt(p2Understand, idx),
      applyPart2: distributeInt(p2Apply, idx),
      highApplyPart2: distributeInt(p2HighApply, idx),
      knowPart3: distributeInt(p3Know, idx),
      understandPart3: distributeInt(p3Understand, idx),
      applyPart3: distributeInt(p3Apply, idx),
      highApplyPart3: distributeInt(p3HighApply, idx),
      essayScore: rowEssay,
      totalPoints: rowPoints,
    };
  });

  return {
    summaryTitle: `Cấu trúc ${duration} phút • ${diffLabel}`,
    rationale: `Với thời lượng ${duration} phút và mục tiêu độ khó "${diffLabel}", đề thi được thiết kế gồm ${p1Total} câu Phần I (${p1Minutes} phút), ${p2Questions} câu / ${p2ItemsTotal} lệnh hỏi Đúng-Sai Phần II (${p2Minutes} phút), ${p3Total} câu trả lời ngắn Phần III (${p3Minutes} phút)${hasEssay ? ` và phần Tự luận ${essayScore} điểm (${essayMinutes} phút)` : ''}. Phân bổ này đảm bảo học sinh trung bình hoàn thành tốt phần Nhận biết (${ratios.knowPercent}%) - Thông hiểu (${ratios.understandPercent}%), đồng thời phân loại rõ học sinh Khá - Giỏi ở nhóm câu Vận dụng (${ratios.applyPercent}%) và Vận dụng cao (${ratios.highApplyPercent}%).`,
    ratios: {
      knowPercent: Number(((totalKnow / totalCommands) * 100).toFixed(1)),
      understandPercent: Number(((totalUnderstand / totalCommands) * 100).toFixed(1)),
      applyPercent: Number(((totalApply / totalCommands) * 100).toFixed(1)),
      highApplyPercent: Number(((totalHighApply / totalCommands) * 100).toFixed(1)),
    },
    counts: {
      know: totalKnow,
      understand: totalUnderstand,
      apply: totalApply,
      highApply: totalHighApply,
      totalCommands,
    },
    byPart: {
      part1: {
        know: p1Know,
        understand: p1Understand,
        apply: p1Apply,
        highApply: p1HighApply,
        total: p1Total,
        estimatedMinutes: p1Minutes,
      },
      part2: {
        know: p2Know,
        understand: p2Understand,
        apply: p2Apply,
        highApply: p2HighApply,
        total: p2ItemsTotal,
        questionCount: p2Questions,
        estimatedMinutes: p2Minutes,
      },
      part3: {
        know: p3Know,
        understand: p3Understand,
        apply: p3Apply,
        highApply: p3HighApply,
        total: p3Total,
        estimatedMinutes: p3Minutes,
      },
      essay: {
        count: essayCount,
        totalScore: essayScore,
        estimatedMinutes: essayMinutes,
      },
    },
    matrixRows,
  };
}

// API endpoint to suggest cognitive level distribution based on exam duration & overall difficulty
app.post('/api/gemini/suggest-distribution', async (req, res) => {
  const {
    duration = 50,
    difficulty = 'Chuẩn CV 7991 (40% NB - 30% TH - 20% VD - 10% VDC)',
    subject = 'Hóa học',
    grade = 'Lớp 12',
    essayRatio = '70% Trắc nghiệm (7.0đ) - 30% Tự luận (3.0đ)',
    topics = [],
  } = req.body;

  const normalizedTopics: string[] = Array.isArray(topics)
    ? topics.filter(Boolean)
    : typeof topics === 'string'
    ? topics
        .split(/[;\n]+/)
        .map((t: string) => t.trim())
        .filter(Boolean)
    : [];

  const fallbackResult = buildFallbackCognitiveDistribution({
    duration: Number(duration) || 50,
    difficulty,
    subject,
    grade,
    essayRatio,
    topics: normalizedTopics,
  });

  if (!process.env.GEMINI_API_KEY) {
    return res.json({ success: true, data: fallbackResult, source: 'fallback' });
  }

  try {
    const prompt = `Bạn là chuyên gia đo lường và đánh giá trong giáo dục của Bộ Giáo dục & Đào tạo Việt Nam (Chương trình GDPT 2018 & Công văn 7991/BGDĐT-GDTrH).
Hãy tính toán và gợi ý PHÂN BỔ SỐ LƯỢNG CÂU HỎI / LỆNH HỎI tối ưu nhất giữa 4 mức độ nhận thức:
1. Nhận biết (Biết)
2. Thông hiểu (Hiểu)
3. Vận dụng
4. Vận dụng cao

Dựa trên các thông số đầu vào sau:
- Môn học: ${subject} (${grade})
- Thời lượng kiểm tra: ${duration} phút
- Độ khó tổng thể của đề thi: ${difficulty}
- Hình thức / Tỉ lệ: ${essayRatio}
- Danh sách chủ đề kiến thức hiện có (${normalizedTopics.length} chủ đề): ${JSON.stringify(
      normalizedTopics.length > 0 ? normalizedTopics : fallbackResult.matrixRows.map((r) => r.topic)
    )}

NGUYÊN TẮC SƯ PHẠM & ĐO LƯỜNG CẦN TUÂN THỦ:
- Phải cân đối số lượng câu hỏi phù hợp với quỹ thời gian ${duration} phút (tránh quá dài gây cháy giờ hoặc quá ngắn).
- Phần I (Trắc nghiệm 4 lựa chọn): ưu tiên đánh giá Nhận biết và Thông hiểu, có một số câu Vận dụng / Vận dụng cao.
- Phần II (Trắc nghiệm Đúng/Sai - mỗi câu gồm 4 lệnh hỏi a, b, c, d): tổng số lệnh hỏi Phần II phải là bội số của 4 (ví dụ 8, 12, 16 lệnh hỏi), trải đều từ Nhận biết -> Thông hiểu -> Vận dụng -> Vận dụng cao.
- Phần III (Trắc nghiệm trả lời ngắn): tập trung đánh giá Thông hiểu, Vận dụng và Vận dụng cao.
- Tổng số lệnh hỏi của từng phần trên bảng \`matrixRows\` (cộng dọc các chủ đề) PHẢI KHỚP CHÍNH XÁC với số lượng trong \`byPart\` và \`counts\`.

Hãy trả về JSON hợp lệ theo đúng cấu trúc mẫu dưới đây:
${JSON.stringify(fallbackResult, null, 2)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (!parsed || !parsed.counts || !parsed.byPart || !Array.isArray(parsed.matrixRows)) {
      return res.json({ success: true, data: fallbackResult, source: 'fallback' });
    }

    return res.json({ success: true, data: parsed, source: 'ai' });
  } catch (error: any) {
    console.warn('AI suggest-distribution fallback:', error?.message);
    return res.json({ success: true, data: fallbackResult, source: 'fallback' });
  }
});

// API endpoint to generate complete exam with matrix & specifications per CV 7991
app.post('/api/gemini/generate-exam', async (req, res) => {
  try {
    const {
      subject,
      grade,
      term,
      duration,
      topics,
      difficulty,
      distribution,
      essayRatio,
      curriculum,
    } = req.body;

    const distributionText = distribution
      ? `\n- Phân bổ số lượng câu hỏi theo mức độ nhận thức bắt buộc:
  + Nhận biết: ${distribution.counts?.know ?? ''} lệnh hỏi (${distribution.ratios?.knowPercent ?? 40}%)
  + Thông hiểu: ${distribution.counts?.understand ?? ''} lệnh hỏi (${distribution.ratios?.understandPercent ?? 30}%)
  + Vận dụng: ${distribution.counts?.apply ?? ''} lệnh hỏi (${distribution.ratios?.applyPercent ?? 20}%)
  + Vận dụng cao: ${distribution.counts?.highApply ?? ''} lệnh hỏi (${distribution.ratios?.highApplyPercent ?? 10}%)
  + Chi tiết: Phần I (${distribution.byPart?.part1?.total ?? 12} câu), Phần II (${distribution.byPart?.part2?.questionCount ?? 2} câu Đúng/Sai = ${distribution.byPart?.part2?.total ?? 8} ý), Phần III (${distribution.byPart?.part3?.total ?? 4} câu trả lời ngắn)`
      : '';

    const prompt = `Bạn là chuyên gia khảo thí và giáo viên giỏi của Bộ Giáo dục & Đào tạo Việt Nam.
Hãy xây dựng trọn bộ hồ sơ kiểm tra đánh giá theo đúng tinh thần CÔNG VĂN 7991/BGDĐT-GDTrH và CẤU TRÚC ĐỊNH DẠNG ĐỀ THI TỐT NGHIỆP THPT / ĐỀ KIỂM TRA ĐỊNH KỲ NĂM HỌC 2025 - 2026 (Chương trình GDPT 2018).

Thông tin yêu cầu:
- Môn học: ${subject || 'Hóa học'}
- Khối lớp: ${grade || 'Lớp 12'}
- Bộ sách: ${curriculum || 'Kết nối tri thức / Chân trời sáng tạo / Cánh diều'}
- Đợt kiểm tra: ${term || 'Kiểm tra giữa kì I'}
- Thời gian làm bài: ${duration || '50'} phút
- Độ khó tổng thể của đề thi: ${difficulty || 'Chuẩn CV 7991 Bộ GD&ĐT (40% Nhận biết - 30% Thông hiểu - 20% Vận dụng - 10% Vận dụng cao)'}
- Nội dung trọng tâm / Chủ đề: ${topics || 'Chương 1: Ester - Lipid, Chương 2: Carbohydrate'}
- Tỉ lệ: ${essayRatio || '70% Trắc nghiệm khách quan - 30% Tự luận (hoặc 100% Trắc nghiệm)'}${distributionText}

CẤU TRÚC ĐỀ THI CẦN TẠO THEO CHUẨN CV 7991 GỒM 3 PHẦN TRẮC NGHIỆM VÀ PHẦN TỰ LUẬN (nếu có):
1. PHẦN I: Câu trắc nghiệm nhiều phương án lựa chọn (Thí sinh trả lời từ câu 1 đến câu N. Mỗi câu hỏi thí sinh chỉ chọn một phương án A, B, C, D).
2. PHẦN II: Câu trắc nghiệm Đúng/Sai (Thí sinh trả lời từ câu 1 đến câu N. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai).
3. PHẦN III: Câu trắc nghiệm trả lời ngắn (Thí sinh điền kết quả vào ô trả lời, kết quả dạng số hoặc cụm từ ngắn).
4. PHẦN IV (hoặc TỰ LUẬN): Tự luận giải thích, bài toán vận dụng thực tiễn (nếu có phần tự luận).
5. Phân loại rõ 4 mức độ nhận thức cho từng câu hỏi: "Biết", "Hiểu", "Vận dụng", "Vận dụng cao".

Yêu cầu xuất ra định dạng JSON hợp lệ (không kèm markdown ngoài khối json) với schema chính xác sau:
{
  "title": "ĐỀ KIỂM TRA ĐỊNH KỲ NĂM HỌC 2025 - 2026",
  "subject": "${subject || 'Hóa học'}",
  "grade": "${grade || '12'}",
  "term": "${term || 'Giữa kì I'}",
  "duration": ${Number(duration) || 50},
  "matrix": [
    {
      "topic": "Tên chủ đề / bài học",
      "knowPart1": 2,
      "understandPart1": 1,
      "applyPart1": 1,
      "highApplyPart1": 0,
      "knowPart2": 1,
      "understandPart2": 1,
      "applyPart2": 1,
      "highApplyPart2": 1,
      "knowPart3": 0,
      "understandPart3": 1,
      "applyPart3": 1,
      "highApplyPart3": 1,
      "essayScore": 1.0,
      "totalPoints": 3.5
    }
  ],
  "specification": [
    {
      "topic": "Tên chủ đề",
      "competency": "Yêu cầu cần đạt",
      "knowDesc": "Mô tả yêu cầu mức Nhận biết",
      "understandDesc": "Mô tả yêu cầu mức Thông hiểu",
      "applyDesc": "Mô tả yêu cầu mức Vận dụng & Vận dụng cao",
      "questionMapping": "Câu 1, 2 (P1); Câu 1a, 1b (P2)..."
    }
  ],
  "part1": [
    {
      "id": 1,
      "content": "Nội dung câu hỏi trắc nghiệm (hỗ trợ công thức nếu có, ví dụ CH3COOC2H5, pH = 7)...",
      "options": {
        "A": "Nội dung phương án A",
        "B": "Nội dung phương án B",
        "C": "Nội dung phương án C",
        "D": "Nội dung phương án D"
      },
      "correctAnswer": "A",
      "level": "Biết",
      "explanation": "Giải thích chi tiết phương án đúng"
    }
  ],
  "part2": [
    {
      "id": 1,
      "content": "Đoạn thông tin / ngữ cảnh hoặc mệnh đề mở đầu...",
      "items": [
        { "label": "a", "text": "Mệnh đề a", "isCorrect": true, "explanation": "Giải thích vì sao đúng" },
        { "label": "b", "text": "Mệnh đề b", "isCorrect": false, "explanation": "Giải thích vì sao sai" },
        { "label": "c", "text": "Mệnh đề c", "isCorrect": true, "explanation": "Giải thích" },
        { "label": "d", "text": "Mệnh đề d", "isCorrect": false, "explanation": "Giải thích" }
      ],
      "level": "Hiểu"
    }
  ],
  "part3": [
    {
      "id": 1,
      "content": "Nội dung câu hỏi yêu cầu điền kết quả số (ví dụ: Tính khối lượng kết tủa thu được là bao nhiêu gam? Làm tròn đến 1 chữ số thập phân)...",
      "correctAnswer": "12.5",
      "unit": "gam",
      "level": "Vận dụng cao",
      "explanation": "Lời giải từng bước chi tiết dẫn tới đáp số 12.5"
    }
  ],
  "essay": [
    {
      "id": 1,
      "content": "Câu hỏi tự luận (nêu hiện tượng, viết phương trình hóa học hoặc giải bài toán thực tiễn)...",
      "points": 1.5,
      "level": "Vận dụng",
      "guide": "Hướng dẫn chấm chi tiết: Ý 1 (0.5đ): ..., Ý 2 (1.0đ): ..."
    }
  ]
}

Hãy tạo các câu hỏi chất lượng cao, đúng chuẩn kiến thức môn ${subject || 'Hóa học'}, số liệu thực tế, câu văn sư phạm chuẩn mực!`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    const parsedData = JSON.parse(text);
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error generating exam:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi tạo đề thi với AI',
    });
  }
});

// API endpoint to parse raw teacher text or PDF extracted text into CV 7991 structure
app.post('/api/gemini/parse-raw', async (req, res) => {
  try {
    const { rawText, subject } = req.body;
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ success: false, error: 'Chưa có nội dung đề bài thô' });
    }

    const prompt = `Bạn là trợ lý chuyên gia khảo thí và xử lý đề thi PDF/Word của giáo viên Việt Nam.
Hãy phân tích và bóc tách đoạn văn bản đề thi (được trích xuất từ PDF hoặc Word) sau đây thành cấu trúc các phần theo chuẩn Công văn 7991 và định dạng 2025/2026:
- Phần 1: Trắc nghiệm 4 lựa chọn (A, B, C, D)
- Phần 2: Trắc nghiệm Đúng/Sai (các ý a, b, c, d)
- Phần 3: Trắc nghiệm trả lời ngắn
- Tự luận (nếu có)

YÊU CẦU KỸ THUẬT QUAN TRỌNG:
1. NHẬN DIỆN ĐÁP ÁN ĐÚNG NGẦM (BẢO MẬT TUYỆT ĐỐI):
   - Tự nhận diện đáp án đúng dựa vào dấu sao (*A, A*), ký hiệu [GẠCH CHÂN], [TÔ ĐỎ], [IN ĐẬM], chữ (Đúng)/(Sai), hoặc BẢNG ĐÁP ÁN ở cuối văn bản.
   - Lưu đáp án đúng vào trường "correctAnswer" (Phần 1, 3) hoặc "isCorrect" (Phần 2).
   - TUYỆT ĐỐI XÓA BỎ mọi ký hiệu đánh dấu đáp án (*, [GẠCH CHÂN], [TÔ ĐỎ], (Đúng), (Sai)) khỏi nội dung câu hỏi ("content") và nội dung các phương án ("options"), để học sinh làm bài không bị lộ đáp án!
2. CHUẨN HÓA CÔNG THỨC HÓA HỌC / TOÁN HỌC BỊ LỖI FONT TỪ PDF SANG LATEX / MHCHEM:
   - Các công thức hóa học bị mất chỉ số trên/dưới khi copy từ PDF (ví dụ: H2SO4, Fe3+, Cu(OH)2, CH3COOC2H5, SO42-, HCO3-) phải được bọc chuẩn xác trong cú pháp KaTeX mhchem: $\\ce{H2SO4}$, $\\ce{Fe^{3+}}$, $\\ce{Cu(OH)2}$, $\\ce{CH3COOC2H5}$, $\\ce{SO4^{2-}}$.
   - Các ký hiệu nhiệt độ hoặc mũi tên phản ứng bị vỡ (ví dụ: t0, --t0-->, ->, <=>) chuyển thành $t^\\circ$, $\\xrightarrow{t^\\circ}$, $\\rightarrow$, $\\rightleftharpoons$.

Văn bản gốc trích xuất từ PDF/Word:
"""
${rawText}
"""

Xuất kết quả định dạng JSON hợp lệ:
{
  "part1": [
    {
      "id": 1,
      "content": "...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correctAnswer": "A",
      "level": "Biết",
      "explanation": "..."
    }
  ],
  "part2": [
    {
      "id": 1,
      "content": "...",
      "items": [
        { "label": "a", "text": "...", "isCorrect": true, "explanation": "..." },
        { "label": "b", "text": "...", "isCorrect": false, "explanation": "..." },
        { "label": "c", "text": "...", "isCorrect": true, "explanation": "..." },
        { "label": "d", "text": "...", "isCorrect": false, "explanation": "..." }
      ],
      "level": "Hiểu"
    }
  ],
  "part3": [
    {
      "id": 1,
      "content": "...",
      "correctAnswer": "...",
      "unit": "",
      "level": "Vận dụng",
      "explanation": "..."
    }
  ],
  "essay": [
    {
      "id": 1,
      "content": "...",
      "points": 1.0,
      "guide": "..."
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error parsing raw test:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint for generating an explanation for a single question
app.post('/api/gemini/explain', async (req, res) => {
  try {
    const { question, type, subject } = req.body;
    const prompt = `Là giáo viên sư phạm môn ${subject || 'Hóa học'}, hãy viết lời giải chi tiết, chuẩn xác, dễ hiểu cho câu hỏi sau (${type}):
${JSON.stringify(question)}

Yêu cầu:
- Nêu phương pháp giải / kiến thức lý thuyết cốt lõi
- Các bước suy luận hoặc tính toán phương trình hóa học / công thức toán học
- Kết luận đáp án đúng`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({ success: true, explanation: response.text });
  } catch (error: any) {
    console.error('Error explaining:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
