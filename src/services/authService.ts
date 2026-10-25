import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { safeLocalStorage } from '../utils/browserSafeguards';
import {
  sanitizeForFirestore,
  getConfiguredGoogleAppsScriptUrl,
  loadGoogleAppsScriptUrlSetting,
} from './roomService';

export type UserRole = 'admin' | 'teacher';
export type AccountStatus = 'active' | 'locked';

export interface TeacherAccountDoc {
  id: string;
  username: string;
  aliases?: string[];
  password: string;
  fullName: string;
  schoolOrDepartment: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface RoomCreatorInfo {
  username: string;
  fullName: string;
  role: UserRole;
  schoolOrDepartment?: string;
}

export const AUTH_SESSION_STORAGE_KEY = 'taodethi2026_auth_session_v1';
export const LOCAL_TEACHER_ACCOUNTS_KEY = 'taodethi2026_teacher_accounts_backup_v1';
export const LOCAL_ADMIN_PASSWORD_KEY = 'taodethi2026_super_admin_password_v1';
export const DEFAULT_PUBLIC_APP_DOMAIN = 'https://taodethi2026cv7791vanha.vercel.app';

export const DEFAULT_SUPER_ADMIN_ACCOUNT: TeacherAccountDoc = {
  id: 'admin',
  username: 'admin',
  aliases: ['admin', 'vanha'],
  password: '123456',
  fullName: 'GV: VANHA (Quản trị viên)',
  schoolOrDepartment: 'Quản trị hệ thống (Super Admin)',
  role: 'admin',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'system',
};

/**
 * Normalizes a username/email input to lowercase trimmed identifier.
 */
export function normalizeUsername(raw: string): string {
  return (raw || '').trim().toLowerCase();
}

/**
 * Checks if a username corresponds to the Super Admin (`admin` or `vanha`).
 */
export function isSuperAdminUsername(rawUsername: string): boolean {
  const clean = normalizeUsername(rawUsername);
  return clean === 'admin' || clean === 'vanha';
}

/**
 * Gets the locally cached Super Admin password (defaults to '123456').
 */
export function getLocalSuperAdminPassword(): string {
  const saved = safeLocalStorage.getItem(LOCAL_ADMIN_PASSWORD_KEY);
  return saved && saved.trim() ? saved.trim() : DEFAULT_SUPER_ADMIN_ACCOUNT.password;
}

export function setLocalSuperAdminPassword(newPassword: string): void {
  const clean = (newPassword || '').trim();
  if (clean) {
    safeLocalStorage.setItem(LOCAL_ADMIN_PASSWORD_KEY, clean);
  }
}

/**
 * Builds the Super Admin account object with the latest password.
 */
export function getSuperAdminAccountDoc(customPassword?: string): TeacherAccountDoc {
  const resolvedPassword =
    (customPassword && customPassword.trim()) || getLocalSuperAdminPassword();
  return {
    ...DEFAULT_SUPER_ADMIN_ACCOUNT,
    password: resolvedPassword,
  };
}

/**
 * Normalizes raw Firestore or Google Sheets data into a valid `TeacherAccountDoc`.
 */
export function normalizeTeacherAccountDoc(raw: any, docId?: string): TeacherAccountDoc {
  const rawUsername = normalizeUsername(raw?.username || docId || '');
  const isDefaultAdmin = isSuperAdminUsername(rawUsername);
  const canonicalUsername = isDefaultAdmin ? 'admin' : rawUsername;

  return {
    id: canonicalUsername || docId || 'teacher',
    username: canonicalUsername || docId || 'teacher',
    aliases: isDefaultAdmin ? ['admin', 'vanha'] : raw?.aliases || [canonicalUsername],
    password: String(
      raw?.password || (isDefaultAdmin ? getLocalSuperAdminPassword() : '123456')
    ).trim(),
    fullName: String(
      raw?.fullName ||
        raw?.displayName ||
        (isDefaultAdmin ? DEFAULT_SUPER_ADMIN_ACCOUNT.fullName : 'Giáo viên')
    ).trim(),
    schoolOrDepartment: String(
      raw?.schoolOrDepartment ||
        raw?.school ||
        raw?.department ||
        (isDefaultAdmin ? DEFAULT_SUPER_ADMIN_ACCOUNT.schoolOrDepartment : 'Tổ Chuyên Môn')
    ).trim(),
    role: isDefaultAdmin || raw?.role === 'admin' ? 'admin' : 'teacher',
    status: !isDefaultAdmin && raw?.status === 'locked' ? 'locked' : 'active',
    createdAt: raw?.createdAt || new Date().toISOString(),
    updatedAt: raw?.updatedAt || new Date().toISOString(),
    createdBy: raw?.createdBy || 'admin',
  };
}

/**
 * LocalStorage backup helpers for teacher accounts (offline-first).
 */
export function loadLocalTeacherAccountsMap(): Record<string, TeacherAccountDoc> {
  try {
    const raw = safeLocalStorage.getItem(LOCAL_TEACHER_ACCOUNTS_KEY);
    const parsed: Record<string, TeacherAccountDoc> = raw ? JSON.parse(raw) : {};
    const result: Record<string, TeacherAccountDoc> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const norm = normalizeTeacherAccountDoc(v, k);
      result[norm.username] = norm;
    }
    // Always ensure default super admin is present
    const existingAdmin = result['admin'];
    result['admin'] = getSuperAdminAccountDoc(existingAdmin?.password);
    return result;
  } catch {
    return {
      admin: getSuperAdminAccountDoc(),
    };
  }
}

export function saveTeacherAccountToLocalBackup(account: TeacherAccountDoc): void {
  try {
    const map = loadLocalTeacherAccountsMap();
    const norm = normalizeTeacherAccountDoc(account, account.username);
    map[norm.username] = norm;
    if (norm.username === 'admin') {
      setLocalSuperAdminPassword(norm.password);
    }
    safeLocalStorage.setItem(LOCAL_TEACHER_ACCOUNTS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function removeTeacherAccountFromLocalBackup(username: string): void {
  try {
    const clean = normalizeUsername(username);
    if (isSuperAdminUsername(clean)) return; // never delete super admin
    const map = loadLocalTeacherAccountsMap();
    delete map[clean];
    safeLocalStorage.setItem(LOCAL_TEACHER_ACCOUNTS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/**
 * Session persistence in safeLocalStorage so teacher/admin stays logged in across page reloads.
 */
export function loadSavedAuthSession(): TeacherAccountDoc | null {
  try {
    const raw = safeLocalStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.username) return null;
    const normalized = normalizeTeacherAccountDoc(parsed, parsed.username);
    if (normalized.status === 'locked' && normalized.role !== 'admin') {
      safeLocalStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

export function saveAuthSession(user: TeacherAccountDoc | null): void {
  try {
    if (!user) {
      safeLocalStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return;
    }
    const normalized = normalizeTeacherAccountDoc(user, user.username);
    safeLocalStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }
}

export function logoutAuthSession(): void {
  saveAuthSession(null);
}

/**
 * Helper to run a promise with a strict timeout so offline or slow networks never block login.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 3500): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

/**
 * Ensures the default Super Admin document exists in Firestore (`users/admin` and `teacher_accounts/admin`)
 * when online, without overwriting any custom password already saved on Firebase.
 */
export async function ensureSuperAdminInitializedOnCloud(): Promise<TeacherAccountDoc> {
  const localAdmin = getSuperAdminAccountDoc();
  try {
    const userAdminSnap = await withTimeout(getDoc(doc(db, 'users', 'admin')), 3000);
    if (userAdminSnap && userAdminSnap.exists()) {
      const cloudAdmin = normalizeTeacherAccountDoc(userAdminSnap.data(), 'admin');
      saveTeacherAccountToLocalBackup(cloudAdmin);
      return cloudAdmin;
    }

    const teacherAdminSnap = await withTimeout(getDoc(doc(db, 'teacher_accounts', 'admin')), 3000);
    if (teacherAdminSnap && teacherAdminSnap.exists()) {
      const cloudAdmin = normalizeTeacherAccountDoc(teacherAdminSnap.data(), 'admin');
      saveTeacherAccountToLocalBackup(cloudAdmin);
      return cloudAdmin;
    }

    // Seed default Super Admin to `users/admin` and `teacher_accounts/admin`
    const payload = sanitizeForFirestore(localAdmin);
    await Promise.allSettled([
      setDoc(doc(db, 'users', 'admin'), payload, { merge: true }),
      setDoc(doc(db, 'teacher_accounts', 'admin'), payload, { merge: true }),
    ]);
  } catch {
    // Offline or restricted — local default admin is always ready
  }
  return localAdmin;
}

/**
 * Syncs a teacher account to Google Sheets (`TaiKhoanGiaoVien` sheet) via Google Apps Script Web App URL.
 */
export async function syncTeacherAccountToGoogleSheets(
  account: TeacherAccountDoc,
  actionType: 'upsert' | 'delete' = 'upsert'
): Promise<boolean> {
  let scriptUrl = getConfiguredGoogleAppsScriptUrl();
  if (!scriptUrl) {
    scriptUrl = await loadGoogleAppsScriptUrlSetting();
  }
  if (!scriptUrl) return false;

  const payload = {
    action: 'syncTeacherAccount',
    subAction: actionType,
    account: sanitizeForFirestore(account),
    username: account.username,
    fullName: account.fullName,
    schoolOrDepartment: account.schoolOrDepartment,
    password: account.password,
    role: account.role,
    status: account.status,
    updatedAt: new Date().toLocaleString('vi-VN'),
  };

  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return true;
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Fetches all teacher accounts from Google Sheets (`doGet?action=listTeachers`) for Dual Cloud Sync failover.
 */
export async function fetchTeacherAccountsFromGoogleSheets(): Promise<TeacherAccountDoc[]> {
  let scriptUrl = getConfiguredGoogleAppsScriptUrl();
  if (!scriptUrl) {
    scriptUrl = await loadGoogleAppsScriptUrlSetting();
  }
  if (!scriptUrl) return [];

  try {
    const separator = scriptUrl.includes('?') ? '&' : '?';
    const url = `${scriptUrl}${separator}action=listTeachers&_t=${Date.now()}`;
    const res = await withTimeout(
      fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }),
      3500
    );
    if (!res || !res.ok) return [];
    const data = await res.json();
    const list = data?.teachers || data?.accounts || [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((item: any) => item && item.username)
      .map((item: any) => normalizeTeacherAccountDoc(item, String(item.username)));
  } catch {
    return [];
  }
}

/**
 * Authenticates a Teacher or Admin using Username/Email and Password.
 * - Supports default Super Admin (`admin` or `vanha`, default password `123456` or updated password in `users/admin`) even when offline!
 * - Checks Firebase (`users/admin`, `teacher_accounts/{username}`), Google Sheets (`TaiKhoanGiaoVien`), and LocalStorage backup.
 * - Rejects locked accounts (`status === 'locked'`).
 */
export async function loginWithCredentials(
  usernameInput: string,
  passwordInput: string
): Promise<{
  ok: boolean;
  user?: TeacherAccountDoc;
  error?: string;
}> {
  const cleanUser = normalizeUsername(usernameInput);
  const cleanPass = (passwordInput || '').trim();

  if (!cleanUser) {
    return { ok: false, error: 'Vui lòng nhập Tên đăng nhập (Username / Email)!' };
  }
  if (!cleanPass) {
    return { ok: false, error: 'Vui lòng nhập Mật khẩu!' };
  }

  // 1. Check Super Admin (`admin` or `vanha`)
  if (isSuperAdminUsername(cleanUser)) {
    let cloudAdminDoc: TeacherAccountDoc | null = null;
    try {
      const [userAdminSnap, teacherAdminSnap] = await Promise.all([
        withTimeout(getDoc(doc(db, 'users', 'admin')), 2800),
        withTimeout(getDoc(doc(db, 'teacher_accounts', 'admin')), 2800),
      ]);
      if (userAdminSnap && userAdminSnap.exists()) {
        cloudAdminDoc = normalizeTeacherAccountDoc(userAdminSnap.data(), 'admin');
      } else if (teacherAdminSnap && teacherAdminSnap.exists()) {
        cloudAdminDoc = normalizeTeacherAccountDoc(teacherAdminSnap.data(), 'admin');
      }
    } catch {
      // Offline fallback
    }

    if (cloudAdminDoc) {
      saveTeacherAccountToLocalBackup(cloudAdminDoc);
    }

    const effectiveAdmin = cloudAdminDoc || getSuperAdminAccountDoc();
    const localPass = getLocalSuperAdminPassword();

    // Match against cloud password, local saved password, or default '123456' if never changed
    const passwordMatches =
      cleanPass === effectiveAdmin.password ||
      cleanPass === localPass ||
      (!cloudAdminDoc && cleanPass === DEFAULT_SUPER_ADMIN_ACCOUNT.password);

    if (!passwordMatches) {
      return {
        ok: false,
        error: 'Mật khẩu Quản trị viên (Admin) không chính xác! Vui lòng kiểm tra lại.',
      };
    }

    const finalAdmin: TeacherAccountDoc = {
      ...effectiveAdmin,
      username: 'admin',
      aliases: ['admin', 'vanha'],
      fullName: effectiveAdmin.fullName || 'GV: VANHA (Quản trị viên)',
      role: 'admin',
      status: 'active',
    };

    saveTeacherAccountToLocalBackup(finalAdmin);
    saveAuthSession(finalAdmin);
    return { ok: true, user: finalAdmin };
  }

  // 2. Check Teacher Account in Firebase (`teacher_accounts/{cleanUser}` or `users/{cleanUser}`)
  let matchedAccount: TeacherAccountDoc | null = null;

  try {
    const [teacherSnap, userSnap] = await Promise.all([
      withTimeout(getDoc(doc(db, 'teacher_accounts', cleanUser)), 3000),
      withTimeout(getDoc(doc(db, 'users', cleanUser)), 3000),
    ]);

    if (teacherSnap && teacherSnap.exists()) {
      matchedAccount = normalizeTeacherAccountDoc(teacherSnap.data(), cleanUser);
    } else if (userSnap && userSnap.exists()) {
      matchedAccount = normalizeTeacherAccountDoc(userSnap.data(), cleanUser);
    }
  } catch {
    // continue to fallback
  }

  // 3. Fallback: Check Google Sheets `TaiKhoanGiaoVien` if not found on Firebase
  if (!matchedAccount) {
    try {
      const sheetsList = await fetchTeacherAccountsFromGoogleSheets();
      const foundInSheets = sheetsList.find((acc) => normalizeUsername(acc.username) === cleanUser);
      if (foundInSheets) {
        matchedAccount = foundInSheets;
        saveTeacherAccountToLocalBackup(foundInSheets);
      }
    } catch {
      // ignore
    }
  }

  // 4. Fallback: Check local storage backup
  if (!matchedAccount) {
    const localMap = loadLocalTeacherAccountsMap();
    if (localMap[cleanUser]) {
      matchedAccount = localMap[cleanUser];
    }
  }

  if (!matchedAccount) {
    return {
      ok: false,
      error: `Tài khoản "${usernameInput.trim()}" chưa được cấp quyền hoặc không tồn tại trên hệ thống!`,
    };
  }

  if (matchedAccount.status === 'locked' && matchedAccount.role !== 'admin') {
    return {
      ok: false,
      error: `Tài khoản "${matchedAccount.fullName}" (${matchedAccount.username}) hiện đang bị khóa quyền truy cập. Vui lòng liên hệ Quản trị viên (GV: VANHA)!`,
    };
  }

  if (cleanPass !== matchedAccount.password) {
    return {
      ok: false,
      error: 'Mật khẩu không chính xác! Vui lòng kiểm tra lại.',
    };
  }

  saveTeacherAccountToLocalBackup(matchedAccount);
  saveAuthSession(matchedAccount);
  return { ok: true, user: matchedAccount };
}

/**
 * Creates or updates a Teacher/Admin account (for Admin management modal)
 * and synchronizes to Firebase (`teacher_accounts/{username}`, `users/{username}`) & Google Sheets.
 */
export async function createOrUpdateTeacherAccount(input: {
  username: string;
  password: string;
  fullName: string;
  schoolOrDepartment: string;
  role: UserRole;
  status?: AccountStatus;
  createdBy?: string;
}): Promise<{
  ok: boolean;
  account?: TeacherAccountDoc;
  savedFirebase?: boolean;
  savedGoogleSheets?: boolean;
  error?: string;
}> {
  const rawUser = normalizeUsername(input.username);
  if (!rawUser) {
    return { ok: false, error: 'Vui lòng nhập Tên đăng nhập (Username) cho giáo viên!' };
  }
  if (!/^[a-z0-9._@-]{3,50}$/i.test(rawUser)) {
    return {
      ok: false,
      error: 'Tên đăng nhập chỉ gồm chữ cái không dấu, chữ số hoặc ký tự . _ @ - (từ 3 ký tự trở lên)!',
    };
  }
  if (!input.password || input.password.trim().length < 4) {
    return { ok: false, error: 'Mật khẩu phải có ít nhất 4 ký tự!' };
  }
  if (!input.fullName || !input.fullName.trim()) {
    return { ok: false, error: 'Vui lòng nhập Họ và tên Giáo viên!' };
  }

  const isSuper = isSuperAdminUsername(rawUser);
  const canonicalUsername = isSuper ? 'admin' : rawUser;
  const nowIso = new Date().toISOString();

  const existingLocal = loadLocalTeacherAccountsMap()[canonicalUsername];

  const accountDoc: TeacherAccountDoc = normalizeTeacherAccountDoc(
    {
      id: canonicalUsername,
      username: canonicalUsername,
      aliases: isSuper ? ['admin', 'vanha'] : [canonicalUsername],
      password: input.password.trim(),
      fullName: input.fullName.trim(),
      schoolOrDepartment: input.schoolOrDepartment.trim() || 'Tổ Chuyên Môn',
      role: isSuper ? 'admin' : input.role,
      status: isSuper ? 'active' : input.status || existingLocal?.status || 'active',
      createdAt: existingLocal?.createdAt || nowIso,
      updatedAt: nowIso,
      createdBy: input.createdBy || 'admin',
    },
    canonicalUsername
  );

  saveTeacherAccountToLocalBackup(accountDoc);

  // Sync active session if updating current logged-in user
  const currentSession = loadSavedAuthSession();
  if (currentSession && normalizeUsername(currentSession.username) === canonicalUsername) {
    saveAuthSession(accountDoc);
  }

  const cleanPayload = sanitizeForFirestore(accountDoc);

  const writeFirebaseTask = async (): Promise<boolean> => {
    await setDoc(doc(db, 'teacher_accounts', canonicalUsername), cleanPayload, { merge: true });
    await setDoc(doc(db, 'users', canonicalUsername), cleanPayload, { merge: true });
    return true;
  };

  const [fbRes, gasRes] = await Promise.allSettled([
    withTimeout(writeFirebaseTask(), 4000),
    withTimeout(syncTeacherAccountToGoogleSheets(accountDoc, 'upsert'), 4000),
  ]);

  const savedFirebase = fbRes.status === 'fulfilled' && fbRes.value === true;
  const savedGoogleSheets = gasRes.status === 'fulfilled' && gasRes.value === true;

  return {
    ok: true,
    account: accountDoc,
    savedFirebase,
    savedGoogleSheets,
  };
}

/**
 * Changes password for any account (including Super Admin `users/admin`).
 */
export async function changeAccountPassword(
  username: string,
  newPassword: string
): Promise<{
  ok: boolean;
  account?: TeacherAccountDoc;
  error?: string;
}> {
  const cleanPass = (newPassword || '').trim();
  if (cleanPass.length < 4) {
    return { ok: false, error: 'Mật khẩu mới phải có ít nhất 4 ký tự!' };
  }

  const isSuper = isSuperAdminUsername(username);
  const canonicalUsername = isSuper ? 'admin' : normalizeUsername(username);
  const localMap = loadLocalTeacherAccountsMap();
  const baseAccount =
    localMap[canonicalUsername] ||
    (isSuper ? getSuperAdminAccountDoc(cleanPass) : null);

  const updatedAccount: TeacherAccountDoc = normalizeTeacherAccountDoc(
    {
      ...(baseAccount || {
        username: canonicalUsername,
        fullName: isSuper ? DEFAULT_SUPER_ADMIN_ACCOUNT.fullName : canonicalUsername,
        schoolOrDepartment: isSuper
          ? DEFAULT_SUPER_ADMIN_ACCOUNT.schoolOrDepartment
          : 'Tổ Chuyên Môn',
        role: isSuper ? 'admin' : 'teacher',
        status: 'active',
        createdAt: new Date().toISOString(),
      }),
      password: cleanPass,
      updatedAt: new Date().toISOString(),
    },
    canonicalUsername
  );

  saveTeacherAccountToLocalBackup(updatedAccount);

  const currentSession = loadSavedAuthSession();
  if (
    currentSession &&
    (normalizeUsername(currentSession.username) === canonicalUsername ||
      (isSuper && isSuperAdminUsername(currentSession.username)))
  ) {
    saveAuthSession(updatedAccount);
  }

  const payload = sanitizeForFirestore(updatedAccount);
  await Promise.allSettled([
    withTimeout(setDoc(doc(db, 'users', canonicalUsername), payload, { merge: true }), 3500),
    withTimeout(
      setDoc(doc(db, 'teacher_accounts', canonicalUsername), payload, { merge: true }),
      3500
    ),
    withTimeout(syncTeacherAccountToGoogleSheets(updatedAccount, 'upsert'), 3500),
  ]);

  return { ok: true, account: updatedAccount };
}

/**
 * Locks or unlocks a teacher account (`status: 'active' | 'locked'`).
 */
export async function toggleTeacherAccountStatus(
  username: string,
  nextStatus: AccountStatus
): Promise<TeacherAccountDoc | null> {
  const cleanUser = normalizeUsername(username);
  if (isSuperAdminUsername(cleanUser)) {
    return getSuperAdminAccountDoc();
  }

  const localMap = loadLocalTeacherAccountsMap();
  const existing = localMap[cleanUser];
  if (!existing) return null;

  const updated: TeacherAccountDoc = {
    ...existing,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };

  saveTeacherAccountToLocalBackup(updated);
  const payload = sanitizeForFirestore(updated);

  await Promise.allSettled([
    withTimeout(setDoc(doc(db, 'teacher_accounts', cleanUser), payload, { merge: true }), 3500),
    withTimeout(setDoc(doc(db, 'users', cleanUser), payload, { merge: true }), 3500),
    withTimeout(syncTeacherAccountToGoogleSheets(updated, 'upsert'), 3500),
  ]);

  return updated;
}

/**
 * Deletes a teacher account from Firebase (`teacher_accounts`, `users`), Google Sheets, and LocalStorage.
 */
export async function deleteTeacherAccount(username: string): Promise<boolean> {
  const cleanUser = normalizeUsername(username);
  if (isSuperAdminUsername(cleanUser)) {
    return false;
  }

  const existing = loadLocalTeacherAccountsMap()[cleanUser];
  removeTeacherAccountFromLocalBackup(cleanUser);

  await Promise.allSettled([
    withTimeout(deleteDoc(doc(db, 'teacher_accounts', cleanUser)), 3500),
    withTimeout(deleteDoc(doc(db, 'users', cleanUser)), 3500),
    existing
      ? withTimeout(syncTeacherAccountToGoogleSheets(existing, 'delete'), 3500)
      : Promise.resolve(false),
  ]);

  return true;
}

/**
 * Subscribes in real-time to all teacher/admin accounts in `teacher_accounts` (merged with `users/admin`, Google Sheets, & local storage).
 */
export function subscribeToTeacherAccounts(
  onUpdate: (accounts: TeacherAccountDoc[]) => void
): () => void {
  let firestoreMap = new Map<string, TeacherAccountDoc>();
  let sheetsMap = new Map<string, TeacherAccountDoc>();
  let adminUserDoc: TeacherAccountDoc | null = null;

  const emitMerged = () => {
    const merged = new Map<string, TeacherAccountDoc>();
    const localMap = loadLocalTeacherAccountsMap();
    for (const acc of Object.values(localMap)) {
      merged.set(acc.username, acc);
    }
    sheetsMap.forEach((v, k) => {
      merged.set(k, v);
    });
    firestoreMap.forEach((v, k) => {
      merged.set(k, v);
      saveTeacherAccountToLocalBackup(v);
    });
    if (adminUserDoc) {
      merged.set('admin', adminUserDoc);
      saveTeacherAccountToLocalBackup(adminUserDoc);
    }
    if (!merged.has('admin')) {
      merged.set('admin', getSuperAdminAccountDoc());
    }

    const list = Array.from(merged.values()).sort((a, b) => {
      if (a.username === 'admin') return -1;
      if (b.username === 'admin') return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    onUpdate(list);
  };

  emitMerged();

  // Also load from Google Sheets if configured
  fetchTeacherAccountsFromGoogleSheets()
    .then((fromSheets) => {
      if (fromSheets.length > 0) {
        const next = new Map<string, TeacherAccountDoc>();
        fromSheets.forEach((a) => next.set(a.username, a));
        sheetsMap = next;
        emitMerged();
      }
    })
    .catch(() => {
      // ignore
    });

  const unsubTeachers = onSnapshot(
    collection(db, 'teacher_accounts'),
    (snap) => {
      const next = new Map<string, TeacherAccountDoc>();
      snap.forEach((d) => {
        const acc = normalizeTeacherAccountDoc(d.data(), d.id);
        next.set(acc.username, acc);
      });
      firestoreMap = next;
      emitMerged();
    },
    () => {
      // ignore offline error
    }
  );

  const unsubAdminUser = onSnapshot(
    doc(db, 'users', 'admin'),
    (snap) => {
      if (snap.exists()) {
        adminUserDoc = normalizeTeacherAccountDoc(snap.data(), 'admin');
        emitMerged();
      }
    },
    () => {
      // ignore
    }
  );

  return () => {
    unsubTeachers();
    unsubAdminUser();
  };
}

/**
 * Formats the teacher account credentials into a ready-to-send Zalo / Messenger message.
 */
export function buildTeacherZaloInviteMessage(
  account: TeacherAccountDoc,
  customPublicUrl?: string
): string {
  const resolvedUrl =
    (customPublicUrl && customPublicUrl.trim()) ||
    (typeof window !== 'undefined' && window.location.origin.includes('vercel.app')
      ? window.location.origin
      : DEFAULT_PUBLIC_APP_DOMAIN);

  const roleLabel =
    account.role === 'admin'
      ? 'Quản trị viên (Admin - Toàn quyền hệ thống)'
      : 'Giáo viên (Tạo đề PDF, Trộn đề, Mở phòng thi 4 số & Quản lý bảng điểm riêng)';

  return [
    `🎓 THÔNG TIN TÀI KHOẢN GIÁO VIÊN - HỆ THỐNG TẠO ĐỀ THI & KIỂM TRA TRỰC TUYẾN 2026 (CHUẨN CV 7991)`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 Họ và tên: ${account.fullName}`,
    `🏫 Trường / Tổ chuyên môn: ${account.schoolOrDepartment || 'Tổ Chuyên Môn'}`,
    `🔑 Tên đăng nhập (Username): ${account.username}`,
    `🔒 Mật khẩu: ${account.password}`,
    `🛡️ Phân quyền: ${roleLabel}`,
    `🌐 Link đăng nhập tạo đề & quản lý phòng thi: ${resolvedUrl}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📌 Hướng dẫn: Thầy/Cô mở link trên bằng máy tính hoặc điện thoại -> Bấm nút "🔐 Đăng nhập Giáo viên / Admin" ở góc trên bên phải màn hình và nhập Tên đăng nhập + Mật khẩu để sử dụng!`,
  ].join('\n');
}

/**
 * Checks whether the current user has permission to manage (edit/lock/delete) a specific exam room.
 * - `admin` role: Full access to ALL exam rooms in the system.
 * - `teacher` role: Full access to exam rooms created by themselves (`createdByUsername === user.username`).
 */
export function canUserManageExamRoom(
  user: TeacherAccountDoc | null | undefined,
  room: {
    createdByUsername?: string;
    createdBy?: { username?: string };
    teacherName?: string;
  }
): boolean {
  if (!user) return false;
  if (user.role === 'admin' || isSuperAdminUsername(user.username)) {
    return true;
  }
  const userNorm = normalizeUsername(user.username);
  const roomOwnerNorm = normalizeUsername(
    room.createdByUsername || room.createdBy?.username || ''
  );
  if (roomOwnerNorm) {
    return roomOwnerNorm === userNorm;
  }
  // Legacy rooms created before `createdBy` field was introduced belong to Admin (GV: VANHA)
  return false;
}
