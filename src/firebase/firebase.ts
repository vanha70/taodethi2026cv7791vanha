import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, Firestore } from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';
import { safeLocalStorage } from '../utils/browserSafeguards';

export const CUSTOM_FIREBASE_CONFIG_STORAGE_KEY = 'taodethi2026_custom_firebase_config_v1';

export interface CustomFirebaseConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  databaseURL?: string;
  firestoreDatabaseId?: string;
}

export function loadSavedCustomFirebaseConfig(): CustomFirebaseConfig | null {
  try {
    const raw = safeLocalStorage.getItem(CUSTOM_FIREBASE_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.apiKey === 'string' && typeof parsed.projectId === 'string' && parsed.apiKey.trim() && parsed.projectId.trim()) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function getActiveFirebaseConfig(): CustomFirebaseConfig {
  const custom = loadSavedCustomFirebaseConfig();
  if (custom) {
    return custom;
  }
  return defaultFirebaseConfig as CustomFirebaseConfig;
}

const activeConfig = getActiveFirebaseConfig();
const app: FirebaseApp =
  getApps().length > 0 ? getApps()[0] : initializeApp(activeConfig);
// CRITICAL: Pass firestoreDatabaseId if present
export let db: Firestore = activeConfig.firestoreDatabaseId
  ? getFirestore(app, activeConfig.firestoreDatabaseId)
  : getFirestore(app);
export let auth: Auth | null = null;
try {
  auth = getAuth(app);
} catch (err) {
  console.warn('Firebase Auth initialization skipped in restricted WebView:', err);
}

/**
 * Allows teacher to dynamically apply a custom firebaseConfig at runtime (or revert to built-in config).
 */
export function applyRuntimeFirebaseConfig(customConfig: CustomFirebaseConfig | null): {
  ok: boolean;
  projectId: string;
  isCustom: boolean;
  error?: string;
} {
  try {
    if (!customConfig) {
      safeLocalStorage.removeItem(CUSTOM_FIREBASE_CONFIG_STORAGE_KEY);
      const defaultApp =
        getApps().find((a) => a.name === '[DEFAULT]') || initializeApp(defaultFirebaseConfig);
      db = defaultFirebaseConfig.firestoreDatabaseId
        ? getFirestore(defaultApp, defaultFirebaseConfig.firestoreDatabaseId)
        : getFirestore(defaultApp);
      try {
        auth = getAuth(defaultApp);
      } catch {
        // ignore in restricted WebView
      }
      return {
        ok: true,
        projectId: defaultFirebaseConfig.projectId,
        isCustom: false,
      };
    }

    safeLocalStorage.setItem(CUSTOM_FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(customConfig));
    const appName = `custom_fb_${customConfig.projectId}_${Date.now()}`;
    const customApp = initializeApp(customConfig, appName);
    db = customConfig.firestoreDatabaseId
      ? getFirestore(customApp, customConfig.firestoreDatabaseId)
      : getFirestore(customApp);
    try {
      auth = getAuth(customApp);
    } catch {
      // ignore in restricted WebView
    }
    return {
      ok: true,
      projectId: customConfig.projectId,
      isCustom: true,
    };
  } catch (err: any) {
    return {
      ok: false,
      projectId: customConfig?.projectId || defaultFirebaseConfig.projectId,
      isCustom: Boolean(customConfig),
      error: err?.message || String(err),
    };
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on demand
export async function testConnection(): Promise<{
  connected: boolean;
  projectId: string;
  databaseId: string;
  message: string;
}> {
  const cfg = getActiveFirebaseConfig();
  const projectId = cfg.projectId || defaultFirebaseConfig.projectId;
  const databaseId = cfg.firestoreDatabaseId || '(default)';
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return {
      connected: true,
      projectId,
      databaseId,
      message: `Kết nối Firebase Firestore thành công! (Project: ${projectId})`,
    };
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      console.warn('Firebase connection: client appears offline.');
      return {
        connected: false,
        projectId,
        databaseId,
        message: `Máy khách đang ngoại tuyến hoặc không thể kết nối tới Project "${projectId}".`,
      };
    }
    // Even if permission-denied on test/connection, the server responded so network & config are valid
    if (/permission-denied|Missing or insufficient permissions/i.test(msg)) {
      return {
        connected: true,
        projectId,
        databaseId,
        message: `Đã kết nối máy chủ Firebase Project "${projectId}" (Firestore online).`,
      };
    }
    return {
      connected: false,
      projectId,
      databaseId,
      message: `Lỗi kết nối Firebase: ${msg}`,
    };
  }
}


