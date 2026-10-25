import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Database,
  FileSpreadsheet,
  Copy,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Code2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  CustomFirebaseConfig,
  getActiveFirebaseConfig,
  loadSavedCustomFirebaseConfig,
  applyRuntimeFirebaseConfig,
  testConnection,
} from '../firebase/firebase';
import {
  getConfiguredGoogleAppsScriptUrl,
  saveGoogleAppsScriptUrlSetting,
  testGoogleAppsScriptConnection,
  SAMPLE_GOOGLE_APPS_SCRIPT_CODE_GS,
  PreferredPrimaryCloud,
  getPreferredPrimaryCloud,
  setPreferredPrimaryCloud,
} from '../services/roomService';
import { copyTextToClipboard } from '../utils/browserSafeguards';

interface DualCloudConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (summaryMessage: string) => void;
  onConfigUpdated?: () => void;
}

export const DualCloudConfigModal: React.FC<DualCloudConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  onConfigUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'firebase' | 'google_sheets'>('firebase');

  // Tab 1: Firebase Config State
  const [fbRawJsonInput, setFbRawJsonInput] = useState<string>('');
  const [fbApiKey, setFbApiKey] = useState<string>('');
  const [fbProjectId, setFbProjectId] = useState<string>('');
  const [fbDatabaseUrl, setFbDatabaseUrl] = useState<string>('');
  const [fbAuthDomain, setFbAuthDomain] = useState<string>('');
  const [fbStorageBucket, setFbStorageBucket] = useState<string>('');
  const [fbAppId, setFbAppId] = useState<string>('');
  const [fbFirestoreDbId, setFbFirestoreDbId] = useState<string>('');
  const [isUsingCustomFb, setIsUsingCustomFb] = useState<boolean>(false);
  const [isTestingFb, setIsTestingFb] = useState<boolean>(false);
  const [fbStatus, setFbStatus] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);

  // Tab 2: Google Sheets & Drive (Apps Script Web App URL) State
  const [gasUrlInput, setGasUrlInput] = useState<string>('');
  const [isTestingGas, setIsTestingGas] = useState<boolean>(false);
  const [isSavingGas, setIsSavingGas] = useState<boolean>(false);
  const [gasStatus, setGasStatus] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);
  const [copiedCodeGs, setCopiedCodeGs] = useState<boolean>(false);
  const [showCodeGsPreview, setShowCodeGsPreview] = useState<boolean>(true);
  const [preferredPrimary, setPreferredPrimary] = useState<PreferredPrimaryCloud>('firebase');

  useEffect(() => {
    if (!isOpen) return;

    const customFb = loadSavedCustomFirebaseConfig();
    const activeFb = getActiveFirebaseConfig();
    setIsUsingCustomFb(Boolean(customFb));
    setFbApiKey(activeFb.apiKey || '');
    setFbProjectId(activeFb.projectId || '');
    setFbDatabaseUrl(activeFb.databaseURL || '');
    setFbAuthDomain(activeFb.authDomain || '');
    setFbStorageBucket(activeFb.storageBucket || '');
    setFbAppId(activeFb.appId || '');
    setFbFirestoreDbId(activeFb.firestoreDatabaseId || '');
    setFbRawJsonInput(JSON.stringify(activeFb, null, 2));

    const savedGas = getConfiguredGoogleAppsScriptUrl();
    setGasUrlInput(savedGas);
    setPreferredPrimary(getPreferredPrimaryCloud());

    // Run automatic Firebase connection check when modal opens
    handleCheckFirebaseConnection();
  }, [isOpen]);

  if (!isOpen) return null;

  // Parse pasted firebaseConfig snippet (supports both strict JSON and JS object literal `const firebaseConfig = { ... }`)
  const handleParseRawFirebaseSnippet = (rawText: string) => {
    setFbRawJsonInput(rawText);
    const extractField = (key: string): string => {
      const regex = new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`, 'i');
      const m = rawText.match(regex);
      return m && m[1] ? m[1].trim() : '';
    };

    const parsedApiKey = extractField('apiKey');
    const parsedProjectId = extractField('projectId');
    const parsedDbUrl = extractField('databaseURL');
    const parsedAuthDomain = extractField('authDomain');
    const parsedBucket = extractField('storageBucket');
    const parsedAppId = extractField('appId');
    const parsedFirestoreDbId = extractField('firestoreDatabaseId');

    if (parsedApiKey) setFbApiKey(parsedApiKey);
    if (parsedProjectId) setFbProjectId(parsedProjectId);
    if (parsedDbUrl) setFbDatabaseUrl(parsedDbUrl);
    if (parsedAuthDomain) setFbAuthDomain(parsedAuthDomain);
    if (parsedBucket) setFbStorageBucket(parsedBucket);
    if (parsedAppId) setFbAppId(parsedAppId);
    if (parsedFirestoreDbId) setFbFirestoreDbId(parsedFirestoreDbId);
  };

  const handleCheckFirebaseConnection = async () => {
    setIsTestingFb(true);
    try {
      const res = await testConnection();
      setFbStatus({
        connected: res.connected,
        message: res.message,
      });
    } finally {
      setIsTestingFb(false);
    }
  };

  const handleSaveFirebaseConfig = async () => {
    if (!fbApiKey.trim() || !fbProjectId.trim()) {
      setFbStatus({
        connected: false,
        message: 'Vui lòng nhập đầy đủ ít nhất apiKey và projectId của Firebase!',
      });
      return;
    }

    const newConfig: CustomFirebaseConfig = {
      apiKey: fbApiKey.trim(),
      projectId: fbProjectId.trim(),
      ...(fbDatabaseUrl.trim() ? { databaseURL: fbDatabaseUrl.trim() } : {}),
      ...(fbAuthDomain.trim() ? { authDomain: fbAuthDomain.trim() } : {}),
      ...(fbStorageBucket.trim() ? { storageBucket: fbStorageBucket.trim() } : {}),
      ...(fbAppId.trim() ? { appId: fbAppId.trim() } : {}),
      ...(fbFirestoreDbId.trim() ? { firestoreDatabaseId: fbFirestoreDbId.trim() } : {}),
    };

    const applied = applyRuntimeFirebaseConfig(newConfig);
    if (!applied.ok) {
      setFbStatus({
        connected: false,
        message: `Không thể khởi tạo Firebase Config: ${applied.error}`,
      });
      return;
    }

    setIsUsingCustomFb(true);
    await handleCheckFirebaseConnection();
    onConfigSaved?.(`Đã lưu cấu hình Firebase (Project: ${newConfig.projectId})!`);
    onConfigUpdated?.();
  };

  const handleRestoreDefaultFirebase = async () => {
    applyRuntimeFirebaseConfig(null);
    const activeFb = getActiveFirebaseConfig();
    setIsUsingCustomFb(false);
    setFbApiKey(activeFb.apiKey || '');
    setFbProjectId(activeFb.projectId || '');
    setFbDatabaseUrl(activeFb.databaseURL || '');
    setFbAuthDomain(activeFb.authDomain || '');
    setFbStorageBucket(activeFb.storageBucket || '');
    setFbAppId(activeFb.appId || '');
    setFbFirestoreDbId(activeFb.firestoreDatabaseId || '');
    setFbRawJsonInput(JSON.stringify(activeFb, null, 2));
    await handleCheckFirebaseConnection();
    onConfigSaved?.(`Đã khôi phục cấu hình Firebase mặc định (${activeFb.projectId})!`);
    onConfigUpdated?.();
  };

  const handleTestGoogleAppsScript = async () => {
    setIsTestingGas(true);
    setGasStatus(null);
    try {
      const res = await testGoogleAppsScriptConnection(gasUrlInput);
      setGasStatus(res);
    } finally {
      setIsTestingGas(false);
    }
  };

  const handleSaveGoogleAppsScriptUrl = async () => {
    setIsSavingGas(true);
    try {
      const cleaned = await saveGoogleAppsScriptUrlSetting(gasUrlInput);
      setPreferredPrimaryCloud(preferredPrimary);
      if (cleaned) {
        setGasStatus({
          connected: true,
          message:
            'Đã lưu đường dẫn Google Apps Script Web App URL! Hệ thống sẽ tự động lưu đề song song (Dual Save) và đồng bộ điểm vào Google Sheets.',
        });
        onConfigSaved?.(
          'Đã kích hoạt Lưu Trữ Đám Mây Kép (Firebase + Google Sheets & Google Drive)!'
        );
        onConfigUpdated?.();
      } else {
        setGasStatus({
          connected: false,
          message: 'Đã xóa đường dẫn Web App URL. Hệ thống hiện chỉ sử dụng Firebase.',
        });
        onConfigUpdated?.();
      }
    } finally {
      setIsSavingGas(false);
    }
  };

  const handleCopySampleCodeGs = async () => {
    await copyTextToClipboard(SAMPLE_GOOGLE_APPS_SCRIPT_CODE_GS);
    setCopiedCodeGs(true);
    setTimeout(() => setCopiedCodeGs(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-950 via-indigo-900 to-teal-900 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 shrink-0">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  DUAL CLOUD SYNC • ĐỒNG BỘ ĐÁM MÂY KÉP
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-black tracking-tight mt-0.5">
                ⚙️ Cấu hình Cloud: Firebase &amp; Google Sheets + Drive
              </h2>
              <p className="text-xs text-indigo-200">
                Chạy song song cả Firebase Firestore VÀ Google Sheets + Google Drive (Lưu đề kép • Tải đề tự động dự phòng • Đồng bộ điểm kép)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cloud Platform Switch Tabs */}
        <div className="bg-slate-100 px-5 pt-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('firebase')}
              className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-2 border-t border-x transition-all cursor-pointer ${
                activeTab === 'firebase'
                  ? 'bg-white text-indigo-700 border-slate-200 shadow-2xs'
                  : 'bg-slate-200/70 text-slate-600 border-transparent hover:bg-white/60'
              }`}
            >
              <Database className="w-4 h-4 text-amber-500" />
              <span>Tab 1: Firebase Config (Firestore / Realtime DB)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-extrabold">
                Đang bật
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('google_sheets')}
              className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-2 border-t border-x transition-all cursor-pointer ${
                activeTab === 'google_sheets'
                  ? 'bg-white text-emerald-700 border-slate-200 shadow-2xs'
                  : 'bg-slate-200/70 text-slate-600 border-transparent hover:bg-white/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Tab 2: Google Sheets &amp; Drive (Apps Script Web App URL)</span>
              {gasUrlInput.trim() ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-extrabold">
                  Đã cấu hình
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
                  Tùy chọn / Khuyên dùng
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
          {/* =================================================================
              TAB 1: FIREBASE CONFIG
              ================================================================= */}
          {activeTab === 'firebase' && (
            <div className="space-y-5">
              {/* Connection Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                  fbStatus?.connected !== false
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {fbStatus?.connected !== false ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <div className="font-bold text-xs sm:text-sm">
                      {fbStatus?.message ||
                        `Đang kết nối tới Firebase Project: ${fbProjectId || 'Mặc định'}`}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Cấu trúc chuẩn: <code className="font-mono font-bold">exam_rooms/&#123;roomCode&#125;</code> (Gói câu hỏi &lt; 450KB) &amp;{' '}
                      <code className="font-mono font-bold">exam_submissions/&#123;roomCode&#125;/students</code>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckFirebaseConnection}
                  disabled={isTestingFb}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingFb ? 'animate-spin' : ''}`} />
                  <span>{isTestingFb ? 'Đang kiểm tra...' : 'Kiểm tra kết nối Firebase'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Column: Paste raw firebaseConfig */}
                <div className="lg:col-span-5 space-y-2">
                  <label className="block text-xs font-extrabold text-slate-800 uppercase">
                    Dán nhanh đoạn mã firebaseConfig (Tự động tách trường):
                  </label>
                  <textarea
                    rows={9}
                    value={fbRawJsonInput}
                    onChange={(e) => handleParseRawFirebaseSnippet(e.target.value)}
                    placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  projectId: "my-exam-app",\n  databaseURL: "https://..."\n};`}
                    className="w-full font-mono text-xs p-3 rounded-xl border border-slate-300 bg-slate-900 text-emerald-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500">
                    Bạn có thể giữ nguyên Firebase tích hợp sẵn của hệ thống hoặc dán{' '}
                    <code className="font-mono font-bold">firebaseConfig</code> riêng của trường/cá nhân.
                  </p>
                </div>

                {/* Right Column: Structured fields */}
                <div className="lg:col-span-7 bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 uppercase">
                      Chi tiết thông số Firebase Config:
                    </span>
                    {isUsingCustomFb ? (
                      <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                        Đang dùng Firebase tùy chỉnh
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        Đang dùng Firebase mặc định của App
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        apiKey <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={fbApiKey}
                        onChange={(e) => setFbApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full font-mono border border-slate-300 rounded-xl p-2 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        projectId <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={fbProjectId}
                        onChange={(e) => setFbProjectId(e.target.value)}
                        placeholder="my-firebase-project"
                        className="w-full font-mono border border-slate-300 rounded-xl p-2 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        databaseURL (Realtime DB - Tùy chọn)
                      </label>
                      <input
                        type="text"
                        value={fbDatabaseUrl}
                        onChange={(e) => setFbDatabaseUrl(e.target.value)}
                        placeholder="https://...firebaseio.com"
                        className="w-full font-mono border border-slate-300 rounded-xl p-2 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        firestoreDatabaseId (Tùy chọn)
                      </label>
                      <input
                        type="text"
                        value={fbFirestoreDbId}
                        onChange={(e) => setFbFirestoreDbId(e.target.value)}
                        placeholder="(default)"
                        className="w-full font-mono border border-slate-300 rounded-xl p-2 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">authDomain</label>
                      <input
                        type="text"
                        value={fbAuthDomain}
                        onChange={(e) => setFbAuthDomain(e.target.value)}
                        placeholder="project.firebaseapp.com"
                        className="w-full font-mono border border-slate-300 rounded-xl p-2 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">appId</label>
                      <input
                        type="text"
                        value={fbAppId}
                        onChange={(e) => setFbAppId(e.target.value)}
                        placeholder="1:123456:web:abcdef"
                        className="w-full font-mono border border-slate-300 rounded-xl p-2 bg-white"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                    {isUsingCustomFb && (
                      <button
                        type="button"
                        onClick={handleRestoreDefaultFirebase}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 cursor-pointer"
                      >
                        Khôi phục Firebase mặc định
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveFirebaseConfig}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Lưu &amp; Áp dụng Firebase Config</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 2: GOOGLE SHEETS & GOOGLE DRIVE (APPS SCRIPT WEB APP URL)
              ================================================================= */}
          {activeTab === 'google_sheets' && (
            <div className="space-y-5">
              {/* Top explanation & Web App URL Input */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 p-5 rounded-2xl border-2 border-emerald-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300 uppercase">
                      GOOGLE SHEETS + GOOGLE DRIVE (APPS SCRIPT WEB APP)
                    </span>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 mt-1">
                      Đường dẫn Web App URL (Lưu file Exam_&#123;roomCode&#125;.json lên Drive &amp; ghi bảng điểm vào Google Sheets)
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopySampleCodeGs}
                    className="px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 flex items-center gap-2 cursor-pointer transition-all"
                  >
                    {copiedCodeGs ? (
                      <>
                        <Check className="w-4 h-4 text-amber-300" />
                        <span>Đã Copy toàn bộ mã Code.gs mẫu!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-amber-300" />
                        <span>📋 Copy mã Code.gs mẫu (Đầy đủ doPost &amp; doGet)</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <input
                    type="url"
                    value={gasUrlInput}
                    onChange={(e) => {
                      setGasUrlInput(e.target.value);
                      setGasStatus(null);
                    }}
                    placeholder="Dán đường dẫn Web App URL: https://script.google.com/macros/s/.../exec"
                    className="flex-1 font-mono text-base sm:text-xs font-bold text-slate-900 bg-white border-2 border-emerald-400 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />

                  <button
                    type="button"
                    onClick={handleTestGoogleAppsScript}
                    disabled={isTestingGas || !gasUrlInput.trim()}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingGas ? 'animate-spin' : ''}`} />
                    <span>{isTestingGas ? 'Đang thử...' : 'Kiểm tra kết nối'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveGoogleAppsScriptUrl}
                    disabled={isSavingGas}
                    className="px-4 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSavingGas ? 'Đang lưu...' : 'Lưu Cấu Hình Cloud Kép'}</span>
                  </button>
                </div>

                {gasStatus && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                      gasStatus.connected
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-950'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                  >
                    {gasStatus.connected ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{gasStatus.message}</span>
                  </div>
                )}

                {/* Smart Failover Priority Selector */}
                <div className="pt-2 border-t border-emerald-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    Chế độ Học sinh tải đề tự động dự phòng (Smart Failover Load):
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPreferredPrimary('firebase');
                        setPreferredPrimaryCloud('firebase');
                      }}
                      className={`px-3 py-1 rounded-lg font-bold border text-[11px] cursor-pointer ${
                        preferredPrimary === 'firebase'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Ưu tiên 1: Firebase (Tự động dự phòng Google Drive)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreferredPrimary('google_sheets');
                        setPreferredPrimaryCloud('google_sheets');
                      }}
                      className={`px-3 py-1 rounded-lg font-bold border text-[11px] cursor-pointer ${
                        preferredPrimary === 'google_sheets'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Ưu tiên 1: Google Drive/Sheets (Tự động dự phòng Firebase)
                    </button>
                  </div>
                </div>
              </div>

              {/* Ready-to-copy Code.gs Template Viewer */}
              <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">
                      Mã nguồn Google Apps Script chuẩn (Code.gs) — Tự động tạo thư mục Drive + Sheet DanhSachDeThi &amp; KetQuaThi
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCodeGsPreview((prev) => !prev)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer"
                    >
                      {showCodeGsPreview ? 'Thu gọn mã' : 'Xem toàn bộ mã Code.gs'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopySampleCodeGs}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedCodeGs ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Đã Copy!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>📋 Copy mã Code.gs mẫu</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {showCodeGsPreview && (
                  <pre className="p-4 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-64 leading-relaxed">
                    {SAMPLE_GOOGLE_APPS_SCRIPT_CODE_GS}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              ✅ Đã bật Firebase Firestore
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold border ${
                gasUrlInput.trim()
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {gasUrlInput.trim()
                ? '✅ Đã kết nối Google Sheets & Drive'
                : '○ Google Sheets & Drive (Chưa dán URL)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer"
            >
              Đóng hộp thoại
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
