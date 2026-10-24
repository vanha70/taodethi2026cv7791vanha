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
import { ExamData } from '../types/exam';

export interface ExamRoomDoc {
  id: string;
  roomCode: string;
  examCode?: string;
  title: string;
  subject: string;
  grade: string;
  targetClass?: string;
  durationMinutes: number;
  status: 'open' | 'closed';
  teacherName: string;
  allowReview: boolean;
  createdAt: string;
  examData: ExamData;
}

export interface StudentSubmissionDoc {
  id: string;
  roomId: string;
  roomCode: string;
  studentName: string;
  studentClass: string;
  studentId: string; // SBD
  scoreTotal: number;
  scorePart1: number;
  scorePart2: number;
  scorePart3: number;
  answersPart1: Record<number, 'A' | 'B' | 'C' | 'D'>;
  answersPart2: Record<number, Record<'a' | 'b' | 'c' | 'd', boolean | null>>;
  answersPart3: Record<number, string>;
  timeSpentSeconds: number;
  submittedAt: string;
}

// Validate strict 4-digit exam/room code format (^\d{4}$)
export function isValid4DigitCode(code: string): boolean {
  return /^\d{4}$/.test(code.trim());
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

// 1. Publish / Create a new exam room in Firebase collection `exams` with Document ID = 4-digit Room Code
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

  // Primary key (Document ID) in `exams` collection is the 4-digit roomCode itself
  const roomId = roomCode;
  const path = `exams/${roomId}`;
  const resolvedClass = targetClass?.trim() || exam.metadata.grade || 'Khối 12';

  const updatedExam: ExamData = {
    ...exam,
    metadata: {
      ...exam.metadata,
      examCode: roomCode,
      grade: resolvedClass,
      durationMinutes: Number(durationMinutes) || exam.metadata.durationMinutes || 45,
    },
  };

  const roomData: ExamRoomDoc = sanitizeForFirestore({
    id: roomId,
    roomCode,
    examCode: roomCode,
    title: exam.metadata.examTitle || 'Đề kiểm tra trực tuyến',
    subject: exam.metadata.subject || 'Hóa học',
    grade: resolvedClass,
    targetClass: resolvedClass,
    durationMinutes: Number(durationMinutes) || exam.metadata.durationMinutes || 45,
    status: 'open',
    teacherName: teacherName || 'Giáo viên',
    allowReview: Boolean(allowReview),
    createdAt: new Date().toISOString(),
    examData: updatedExam,
  });

  try {
    // Save to `exams/{roomCode}` with Document ID = 4-digit roomCode
    await setDoc(doc(db, 'exams', roomId), roomData);
    // Also mirror to `rooms/{roomCode}` for backward compatibility
    await setDoc(doc(db, 'rooms', roomId), roomData);
    return roomData;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 2. Find published exam / room by 4-digit roomCode (checks `exams/{code}` first, then `rooms`)
export async function findRoomByCode(roomCode: string): Promise<ExamRoomDoc | null> {
  const cleanCode = roomCode.trim().toUpperCase();
  const path = `exams/${cleanCode}`;

  try {
    // 1) Direct lookup by Document ID in `exams/{cleanCode}`
    const directExamSnap = await getDoc(doc(db, 'exams', cleanCode));
    if (directExamSnap.exists()) {
      const data = directExamSnap.data() as ExamRoomDoc;
      return { ...data, id: directExamSnap.id };
    }

    // 2) Query `exams` collection where roomCode == cleanCode
    const qExams = query(collection(db, 'exams'), where('roomCode', '==', cleanCode));
    const snapExams = await getDocs(qExams);
    if (!snapExams.empty) {
      const docData = snapExams.docs[0].data() as ExamRoomDoc;
      return { ...docData, id: snapExams.docs[0].id };
    }

    // 3) Fallback: Direct lookup or query in `rooms` collection
    const directRoomSnap = await getDoc(doc(db, 'rooms', cleanCode));
    if (directRoomSnap.exists()) {
      const data = directRoomSnap.data() as ExamRoomDoc;
      return { ...data, id: directRoomSnap.id };
    }

    const qRooms = query(collection(db, 'rooms'), where('roomCode', '==', cleanCode));
    const snapRooms = await getDocs(qRooms);
    if (!snapRooms.empty) {
      const docData = snapRooms.docs[0].data() as ExamRoomDoc;
      return { ...docData, id: snapRooms.docs[0].id };
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// 3. Real-time subscription to all published exams in `exams` collection
export function subscribeToPublishedExams(
  onUpdate: (exams: ExamRoomDoc[]) => void,
  onError?: (err: any) => void
): () => void {
  const path = 'exams';
  const examsCol = collection(db, 'exams');

  const unsubscribe = onSnapshot(
    examsCol,
    (snapshot) => {
      const list: ExamRoomDoc[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as ExamRoomDoc;
        list.push({ ...data, id: d.id });
      });
      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  return unsubscribe;
}

// 4. Submit student test result to `exams/{roomId}/submissions/{subId}` (and `rooms` backup)
export async function submitStudentResult(
  roomId: string,
  submissionData: Omit<StudentSubmissionDoc, 'id'>
): Promise<string> {
  const subId = `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const targetDocId = submissionData.roomCode || roomId;
  const path = `exams/${targetDocId}/submissions/${subId}`;

  const fullData: StudentSubmissionDoc = sanitizeForFirestore({
    ...submissionData,
    id: subId,
  });

  try {
    await setDoc(doc(db, 'exams', targetDocId, 'submissions', subId), fullData);
    try {
      await setDoc(doc(db, 'rooms', roomId, 'submissions', subId), fullData);
    } catch {
      // ignore secondary mirror error if room only exists in exams
    }
    return subId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 5. Real-time subscription to room submissions (for teacher dashboard)
export function subscribeToSubmissions(
  roomId: string,
  onUpdate: (submissions: StudentSubmissionDoc[]) => void,
  onError?: (err: any) => void
): () => void {
  const path = `exams/${roomId}/submissions`;
  const subCol = collection(db, 'exams', roomId, 'submissions');

  const unsubscribe = onSnapshot(
    subCol,
    (snapshot) => {
      const list: StudentSubmissionDoc[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as StudentSubmissionDoc);
      });
      list.sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  return unsubscribe;
}

// 6. Update room status (open / closed)
export async function updateRoomStatus(
  roomId: string,
  status: 'open' | 'closed'
): Promise<void> {
  const path = `exams/${roomId}`;
  try {
    await updateDoc(doc(db, 'exams', roomId), { status });
    try {
      await updateDoc(doc(db, 'rooms', roomId), { status });
    } catch {
      // ignore if not in legacy rooms
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// 7. Delete an exam room
export async function deleteRoom(roomId: string): Promise<void> {
  const path = `exams/${roomId}`;
  try {
    await deleteDoc(doc(db, 'exams', roomId));
    try {
      await deleteDoc(doc(db, 'rooms', roomId));
    } catch {
      // ignore if not in legacy rooms
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
    try {
      const savedLocal = localStorage.getItem(PUBLIC_APP_URL_STORAGE_KEY);
      if (savedLocal && savedLocal.trim()) {
        const normalizedSaved = normalizePublicBaseUrl(savedLocal);
        if (normalizedSaved) return normalizedSaved;
      }
    } catch {
      // ignore localStorage read error
    }

    return normalizePublicBaseUrl(getBrowserCurrentBaseUrl());
  }

  return '';
}

/**
 * Builds the direct student exam link using combined Query Param + Hash Routing:
 * `${baseUrl}?room=${roomCode}#room=${roomCode}` (e.g. `https://...run.app/?room=3203#room=3203`)
 * Never appends `/room/...` or `/exam/...` sub-paths and never auto-mutates `window.location.origin`.
 */
export function buildStudentRoomLink(roomCode: string, customBaseUrl?: string): string {
  const baseUrl = getResolvedPublicAppUrl(customBaseUrl);
  const cleanCode = encodeURIComponent((roomCode || '').trim());
  return `${baseUrl}?room=${cleanCode}#room=${cleanCode}`;
}

/**
 * Saves the teacher's custom Public App URL to localStorage and Firebase `settings/publicConfig`.
 * If `rawUrl` is empty, clears the custom override so the app uses `window.location.origin + window.location.pathname`.
 */
export async function savePublicAppUrlSetting(rawUrl: string): Promise<string> {
  const trimmed = (rawUrl || '').trim();
  const normalized = trimmed ? normalizePublicBaseUrl(trimmed) : '';
  if (typeof window !== 'undefined') {
    try {
      if (normalized) {
        localStorage.setItem(PUBLIC_APP_URL_STORAGE_KEY, normalized);
      } else {
        localStorage.removeItem(PUBLIC_APP_URL_STORAGE_KEY);
      }
    } catch {
      // ignore localStorage write error
    }
  }

  try {
    await setDoc(
      doc(db, 'settings', 'publicConfig'),
      sanitizeForFirestore({
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
      if (data && typeof data.customPublicAppUrl === 'string') {
        const trimmed = data.customPublicAppUrl.trim();
        const normalized = trimmed ? normalizePublicBaseUrl(trimmed) : '';
        if (typeof window !== 'undefined') {
          try {
            if (normalized) {
              localStorage.setItem(PUBLIC_APP_URL_STORAGE_KEY, normalized);
            } else {
              localStorage.removeItem(PUBLIC_APP_URL_STORAGE_KEY);
            }
          } catch {
            // ignore
          }
        }
        return normalized;
      }
    }
  } catch {
    // fallback to localStorage if offline or permission restricted
  }

  if (typeof window !== 'undefined') {
    try {
      const savedLocal = localStorage.getItem(PUBLIC_APP_URL_STORAGE_KEY);
      if (savedLocal && savedLocal.trim()) {
        return normalizePublicBaseUrl(savedLocal);
      }
    } catch {
      // ignore
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


