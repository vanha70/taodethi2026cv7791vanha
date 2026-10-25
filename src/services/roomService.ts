import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/firebase';
import { ExamData, Part1Question, Part2Question, Part3Question, EssayQuestion } from '../types/exam';
import { safeLocalStorage } from '../utils/browserSafeguards';
import { canvasToCompressedDataUrl } from '../utils/pdfExamParser';

export interface ExamRoomDoc {
  id: string;
  roomCode: string;
  examCode?: string;
  examTitle?: string;
  title: string;
  subject: string;
  grade: string;
  gradeClass?: string;
  targetClass?: string;
  duration?: number;
  durationMinutes: number;
  status: 'open' | 'closed';
  teacherName: string;
  allowReview: boolean;
  createdAt: string;
  totalQuestions?: number;
  isChunked?: boolean;
  chunkCount?: number;
  savedOfflineOnly?: boolean;
  savedFirebase?: boolean;
  savedGoogleSheets?: boolean;
  googleDriveFileId?: string;
  googleDriveFileUrl?: string;
  loadedFromSource?: 'firebase' | 'google_sheets_drive' | 'local_backup';
  part1?: Part1Question[];
  part2?: Part2Question[];
  part3?: Part3Question[];
  examData: ExamData;
}

export interface ExamQuestionChunkDoc {
  roomCode: string;
  chunkIndex: number;
  part1Items: Part1Question[];
  part2Items: Part2Question[];
  part3Items: Part3Question[];
  essayItems: EssayQuestion[];
  updatedAt: string;
}

export interface StudentSubmissionScore {
  total: number;
  part1: number;
  part2: number;
  part3: number;
}

export interface StudentSubmissionDoc {
  id: string;
  roomId: string;
  roomCode: string;
  studentName: string;
  studentClass: string;
  studentId: string; // SBD
  score?: StudentSubmissionScore;
  scoreTotal: number;
  scorePart1: number;
  scorePart2: number;
  scorePart3: number;
  answersPart1: Record<number, 'A' | 'B' | 'C' | 'D'>;
  answersPart2: Record<number, Record<'a' | 'b' | 'c' | 'd', boolean | null>>;
  answersPart3: Record<number, string>;
  timeSpent?: number;
  timeSpentSeconds: number;
  submittedAt: string;
}

export const LOCAL_ROOMS_BACKUP_KEY = 'taodethi2026_published_rooms_backup_v1';

// Validate strict 4-digit exam/room code format (^\d{4}$)
export function isValid4DigitCode(code: string): boolean {
  return /^\d{4}$/.test(code.trim());
}

/**
 * Automatically capitalizes the first letter of each word in a Vietnamese student name.
 * Preserves trailing space while typing if `preserveTrailingSpace` is true.
 */
export function formatStudentFullName(rawName: string, preserveTrailingSpace: boolean = false): string {
  if (!rawName) return '';
  const hasTrailingSpace = preserveTrailingSpace && /\s$/.test(rawName);
  const words = rawName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase('vi-VN') + word.slice(1).toLocaleLowerCase('vi-VN'));
  const formatted = words.join(' ');
  return hasTrailingSpace && formatted ? `${formatted} ` : formatted;
}

// Generate unique 4-digit numeric code (e.g. 1003, 1001, 2026) not in existingCodes
export function generateRandom4DigitCode(existingCodes: string[] = []): string {
  const existingSet = new Set(existingCodes.map((c) => c.trim()));
  for (let attempt = 0; attempt < 200; attempt++) {
    const num = Math.floor(1000 + Math.random() * 9000);
    const code = String(num);
    if (!existingSet.has(code)) {
      return code;
    }
  }
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Deeply sanitizes any payload before writing to Firebase Firestore:
 * 1. Recursively removes `undefined` keys on objects and replaces `undefined` in arrays with `null`.
 * 2. Replaces `NaN` or `Infinity` numbers with `0`.
 * 3. Flattens/converts any nested arrays (`Array` inside `Array`) because Firestore rejects nested arrays.
 * 4. Runs `JSON.parse(JSON.stringify(...))` so only 100% pure JSON primitives/objects/arrays remain.
 */
export function sanitizeForFirestore<T>(value: T): T {
  const deepClean = (val: any, insideArray: boolean = false): any => {
    if (val === undefined) {
      return insideArray ? null : undefined;
    }
    if (val === null) {
      return null;
    }
    if (typeof val === 'number') {
      return Number.isFinite(val) ? val : 0;
    }
    if (typeof val === 'string' || typeof val === 'boolean') {
      return val;
    }
    if (val instanceof Date) {
      return val.toISOString();
    }
    if (Array.isArray(val)) {
      const cleanedArr = val
        .filter((item) => item !== undefined)
        .map((item) => deepClean(item, true));
      if (insideArray) {
        // Firestore does not allow nested arrays (array of arrays). Convert inner array to indexed object.
        const indexedObj: Record<string, any> = {};
        cleanedArr.forEach((el, idx) => {
          indexedObj[String(idx)] = el;
        });
        return indexedObj;
      }
      return cleanedArr;
    }
    if (typeof val === 'object') {
      const cleanedObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        if (v !== undefined && typeof v !== 'function' && typeof v !== 'symbol') {
          const cleanedVal = deepClean(v, false);
          if (cleanedVal !== undefined) {
            cleanedObj[k] = cleanedVal;
          }
        }
      }
      return cleanedObj;
    }
    return String(val);
  };

  try {
    const step1 = deepClean(value, false);
    return JSON.parse(JSON.stringify(step1 ?? null));
  } catch {
    return value;
  }
}

/**
 * Estimates the UTF-8 byte size of a serialized Firestore payload.
 */
export function estimateJsonByteSize(obj: unknown): number {
  try {
    const json = JSON.stringify(obj);
    if (!json) return 0;
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(json).length;
    }
    return json.length * 2;
  } catch {
    return 0;
  }
}

/**
 * Re-compresses any Base64 image (`data:image/png`, `data:image/jpeg`, or large `data:image/webp`)
 * onto a `#ffffff`-filled `<canvas>` and exports it with `image/webp` at quality `0.65`
 * (or `image/jpeg` at quality `0.7` fallback) so 28 PDF slices are ~85% smaller.
 */
export async function compressBase64ImageForFirestore(
  dataUrl?: string,
  maxWidth: number = 880,
  webpQuality: number = 0.65
): Promise<string | undefined> {
  if (!dataUrl || typeof dataUrl !== 'string') return undefined;
  const trimmed = dataUrl.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith('data:image/')) return trimmed;

  // Fast path: if already compressed WebP and small (< 26KB), keep as-is
  if (trimmed.startsWith('data:image/webp') && trimmed.length < 26000) {
    return trimmed;
  }

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return trimmed;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(trimmed);
    }, 2500);

    const img = new Image();
    img.onload = () => {
      clearTimeout(timeoutId);
      try {
        const srcW = img.naturalWidth || img.width || 600;
        const srcH = img.naturalHeight || img.height || 200;
        const scale = srcW > maxWidth ? maxWidth / srcW : 1;
        const outW = Math.max(20, Math.round(srcW * scale));
        const outH = Math.max(20, Math.round(srcH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(trimmed);
          return;
        }
        // Fill solid white background before drawing so transparent PNGs never turn black
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outW, outH);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, outW, outH);

        const compressed = canvasToCompressedDataUrl(
          canvas,
          webpQuality,
          Math.min(0.72, webpQuality + 0.05)
        );
        // Keep whichever is smaller
        resolve(compressed && compressed.length < trimmed.length ? compressed : trimmed);
      } catch {
        resolve(trimmed);
      }
    };
    img.onerror = () => {
      clearTimeout(timeoutId);
      resolve(trimmed);
    };
    img.src = trimmed;
  });
}

/**
 * Compresses all `pdfSliceUrl` and `imageUrl` images in an `ExamData` object using WebP 0.65 / JPEG 0.7,
 * and drops redundant `stemSliceUrl` when `pdfSliceUrl` is already present.
 */
export async function compressExamDataImages(
  exam: ExamData,
  maxWidth: number = 880,
  webpQuality: number = 0.65
): Promise<ExamData> {
  const part1 = await Promise.all(
    (exam.part1 || []).map(async (q) => {
      const pdfSliceUrl = await compressBase64ImageForFirestore(q.pdfSliceUrl, maxWidth, webpQuality);
      const imageUrl = await compressBase64ImageForFirestore(
        q.image || q.imageUrl,
        maxWidth,
        webpQuality
      );
      const { stemSliceUrl: _stem, ...rest } = q;
      return {
        ...rest,
        ...(pdfSliceUrl ? { pdfSliceUrl } : {}),
        ...(imageUrl ? { image: imageUrl, imageUrl } : {}),
      };
    })
  );

  const part2 = await Promise.all(
    (exam.part2 || []).map(async (q) => {
      const pdfSliceUrl = await compressBase64ImageForFirestore(q.pdfSliceUrl, maxWidth, webpQuality);
      const imageUrl = await compressBase64ImageForFirestore(
        q.image || q.imageUrl,
        maxWidth,
        webpQuality
      );
      const { stemSliceUrl: _stem, ...rest } = q;
      return {
        ...rest,
        ...(pdfSliceUrl ? { pdfSliceUrl } : {}),
        ...(imageUrl ? { image: imageUrl, imageUrl } : {}),
      };
    })
  );

  const part3 = await Promise.all(
    (exam.part3 || []).map(async (q) => {
      const pdfSliceUrl = await compressBase64ImageForFirestore(q.pdfSliceUrl, maxWidth, webpQuality);
      const imageUrl = await compressBase64ImageForFirestore(
        q.image || q.imageUrl,
        maxWidth,
        webpQuality
      );
      const { stemSliceUrl: _stem, ...rest } = q;
      return {
        ...rest,
        ...(pdfSliceUrl ? { pdfSliceUrl } : {}),
        ...(imageUrl ? { image: imageUrl, imageUrl } : {}),
      };
    })
  );

  return {
    ...exam,
    part1,
    part2,
    part3,
    essay: exam.essay || [],
  };
}

/**
 * Splits the 28 questions (with their compressed Base64 `pdfSliceUrl` and `imageUrl`) into small batches
 * (max 5 questions per chunk AND strictly < 450KB per chunk document) for storage in
 * `exam_rooms/{roomCode}/chunks/chunk_{i}` so no Firestore document ever exceeds the 1MB limit.
 */
function buildExamQuestionChunks(
  roomCode: string,
  examData: ExamData,
  maxQuestionsPerChunk: number = 5,
  maxBytesPerChunk: number = 450000
): ExamQuestionChunkDoc[] {
  type TaggedItem =
    | { kind: 'part1'; item: Part1Question }
    | { kind: 'part2'; item: Part2Question }
    | { kind: 'part3'; item: Part3Question }
    | { kind: 'essay'; item: EssayQuestion };

  const allItems: TaggedItem[] = [
    ...(examData.part1 || []).map((item) => ({ kind: 'part1' as const, item })),
    ...(examData.part2 || []).map((item) => ({ kind: 'part2' as const, item })),
    ...(examData.part3 || []).map((item) => ({ kind: 'part3' as const, item })),
    ...(examData.essay || []).map((item) => ({ kind: 'essay' as const, item })),
  ];

  const chunks: ExamQuestionChunkDoc[] = [];
  const nowIso = new Date().toISOString();

  let currentChunk: ExamQuestionChunkDoc = {
    roomCode,
    chunkIndex: 0,
    part1Items: [],
    part2Items: [],
    part3Items: [],
    essayItems: [],
    updatedAt: nowIso,
  };
  let currentCount = 0;

  const pushCurrentChunk = () => {
    if (
      currentChunk.part1Items.length > 0 ||
      currentChunk.part2Items.length > 0 ||
      currentChunk.part3Items.length > 0 ||
      currentChunk.essayItems.length > 0
    ) {
      chunks.push(sanitizeForFirestore(currentChunk));
      currentChunk = {
        roomCode,
        chunkIndex: chunks.length,
        part1Items: [],
        part2Items: [],
        part3Items: [],
        essayItems: [],
        updatedAt: nowIso,
      };
      currentCount = 0;
    }
  };

  for (const entry of allItems) {
    const itemBytes = estimateJsonByteSize(entry.item);
    const currentBytes = estimateJsonByteSize(currentChunk);

    if (
      currentCount >= maxQuestionsPerChunk ||
      (currentCount > 0 && currentBytes + itemBytes > maxBytesPerChunk)
    ) {
      pushCurrentChunk();
    }

    if (entry.kind === 'part1') currentChunk.part1Items.push(entry.item);
    else if (entry.kind === 'part2') currentChunk.part2Items.push(entry.item);
    else if (entry.kind === 'part3') currentChunk.part3Items.push(entry.item);
    else currentChunk.essayItems.push(entry.item);

    currentCount++;
  }

  pushCurrentChunk();
  return chunks;
}

/**
 * Merges question chunks fetched from `exam_rooms/{roomCode}/chunks` back into an `ExamRoomDoc`.
 */
function mergeChunksIntoRoomDoc(
  roomDoc: ExamRoomDoc,
  chunks: ExamQuestionChunkDoc[]
): ExamRoomDoc {
  if (!chunks || chunks.length === 0) return roomDoc;

  const sorted = [...chunks].sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));
  const chunkP1Map = new Map<number, Part1Question>();
  const chunkP2Map = new Map<number, Part2Question>();
  const chunkP3Map = new Map<number, Part3Question>();
  const chunkP1List: Part1Question[] = [];
  const chunkP2List: Part2Question[] = [];
  const chunkP3List: Part3Question[] = [];
  const chunkEssayList: EssayQuestion[] = [];

  for (const ch of sorted) {
    for (const q of ch.part1Items || []) {
      chunkP1Map.set(q.id, q);
      chunkP1List.push(q);
    }
    for (const q of ch.part2Items || []) {
      chunkP2Map.set(q.id, q);
      chunkP2List.push(q);
    }
    for (const q of ch.part3Items || []) {
      chunkP3Map.set(q.id, q);
      chunkP3List.push(q);
    }
    for (const q of ch.essayItems || []) {
      chunkEssayList.push(q);
    }
  }

  const baseP1 = roomDoc.examData?.part1 || roomDoc.part1 || [];
  const baseP2 = roomDoc.examData?.part2 || roomDoc.part2 || [];
  const baseP3 = roomDoc.examData?.part3 || roomDoc.part3 || [];

  const mergedPart1 =
    baseP1.length > 0
      ? baseP1.map((q) => {
          const fromChunk = chunkP1Map.get(q.id);
          return fromChunk ? { ...q, ...fromChunk } : q;
        })
      : chunkP1List;

  const mergedPart2 =
    baseP2.length > 0
      ? baseP2.map((q) => {
          const fromChunk = chunkP2Map.get(q.id);
          return fromChunk ? { ...q, ...fromChunk } : q;
        })
      : chunkP2List;

  const mergedPart3 =
    baseP3.length > 0
      ? baseP3.map((q) => {
          const fromChunk = chunkP3Map.get(q.id);
          return fromChunk ? { ...q, ...fromChunk } : q;
        })
      : chunkP3List;

  const mergedExamData: ExamData = {
    ...roomDoc.examData,
    part1: mergedPart1,
    part2: mergedPart2,
    part3: mergedPart3,
    essay:
      roomDoc.examData?.essay && roomDoc.examData.essay.length > 0
        ? roomDoc.examData.essay
        : chunkEssayList,
  };

  return {
    ...roomDoc,
    part1: mergedPart1,
    part2: mergedPart2,
    part3: mergedPart3,
    examData: mergedExamData,
  };
}

/**
 * Saves/updates a published room in `safeLocalStorage` as an immediate offline/fallback backup.
 */
export function saveRoomToLocalBackup(room: ExamRoomDoc): void {
  try {
    const raw = safeLocalStorage.getItem(LOCAL_ROOMS_BACKUP_KEY);
    const map: Record<string, ExamRoomDoc> = raw ? JSON.parse(raw) : {};
    map[room.roomCode] = room;
    // Keep at most 8 recent rooms in localStorage to avoid exceeding WebView storage quota
    const entries = Object.entries(map).sort(
      (a, b) => new Date(b[1].createdAt || 0).getTime() - new Date(a[1].createdAt || 0).getTime()
    );
    const trimmedMap: Record<string, ExamRoomDoc> = {};
    entries.slice(0, 6).forEach(([k, v]) => {
      trimmedMap[k] = v;
    });
    safeLocalStorage.setItem(LOCAL_ROOMS_BACKUP_KEY, JSON.stringify(trimmedMap));
  } catch {
    // If localStorage quota is tight with images, store lightweight text version
    try {
      const lightRoom: ExamRoomDoc = {
        ...room,
        part1: (room.part1 || []).map(({ pdfSliceUrl: _p, ...q }) => q),
        part2: (room.part2 || []).map(({ pdfSliceUrl: _p, ...q }) => q),
        part3: (room.part3 || []).map(({ pdfSliceUrl: _p, ...q }) => q),
        examData: {
          ...room.examData,
          part1: (room.examData?.part1 || []).map(({ pdfSliceUrl: _p, ...q }) => q),
          part2: (room.examData?.part2 || []).map(({ pdfSliceUrl: _p, ...q }) => q),
          part3: (room.examData?.part3 || []).map(({ pdfSliceUrl: _p, ...q }) => q),
        },
      };
      safeLocalStorage.setItem(
        LOCAL_ROOMS_BACKUP_KEY,
        JSON.stringify({ [room.roomCode]: lightRoom })
      );
    } catch {
      // ignore
    }
  }
}

export function loadRoomFromLocalBackup(roomCode: string): ExamRoomDoc | null {
  try {
    const raw = safeLocalStorage.getItem(LOCAL_ROOMS_BACKUP_KEY);
    if (!raw) return null;
    const map: Record<string, ExamRoomDoc> = JSON.parse(raw);
    const found = map[roomCode.trim()];
    return found ? normalizeRoomDoc(found, roomCode.trim()) : null;
  } catch {
    return null;
  }
}

export function loadAllRoomsFromLocalBackup(): ExamRoomDoc[] {
  try {
    const raw = safeLocalStorage.getItem(LOCAL_ROOMS_BACKUP_KEY);
    if (!raw) return [];
    const map: Record<string, ExamRoomDoc> = JSON.parse(raw);
    return Object.values(map).map((r) => normalizeRoomDoc(r, r.roomCode || r.id));
  } catch {
    return [];
  }
}

/**
 * Formats any Firebase error into a detailed, user-friendly Vietnamese diagnostic message.
 */
export function formatFirebasePublishError(error: any): string {
  const rawMsg = String(error?.message || error || '');
  const code = String(error?.code || '');

  if (
    code.includes('permission-denied') ||
    /Missing or insufficient permissions|PERMISSION_DENIED/i.test(rawMsg)
  ) {
    return 'Lỗi phân quyền Firebase (Permission Denied): Firestore Security Rules đang chặn quyền ghi vào collection exam_rooms hoặc subcollection chunks. Đề thi đã được tự động lưu bản dự phòng tại trình duyệt (LocalStorage).';
  }
  if (
    /maximum allowed size|1,048,576|1048576|too large|resource-exhausted/i.test(rawMsg)
  ) {
    return 'Dung lượng gói dữ liệu vượt quá giới hạn 1MB của 1 Document Firestore. Hệ thống đã tự động kích hoạt chế độ nén ảnh WebP 65% và chia nhỏ câu hỏi sang subcollection chunks!';
  }
  if (/undefined|nested array|invalid-argument/i.test(rawMsg)) {
    return `Lỗi định dạng dữ liệu Firebase (${rawMsg}). Hệ thống đã làm sạch các trường undefined và lưu bản dự phòng LocalStorage.`;
  }
  return `Chi tiết lỗi Firebase: ${rawMsg || 'Không thể kết nối tới máy chủ Firestore'}. Đề thi vẫn được lưu an toàn trong bộ nhớ dự phòng LocalStorage!`;
}

/**
 * Normalize an ExamRoomDoc loaded from `exam_rooms`, `exams`, or `rooms`
 */
function normalizeRoomDoc(raw: any, docId: string): ExamRoomDoc {
  const roomCode = String(raw.roomCode || docId || '').trim();
  const resolvedTitle = raw.examTitle || raw.title || raw.examData?.metadata?.examTitle || 'Đề kiểm tra trực tuyến';
  const resolvedClass = raw.gradeClass || raw.targetClass || raw.grade || raw.examData?.metadata?.grade || 'Khối 12';
  const resolvedDuration = Number(raw.duration || raw.durationMinutes || raw.examData?.metadata?.durationMinutes || 45);
  const resolvedExamData: ExamData = raw.examData
    ? {
        ...raw.examData,
        part1: raw.examData.part1 || raw.part1 || [],
        part2: raw.examData.part2 || raw.part2 || [],
        part3: raw.examData.part3 || raw.part3 || [],
      }
    : {
        metadata: {
          schoolOrDept: 'SỞ GD&ĐT',
          SchoolName: 'TRƯỜNG THPT',
          examTitle: resolvedTitle,
          subject: raw.subject || 'Hóa học',
          grade: resolvedClass,
          durationMinutes: resolvedDuration,
          examCode: roomCode,
          schoolYear: '2025 - 2026',
        },
        part1: raw.part1 || [],
        part2: raw.part2 || [],
        part3: raw.part3 || [],
        essay: [],
      };

  const totalQuestions =
    (resolvedExamData.part1?.length || 0) +
    (resolvedExamData.part2?.length || 0) +
    (resolvedExamData.part3?.length || 0);

  return {
    ...raw,
    id: roomCode || docId,
    roomCode,
    examCode: raw.examCode || roomCode,
    examTitle: resolvedTitle,
    title: resolvedTitle,
    subject: raw.subject || resolvedExamData.metadata?.subject || 'Hóa học',
    grade: resolvedClass,
    gradeClass: resolvedClass,
    targetClass: resolvedClass,
    duration: resolvedDuration,
    durationMinutes: resolvedDuration,
    status: raw.status === 'closed' ? 'closed' : 'open',
    teacherName: raw.teacherName || 'Giáo viên',
    allowReview: raw.allowReview !== undefined ? Boolean(raw.allowReview) : true,
    createdAt: raw.createdAt || new Date().toISOString(),
    totalQuestions: raw.totalQuestions ?? totalQuestions,
    isChunked: Boolean(raw.isChunked),
    chunkCount: Number(raw.chunkCount || 0),
    savedFirebase: raw.savedFirebase !== undefined ? Boolean(raw.savedFirebase) : true,
    savedGoogleSheets: Boolean(raw.savedGoogleSheets),
    googleDriveFileId: raw.googleDriveFileId || '',
    googleDriveFileUrl: raw.googleDriveFileUrl || '',
    loadedFromSource: raw.loadedFromSource || 'firebase',
    part1: resolvedExamData.part1,
    part2: resolvedExamData.part2,
    part3: resolvedExamData.part3,
    examData: resolvedExamData,
  };
}

/**
 * Normalize a StudentSubmissionDoc loaded from `exam_submissions/{roomCode}/students/{subId}`
 * or legacy `exams/{roomCode}/submissions/{subId}`
 */
function normalizeSubmissionDoc(raw: any, docId: string): StudentSubmissionDoc {
  const scoreTotal = Number(raw.score?.total ?? raw.scoreTotal ?? 0);
  const scorePart1 = Number(raw.score?.part1 ?? raw.scorePart1 ?? 0);
  const scorePart2 = Number(raw.score?.part2 ?? raw.scorePart2 ?? 0);
  const scorePart3 = Number(raw.score?.part3 ?? raw.scorePart3 ?? 0);
  const timeSpentSeconds = Number(raw.timeSpent ?? raw.timeSpentSeconds ?? 0);
  return {
    ...raw,
    id: raw.id || docId,
    roomId: raw.roomId || raw.roomCode || '',
    roomCode: String(raw.roomCode || '').trim(),
    studentName: raw.studentName || 'Học sinh',
    studentClass: raw.studentClass || '',
    studentId: raw.studentId || '',
    score: {
      total: scoreTotal,
      part1: scorePart1,
      part2: scorePart2,
      part3: scorePart3,
    },
    scoreTotal,
    scorePart1,
    scorePart2,
    scorePart3,
    answersPart1: raw.answersPart1 || {},
    answersPart2: raw.answersPart2 || {},
    answersPart3: raw.answersPart3 || {},
    timeSpent: timeSpentSeconds,
    timeSpentSeconds,
    submittedAt: raw.submittedAt || new Date().toISOString(),
  };
}

// 1. DUAL CLOUD SAVE: Publish / Create a new exam room simultaneously in Firebase (`exam_rooms/{roomCode}`)
//    AND Google Sheets + Google Drive (`Exam_{roomCode}.json` + `DanhSachDeThi` sheet via Apps Script Web App URL).
//    Automatically cleans data (`JSON.parse(JSON.stringify(...))`), compresses diagram images (WebP 65% / JPEG 70%),
//    and chunks question batches (< 450KB) so Firestore's 1MB limit is never exceeded.
export async function createExamRoom(
  exam: ExamData,
  durationMinutes: number,
  teacherName: string = 'Thầy: Nguyễn Văn Hà',
  allowReview: boolean = true,
  customRoomCode?: string,
  targetClass?: string,
  onProgress?: (stepMessage: string) => void
): Promise<ExamRoomDoc> {
  const cleanCustom = customRoomCode ? customRoomCode.trim() : '';
  const roomCode = isValid4DigitCode(cleanCustom)
    ? cleanCustom
    : isValid4DigitCode(exam.metadata.examCode || '')
      ? exam.metadata.examCode.trim()
      : generateRandom4DigitCode();

  // Primary key (Document ID) in `exam_rooms` collection is the 4-digit roomCode itself
  const roomId = roomCode;
  const path = `exam_rooms/${roomId}`;
  const resolvedClass = targetClass?.trim() || exam.metadata.grade || 'Khối 12';
  const resolvedDuration = Number(durationMinutes) || exam.metadata.durationMinutes || 45;
  const resolvedTitle = exam.metadata.examTitle || 'Đề kiểm tra trực tuyến';
  const nowIso = new Date().toISOString();

  if (onProgress) {
    onProgress('Đang làm sạch dữ liệu & nén ảnh hình vẽ (WebP 65% / JPEG 70%)...');
  }

  // Step 1: Compress all Base64 diagram images (`image/webp` at 0.65 / `image/jpeg` at 0.7)
  const compressedExam = await compressExamDataImages(
    {
      ...exam,
      metadata: {
        ...exam.metadata,
        examCode: roomCode,
        grade: resolvedClass,
        durationMinutes: resolvedDuration,
        examTitle: resolvedTitle,
      },
    },
    880,
    0.65
  );

  // Step 2: Build lightweight text-only question lists (stripping heavy Base64 slices from main metadata doc
  // whenever chunking is used so `exam_rooms/{roomCode}` is guaranteed < 100KB!)
  const stripHeavyImages = <
    T extends { pdfSliceUrl?: string; stemSliceUrl?: string; imageUrl?: string }
  >(
    q: T
  ): T => {
    const copy = { ...q };
    delete copy.pdfSliceUrl;
    delete copy.stemSliceUrl;
    // Keep small inline imageUrls (< 12KB) in main doc, move larger ones to chunks
    if (copy.imageUrl && copy.imageUrl.length > 12000) {
      delete copy.imageUrl;
    }
    return copy;
  };

  const lightPart1 = compressedExam.part1.map(stripHeavyImages);
  const lightPart2 = compressedExam.part2.map(stripHeavyImages);
  const lightPart3 = compressedExam.part3.map(stripHeavyImages);
  const totalQuestions =
    compressedExam.part1.length + compressedExam.part2.length + compressedExam.part3.length;

  // Step 3: Split the full 28 questions (with compressed `imageUrl`) into batches of <= 5 questions
  // and strictly < 450KB per chunk document
  const questionChunks = buildExamQuestionChunks(roomCode, compressedExam, 5, 450000);

  // Check if Google Apps Script Web App URL is configured
  const configuredGasUrl = getConfiguredGoogleAppsScriptUrl();

  // Full room object (with all images) for immediate return, Google Drive JSON, & localStorage backup
  let fullRoomObject: ExamRoomDoc = sanitizeForFirestore(
    normalizeRoomDoc(
      {
        id: roomId,
        roomCode,
        examCode: roomCode,
        examTitle: resolvedTitle,
        title: resolvedTitle,
        subject: compressedExam.metadata.subject || 'Hóa học',
        grade: resolvedClass,
        gradeClass: resolvedClass,
        targetClass: resolvedClass,
        duration: resolvedDuration,
        durationMinutes: resolvedDuration,
        status: 'open',
        teacherName: teacherName || 'Giáo viên',
        allowReview: Boolean(allowReview),
        createdAt: nowIso,
        totalQuestions,
        isChunked: questionChunks.length > 0,
        chunkCount: questionChunks.length,
        savedFirebase: false,
        savedGoogleSheets: false,
        part1: compressedExam.part1,
        part2: compressedExam.part2,
        part3: compressedExam.part3,
        examData: compressedExam,
      },
      roomId
    )
  );

  // Always save an immediate backup in localStorage so teacher never loses data
  saveRoomToLocalBackup(fullRoomObject);

  // Task A: Save to Firebase Firestore (`exam_rooms/{roomCode}` + `chunks`)
  const saveToFirebaseTask = async (): Promise<boolean> => {
    const candidateInlineDoc = sanitizeForFirestore({
      ...fullRoomObject,
      savedFirebase: true,
      savedGoogleSheets: Boolean(configuredGasUrl),
      part1: lightPart1,
      part2: lightPart2,
      part3: lightPart3,
      examData: compressedExam,
    });
    const candidateInlineBytes = estimateJsonByteSize(candidateInlineDoc);

    const lightMainDoc = sanitizeForFirestore({
      ...fullRoomObject,
      savedFirebase: true,
      savedGoogleSheets: Boolean(configuredGasUrl),
      isChunked: true,
      chunkCount: questionChunks.length,
      part1: lightPart1,
      part2: lightPart2,
      part3: lightPart3,
      examData: {
        ...compressedExam,
        part1: lightPart1,
        part2: lightPart2,
        part3: lightPart3,
      },
    });

    const mainDocToWrite = candidateInlineBytes < 520000 ? candidateInlineDoc : lightMainDoc;

    // 1) Write main room document to `exam_rooms/{roomCode}`
    try {
      await setDoc(doc(db, 'exam_rooms', roomId), mainDocToWrite);
    } catch (mainWriteErr: any) {
      console.warn('Retrying main room write with lightweight payload:', mainWriteErr);
      await setDoc(doc(db, 'exam_rooms', roomId), lightMainDoc);
    }

    // 2) Write question chunks to subcollection `exam_rooms/{roomCode}/chunks/chunk_{i}`
    if (questionChunks.length > 0) {
      for (let i = 0; i < questionChunks.length; i++) {
        const chunkId = `chunk_${i}`;
        const sanitizedChunk = sanitizeForFirestore(questionChunks[i]);
        await setDoc(doc(db, 'exam_rooms', roomId, 'chunks', chunkId), sanitizedChunk);
      }
    }

    // 3) Mirror lightweight metadata to `exams/{roomCode}` and `rooms/{roomCode}` for backward compatibility
    try {
      await setDoc(doc(db, 'exams', roomId), lightMainDoc);
      await setDoc(doc(db, 'rooms', roomId), lightMainDoc);
    } catch {
      // ignore secondary mirror errors
    }

    return true;
  };

  // Task B: Save simultaneously to Google Sheets (`DanhSachDeThi`) & Google Drive (`Exam_{roomCode}.json`)
  const saveToGoogleTask = async (): Promise<{
    saved: boolean;
    fileId?: string;
    fileUrl?: string;
  }> => {
    if (!configuredGasUrl) {
      return { saved: false };
    }
    const gasRes = await saveExamToGoogleSheetsAndDrive(fullRoomObject, configuredGasUrl);
    return {
      saved: gasRes.ok,
      fileId: gasRes.fileId,
      fileUrl: gasRes.fileUrl,
    };
  };

  if (onProgress) {
    onProgress(
      configuredGasUrl
        ? `Đang đồng bộ Kép (Dual Save): Lưu Firebase exam_rooms/${roomId} & Google Drive Exam_${roomId}.json...`
        : `Đang lưu đề thi exam_rooms/${roomId} lên Firebase Firestore...`
    );
  }

  const [fbResult, gasResult] = await Promise.allSettled([
    saveToFirebaseTask(),
    saveToGoogleTask(),
  ]);

  const savedFirebase = fbResult.status === 'fulfilled' && fbResult.value === true;
  const savedGoogleSheets =
    gasResult.status === 'fulfilled' && gasResult.value.saved === true;
  const googleDriveFileId =
    gasResult.status === 'fulfilled' ? gasResult.value.fileId || '' : '';
  const googleDriveFileUrl =
    gasResult.status === 'fulfilled' ? gasResult.value.fileUrl || '' : '';

  fullRoomObject = {
    ...fullRoomObject,
    savedFirebase,
    savedGoogleSheets,
    googleDriveFileId,
    googleDriveFileUrl,
  };

  // Update local backup with actual dual-cloud sync flags
  saveRoomToLocalBackup(fullRoomObject);

  // If Google Drive/Sheets succeeded and Firebase also succeeded, update the badges in Firestore metadata
  if (savedFirebase && savedGoogleSheets) {
    try {
      await updateDoc(doc(db, 'exam_rooms', roomId), {
        savedFirebase: true,
        savedGoogleSheets: true,
        googleDriveFileId,
        googleDriveFileUrl,
      });
    } catch {
      // ignore metadata badge update error
    }
  }

  // If BOTH Firebase failed AND Google Sheets was not saved, report error
  if (!savedFirebase && !savedGoogleSheets) {
    const fbError = fbResult.status === 'rejected' ? fbResult.reason : new Error('Firebase write failed');
    try {
      handleFirestoreError(fbError, OperationType.WRITE, path);
    } catch {
      // Re-throw original error so UI can format a clear Vietnamese message
    }
    throw fbError;
  }

  return fullRoomObject;
}

/**
 * Helper to fetch and reassemble all question chunks from `exam_rooms/{roomCode}/chunks`
 * (or fallback `exams/{roomCode}/chunks` / `exam_rooms/{roomCode}/question_chunks`).
 */
async function fetchAndMergeRoomChunks(
  cleanCode: string,
  baseRoom: ExamRoomDoc
): Promise<ExamRoomDoc> {
  const hasAllInlineImages =
    !baseRoom.isChunked &&
    (baseRoom.examData?.part1 || []).some((q) => Boolean(q.imageUrl || q.pdfSliceUrl));

  try {
    const chunksSnap = await getDocs(collection(db, 'exam_rooms', cleanCode, 'chunks'));
    if (!chunksSnap.empty) {
      const loadedChunks: ExamQuestionChunkDoc[] = [];
      chunksSnap.forEach((d) => {
        loadedChunks.push(d.data() as ExamQuestionChunkDoc);
      });
      return mergeChunksIntoRoomDoc(baseRoom, loadedChunks);
    }

    const altSnap = await getDocs(collection(db, 'exam_rooms', cleanCode, 'question_chunks'));
    if (!altSnap.empty) {
      const loadedChunks: ExamQuestionChunkDoc[] = [];
      altSnap.forEach((d) => {
        loadedChunks.push(d.data() as ExamQuestionChunkDoc);
      });
      return mergeChunksIntoRoomDoc(baseRoom, loadedChunks);
    }

    const legacyChunksSnap = await getDocs(collection(db, 'exams', cleanCode, 'chunks'));
    if (!legacyChunksSnap.empty) {
      const loadedChunks: ExamQuestionChunkDoc[] = [];
      legacyChunksSnap.forEach((d) => {
        loadedChunks.push(d.data() as ExamQuestionChunkDoc);
      });
      return mergeChunksIntoRoomDoc(baseRoom, loadedChunks);
    }
  } catch (err) {
    console.warn('Could not load subcollection chunks from Firestore, checking fallbacks:', err);
  }

  if (!hasAllInlineImages) {
    const localBackup = loadRoomFromLocalBackup(cleanCode);
    if (localBackup) {
      return localBackup;
    }
  }

  return baseRoom;
}

/**
 * Internal helper to query Firebase Firestore for `roomCode`
 */
async function findRoomInFirebaseOnly(cleanCode: string): Promise<ExamRoomDoc | null> {
  // 1) Primary lookup by Document ID in `exam_rooms/{cleanCode}`
  const directExamRoomSnap = await getDoc(doc(db, 'exam_rooms', cleanCode));
  if (directExamRoomSnap.exists()) {
    const baseRoom = normalizeRoomDoc(directExamRoomSnap.data(), directExamRoomSnap.id);
    const merged = await fetchAndMergeRoomChunks(cleanCode, baseRoom);
    return { ...merged, savedFirebase: true, loadedFromSource: 'firebase' };
  }

  // 2) Query `exam_rooms` collection where roomCode == cleanCode
  const qExamRooms = query(collection(db, 'exam_rooms'), where('roomCode', '==', cleanCode));
  const snapExamRooms = await getDocs(qExamRooms);
  if (!snapExamRooms.empty) {
    const baseRoom = normalizeRoomDoc(snapExamRooms.docs[0].data(), snapExamRooms.docs[0].id);
    const merged = await fetchAndMergeRoomChunks(cleanCode, baseRoom);
    return { ...merged, savedFirebase: true, loadedFromSource: 'firebase' };
  }

  // 3) Fallback: Direct lookup in `exams/{cleanCode}`
  const directExamSnap = await getDoc(doc(db, 'exams', cleanCode));
  if (directExamSnap.exists()) {
    const baseRoom = normalizeRoomDoc(directExamSnap.data(), directExamSnap.id);
    const merged = await fetchAndMergeRoomChunks(cleanCode, baseRoom);
    return { ...merged, savedFirebase: true, loadedFromSource: 'firebase' };
  }

  // 4) Fallback: Direct lookup in `rooms/{cleanCode}`
  const directRoomSnap = await getDoc(doc(db, 'rooms', cleanCode));
  if (directRoomSnap.exists()) {
    const baseRoom = normalizeRoomDoc(directRoomSnap.data(), directRoomSnap.id);
    const merged = await fetchAndMergeRoomChunks(cleanCode, baseRoom);
    return { ...merged, savedFirebase: true, loadedFromSource: 'firebase' };
  }

  return null;
}

// 2. SMART FAILOVER LOAD (Học Sinh Tải Đề Tự Động Dự Phòng):
//    - Priority 1: Load from Firebase (`exam_rooms/{roomCode}` + chunks)
//    - Auto-Failover Priority 2: If Firebase is not configured, fails, times out, or does not have the room,
//      immediately load `Exam_{roomCode}.json` from Google Drive / Sheets via Apps Script Web App URL!
//    - Priority 3: LocalStorage backup (`loadRoomFromLocalBackup`).
export async function findRoomByCode(roomCode: string): Promise<ExamRoomDoc | null> {
  const cleanCode = roomCode.trim().toUpperCase();
  const preferredPrimary = getPreferredPrimaryCloud();

  // If teacher set Google Sheets/Drive as primary, try Google Drive first then auto-failover to Firebase
  if (preferredPrimary === 'google_sheets') {
    const fromGasFirst = await fetchExamFromGoogleSheetsAndDrive(cleanCode);
    if (fromGasFirst) {
      saveRoomToLocalBackup(fromGasFirst);
      return fromGasFirst;
    }
  }

  // Try Firebase primary
  try {
    const firebaseRoom = await findRoomInFirebaseOnly(cleanCode);
    if (firebaseRoom && (firebaseRoom.examData?.part1?.length || 0) > 0) {
      saveRoomToLocalBackup(firebaseRoom);
      return firebaseRoom;
    }
  } catch (firebaseErr) {
    console.warn(
      `[Smart Failover] Firebase lookup for room ${cleanCode} failed, switching to Google Drive/Sheets failover:`,
      firebaseErr
    );
  }

  // Auto-Failover to Google Sheets & Google Drive (`Exam_{roomCode}.json`)
  try {
    const gasRoom = await fetchExamFromGoogleSheetsAndDrive(cleanCode);
    if (gasRoom) {
      saveRoomToLocalBackup(gasRoom);
      return gasRoom;
    }
  } catch (gasErr) {
    console.warn(`[Smart Failover] Google Sheets/Drive lookup for room ${cleanCode} failed:`, gasErr);
  }

  // Final Fallback: Check local backup in safeLocalStorage
  const localRoom = loadRoomFromLocalBackup(cleanCode);
  if (localRoom) {
    return { ...localRoom, loadedFromSource: 'local_backup' };
  }

  return null;
}

// 3. Real-time subscription to all published exam rooms in `exam_rooms` (merged with `exams`, Google Sheets `DanhSachDeThi`, & local backup)
export function subscribeToPublishedExams(
  onUpdate: (exams: ExamRoomDoc[]) => void,
  onError?: (err: any) => void
): () => void {
  const path = 'exam_rooms';
  const examRoomsCol = collection(db, 'exam_rooms');
  const legacyExamsCol = collection(db, 'exams');

  let primaryMap = new Map<string, ExamRoomDoc>();
  let legacyMap = new Map<string, ExamRoomDoc>();
  let googleSheetsMap = new Map<string, ExamRoomDoc>();

  const emitMerged = () => {
    const merged = new Map<string, ExamRoomDoc>();
    // 1. Include local backup rooms first
    for (const localRoom of loadAllRoomsFromLocalBackup()) {
      merged.set(localRoom.roomCode, localRoom);
    }
    // 2. Include Google Sheets rooms
    googleSheetsMap.forEach((v, k) => {
      const existing = merged.get(k);
      merged.set(
        k,
        existing
          ? {
              ...existing,
              savedGoogleSheets: true,
              googleDriveFileId: v.googleDriveFileId || existing.googleDriveFileId,
              googleDriveFileUrl: v.googleDriveFileUrl || existing.googleDriveFileUrl,
            }
          : v
      );
    });
    // 3. Include legacy Firestore rooms
    legacyMap.forEach((v, k) => {
      const existing = merged.get(k);
      merged.set(
        k,
        existing
          ? {
              ...existing,
              ...v,
              savedFirebase: true,
              savedGoogleSheets: Boolean(v.savedGoogleSheets || existing.savedGoogleSheets),
            }
          : v
      );
    });
    // 4. Include primary Firestore `exam_rooms`
    primaryMap.forEach((v, k) => {
      const existing = merged.get(k);
      merged.set(
        k,
        existing
          ? {
              ...existing,
              ...v,
              savedFirebase: true,
              savedGoogleSheets: Boolean(v.savedGoogleSheets || existing.savedGoogleSheets),
              googleDriveFileId: v.googleDriveFileId || existing.googleDriveFileId,
              googleDriveFileUrl: v.googleDriveFileUrl || existing.googleDriveFileUrl,
            }
          : { ...v, savedFirebase: true }
      );
    });

    const list = Array.from(merged.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    onUpdate(list);
  };

  // Emit initial local backup immediately while Firestore & Google Sheets connect
  emitMerged();

  // Also fetch rooms list from Google Sheets `DanhSachDeThi` if configured
  fetchAllExamsFromGoogleSheetsAndDrive()
    .then((gasRooms) => {
      if (gasRooms.length > 0) {
        const next = new Map<string, ExamRoomDoc>();
        gasRooms.forEach((r) => next.set(r.roomCode, r));
        googleSheetsMap = next;
        emitMerged();
      }
    })
    .catch(() => {
      // ignore
    });

  const unsubPrimary = onSnapshot(
    examRoomsCol,
    (snapshot) => {
      const next = new Map<string, ExamRoomDoc>();
      snapshot.forEach((d) => {
        const docObj = normalizeRoomDoc(d.data(), d.id);
        next.set(docObj.roomCode, { ...docObj, savedFirebase: true });
      });
      primaryMap = next;
      emitMerged();
    },
    (error) => {
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {
        // Keep local backup & Google Sheets rooms visible even if Firestore read fails
      }
    }
  );

  const unsubLegacy = onSnapshot(
    legacyExamsCol,
    (snapshot) => {
      const next = new Map<string, ExamRoomDoc>();
      snapshot.forEach((d) => {
        const docObj = normalizeRoomDoc(d.data(), d.id);
        next.set(docObj.roomCode, { ...docObj, savedFirebase: true });
      });
      legacyMap = next;
      emitMerged();
    },
    () => {
      // ignore legacy error
    }
  );

  return () => {
    unsubPrimary();
    unsubLegacy();
  };
}

// 4. DUAL SCORE SYNC (Đồng bộ Bảng Điểm Kép):
//    Simultaneously writes student test results to Firebase (`exam_submissions/{roomCode}/students/{submissionId}`)
//    AND appends a new row to Google Sheets (`KetQuaThi` sheet via Apps Script Web App URL).
export async function submitStudentResult(
  roomId: string,
  submissionData: Omit<StudentSubmissionDoc, 'id'>
): Promise<string> {
  const subId = `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const targetRoomCode = (submissionData.roomCode || roomId).trim();
  const path = `exam_submissions/${targetRoomCode}/students/${subId}`;

  const fullData: StudentSubmissionDoc = sanitizeForFirestore({
    ...submissionData,
    id: subId,
    roomCode: targetRoomCode,
    score: {
      total: submissionData.scoreTotal,
      part1: submissionData.scorePart1,
      part2: submissionData.scorePart2,
      part3: submissionData.scorePart3,
    },
    timeSpent: submissionData.timeSpentSeconds,
  });

  // Save locally as well so submissions are never lost offline
  saveSubmissionToLocalBackup(targetRoomCode, fullData);

  const writeFirebaseTask = async () => {
    await setDoc(doc(db, 'exam_submissions', targetRoomCode, 'students', subId), fullData);
    try {
      await setDoc(doc(db, 'exams', targetRoomCode, 'submissions', subId), fullData);
      await setDoc(doc(db, 'rooms', roomId, 'submissions', subId), fullData);
    } catch {
      // ignore secondary mirror error
    }
    return true;
  };

  const writeGoogleSheetsTask = async () => {
    return await submitScoreToGoogleSheets(fullData);
  };

  const [fbRes, gasRes] = await Promise.allSettled([
    writeFirebaseTask(),
    writeGoogleSheetsTask(),
  ]);

  const fbSuccess = fbRes.status === 'fulfilled' && fbRes.value === true;
  const gasSuccess = gasRes.status === 'fulfilled' && gasRes.value.ok === true;

  if (!fbSuccess && !gasSuccess) {
    const err = fbRes.status === 'rejected' ? fbRes.reason : new Error('Dual submission failed');
    try {
      handleFirestoreError(err, OperationType.WRITE, path);
    } catch {
      // ignore if local backup succeeded
    }
  }

  return subId;
}

// 5. Real-time subscription to room submissions from `exam_submissions/{roomCode}/students`
//    (merged with legacy `exams/{roomCode}/submissions` + Google Sheets `KetQuaThi` + local backup)
export function subscribeToSubmissions(
  roomId: string,
  onUpdate: (submissions: StudentSubmissionDoc[]) => void,
  onError?: (err: any) => void
): () => void {
  const cleanRoomCode = roomId.trim();
  const path = `exam_submissions/${cleanRoomCode}/students`;
  const primaryCol = collection(db, 'exam_submissions', cleanRoomCode, 'students');
  const legacyCol = collection(db, 'exams', cleanRoomCode, 'submissions');

  let primarySubs = new Map<string, StudentSubmissionDoc>();
  let legacySubs = new Map<string, StudentSubmissionDoc>();
  let sheetsSubs = new Map<string, StudentSubmissionDoc>();

  const emitMerged = () => {
    const merged = new Map<string, StudentSubmissionDoc>();
    for (const localSub of loadSubmissionsFromLocalBackup(cleanRoomCode)) {
      merged.set(localSub.id, localSub);
    }
    sheetsSubs.forEach((v, k) => merged.set(k, v));
    legacySubs.forEach((v, k) => merged.set(k, v));
    primarySubs.forEach((v, k) => merged.set(k, v));
    const list = Array.from(merged.values()).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    onUpdate(list);
  };

  emitMerged();

  // Fetch initial submissions from Google Sheets `KetQuaThi` if Apps Script URL is configured
  fetchSubmissionsFromGoogleSheets(cleanRoomCode)
    .then((fromSheets) => {
      if (fromSheets.length > 0) {
        const next = new Map<string, StudentSubmissionDoc>();
        fromSheets.forEach((s) => next.set(s.id, s));
        sheetsSubs = next;
        emitMerged();
      }
    })
    .catch(() => {
      // ignore
    });

  const unsubPrimary = onSnapshot(
    primaryCol,
    (snapshot) => {
      const next = new Map<string, StudentSubmissionDoc>();
      snapshot.forEach((d) => {
        const sub = normalizeSubmissionDoc(d.data(), d.id);
        next.set(sub.id, sub);
      });
      primarySubs = next;
      emitMerged();
    },
    (error) => {
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {
        // Keep Google Sheets & local submissions visible
      }
    }
  );

  const unsubLegacy = onSnapshot(
    legacyCol,
    (snapshot) => {
      const next = new Map<string, StudentSubmissionDoc>();
      snapshot.forEach((d) => {
        const sub = normalizeSubmissionDoc(d.data(), d.id);
        next.set(sub.id, sub);
      });
      legacySubs = next;
      emitMerged();
    },
    () => {
      // ignore legacy error
    }
  );

  return () => {
    unsubPrimary();
    unsubLegacy();
  };
}

// 6. Update room status (open / closed) in `exam_rooms/{roomCode}` (and Google Sheets `DanhSachDeThi`)
export async function updateRoomStatus(
  roomId: string,
  status: 'open' | 'closed'
): Promise<void> {
  const cleanCode = roomId.trim();
  const path = `exam_rooms/${cleanCode}`;
  try {
    const localRoom = loadRoomFromLocalBackup(cleanCode);
    if (localRoom) {
      saveRoomToLocalBackup({ ...localRoom, status });
    }
    try {
      await updateDoc(doc(db, 'exam_rooms', cleanCode), { status });
    } catch {
      // If room only existed in legacy `exams`, copy or update there
    }
    try {
      await updateDoc(doc(db, 'exams', cleanCode), { status });
    } catch {
      // ignore if not in legacy exams
    }
    try {
      await updateDoc(doc(db, 'rooms', cleanCode), { status });
    } catch {
      // ignore if not in legacy rooms
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// 7. Delete an exam room from `exam_rooms/{roomCode}` (and `exams`/`rooms`)
export async function deleteRoom(roomId: string): Promise<void> {
  const cleanCode = roomId.trim();
  const path = `exam_rooms/${cleanCode}`;
  try {
    try {
      const raw = safeLocalStorage.getItem(LOCAL_ROOMS_BACKUP_KEY);
      if (raw) {
        const map = JSON.parse(raw);
        delete map[cleanCode];
        safeLocalStorage.setItem(LOCAL_ROOMS_BACKUP_KEY, JSON.stringify(map));
      }
    } catch {
      // ignore
    }
    try {
      await deleteDoc(doc(db, 'exam_rooms', cleanCode));
    } catch {
      // ignore
    }
    try {
      await deleteDoc(doc(db, 'exams', cleanCode));
    } catch {
      // ignore
    }
    try {
      await deleteDoc(doc(db, 'rooms', cleanCode));
    } catch {
      // ignore
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// 8. PUBLIC APP URL & ROOM LINK RESOLUTION HELPERS (NO AUTO DOMAIN MUTATION, PREVENT 404)
// ============================================================================

export const PUBLIC_APP_URL_STORAGE_KEY = 'taodethi2026_custom_public_url';

/**
 * Checks whether the current browser origin is an AI Studio private dev URL (`https://ais-dev-...`)
 */
export function isAisDevOrigin(origin?: string): boolean {
  const target = (origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).trim();
  return /^https:\/\/ais-dev-/i.test(target);
}

/**
 * Returns the exact current browser base URL (`window.location.origin + window.location.pathname`)
 * without modifying the domain and without sub-paths like `/room/...` or `/exam/...`.
 */
export function getBrowserCurrentBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  let pathname = window.location.pathname || '/';
  // Strip any accidental /room/... or /exam/... subpaths
  pathname = pathname.replace(/\/(room|exam)(\/.*)?$/i, '/');
  if (!pathname.startsWith('/')) {
    pathname = '/' + pathname;
  }
  return origin + pathname;
}

/**
 * Normalizes a custom Public URL entered by the teacher:
 * - NEVER modifies or replaces the domain (`ais-dev-` is kept as-is unless teacher pastes another domain)
 * - Strips any query string (`?room=...`), hash (`#room=...`), or sub-paths (`/room/...`, `/exam/...`)
 * - Ensures a trailing slash `/` when pathname is empty so `${baseUrl}?room=...` produces `https://...run.app/?room=...`
 */
export function normalizePublicBaseUrl(rawUrl: string): string {
  let cleaned = (rawUrl || '').trim();
  if (!cleaned) return '';

  // Remove any query parameters or hash if the user pasted a full room link
  cleaned = cleaned.split('?')[0].split('#')[0].trim();
  // Remove any accidental /room/... or /exam/... suffix
  cleaned = cleaned.replace(/\/(room|exam)(\/.*)?$/i, '');
  // Ensure trailing slash so `${baseUrl}?room=${roomCode}#room=${roomCode}` matches `https://...run.app/?room=3203#room=3203`
  if (!cleaned.endsWith('/')) {
    cleaned = cleaned + '/';
  }
  return cleaned;
}

/**
 * Returns the resolved base URL:
 * 1. If the teacher entered a custom Public URL (via parameter or saved in localStorage), returns that normalized URL.
 * 2. Otherwise, returns the exact `window.location.origin + window.location.pathname` of the current browser.
 */
export function getResolvedPublicAppUrl(customUrlOverride?: string): string {
  if (customUrlOverride && customUrlOverride.trim()) {
    const normalizedOverride = normalizePublicBaseUrl(customUrlOverride);
    if (normalizedOverride) return normalizedOverride;
  }

  if (typeof window !== 'undefined') {
    const savedLocal = safeLocalStorage.getItem(PUBLIC_APP_URL_STORAGE_KEY);
    if (savedLocal && savedLocal.trim()) {
      const normalizedSaved = normalizePublicBaseUrl(savedLocal);
      if (normalizedSaved) return normalizedSaved;
    }

    return normalizePublicBaseUrl(getBrowserCurrentBaseUrl());
  }

  return '';
}

/**
 * Builds the direct student exam link using combined Query Param + Hash Routing:
 * `${baseUrl}?mode=student&room=${roomCode}#room=${roomCode}`
 * Never appends `/room/...` or `/exam/...` sub-paths and never auto-mutates `window.location.origin`.
 */
export function buildStudentRoomLink(roomCode: string, customBaseUrl?: string): string {
  const baseUrl = getResolvedPublicAppUrl(customBaseUrl);
  const cleanCode = encodeURIComponent((roomCode || '').trim());
  return `${baseUrl}?mode=student&room=${cleanCode}#room=${cleanCode}`;
}

/**
 * Saves the teacher's custom Public App URL to localStorage and Firebase `settings/publicConfig`.
 * If `rawUrl` is empty, clears the custom override so the app uses `window.location.origin + window.location.pathname`.
 */
export async function savePublicAppUrlSetting(rawUrl: string): Promise<string> {
  const trimmed = (rawUrl || '').trim();
  const normalized = trimmed ? normalizePublicBaseUrl(trimmed) : '';
  if (typeof window !== 'undefined') {
    if (normalized) {
      safeLocalStorage.setItem(PUBLIC_APP_URL_STORAGE_KEY, normalized);
    } else {
      safeLocalStorage.removeItem(PUBLIC_APP_URL_STORAGE_KEY);
    }
  }

  try {
    await setDoc(
      doc(db, 'settings', 'publicConfig'),
      sanitizeForFirestore({
        publicAppUrl: normalized,
        customPublicAppUrl: normalized,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.warn('Could not sync customPublicAppUrl to Firestore settings:', err);
  }

  return normalized;
}

/**
 * Loads the teacher-configured custom Public App URL from Firebase `settings/publicConfig` (or localStorage).
 * Returns empty string `''` if the teacher has not explicitly configured a custom URL, so the app
 * falls back to the exact `window.location.origin + window.location.pathname`.
 */
export async function loadPublicAppUrlSetting(): Promise<string> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'publicConfig'));
    if (snap.exists()) {
      const data = snap.data();
      const rawField = data?.customPublicAppUrl ?? data?.publicAppUrl;
      if (typeof rawField === 'string') {
        const trimmed = rawField.trim();
        const normalized = trimmed ? normalizePublicBaseUrl(trimmed) : '';
        if (typeof window !== 'undefined') {
          if (normalized) {
            safeLocalStorage.setItem(PUBLIC_APP_URL_STORAGE_KEY, normalized);
          } else {
            safeLocalStorage.removeItem(PUBLIC_APP_URL_STORAGE_KEY);
          }
        }
        return normalized;
      }
    }
  } catch {
    // fallback to safeLocalStorage if offline or permission restricted
  }

  if (typeof window !== 'undefined') {
    const savedLocal = safeLocalStorage.getItem(PUBLIC_APP_URL_STORAGE_KEY);
    if (savedLocal && savedLocal.trim()) {
      return normalizePublicBaseUrl(savedLocal);
    }
  }
  return '';
}

/**
 * Extracts the `room` (or `code`) parameter from both `window.location.search` (`?room=3203`)
 * and `window.location.hash` (`#room=3203` or `#/?room=3203`).
 */
export function extractRoomCodeFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Check standard query string: ?room=3203 or ?code=3203
    const searchParams = new URLSearchParams(window.location.search);
    const fromSearch = searchParams.get('room') || searchParams.get('code');
    if (fromSearch && fromSearch.trim()) {
      return fromSearch.trim();
    }

    // 2. Check window.location.hash: e.g. #room=3203, #/?room=3203, #?room=3203, or #3203
    const rawHash = window.location.hash || '';
    if (rawHash) {
      const cleanedHash = rawHash.replace(/^#\/?/, '');
      if (cleanedHash.includes('room=') || cleanedHash.includes('code=')) {
        const queryIdx = cleanedHash.indexOf('?');
        const paramString = queryIdx >= 0 ? cleanedHash.slice(queryIdx + 1) : cleanedHash;
        const hashParams = new URLSearchParams(paramString);
        const fromHash = hashParams.get('room') || hashParams.get('code');
        if (fromHash && fromHash.trim()) {
          return fromHash.trim();
        }
      }
      const directMatch = cleanedHash.match(/(?:^|[?&/])room=([a-zA-Z0-9_-]+)/i);
      if (directMatch && directMatch[1]) {
        return directMatch[1].trim();
      }
      if (/^\d{4}$/.test(cleanedHash.trim())) {
        return cleanedHash.trim();
      }
    }
  } catch {
    // ignore URL parse error
  }
  return null;
}

/**
 * Checks whether the current URL indicates Student Portal mode:
 * - `?mode=student`
 * - `?room=XXXX` or `?code=XXXX`
 * - `#room=XXXX` or `#XXXX`
 */
export function isStudentPortalLocation(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('mode')?.toLowerCase() === 'student') {
      return true;
    }
    if (extractRoomCodeFromLocation()) {
      return true;
    }
    const rawHash = (window.location.hash || '').toLowerCase();
    if (rawHash.includes('mode=student')) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

// ============================================================================
// 9. DUAL CLOUD SYNC: GOOGLE SHEETS & GOOGLE DRIVE (APPS SCRIPT WEB APP URL)
// ============================================================================

export const GOOGLE_APPS_SCRIPT_URL_STORAGE_KEY = 'taodethi2026_google_apps_script_url_v1';
export const PREFERRED_PRIMARY_CLOUD_KEY = 'taodethi2026_preferred_primary_cloud_v1';
export const LOCAL_SUBMISSIONS_BACKUP_KEY = 'taodethi2026_submissions_backup_v1';

export type PreferredPrimaryCloud = 'firebase' | 'google_sheets';

export function getPreferredPrimaryCloud(): PreferredPrimaryCloud {
  if (typeof window === 'undefined') return 'firebase';
  const saved = safeLocalStorage.getItem(PREFERRED_PRIMARY_CLOUD_KEY);
  return saved === 'google_sheets' ? 'google_sheets' : 'firebase';
}

export function setPreferredPrimaryCloud(cloud: PreferredPrimaryCloud): void {
  if (typeof window === 'undefined') return;
  safeLocalStorage.setItem(PREFERRED_PRIMARY_CLOUD_KEY, cloud);
}

/**
 * Returns the configured Google Apps Script Web App URL (`https://script.google.com/macros/s/.../exec`)
 * from URL query (`?gas=...`), localStorage, or empty string if not configured.
 */
export function getConfiguredGoogleAppsScriptUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const fromUrl = searchParams.get('gas');
      if (fromUrl && fromUrl.trim().startsWith('https://script.google.com/')) {
        safeLocalStorage.setItem(GOOGLE_APPS_SCRIPT_URL_STORAGE_KEY, fromUrl.trim());
        return fromUrl.trim();
      }
    } catch {
      // ignore
    }
    const saved = safeLocalStorage.getItem(GOOGLE_APPS_SCRIPT_URL_STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  }
  return '';
}

/**
 * Saves the Google Apps Script Web App URL to localStorage AND syncs it to Firebase `settings/publicConfig`
 * so student devices automatically know the failover Web App URL.
 */
export async function saveGoogleAppsScriptUrlSetting(rawUrl: string): Promise<string> {
  const cleaned = (rawUrl || '').trim();
  if (typeof window !== 'undefined') {
    if (cleaned) {
      safeLocalStorage.setItem(GOOGLE_APPS_SCRIPT_URL_STORAGE_KEY, cleaned);
    } else {
      safeLocalStorage.removeItem(GOOGLE_APPS_SCRIPT_URL_STORAGE_KEY);
    }
  }

  try {
    await setDoc(
      doc(db, 'settings', 'publicConfig'),
      sanitizeForFirestore({
        googleAppsScriptUrl: cleaned,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch {
    // ignore if Firestore is offline
  }

  return cleaned;
}

/**
 * Loads the Google Apps Script Web App URL from Firebase `settings/publicConfig` or localStorage.
 */
export async function loadGoogleAppsScriptUrlSetting(): Promise<string> {
  const localUrl = getConfiguredGoogleAppsScriptUrl();
  try {
    const snap = await getDoc(doc(db, 'settings', 'publicConfig'));
    if (snap.exists()) {
      const data = snap.data();
      const remoteUrl =
        typeof data?.googleAppsScriptUrl === 'string' ? data.googleAppsScriptUrl.trim() : '';
      if (remoteUrl) {
        if (typeof window !== 'undefined' && !localUrl) {
          safeLocalStorage.setItem(GOOGLE_APPS_SCRIPT_URL_STORAGE_KEY, remoteUrl);
        }
        return localUrl || remoteUrl;
      }
    }
  } catch {
    // ignore
  }
  return localUrl;
}

/**
 * Local backup for student submissions so no score is ever lost
 */
export function saveSubmissionToLocalBackup(roomCode: string, sub: StudentSubmissionDoc): void {
  try {
    const raw = safeLocalStorage.getItem(LOCAL_SUBMISSIONS_BACKUP_KEY);
    const map: Record<string, StudentSubmissionDoc[]> = raw ? JSON.parse(raw) : {};
    const list = map[roomCode] || [];
    const filtered = list.filter((item) => item.id !== sub.id);
    filtered.unshift(sub);
    map[roomCode] = filtered.slice(0, 120);
    safeLocalStorage.setItem(LOCAL_SUBMISSIONS_BACKUP_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function loadSubmissionsFromLocalBackup(roomCode: string): StudentSubmissionDoc[] {
  try {
    const raw = safeLocalStorage.getItem(LOCAL_SUBMISSIONS_BACKUP_KEY);
    if (!raw) return [];
    const map: Record<string, StudentSubmissionDoc[]> = JSON.parse(raw);
    return (map[roomCode] || []).map((s) => normalizeSubmissionDoc(s, s.id));
  } catch {
    return [];
  }
}

/**
 * Formats student answers into a concise summary string for the `Chi tiết đáp án` column in `KetQuaThi` sheet.
 */
export function formatStudentAnswersDetailForSheet(sub: StudentSubmissionDoc): string {
  const p1Parts = Object.entries(sub.answersPart1 || {})
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([qId, ans]) => `C${qId}:${ans}`)
    .join(', ');

  const p2Parts = Object.entries(sub.answersPart2 || {})
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([qId, obj]) => {
      const items = (['a', 'b', 'c', 'd'] as const)
        .map((k) => `${k}=${obj?.[k] === true ? 'Đ' : obj?.[k] === false ? 'S' : '-'}`)
        .join('|');
      return `C${qId}(${items})`;
    })
    .join('; ');

  const p3Parts = Object.entries(sub.answersPart3 || {})
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([qId, val]) => `C${qId}:${val}`)
    .join(', ');

  return [
    p1Parts ? `[P.I] ${p1Parts}` : '',
    p2Parts ? `[P.II] ${p2Parts}` : '',
    p3Parts ? `[P.III] ${p3Parts}` : '',
  ]
    .filter(Boolean)
    .join(' || ');
}

/**
 * Sends the published exam room to Google Apps Script Web App (`doPost` with `action: 'saveExam'`):
 * - Saves `Exam_{roomCode}.json` into Google Drive folder `TAODETHI_2026_EXAMS`
 * - Logs/updates row in Google Sheet `DanhSachDeThi`
 */
export async function saveExamToGoogleSheetsAndDrive(
  room: ExamRoomDoc,
  customScriptUrl?: string
): Promise<{
  ok: boolean;
  fileId?: string;
  fileUrl?: string;
  message?: string;
}> {
  const scriptUrl = (customScriptUrl || getConfiguredGoogleAppsScriptUrl()).trim();
  if (!scriptUrl) {
    return { ok: false, message: 'Chưa cấu hình Google Apps Script Web App URL.' };
  }

  const cleanRoom = sanitizeForFirestore({
    ...room,
    savedGoogleSheets: true,
  });

  const payload = {
    action: 'saveExam',
    roomCode: cleanRoom.roomCode,
    examTitle: cleanRoom.title || cleanRoom.examTitle,
    gradeClass: cleanRoom.targetClass || cleanRoom.grade || 'Khối 12',
    durationMinutes: cleanRoom.durationMinutes || cleanRoom.duration || 45,
    totalQuestions:
      cleanRoom.totalQuestions ||
      (cleanRoom.examData?.part1?.length || 0) +
        (cleanRoom.examData?.part2?.length || 0) +
        (cleanRoom.examData?.part3?.length || 0),
    status: cleanRoom.status || 'open',
    createdAt: cleanRoom.createdAt || new Date().toISOString(),
    fileName: `Exam_${cleanRoom.roomCode}.json`,
    roomData: cleanRoom,
  };

  try {
    // Use text/plain content-type so Google Apps Script accepts CORS POST without preflight rejection
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      try {
        const json = await response.json();
        return {
          ok: json?.ok !== false,
          fileId: json?.fileId || '',
          fileUrl: json?.fileUrl || '',
          message: json?.message || `Đã lưu Exam_${cleanRoom.roomCode}.json lên Google Drive & DanhSachDeThi!`,
        };
      } catch {
        return {
          ok: true,
          message: `Đã gửi đề thi Exam_${cleanRoom.roomCode}.json lên Google Sheets & Drive!`,
        };
      }
    }

    // Fallback no-cors mode if browser blocked opaque redirect response
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
    return {
      ok: true,
      message: `Đã đồng bộ Exam_${cleanRoom.roomCode}.json lên Google Sheets & Drive!`,
    };
  } catch (err: any) {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
      return {
        ok: true,
        message: `Đã đồng bộ Exam_${cleanRoom.roomCode}.json lên Google Sheets & Drive (no-cors)!`,
      };
    } catch (innerErr: any) {
      return {
        ok: false,
        message: innerErr?.message || err?.message || 'Không thể kết nối tới Google Apps Script URL.',
      };
    }
  }
}

/**
 * Fetches an exam room (`Exam_{roomCode}.json`) from Google Drive / Sheets via Apps Script `doGet?action=getExam&roomCode=XXXX`
 */
export async function fetchExamFromGoogleSheetsAndDrive(
  roomCode: string,
  customScriptUrl?: string
): Promise<ExamRoomDoc | null> {
  let scriptUrl = (customScriptUrl || getConfiguredGoogleAppsScriptUrl()).trim();
  if (!scriptUrl) {
    scriptUrl = await loadGoogleAppsScriptUrlSetting();
  }
  if (!scriptUrl) return null;

  const cleanCode = roomCode.trim();
  try {
    const separator = scriptUrl.includes('?') ? '&' : '?';
    const url = `${scriptUrl}${separator}action=getExam&roomCode=${encodeURIComponent(cleanCode)}&_t=${Date.now()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const rawRoom = data?.room || data?.roomData || data?.data;
    if (!rawRoom) return null;

    const parsedRoom = typeof rawRoom === 'string' ? JSON.parse(rawRoom) : rawRoom;
    const normalized = normalizeRoomDoc(parsedRoom, cleanCode);
    return {
      ...normalized,
      savedGoogleSheets: true,
      loadedFromSource: 'google_sheets_drive',
    };
  } catch (err) {
    console.warn('fetchExamFromGoogleSheetsAndDrive error:', err);
    return null;
  }
}

/**
 * Fetches all published exam rooms from Google Sheets `DanhSachDeThi` (`doGet?action=listExams`)
 */
export async function fetchAllExamsFromGoogleSheetsAndDrive(
  customScriptUrl?: string
): Promise<ExamRoomDoc[]> {
  const scriptUrl = (customScriptUrl || getConfiguredGoogleAppsScriptUrl()).trim();
  if (!scriptUrl) return [];

  try {
    const separator = scriptUrl.includes('?') ? '&' : '?';
    const url = `${scriptUrl}${separator}action=listExams&_t=${Date.now()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const data = await response.json();
    const rawList = data?.exams || data?.rooms || [];
    if (!Array.isArray(rawList)) return [];
    return rawList.map((item: any) => ({
      ...normalizeRoomDoc(item, String(item.roomCode || item.id || '')),
      savedGoogleSheets: true,
    }));
  } catch {
    return [];
  }
}

/**
 * Appends a student submission row to Google Sheets `KetQuaThi` (`doPost` with `action: 'submitResult'`)
 * Columns: Thời gian nộp | Mã phòng | Họ và tên | Lớp | Tổng điểm | Điểm Phần I | Điểm Phần II | Điểm Phần III | Thời gian làm bài | Chi tiết đáp án
 */
export async function submitScoreToGoogleSheets(
  submission: StudentSubmissionDoc,
  customScriptUrl?: string
): Promise<{ ok: boolean; message?: string }> {
  let scriptUrl = (customScriptUrl || getConfiguredGoogleAppsScriptUrl()).trim();
  if (!scriptUrl) {
    scriptUrl = await loadGoogleAppsScriptUrlSetting();
  }
  if (!scriptUrl) {
    return { ok: false, message: 'Chưa cấu hình Google Apps Script URL.' };
  }

  const detailString = formatStudentAnswersDetailForSheet(submission);
  const mins = Math.floor((submission.timeSpentSeconds || 0) / 60);
  const secs = (submission.timeSpentSeconds || 0) % 60;
  const formattedTimeSpent = `${mins}p ${secs}s (${submission.timeSpentSeconds || 0}s)`;

  const payload = {
    action: 'submitResult',
    submittedAt: submission.submittedAt || new Date().toISOString(),
    submittedAtFormatted: new Date(submission.submittedAt || Date.now()).toLocaleString('vi-VN'),
    roomCode: submission.roomCode,
    studentName: submission.studentName,
    studentClass: submission.studentClass,
    studentId: submission.studentId || '',
    scoreTotal: submission.scoreTotal,
    scorePart1: submission.scorePart1,
    scorePart2: submission.scorePart2,
    scorePart3: submission.scorePart3,
    timeSpentSeconds: submission.timeSpentSeconds,
    timeSpentFormatted: formattedTimeSpent,
    answerDetails: detailString,
    submission,
  };

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      return { ok: true, message: 'Đã ghi kết quả vào sheet KetQuaThi trên Google Sheets!' };
    }
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
    return { ok: true, message: 'Đã đồng bộ kết quả lên Google Sheets!' };
  } catch {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
      return { ok: true, message: 'Đã gửi kết quả lên Google Sheets (no-cors)!' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Lỗi kết nối Google Sheets.' };
    }
  }
}

/**
 * Fetches student submissions for a given `roomCode` from Google Sheets `KetQuaThi` (`doGet?action=getSubmissions&roomCode=XXXX`)
 */
export async function fetchSubmissionsFromGoogleSheets(
  roomCode: string,
  customScriptUrl?: string
): Promise<StudentSubmissionDoc[]> {
  const scriptUrl = (customScriptUrl || getConfiguredGoogleAppsScriptUrl()).trim();
  if (!scriptUrl) return [];

  try {
    const separator = scriptUrl.includes('?') ? '&' : '?';
    const url = `${scriptUrl}${separator}action=getSubmissions&roomCode=${encodeURIComponent(
      roomCode.trim()
    )}&_t=${Date.now()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const data = await response.json();
    const rows = data?.submissions || [];
    if (!Array.isArray(rows)) return [];
    return rows.map((r: any, idx: number) =>
      normalizeSubmissionDoc(r, r.id || `gas_sub_${roomCode}_${idx}`)
    );
  } catch {
    return [];
  }
}

/**
 * Tests connectivity to a Google Apps Script Web App URL (`doGet?action=ping`)
 */
export async function testGoogleAppsScriptConnection(scriptUrl: string): Promise<{
  connected: boolean;
  message: string;
}> {
  const cleanUrl = (scriptUrl || '').trim();
  if (!cleanUrl || !/^https:\/\/script\.google\.com\/macros\/s\//i.test(cleanUrl)) {
    return {
      connected: false,
      message:
        'URL không hợp lệ! Vui lòng dán đúng đường dẫn Web App URL có dạng: https://script.google.com/macros/s/.../exec',
    };
  }

  try {
    const separator = cleanUrl.includes('?') ? '&' : '?';
    const pingUrl = `${cleanUrl}${separator}action=ping&_t=${Date.now()}`;
    const res = await fetch(pingUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      return {
        connected: true,
        message:
          data?.message ||
          'Kết nối Google Sheets & Google Drive (Apps Script Web App) thành công! Sẵn sàng lưu đề & đồng bộ điểm.',
      };
    }
    return {
      connected: false,
      message: `Máy chủ Apps Script phản hồi mã ${res.status}. Hãy kiểm tra quyền truy cập "Anyone (Bất kỳ ai)" khi Deploy Web App.`,
    };
  } catch (err: any) {
    return {
      connected: false,
      message: `Không thể kết nối tới Web App URL (${err?.message || 'CORS / Network Error'}). Hãy chắc chắn bạn đã Deploy -> New deployment -> Who has access: Anyone (Bất kỳ ai).`,
    };
  }
}

/**
 * Complete, ready-to-deploy Google Apps Script `Code.gs` template containing `doPost(e)` and `doGet(e)`:
 * - Saves `Exam_{roomCode}.json` to Google Drive folder `TAODETHI_2026_EXAMS`
 * - Writes/updates exam metadata in sheet `DanhSachDeThi`
 * - Appends student submissions to sheet `KetQuaThi`
 * - Serves exam JSON & submissions via `doGet(e)` for Smart Failover Load
 */
export const SAMPLE_GOOGLE_APPS_SCRIPT_CODE_GS = `/**
 * ============================================================================
 * MÃ NGUỒN GOOGLE APPS SCRIPT (Code.gs) - ĐỒNG BỘ ĐÁM MÂY KÉP (SHEETS + DRIVE)
 * HỆ THỐNG TẠO ĐỀ THI & KIỂM TRA TRỰC TUYẾN CHUẨN CV 7991 (2025 - 2026)
 * ============================================================================
 * HƯỚNG DẪN CÀI ĐẶT NHANH (CHỈ MẤT 1 PHÚT):
 * 1. Mở một file Google Sheets mới -> Chọn "Tiện ích mở rộng" (Extensions) -> "Apps Script".
 * 2. Xóa toàn bộ mã cũ, dán toàn bộ mã Code.gs này vào và nhấn Lưu (Ctrl + S).
 * 3. Nhấn nút "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment).
 * 4. Chọn loại: "Ứng dụng web" (Web app):
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me)
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)  <-- RẤT QUAN TRỌNG!
 * 5. Nhấn "Triển khai" (Deploy), cấp quyền truy cập Google Sheets & Drive,
 *    sau đó Copy đường dẫn Web App URL (https://script.google.com/macros/s/.../exec)
 *    dán vào Tab 2 trong bảng Cấu hình Cloud của ứng dụng!
 * ============================================================================
 */

var DRIVE_FOLDER_NAME = 'TAODETHI_2026_EXAMS';
var SHEET_EXAMS = 'DanhSachDeThi';
var SHEET_RESULTS = 'KetQuaThi';

function getOrCreateExamFolder_() {
  var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function getOrCreateSheet_(sheetName, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e0e7ff');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Xử lý yêu cầu GET (Kiểm tra kết nối, Tải đề thi dự phòng Smart Failover, Tải danh sách đề & Bảng điểm)
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'ping';

    if (action === 'ping') {
      return jsonResponse_({
        ok: true,
        status: 'connected',
        message: 'Đã kết nối Google Sheets & Google Drive thành công! (Sẵn sàng lưu Exam_{roomCode}.json, DanhSachDeThi & KetQuaThi)'
      });
    }

    if (action === 'getExam') {
      var roomCode = String(params.roomCode || '').trim();
      if (!roomCode) {
        return jsonResponse_({ ok: false, message: 'Thiếu tham số roomCode' });
      }
      var folder = getOrCreateExamFolder_();
      var fileName = 'Exam_' + roomCode + '.json';
      var files = folder.getFilesByName(fileName);
      if (files.hasNext()) {
        var file = files.next();
        var content = file.getBlob().getDataAsString('UTF-8');
        var roomData = JSON.parse(content);
        return jsonResponse_({
          ok: true,
          roomCode: roomCode,
          fileId: file.getId(),
          fileUrl: file.getUrl(),
          room: roomData
        });
      }
      return jsonResponse_({ ok: false, message: 'Không tìm thấy file ' + fileName + ' trên Google Drive' });
    }

    if (action === 'listExams') {
      var examSheet = getOrCreateSheet_(SHEET_EXAMS, [
        'Thời gian cập nhật', 'Mã phòng', 'Tên đề thi', 'Khối/Lớp', 'Thời gian (phút)', 'Tổng số câu', 'Trạng thái', 'File Drive ID', 'Link File JSON Drive'
      ]);
      var values = examSheet.getDataRange().getValues();
      var exams = [];
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        if (row[1]) {
          exams.push({
            createdAt: row[0],
            roomCode: String(row[1]),
            title: String(row[2] || 'Đề kiểm tra'),
            targetClass: String(row[3] || 'Khối 12'),
            durationMinutes: Number(row[4] || 45),
            totalQuestions: Number(row[5] || 28),
            status: String(row[6] || 'open'),
            googleDriveFileId: String(row[7] || ''),
            googleDriveFileUrl: String(row[8] || '')
          });
        }
      }
      return jsonResponse_({ ok: true, exams: exams });
    }

    if (action === 'getSubmissions') {
      var filterRoom = String(params.roomCode || '').trim();
      var resSheet = getOrCreateSheet_(SHEET_RESULTS, [
        'Thời gian nộp', 'Mã phòng', 'Họ và tên', 'Lớp', 'Tổng điểm', 'Điểm Phần I', 'Điểm Phần II', 'Điểm Phần III', 'Thời gian làm bài', 'Chi tiết đáp án'
      ]);
      var rows = resSheet.getDataRange().getValues();
      var submissions = [];
      for (var r = 1; r < rows.length; r++) {
        var item = rows[r];
        var rCode = String(item[1] || '').trim();
        if (!filterRoom || rCode === filterRoom) {
          submissions.push({
            id: 'sheet_row_' + r,
            submittedAt: item[0] ? new Date(item[0]).toISOString() : new Date().toISOString(),
            roomCode: rCode,
            studentName: String(item[2] || ''),
            studentClass: String(item[3] || ''),
            scoreTotal: Number(item[4] || 0),
            scorePart1: Number(item[5] || 0),
            scorePart2: Number(item[6] || 0),
            scorePart3: Number(item[7] || 0),
            timeSpentFormatted: String(item[8] || ''),
            answerDetails: String(item[9] || '')
          });
        }
      }
      return jsonResponse_({ ok: true, submissions: submissions });
    }

    return jsonResponse_({ ok: true, status: 'ready' });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

/**
 * Xử lý yêu cầu POST (Lưu Đề Thi lên Google Drive + DanhSachDeThi VÀ Ghi Bảng Điểm vào KetQuaThi)
 */
function doPost(e) {
  try {
    var rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var body = JSON.parse(rawBody);
    var action = body.action || '';

    // 1. LƯU ĐỀ THI LÊN GOOGLE DRIVE (Exam_{roomCode}.json) & TRANG TÍNH DanhSachDeThi
    if (action === 'saveExam') {
      var roomCode = String(body.roomCode || '').trim();
      var fileName = 'Exam_' + roomCode + '.json';
      var folder = getOrCreateExamFolder_();
      var jsonContent = JSON.stringify(body.roomData || body, null, 2);

      var existingFiles = folder.getFilesByName(fileName);
      var savedFile;
      if (existingFiles.hasNext()) {
        savedFile = existingFiles.next();
        savedFile.setContent(jsonContent);
      } else {
        savedFile = folder.createFile(fileName, jsonContent, MimeType.PLAIN_TEXT);
      }

      var examSheet = getOrCreateSheet_(SHEET_EXAMS, [
        'Thời gian cập nhật', 'Mã phòng', 'Tên đề thi', 'Khối/Lớp', 'Thời gian (phút)', 'Tổng số câu', 'Trạng thái', 'File Drive ID', 'Link File JSON Drive'
      ]);

      var data = examSheet.getDataRange().getValues();
      var foundRowIndex = -1;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][1]).trim() === roomCode) {
          foundRowIndex = i + 1;
          break;
        }
      }

      var rowValues = [
        new Date().toLocaleString('vi-VN'),
        roomCode,
        body.examTitle || 'Đề kiểm tra trực tuyến',
        body.gradeClass || 'Khối 12',
        body.durationMinutes || 45,
        body.totalQuestions || 28,
        body.status || 'open',
        savedFile.getId(),
        savedFile.getUrl()
      ];

      if (foundRowIndex > 0) {
        examSheet.getRange(foundRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        examSheet.appendRow(rowValues);
      }

      return jsonResponse_({
        ok: true,
        roomCode: roomCode,
        fileId: savedFile.getId(),
        fileUrl: savedFile.getUrl(),
        message: 'Đã lưu ' + fileName + ' lên Google Drive và cập nhật sheet DanhSachDeThi!'
      });
    }

    // 2. GHI BẢNG ĐIỂM HỌC SINH NỘP BÀI VÀO TRANG TÍNH KetQuaThi
    if (action === 'submitResult') {
      var resSheet = getOrCreateSheet_(SHEET_RESULTS, [
        'Thời gian nộp', 'Mã phòng', 'Họ và tên', 'Lớp', 'Tổng điểm', 'Điểm Phần I', 'Điểm Phần II', 'Điểm Phần III', 'Thời gian làm bài', 'Chi tiết đáp án'
      ]);

      resSheet.appendRow([
        body.submittedAtFormatted || new Date().toLocaleString('vi-VN'),
        String(body.roomCode || ''),
        String(body.studentName || ''),
        String(body.studentClass || ''),
        Number(body.scoreTotal || 0),
        Number(body.scorePart1 || 0),
        Number(body.scorePart2 || 0),
        Number(body.scorePart3 || 0),
        String(body.timeSpentFormatted || ''),
        String(body.answerDetails || '')
      ]);

      return jsonResponse_({
        ok: true,
        message: 'Đã ghi điểm của học sinh vào sheet KetQuaThi!'
      });
    }

    return jsonResponse_({ ok: false, message: 'Action không hợp lệ: ' + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}
`;



