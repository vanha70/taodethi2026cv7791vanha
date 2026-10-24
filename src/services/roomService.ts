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
import { ExamData, Part1Question, Part2Question, Part3Question } from '../types/exam';
import { safeLocalStorage } from '../utils/browserSafeguards';

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
  part1?: Part1Question[];
  part2?: Part2Question[];
  part3?: Part3Question[];
  examData: ExamData;
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

// Recursively remove undefined fields so Firestore setDoc() never fails on optional properties
function sanitizeForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        cleaned[k] = sanitizeForFirestore(v);
      }
    }
    return cleaned as T;
  }
  return value;
}

/**
 * Normalize an ExamRoomDoc loaded from `exam_rooms`, `exams`, or `rooms`
 */
function normalizeRoomDoc(raw: any, docId: string): ExamRoomDoc {
  const roomCode = String(raw.roomCode || docId || '').trim();
  const resolvedTitle = raw.examTitle || raw.title || raw.examData?.metadata?.examTitle || 'Đề kiểm tra trực tuyến';
  const resolvedClass = raw.gradeClass || raw.targetClass || raw.grade || raw.examData?.metadata?.grade || 'Khối 12';
  const resolvedDuration = Number(raw.duration || raw.durationMinutes || raw.examData?.metadata?.durationMinutes || 45);
  return {
    ...raw,
    id: roomCode || docId,
    roomCode,
    examCode: raw.examCode || roomCode,
    examTitle: resolvedTitle,
    title: resolvedTitle,
    subject: raw.subject || raw.examData?.metadata?.subject || 'Hóa học',
    grade: resolvedClass,
    gradeClass: resolvedClass,
    targetClass: resolvedClass,
    duration: resolvedDuration,
    durationMinutes: resolvedDuration,
    status: raw.status === 'closed' ? 'closed' : 'open',
    teacherName: raw.teacherName || 'Giáo viên',
    allowReview: raw.allowReview !== undefined ? Boolean(raw.allowReview) : true,
    createdAt: raw.createdAt || new Date().toISOString(),
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

// 1. Publish / Create a new exam room in Firebase collection `exam_rooms/{roomCode}` (and mirror to `exams/{roomCode}`)
export async function createExamRoom(
  exam: ExamData,
  durationMinutes: number,
  teacherName: string = 'Thầy: Nguyễn Văn Hà',
  allowReview: boolean = true,
  customRoomCode?: string,
  targetClass?: string
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

  const updatedExam: ExamData = {
    ...exam,
    metadata: {
      ...exam.metadata,
      examCode: roomCode,
      grade: resolvedClass,
      durationMinutes: resolvedDuration,
    },
  };

  const roomData: ExamRoomDoc = sanitizeForFirestore({
    id: roomId,
    roomCode,
    examCode: roomCode,
    examTitle: resolvedTitle,
    title: resolvedTitle,
    subject: exam.metadata.subject || 'Hóa học',
    grade: resolvedClass,
    gradeClass: resolvedClass,
    targetClass: resolvedClass,
    duration: resolvedDuration,
    durationMinutes: resolvedDuration,
    status: 'open',
    teacherName: teacherName || 'Giáo viên',
    allowReview: Boolean(allowReview),
    createdAt: new Date().toISOString(),
    part1: updatedExam.part1,
    part2: updatedExam.part2,
    part3: updatedExam.part3,
    examData: updatedExam,
  });

  try {
    // Primary standardized path: `exam_rooms/{roomCode}`
    await setDoc(doc(db, 'exam_rooms', roomId), roomData);
    // Also mirror to `exams/{roomCode}` and `rooms/{roomCode}` for backward compatibility
    try {
      await setDoc(doc(db, 'exams', roomId), roomData);
      await setDoc(doc(db, 'rooms', roomId), roomData);
    } catch {
      // ignore secondary mirror errors
    }
    return roomData;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 2. Find published exam / room by 4-digit roomCode (checks `exam_rooms/{roomCode}` first, then `exams` and `rooms`)
export async function findRoomByCode(roomCode: string): Promise<ExamRoomDoc | null> {
  const cleanCode = roomCode.trim().toUpperCase();
  const path = `exam_rooms/${cleanCode}`;

  try {
    // 1) Primary lookup by Document ID in `exam_rooms/{cleanCode}`
    const directExamRoomSnap = await getDoc(doc(db, 'exam_rooms', cleanCode));
    if (directExamRoomSnap.exists()) {
      return normalizeRoomDoc(directExamRoomSnap.data(), directExamRoomSnap.id);
    }

    // 2) Query `exam_rooms` collection where roomCode == cleanCode
    const qExamRooms = query(collection(db, 'exam_rooms'), where('roomCode', '==', cleanCode));
    const snapExamRooms = await getDocs(qExamRooms);
    if (!snapExamRooms.empty) {
      return normalizeRoomDoc(snapExamRooms.docs[0].data(), snapExamRooms.docs[0].id);
    }

    // 3) Fallback: Direct lookup in `exams/{cleanCode}`
    const directExamSnap = await getDoc(doc(db, 'exams', cleanCode));
    if (directExamSnap.exists()) {
      return normalizeRoomDoc(directExamSnap.data(), directExamSnap.id);
    }

    // 4) Fallback: Direct lookup in `rooms/{cleanCode}`
    const directRoomSnap = await getDoc(doc(db, 'rooms', cleanCode));
    if (directRoomSnap.exists()) {
      return normalizeRoomDoc(directRoomSnap.data(), directRoomSnap.id);
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// 3. Real-time subscription to all published exam rooms in `exam_rooms` (merged with `exams` for backward compatibility)
export function subscribeToPublishedExams(
  onUpdate: (exams: ExamRoomDoc[]) => void,
  onError?: (err: any) => void
): () => void {
  const path = 'exam_rooms';
  const examRoomsCol = collection(db, 'exam_rooms');
  const legacyExamsCol = collection(db, 'exams');

  let primaryMap = new Map<string, ExamRoomDoc>();
  let legacyMap = new Map<string, ExamRoomDoc>();

  const emitMerged = () => {
    const merged = new Map<string, ExamRoomDoc>();
    legacyMap.forEach((v, k) => merged.set(k, v));
    primaryMap.forEach((v, k) => merged.set(k, v));
    const list = Array.from(merged.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    onUpdate(list);
  };

  const unsubPrimary = onSnapshot(
    examRoomsCol,
    (snapshot) => {
      const next = new Map<string, ExamRoomDoc>();
      snapshot.forEach((d) => {
        const docObj = normalizeRoomDoc(d.data(), d.id);
        next.set(docObj.roomCode, docObj);
      });
      primaryMap = next;
      emitMerged();
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  const unsubLegacy = onSnapshot(
    legacyExamsCol,
    (snapshot) => {
      const next = new Map<string, ExamRoomDoc>();
      snapshot.forEach((d) => {
        const docObj = normalizeRoomDoc(d.data(), d.id);
        next.set(docObj.roomCode, docObj);
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

// 4. Submit student test result to `exam_submissions/{roomCode}/students/{submissionId}` (and `exams/{roomCode}/submissions` backup)
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

  try {
    // Primary standardized path: `exam_submissions/{roomCode}/students/{submissionId}`
    await setDoc(doc(db, 'exam_submissions', targetRoomCode, 'students', subId), fullData);
    try {
      await setDoc(doc(db, 'exams', targetRoomCode, 'submissions', subId), fullData);
      await setDoc(doc(db, 'rooms', roomId, 'submissions', subId), fullData);
    } catch {
      // ignore secondary mirror error
    }
    return subId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 5. Real-time subscription to room submissions from `exam_submissions/{roomCode}/students` (merged with legacy `exams/{roomCode}/submissions`)
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

  const emitMerged = () => {
    const merged = new Map<string, StudentSubmissionDoc>();
    legacySubs.forEach((v, k) => merged.set(k, v));
    primarySubs.forEach((v, k) => merged.set(k, v));
    const list = Array.from(merged.values()).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    onUpdate(list);
  };

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
      handleFirestoreError(error, OperationType.GET, path);
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

// 6. Update room status (open / closed) in `exam_rooms/{roomCode}` (and `exams`/`rooms`)
export async function updateRoomStatus(
  roomId: string,
  status: 'open' | 'closed'
): Promise<void> {
  const cleanCode = roomId.trim();
  const path = `exam_rooms/${cleanCode}`;
  try {
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


