export type CognitiveLevel = 'Biết' | 'Hiểu' | 'Vận dụng' | 'Vận dụng cao';

export interface Part1Question {
  id: number;
  content: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  level: CognitiveLevel;
  topic?: string;
  explanation?: string;
  imageUrl?: string;
  imageCaption?: string;
  imageWidth?: number;
}

export interface Part2Item {
  label: 'a' | 'b' | 'c' | 'd';
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface Part2Question {
  id: number;
  content: string;
  items: Part2Item[];
  level: CognitiveLevel;
  topic?: string;
  imageUrl?: string;
  imageCaption?: string;
  imageWidth?: number;
}

export interface Part3Question {
  id: number;
  content: string;
  correctAnswer: string;
  unit?: string;
  level: CognitiveLevel;
  topic?: string;
  explanation?: string;
  imageUrl?: string;
  imageCaption?: string;
  imageWidth?: number;
}

export interface EssayQuestion {
  id: number;
  content: string;
  points: number;
  guide: string;
  level?: CognitiveLevel;
  topic?: string;
  imageUrl?: string;
  imageCaption?: string;
  imageWidth?: number;
}

export interface MatrixRow {
  id: string;
  topic: string;
  // Số câu Phần 1
  knowPart1: number;
  understandPart1: number;
  applyPart1: number;
  highApplyPart1?: number;
  // Số ý Phần 2
  knowPart2: number;
  understandPart2: number;
  applyPart2: number;
  highApplyPart2?: number;
  // Số câu Phần 3
  knowPart3: number;
  understandPart3: number;
  applyPart3: number;
  highApplyPart3?: number;
  // Tự luận
  essayScore: number;
  totalPoints: number;
}

export interface SpecificationRow {
  id: string;
  topic: string;
  competency: string; // Yêu cầu cần đạt
  knowDesc: string; // Mô tả mức Biết
  understandDesc: string; // Mô tả mức Hiểu
  applyDesc: string; // Mô tả mức Vận dụng
  highApplyDesc?: string; // Mô tả mức Vận dụng cao
  questionMapping: string; // Câu hỏi tương ứng
}

export interface ExamMetadata {
  schoolName: string;
  departmentName: string;
  examTitle: string;
  academicYear: string;
  subject: string;
  grade: string;
  term: string;
  curriculum: string; // Kết nối tri thức, Cánh diều, Chân trời sáng tạo
  durationMinutes: number;
  examCode: string;
  dateStr?: string;
}

export interface ExamData {
  metadata: ExamMetadata;
  matrix: MatrixRow[];
  specification: SpecificationRow[];
  part1: Part1Question[];
  part2: Part2Question[];
  part3: Part3Question[];
  essay: EssayQuestion[];
}

export interface ShuffledExamCode {
  code: string;
  part1: Part1Question[];
  part2: Part2Question[];
  part3: Part3Question[];
  essay: EssayQuestion[];
  answerKeyPart1: Record<number, 'A' | 'B' | 'C' | 'D'>;
  answerKeyPart2: Record<number, Record<string, boolean>>;
  answerKeyPart3: Record<number, string>;
}
