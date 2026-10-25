import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Check,
  FileSpreadsheet,
  AlertCircle,
  LogIn,
  ChevronRight,
  Shuffle,
  QrCode,
  Share2,
  FolderKanban,
  Sparkles,
  ExternalLink,
  X,
  BookOpen,
  Clock,
  GraduationCap,
  Loader2,
  Settings,
  Database,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import { ExamData } from '../types/exam';
import {
  ExamRoomDoc,
  StudentSubmissionDoc,
  createExamRoom,
  findRoomByCode,
  subscribeToPublishedExams,
  subscribeToSubmissions,
  updateRoomStatus,
  deleteRoom,
  isValid4DigitCode,
  generateRandom4DigitCode,
  isAisDevOrigin,
  getBrowserCurrentBaseUrl,
  normalizePublicBaseUrl,
  getResolvedPublicAppUrl,
  savePublicAppUrlSetting,
  loadPublicAppUrlSetting,
  resetPublicAppUrlToCurrentOrigin,
  purgeLegacyRunAppUrlsFromStorage,
  loadGoogleAppsScriptUrlSetting,
  getConfiguredGoogleAppsScriptUrl,
  saveExamToGoogleSheetsAndDrive,
  buildStudentRoomLink,
  formatStudentFullName,
  formatFirebasePublishError,
  loadRoomFromLocalBackup,
  PUBLIC_APP_URL_STORAGE_KEY,
} from '../services/roomService';
import {
  TeacherAccountDoc,
  canUserManageExamRoom,
  normalizeUsername,
} from '../services/authService';
import { copyTextToClipboard, safeLocalStorage } from '../utils/browserSafeguards';
import { DualCloudConfigModal } from './DualCloudConfigModal';

interface OnlineRoomManagerProps {
  currentExam: ExamData;
  initialRoomCode?: string | null;
  standaloneStudentMode?: boolean;
  currentUser?: TeacherAccountDoc | null;
  onOpenLoginModal?: () => void;
  onOpenTeacherManagementModal?: () => void;
  onExitStandaloneStudentMode?: () => void;
  onUpdateExamMetadata?: (examCode: string, grade: string, durationMinutes: number, examTitle: string) => void;
  onStudentStartTest: (
    room: ExamRoomDoc,
    studentInfo: { name: string; className: string; sbd: string }
  ) => void;
}

const PRESET_CLASSES = ['Khối 10', 'Khối 11', 'Khối 12', '10A1', '11A1', '11A2', '12A1', '12A2'];
const STUDENT_QUICK_CLASSES = ['10A1', '10A2', '11A1', '11A2', '12A1', '12A2'];

export const OnlineRoomManager: React.FC<OnlineRoomManagerProps> = ({
  currentExam,
  initialRoomCode,
  standaloneStudentMode = false,
  currentUser,
  onOpenLoginModal,
  onOpenTeacherManagementModal,
  onExitStandaloneStudentMode,
  onUpdateExamMetadata,
  onStudentStartTest,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'teacher' | 'student'>(
    standaloneStudentMode || initialRoomCode || !currentUser ? 'student' : 'teacher'
  );

  // Teacher states
  const [publishedExams, setPublishedExams] = useState<ExamRoomDoc[]>([]);
  const [adminTeacherFilter, setAdminTeacherFilter] = useState<string>('ALL');
  const [roomSubmissionStats, setRoomSubmissionStats] = useState<
    Record<string, { count: number; avgScore: string }>
  >({});
  const [activeRoom, setActiveRoom] = useState<ExamRoomDoc | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmissionDoc[]>([]);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [publishProgressMsg, setPublishProgressMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [publishSuccessBanner, setPublishSuccessBanner] = useState<string | null>(null);

  // Required Configuration Form before Publishing Exam
  const [examCodeInput, setExamCodeInput] = useState<string>(() => {
    const existing = (currentExam?.metadata?.examCode || '').trim();
    return /^\d{4}$/.test(existing) ? existing : '1003';
  });
  const [targetClass, setTargetClass] = useState<string>(() => {
    const g = (currentExam?.metadata?.grade || '12').trim();
    if (g === '10' || g === '11' || g === '12') return `Khối ${g}`;
    return g || '12A1';
  });
  const [roomTitle, setRoomTitle] = useState<string>(
    currentExam?.metadata?.examTitle || 'Đề kiểm tra định kỳ'
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(
    currentExam?.metadata?.durationMinutes || 45
  );
  const [allowReview, setAllowReview] = useState<boolean>(true);

  // Copy & QR states
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);
  const [copiedMsgKey, setCopiedMsgKey] = useState<string | null>(null);
  const [qrModalRoom, setQrModalRoom] = useState<ExamRoomDoc | null>(null);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentSubmissionDoc | null>(
    null
  );
  const [isCloudConfigModalOpen, setIsCloudConfigModalOpen] = useState<boolean>(false);
  const [syncingGoogleRoomCode, setSyncingGoogleRoomCode] = useState<string | null>(null);
  const [hasAppsScriptConfigured, setHasAppsScriptConfigured] = useState<boolean>(() =>
    Boolean(getConfiguredGoogleAppsScriptUrl())
  );

  // Public App URL configuration state (empty = use exact window.location.origin)
  const [publicAppUrlInput, setPublicAppUrlInput] = useState<string>(() => {
    purgeLegacyRunAppUrlsFromStorage();
    if (typeof window !== 'undefined') {
      const saved = safeLocalStorage.getItem(PUBLIC_APP_URL_STORAGE_KEY) || '';
      if (/run\.app/i.test(saved)) {
        safeLocalStorage.removeItem(PUBLIC_APP_URL_STORAGE_KEY);
        return '';
      }
      return saved;
    }
    return '';
  });
  const [isSavingPublicUrl, setIsSavingPublicUrl] = useState<boolean>(false);
  const [publicUrlSavedBanner, setPublicUrlSavedBanner] = useState<string | null>(null);
  const isRunningOnDevDomain =
    typeof window !== 'undefined' && isAisDevOrigin(window.location.origin);

  // Student joining states
  const [joinCode, setJoinCode] = useState<string>(() =>
    initialRoomCode ? initialRoomCode.replace(/\D/g, '').slice(0, 4) : ''
  );
  const [previewedStudentRoom, setPreviewedStudentRoom] = useState<ExamRoomDoc | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  const [studentClass, setStudentClass] = useState<string>('12A1');
  const [studentSbd, setStudentSbd] = useState<string>('');
  const [isSearchingRoom, setIsSearchingRoom] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Sync when initialRoomCode, standaloneStudentMode, or currentUser prop changes
  useEffect(() => {
    if (standaloneStudentMode || !currentUser) {
      setActiveSubTab('student');
      return;
    }
    if (initialRoomCode && initialRoomCode.trim()) {
      const clean = initialRoomCode.replace(/\D/g, '').slice(0, 4);
      setActiveSubTab('student');
      if (clean) {
        setJoinCode(clean);
      }
      return;
    }
    setActiveSubTab('teacher');
  }, [initialRoomCode, standaloneStudentMode, currentUser]);

  // Auto-lookup room details when student types a 4-digit code or arrives via ?room=1003
  useEffect(() => {
    const clean = joinCode.trim();
    if (!isValid4DigitCode(clean)) {
      setPreviewedStudentRoom(null);
      return;
    }
    let cancelled = false;
    findRoomByCode(clean)
      .then((found) => {
        if (!cancelled) {
          setPreviewedStudentRoom(found);
          if (found && found.targetClass && !found.targetClass.startsWith('Khối')) {
            setStudentClass((prev) => prev || found.targetClass || '12A1');
          }
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewedStudentRoom(null);
      });
    return () => {
      cancelled = true;
    };
  }, [joinCode]);

  // Subscribe to all published exams in Firebase `exam_rooms` / `exams` collection
  useEffect(() => {
    if (standaloneStudentMode) return;
    const unsubscribe = subscribeToPublishedExams(
      (examsList) => {
        setPublishedExams(examsList);
      },
      (err) => {
        console.error('Published exams subscription error:', err);
      }
    );
    return () => unsubscribe();
  }, [standaloneStudentMode]);

  // Subscribe to live submission statistics per roomCode across publishedExams
  useEffect(() => {
    if (standaloneStudentMode || publishedExams.length === 0) return;

    const unsubscribers = publishedExams.map((room) => {
      const code = room.roomCode || room.id;
      return subscribeToSubmissions(code, (subsList) => {
        const count = subsList.length;
        const avgScore =
          count > 0
            ? (subsList.reduce((acc, s) => acc + s.scoreTotal, 0) / count).toFixed(2)
            : '0.00';
        setRoomSubmissionStats((prev) => ({
          ...prev,
          [code]: { count, avgScore },
        }));
      });
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [publishedExams, standaloneStudentMode]);

  // Subscribe to real-time submissions when activeRoom is selected
  useEffect(() => {
    if (!activeRoom) return;

    const unsubscribe = subscribeToSubmissions(
      activeRoom.roomCode || activeRoom.id,
      (newList) => {
        setSubmissions(newList);
      },
      (err) => {
        console.error('Realtime subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [activeRoom]);

  // Generate unique 4-digit code
  const handleGenerateRandomCode = () => {
    const existingCodes = publishedExams.map((e) => e.roomCode);
    const newCode = generateRandom4DigitCode(existingCodes);
    setExamCodeInput(newCode);
    setFormError(null);
  };

  // Load saved custom Public App URL and Google Apps Script Web App URL from Firebase settings (`settings/publicConfig`) on mount
  useEffect(() => {
    purgeLegacyRunAppUrlsFromStorage();
    let mounted = true;
    if (!standaloneStudentMode) {
      loadPublicAppUrlSetting()
        .then((customSavedUrl) => {
          if (mounted) {
            setPublicAppUrlInput(customSavedUrl && !/run\.app/i.test(customSavedUrl) ? customSavedUrl : '');
          }
        })
        .catch(() => {
          // fallback already handled
        });
    }
    loadGoogleAppsScriptUrlSetting()
      .then((savedScriptUrl) => {
        if (mounted) {
          setHasAppsScriptConfigured(Boolean(savedScriptUrl));
        }
      })
      .catch(() => {
        // fallback already handled
      });
    return () => {
      mounted = false;
    };
  }, [standaloneStudentMode]);

  // Reset Public App URL directly to window.location.origin
  const handleResetToCurrentOrigin = async () => {
    setPublicAppUrlInput('');
    try {
      setIsSavingPublicUrl(true);
      const currentOrigin = await resetPublicAppUrlToCurrentOrigin();
      setPublicUrlSavedBanner(
        `Đã đặt lại theo tên miền hiện tại (window.location.origin): ${currentOrigin}`
      );
      setTimeout(() => setPublicUrlSavedBanner(null), 4000);
    } finally {
      setIsSavingPublicUrl(false);
    }
  };

  // Save Public App URL to localStorage and Firebase settings
  const handleSavePublicAppUrl = async (customUrl?: string) => {
    const rawToSave = (customUrl !== undefined ? customUrl : publicAppUrlInput).trim();
    const normalized = rawToSave && !/run\.app/i.test(rawToSave) ? normalizePublicBaseUrl(rawToSave) : '';
    setPublicAppUrlInput(normalized);
    try {
      setIsSavingPublicUrl(true);
      await savePublicAppUrlSetting(normalized);
      const effectiveBase = normalized || getResolvedPublicAppUrl();
      setPublicUrlSavedBanner(
        normalized
          ? `Đã lưu Tên miền Public tùy chỉnh: ${normalized} (Đồng bộ vào LINK GỬI HS, Tin nhắn giao bài & Mã QR)`
          : `Đã đặt về tên miền hiện tại của trình duyệt: ${effectiveBase}`
      );
      setTimeout(() => setPublicUrlSavedBanner(null), 4000);
    } finally {
      setIsSavingPublicUrl(false);
    }
  };

  // Auto-save custom URL to safeLocalStorage as teacher edits the input
  const handlePublicUrlInputChange = (val: string) => {
    if (/run\.app/i.test(val)) {
      purgeLegacyRunAppUrlsFromStorage();
      setPublicAppUrlInput('');
      return;
    }
    setPublicAppUrlInput(val);
    const trimmed = val.trim();
    if (trimmed) {
      safeLocalStorage.setItem(PUBLIC_APP_URL_STORAGE_KEY, normalizePublicBaseUrl(trimmed));
    } else {
      safeLocalStorage.removeItem(PUBLIC_APP_URL_STORAGE_KEY);
    }
  };

  // Build direct student exam link: ${window.location.origin}/?mode=student&room=${roomCode}
  const getDirectRoomUrl = (roomCode: string): string => {
    return buildStudentRoomLink(roomCode, publicAppUrlInput);
  };

  // Build formatted assignment message for Zalo / Messenger / Classroom
  const buildAssignmentMessage = (room: ExamRoomDoc): string => {
    const directUrl = getDirectRoomUrl(room.roomCode);
    const assignedClass = room.targetClass || room.grade || 'Khối 12';
    return [
      `📢 THÔNG BÁO LÀM BÀI KIỂM TRA TRỰC TUYẾN`,
      `📝 Tên đề thi: ${room.title}`,
      `🏫 Lớp áp dụng: ${assignedClass}`,
      `⏱ Thời gian làm bài: ${room.durationMinutes} phút`,
      `🔑 Mã phòng thi (4 số): ${room.roomCode}`,
      `👉 LINK GỬI HS (Vào thi trực tiếp): ${directUrl}`,
      `(Học sinh nhấn trực tiếp vào link trên hoặc quét Mã QR để mở thẳng bài thi mã ${room.roomCode})`,
    ].join('\n');
  };

  // Copy 4-digit Room Code (with hidden textarea execCommand('copy') fallback for Zalo/Facebook WebViews)
  const handleCopyRoomCode = async (roomCode: string) => {
    await copyTextToClipboard(roomCode);
    setCopiedCodeKey(roomCode);
    setTimeout(() => setCopiedCodeKey(null), 2200);
  };

  // Copy direct student Public Link (LINK GỬI HS)
  const handleCopyDirectLink = async (roomCode: string) => {
    const directUrl = getDirectRoomUrl(roomCode);
    await copyTextToClipboard(directUrl);
    setCopiedLinkKey(roomCode);
    setTimeout(() => setCopiedLinkKey(null), 2200);
  };

  // Copy full assignment message
  const handleCopyAssignmentMessage = async (room: ExamRoomDoc) => {
    const msg = buildAssignmentMessage(room);
    await copyTextToClipboard(msg);
    setCopiedMsgKey(room.roomCode);
    setTimeout(() => setCopiedMsgKey(null), 2500);
  };

  // Handle Publish & Save to Firebase (`exams/{roomCode}`)
  const handleCreateRoom = async () => {
    const cleanCode = examCodeInput.trim();
    if (!isValid4DigitCode(cleanCode)) {
      setFormError(
        'Mã đề thi / Mã phòng thi bắt buộc phải đúng định dạng 4 chữ số (ví dụ: 1003, 1001, 2026)!'
      );
      return;
    }
    if (!targetClass.trim()) {
      setFormError('Vui lòng chọn hoặc nhập Khối / Lớp áp dụng (ví dụ: Khối 12, 12A1)!');
      return;
    }
    if (!roomTitle.trim()) {
      setFormError('Vui lòng nhập Tên đề thi trước khi xuất bản!');
      return;
    }
    if (!durationMinutes || durationMinutes <= 0) {
      setFormError('Thời gian làm bài phải lớn hơn 0 phút!');
      return;
    }

    try {
      setIsCreating(true);
      setFormError(null);
      setPublishSuccessBanner(null);
      setPublishProgressMsg('Đang chuẩn bị dữ liệu & nén ảnh câu hỏi (WebP 65% / JPEG 70%)...');

      const cleanClass = targetClass.trim();
      const cleanTitle = roomTitle.trim();

      if (onUpdateExamMetadata) {
        onUpdateExamMetadata(cleanCode, cleanClass, durationMinutes, cleanTitle);
      }

      // Prevent a regular teacher from accidentally overwriting another teacher's room code
      const existingWithSameCode = publishedExams.find((r) => r.roomCode === cleanCode);
      if (
        existingWithSameCode &&
        currentUser &&
        currentUser.role !== 'admin' &&
        !canUserManageExamRoom(currentUser, existingWithSameCode)
      ) {
        setFormError(
          `Mã phòng ${cleanCode} đã được tạo bởi giáo viên khác (${
            existingWithSameCode.createdByName || existingWithSameCode.teacherName || 'Admin'
          }). Vui lòng bấm "Tạo mã ngẫu nhiên" hoặc chọn mã 4 số khác!`
        );
        setIsCreating(false);
        setPublishProgressMsg(null);
        return;
      }

      const creatorInfo = currentUser
        ? {
            username: currentUser.username,
            fullName: currentUser.fullName,
            role: currentUser.role,
            schoolOrDepartment: currentUser.schoolOrDepartment,
          }
        : {
            username: 'admin',
            fullName: 'GV: VANHA (Quản trị viên)',
            role: 'admin' as const,
            schoolOrDepartment: 'Quản trị hệ thống',
          };

      const newRoom = await createExamRoom(
        {
          ...currentExam,
          metadata: {
            ...currentExam.metadata,
            examTitle: cleanTitle,
            examCode: cleanCode,
            grade: cleanClass,
            durationMinutes,
          },
        },
        durationMinutes,
        creatorInfo.fullName,
        allowReview,
        cleanCode,
        cleanClass,
        (stepMsg) => setPublishProgressMsg(stepMsg),
        creatorInfo
      );

      setActiveRoom(newRoom);
      const chunkNote =
        newRoom.chunkCount && newRoom.chunkCount > 0
          ? ` (Đã nén ảnh WebP 65% & chia thành ${newRoom.chunkCount} gói chunks an toàn < 450KB/gói)`
          : '';
      const cloudStatusParts: string[] = [];
      if (newRoom.savedFirebase !== false) {
        cloudStatusParts.push('✅ Đã lưu Firebase');
      }
      if (newRoom.savedGoogleSheets) {
        cloudStatusParts.push('✅ Đã lưu Google Drive/Sheets');
      }
      const dualBadgeStr =
        cloudStatusParts.length > 0 ? ` [${cloudStatusParts.join(' • ')}]` : '';
      setPublishSuccessBanner(
        `Đã xuất bản đề thi Mã phòng ${newRoom.roomCode} thành công${dualBadgeStr}${chunkNote}! Lớp: ${cleanClass}`
      );
    } catch (err: any) {
      console.error('Publish exam room error:', err);
      const friendlyErr = formatFirebasePublishError(err);
      setFormError(friendlyErr);
      // Even if remote Firestore threw an error, restore the local backup room so teacher can still test/share immediately
      const backupRoom = loadRoomFromLocalBackup(cleanCode);
      if (backupRoom) {
        setActiveRoom(backupRoom);
      }
    } finally {
      setIsCreating(false);
      setPublishProgressMsg(null);
    }
  };

  // Manually sync an existing room to Google Drive & Google Sheets
  const handleSyncRoomToGoogleDrive = async (room: ExamRoomDoc) => {
    const scriptUrl = getConfiguredGoogleAppsScriptUrl();
    if (!scriptUrl) {
      setIsCloudConfigModalOpen(true);
      return;
    }
    try {
      setSyncingGoogleRoomCode(room.roomCode);
      const fullRoom = (await findRoomByCode(room.roomCode)) || room;
      const res = await saveExamToGoogleSheetsAndDrive(fullRoom, scriptUrl);
      if (res.ok) {
        setPublishedExams((prev) =>
          prev.map((r) =>
            r.roomCode === room.roomCode
              ? {
                  ...r,
                  savedGoogleSheets: true,
                  googleDriveFileId: res.fileId || r.googleDriveFileId,
                  googleDriveFileUrl: res.fileUrl || r.googleDriveFileUrl,
                }
              : r
          )
        );
        if (activeRoom?.roomCode === room.roomCode) {
          setActiveRoom((prev) =>
            prev
              ? {
                  ...prev,
                  savedGoogleSheets: true,
                  googleDriveFileId: res.fileId || prev.googleDriveFileId,
                  googleDriveFileUrl: res.fileUrl || prev.googleDriveFileUrl,
                }
              : prev
          );
        }
        setPublishSuccessBanner(
          `✅ Đã đồng bộ đề thi Mã phòng ${room.roomCode} lên Google Drive (Exam_${room.roomCode}.json) & Google Sheets!`
        );
      } else {
        setFormError(res.message);
      }
    } finally {
      setSyncingGoogleRoomCode(null);
    }
  };

  // Toggle lock / unlock room (Protected by teacher ownership or Admin role)
  const handleToggleRoomStatus = async (roomToToggle?: ExamRoomDoc) => {
    const target = roomToToggle || activeRoom;
    if (!target) return;
    if (currentUser && !canUserManageExamRoom(currentUser, target)) {
      setFormError('Bạn chỉ có quyền Đóng/Mở các phòng thi do chính tài khoản của mình tạo!');
      return;
    }
    const newStatus = target.status === 'open' ? 'closed' : 'open';
    try {
      await updateRoomStatus(target.roomCode || target.id, newStatus);
      if (activeRoom && activeRoom.roomCode === target.roomCode) {
        setActiveRoom({ ...activeRoom, status: newStatus });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete published exam room (Protected by teacher ownership or Admin role)
  const handleDeletePublishedRoom = async (room: ExamRoomDoc) => {
    if (currentUser && !canUserManageExamRoom(currentUser, room)) {
      setFormError('Bạn chỉ có quyền xóa các phòng thi do chính tài khoản của mình tạo!');
      return;
    }
    try {
      await deleteRoom(room.roomCode || room.id);
      if (activeRoom && activeRoom.roomCode === room.roomCode) {
        setActiveRoom(null);
        setSubmissions([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Student searches and enters room (Mandatory 3-field verification: 4-digit roomCode + studentName + studentClass)
  const isStudentRoomCodeValid = isValid4DigitCode(joinCode.trim());
  const isStudentNameValid = studentName.trim().length > 0;
  const isStudentClassValid = studentClass.trim().length > 0;
  const isStudentLoginValid =
    isStudentRoomCodeValid && isStudentNameValid && isStudentClassValid;

  const handleStudentJoin = async () => {
    const cleanCode = joinCode.trim();
    const formattedName = formatStudentFullName(studentName, false);
    const cleanClass = studentClass.trim();

    if (!isValid4DigitCode(cleanCode)) {
      setJoinError('Vui lòng nhập đúng Mã phòng thi gồm 4 chữ số (ví dụ: 3203, 1003)!');
      return;
    }
    if (!formattedName) {
      setJoinError('Vui lòng nhập đầy đủ Họ và tên học sinh!');
      return;
    }
    if (!cleanClass) {
      setJoinError('Vui lòng nhập hoặc chọn Lớp của bạn (ví dụ: 10A1, 11A2, 12A1)!');
      return;
    }

    try {
      setIsSearchingRoom(true);
      setJoinError(null);

      const room = await findRoomByCode(cleanCode);
      if (!room || room.status === 'closed') {
        setJoinError(
          'Mã phòng thi không tồn tại hoặc chưa mở. Vui lòng kiểm tra lại với giáo viên!'
        );
        return;
      }

      setStudentName(formattedName);

      // Enter student exam (OnlineTestRoom automatically shuffles Part I, II, III and grades)
      onStudentStartTest(room, {
        name: formattedName,
        className: cleanClass,
        sbd: studentSbd.trim() || `HS-${Math.floor(100 + Math.random() * 900)}`,
      });
    } catch (err: any) {
      console.error(err);
      setJoinError(
        'Mã phòng thi không tồn tại hoặc chưa mở. Vui lòng kiểm tra lại với giáo viên!'
      );
    } finally {
      setIsSearchingRoom(false);
    }
  };

  // Export submissions to CSV (Excel format)
  const handleExportCsv = () => {
    if (submissions.length === 0) return;

    let csv = '\uFEFF'; // UTF-8 BOM for Excel
    csv +=
      'STT,Mã Phòng,Họ và Tên,Lớp,SBD,Điểm Tổng,Điểm Phần I,Điểm Phần II,Điểm Phần III,Thời gian nộp bài\n';

    submissions.forEach((sub, idx) => {
      csv += `${idx + 1},"${sub.roomCode}","${sub.studentName}","${sub.studentClass}","${sub.studentId}",${sub.scoreTotal},${sub.scorePart1},${sub.scorePart2},${sub.scorePart3},"${sub.submittedAt}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bang_Diem_Phong_${activeRoom?.roomCode || 'Thi'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Analytics computation
  const totalSubmissions = submissions.length;
  const avgScore =
    totalSubmissions > 0
      ? (submissions.reduce((acc, s) => acc + s.scoreTotal, 0) / totalSubmissions).toFixed(2)
      : '0.00';
  const highestScore =
    totalSubmissions > 0
      ? Math.max(...submissions.map((s) => s.scoreTotal)).toFixed(2)
      : '0.00';
  const lowestScore =
    totalSubmissions > 0
      ? Math.min(...submissions.map((s) => s.scoreTotal)).toFixed(2)
      : '0.00';

  const countGioi = submissions.filter((s) => s.scoreTotal >= 8.0).length;
  const countKha = submissions.filter((s) => s.scoreTotal >= 6.5 && s.scoreTotal < 8.0).length;
  const countTB = submissions.filter((s) => s.scoreTotal >= 5.0 && s.scoreTotal < 6.5).length;
  const countYeu = submissions.filter((s) => s.scoreTotal < 5.0).length;

  const isCodeFormatValid = isValid4DigitCode(examCodeInput);
  const isDuplicateCode = publishedExams.some(
    (e) => e.roomCode === examCodeInput.trim()
  );

  const isAdminUser = currentUser?.role === 'admin';

  // Filter publishedExams according to role:
  // - Admin: sees ALL rooms (with optional teacher filter)
  // - Teacher: sees only rooms created by themselves (`canUserManageExamRoom(currentUser, room)`)
  const scopedPublishedExams = publishedExams.filter((room) => {
    if (!currentUser) return false;
    if (isAdminUser) {
      if (adminTeacherFilter === 'ALL') return true;
      const ownerUser = normalizeUsername(
        room.createdByUsername || room.createdBy?.username || 'admin'
      );
      return ownerUser === normalizeUsername(adminTeacherFilter);
    }
    return canUserManageExamRoom(currentUser, room);
  });

  // Distinct creators list for Admin filter dropdown
  const distinctCreators = Array.from(
    new Map(
      publishedExams.map((r) => {
        const u = normalizeUsername(r.createdByUsername || r.createdBy?.username || 'admin');
        const label =
          r.createdByName ||
          r.createdBy?.fullName ||
          r.teacherName ||
          'GV: VANHA (Quản trị viên)';
        return [u, { username: u, fullName: label }];
      })
    ).values()
  );

  return (
    <div className="space-y-6">
      {/* Top role switch tab (Hidden in Standalone Student Portal Mode or when not logged in) */}
      {!standaloneStudentMode && currentUser && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('teacher')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'teacher'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>1. Giáo Viên: Xuất Bản Đề (Mã 4 Số) &amp; Kho Đề Đã Xuất Bản</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('student')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'student'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>2. Học Sinh: Cổng Vào Phòng Thi Trực Tuyến (Mã 4 Số)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdminUser && onOpenTeacherManagementModal && (
              <button
                type="button"
                onClick={onOpenTeacherManagementModal}
                className="px-3.5 py-2 rounded-lg text-xs font-extrabold text-amber-950 bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-300 hover:from-amber-400 hover:to-yellow-400 border border-amber-500/60 shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <span>👥 Quản lý Giáo viên (Cấp quyền)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCloudConfigModalOpen(true)}
              className="px-3.5 py-2 rounded-lg text-xs font-extrabold bg-gradient-to-r from-indigo-900 via-indigo-800 to-emerald-800 hover:from-indigo-950 hover:to-emerald-900 text-white shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
              title="Thiết lập cấu hình Cloud Kép: Firebase & Google Sheets + Google Drive"
            >
              <Settings className="w-3.5 h-3.5 text-amber-300" />
              <span>⚙️ Cấu hình Cloud: Firebase &amp; Google Sheets</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          TEACHER DASHBOARD: CONFIG FORM + PUBLISHED ROOM CARD + REPOSITORY
          ===================================================================== */}
      {!standaloneStudentMode && activeSubTab === 'teacher' && (
        <div className="space-y-6">
          {publishSuccessBanner && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs sm:text-sm text-emerald-950 font-semibold flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{publishSuccessBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setPublishSuccessBanner(null)}
                className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 1: REQUIRED EXAM PUBLISHING CONFIGURATION FORM */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 uppercase">
                    CẤU HÌNH BẮT BUỘC TRƯỚC KHI XUẤT BẢN ĐỀ THI (DUAL CLOUD SYNC)
                  </span>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    Lưu song song Firebase + Google Sheets &amp; Drive
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-2">
                  Thiết lập Mã Đề / Mã Phòng (4 Chữ Số), Lớp &amp; Xuất Bản Đám Mây Kép
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lưu đồng thời toàn bộ 3 phần câu hỏi ({currentExam?.part1?.length ?? 0} câu P.I • {currentExam?.part2?.length ?? 0} câu P.II • {currentExam?.part3?.length ?? 0} câu P.III), đáp án ẩn, hình vẽ minh họa và công thức KaTeX lên <code className="font-mono font-bold text-indigo-700">Firebase (exam_rooms/&#123;roomCode&#125;)</code> VÀ <code className="font-mono font-bold text-emerald-700">Google Drive (Exam_&#123;roomCode&#125;.json) + Google Sheets</code>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCloudConfigModalOpen(true)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Cloud className="w-4 h-4 text-indigo-600" />
                  <span>⚙️ Cấu hình Cloud Kép</span>
                </button>

                <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold text-slate-700">Đề hiện tại:</span>
                  <span className="font-bold text-indigo-700">
                    {(currentExam?.part1?.length ?? 0) +
                      (currentExam?.part2?.length ?? 0) +
                      (currentExam?.part3?.length ?? 0)}{' '}
                    câu (10,0 điểm)
                  </span>
                </div>
              </div>
            </div>

            {formError && (
              <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
              {/* 1. 4-Digit Exam / Room Code */}
              <div className="lg:col-span-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-200/80 space-y-2.5">
                <label className="block text-xs font-bold text-indigo-950">
                  1. Mã đề thi / Mã phòng thi (4 chữ số) <span className="text-rose-600">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={examCodeInput}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setExamCodeInput(digitsOnly);
                      setFormError(null);
                    }}
                    placeholder="VD: 1003"
                    className={`w-full text-center font-mono font-black text-2xl tracking-widest rounded-xl p-2.5 border-2 bg-white focus:outline-none ${
                      isCodeFormatValid
                        ? 'border-indigo-500 text-indigo-900 focus:ring-2 focus:ring-indigo-200'
                        : 'border-rose-400 text-rose-700 focus:ring-2 focus:ring-rose-200'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleGenerateRandomCode}
                    className="shrink-0 px-3 py-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Tự sinh mã 4 chữ số ngẫu nhiên không trùng lặp"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Tạo mã ngẫu nhiên</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  {isCodeFormatValid ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Hợp lệ (^\d&#123;4&#125;$): Document ID ={' '}
                      <code className="font-mono font-bold">exams/{examCodeInput}</code>
                    </span>
                  ) : (
                    <span className="text-rose-600 font-semibold">
                      Bắt buộc nhập đúng 4 chữ số (VD: 1003, 1001, 2026)
                    </span>
                  )}
                </div>

                {isDuplicateCode && isCodeFormatValid && (
                  <div className="text-[11px] text-amber-800 bg-amber-100/80 border border-amber-300 px-2.5 py-1 rounded-lg">
                    Mã <strong>{examCodeInput}</strong> đã có trong Kho đề. Xuất bản sẽ cập nhật lại đề của mã này.
                  </div>
                )}
              </div>

              {/* 2. Target Grade / Class (Khối / Lớp áp dụng) */}
              <div className="lg:col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                <label className="block text-xs font-bold text-slate-800">
                  2. Khối / Lớp áp dụng <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={targetClass}
                  onChange={(e) => {
                    setTargetClass(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="VD: Khối 12, 10A1, 11A2, 12A1..."
                  className="w-full text-base sm:text-sm font-bold text-slate-900 border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex flex-wrap gap-1">
                  {PRESET_CLASSES.map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setTargetClass(cls)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                        targetClass === cls
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Exam Title & Duration */}
              <div className="lg:col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    3. Tên đề thi <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={roomTitle}
                    onChange={(e) => {
                      setRoomTitle(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="VD: Đề kiểm tra 1 tiết Hóa 12 - Mã 1003"
                    className="w-full text-base sm:text-sm font-semibold border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Thời gian (phút):
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={5}
                        max={240}
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                        className="w-full text-base sm:text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white"
                      />
                      <select
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                        className="text-base sm:text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white"
                        title="Chọn nhanh thời lượng"
                      >
                        <option value={15}>15p</option>
                        <option value={45}>45p</option>
                        <option value={50}>50p</option>
                        <option value={60}>60p</option>
                        <option value={90}>90p</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-slate-700 p-2 bg-white border border-slate-300 rounded-lg">
                      <input
                        type="checkbox"
                        checked={allowReview}
                        onChange={(e) => setAllowReview(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Xem đáp án sau nộp</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600 space-y-1">
                <div>
                  Link phòng thi sẽ tự động tạo dạng:{' '}
                  <code className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    {getDirectRoomUrl(isCodeFormatValid ? examCodeInput : '1003')}
                  </code>
                </div>
                {isCreating && publishProgressMsg && (
                  <div className="text-indigo-700 font-bold flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    <span>{publishProgressMsg}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={isCreating}
                className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-indigo-600 via-indigo-700 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white shadow-md shadow-indigo-200 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-300" />
                )}
                <span>
                  {isCreating
                    ? publishProgressMsg || 'Đang xuất bản & lưu song song lên Cloud...'
                    : `Xuất bản & Lưu Cloud Kép (Mã Phòng: ${examCodeInput || '----'})`}
                </span>
              </button>
            </div>
          </div>

          {/* STEP 2: ACTIVE / JUST-PUBLISHED ROOM SHARE CARD & LIVE SUBMISSIONS */}
          {activeRoom && (
            <div className="space-y-6">
              {/* Prominent Room Info Card for sharing with Students */}
              <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-indigo-800/60 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                          activeRoom.status === 'open'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            activeRoom.status === 'open'
                              ? 'bg-emerald-400 animate-pulse'
                              : 'bg-rose-400'
                          }`}
                        ></span>
                        {activeRoom.status === 'open'
                          ? 'ĐANG MỞ NHẬN BÀI THI'
                          : 'ĐÃ KHÓA PHÒNG THI'}
                      </span>

                      <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5" />
                        Lớp: {activeRoom.targetClass || activeRoom.grade}
                      </span>

                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-indigo-100 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {activeRoom.durationMinutes} phút
                      </span>

                      {activeRoom.savedFirebase !== false && (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/30 text-indigo-100 border border-indigo-400/40">
                          ✅ Đã lưu Firebase
                        </span>
                      )}

                      {activeRoom.savedGoogleSheets ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                          ✅ Đã lưu Google Drive/Sheets
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSyncRoomToGoogleDrive(activeRoom)}
                          disabled={syncingGoogleRoomCode === activeRoom.roomCode}
                          className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/10 hover:bg-white/20 text-amber-200 border border-amber-400/30 cursor-pointer flex items-center gap-1"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${
                              syncingGoogleRoomCode === activeRoom.roomCode ? 'animate-spin' : ''
                            }`}
                          />
                          <span>
                            {hasAppsScriptConfigured
                              ? 'Đồng bộ sang Google Drive/Sheets'
                              : 'Cấu hình Google Drive/Sheets'}
                          </span>
                        </button>
                      )}
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                      {activeRoom.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-200">
                      <span className="font-bold text-amber-300 uppercase">LINK GỬI HS:</span>
                      <a
                        href={getDirectRoomUrl(activeRoom.roomCode)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-mono text-amber-300 hover:text-amber-200 break-all"
                      >
                        {getDirectRoomUrl(activeRoom.roomCode)}
                      </a>
                    </div>
                  </div>

                  {/* BIG 4-DIGIT ROOM CODE DISPLAY + COPY LINK + COPY MESSAGE + QR */}
                  <div className="flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                    <div className="pr-3 border-r border-white/20">
                      <span className="text-[10px] font-bold text-indigo-200 block uppercase tracking-wider">
                        MÃ PHÒNG THI / MÃ ĐỀ (4 SỐ)
                      </span>
                      <span className="text-3xl sm:text-4xl font-black text-amber-300 font-mono tracking-widest">
                        {activeRoom.roomCode}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyDirectLink(activeRoom.roomCode)}
                        className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                        title="Copy đường link Public gửi trực tiếp cho học sinh"
                      >
                        {copiedLinkKey === activeRoom.roomCode ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Đã copy LINK GỬI HS!</span>
                          </>
                        ) : (
                          <>
                            <ExternalLink className="w-4 h-4" />
                            <span>LINK GỬI HS</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyRoomCode(activeRoom.roomCode)}
                        className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedCodeKey === activeRoom.roomCode ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>Đã copy mã</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copy Mã phòng</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyAssignmentMessage(activeRoom)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        {copiedMsgKey === activeRoom.roomCode ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Đã copy tin nhắn giao bài!</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-4 h-4" />
                            <span>Copy Tin nhắn giao bài</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setQrModalRoom(activeRoom)}
                        className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Mã QR</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action bar for Active Room */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleToggleRoomStatus(activeRoom)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      activeRoom.status === 'open'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {activeRoom.status === 'open' ? (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Khóa Phòng Thi {activeRoom.roomCode}
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5" /> Mở Lại Phòng Thi {activeRoom.roomCode}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={submissions.length === 0}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                    <span>Xuất Bảng Điểm Excel / CSV ({submissions.length})</span>
                  </button>
                </div>

                <span className="text-xs text-slate-500">
                  Đang theo dõi bảng điểm trực tiếp của Mã phòng{' '}
                  <strong className="text-indigo-700">{activeRoom.roomCode}</strong>
                </span>
              </div>

              {/* Real-time Statistics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 block font-medium">
                    Học sinh đã nộp:
                  </span>
                  <span className="text-2xl font-black text-indigo-700 mt-1 block">
                    {totalSubmissions}{' '}
                    <span className="text-xs font-normal text-slate-400">em</span>
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 block font-medium">
                    Điểm trung bình:
                  </span>
                  <span className="text-2xl font-black text-sky-700 mt-1 block">
                    {avgScore} <span className="text-xs font-normal text-slate-400">/ 10.0</span>
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 block font-medium">Điểm cao nhất:</span>
                  <span className="text-2xl font-black text-emerald-600 mt-1 block">
                    {highestScore}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 block font-medium">Điểm thấp nhất:</span>
                  <span className="text-2xl font-black text-rose-600 mt-1 block">
                    {lowestScore}
                  </span>
                </div>
              </div>

              {/* Grade distribution badges */}
              <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-100 rounded-xl text-xs font-medium text-slate-700">
                <span className="font-bold text-slate-900">Phân loại học lực:</span>
                <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                  Giỏi (≥8.0đ): {countGioi} em
                </span>
                <span className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 font-bold">
                  Khá (6.5-7.9đ): {countKha} em
                </span>
                <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 font-bold">
                  Đạt (5.0-6.4đ): {countTB} em
                </span>
                <span className="px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 font-bold">
                  Chưa đạt (&lt;5.0đ): {countYeu} em
                </span>
              </div>

              {/* LIVE STUDENT SUBMISSIONS TABLE */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase">
                      DANH SÁCH BÀI THI HỌC SINH ĐÃ NỘP - MÃ PHÒNG {activeRoom.roomCode}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    Tự động đồng bộ mỗi khi có học sinh nộp bài
                  </span>
                </div>

                {submissions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30 text-indigo-600" />
                    <p className="text-sm font-medium text-slate-600">
                      Chưa có học sinh nào nộp bài ở phòng thi {activeRoom.roomCode}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Hãy nhấn <strong>&quot;Copy Tin nhắn giao bài&quot;</strong> hoặc{' '}
                      <strong>&quot;Mã QR&quot;</strong> để gửi cho học sinh lớp{' '}
                      <strong>{activeRoom.targetClass || activeRoom.grade}</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="p-3 w-12 text-center">STT</th>
                          <th className="p-3">Họ và Tên Học Sinh</th>
                          <th className="p-3 w-24 text-center">Lớp</th>
                          <th className="p-3 w-24 text-center">SBD</th>
                          <th className="p-3 w-28 text-center bg-indigo-50 text-indigo-900">
                            Điểm Tổng / 10
                          </th>
                          <th className="p-3 w-20 text-center">Phần I</th>
                          <th className="p-3 w-20 text-center">Phần II</th>
                          <th className="p-3 w-20 text-center">Phần III</th>
                          <th className="p-3 text-center">Thời gian nộp</th>
                          <th className="p-3 w-24 text-center">Chi tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {submissions.map((sub, idx) => (
                          <tr
                            key={sub.id || idx}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900">{sub.studentName}</td>
                            <td className="p-3 text-center text-slate-600">{sub.studentClass}</td>
                            <td className="p-3 text-center font-mono text-slate-700">
                              {sub.studentId}
                            </td>
                            <td className="p-3 text-center font-black text-indigo-700 bg-indigo-50/50 text-sm">
                              {sub.scoreTotal.toFixed(2)}
                            </td>
                            <td className="p-3 text-center font-semibold text-sky-700">
                              {sub.scorePart1.toFixed(2)}
                            </td>
                            <td className="p-3 text-center font-semibold text-indigo-700">
                              {sub.scorePart2.toFixed(2)}
                            </td>
                            <td className="p-3 text-center font-semibold text-emerald-700">
                              {sub.scorePart3.toFixed(2)}
                            </td>
                            <td className="p-3 text-center text-slate-500 font-mono text-[11px]">
                              {new Date(sub.submittedAt).toLocaleTimeString('vi-VN')}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedStudentDetail(sub)}
                                className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs cursor-pointer"
                              >
                                Xem bài
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PUBLIC APP URL CONFIGURATION BOX (RIGHT ABOVE KHO ĐỀ KIỂM TRA ONLINE ĐÃ XUẤT BẢN) */}
          <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 rounded-2xl border-2 border-indigo-200 p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
                  <ExternalLink className="w-4 h-4" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-black text-indigo-950 uppercase tracking-wide">
                    Tên miền Public (Public URL)
                  </label>
                  <p className="text-[11px] text-slate-600">
                    Mặc định tự động lấy chính xác <code className="font-mono font-bold text-indigo-800">window.location.origin</code> hiện tại trên thanh địa chỉ và gắn <code className="font-mono font-bold text-emerald-700">/?mode=student&amp;room=XXXX</code>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetToCurrentOrigin}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-300 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Đặt lại đường link theo tên miền hiện tại (window.location.origin)"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                <span>🔄 Đặt lại theo tên miền hiện tại (window.location.origin)</span>
              </button>
            </div>

            {publicUrlSavedBanner && (
              <div className="p-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-xs text-emerald-950 font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{publicUrlSavedBanner}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="url"
                value={publicAppUrlInput}
                onChange={(e) => handlePublicUrlInputChange(e.target.value)}
                placeholder={`Mặc định theo trình duyệt: ${getBrowserCurrentBaseUrl()}`}
                className="flex-1 font-mono text-base sm:text-sm font-bold text-indigo-950 bg-white border-2 border-indigo-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200"
              />

              {publicAppUrlInput.trim() !== '' && (
                <button
                  type="button"
                  onClick={handleResetToCurrentOrigin}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 cursor-pointer transition-colors shrink-0"
                  title="Xóa link tùy chỉnh để dùng nguyên window.location.origin hiện tại"
                >
                  Dùng link hiện tại
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSavePublicAppUrl()}
                disabled={isSavingPublicUrl}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-60"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingPublicUrl ? 'Đang lưu...' : 'Lưu Link Public'}</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
              <span>
                Định dạng Link &amp; Mã QR gửi học sinh hiện tại:{' '}
                <code className="font-mono font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200 break-all">
                  {getDirectRoomUrl(activeRoom?.roomCode || (isCodeFormatValid ? examCodeInput : '3204'))}
                </code>
              </span>
              <span className="text-slate-500">
                Tên miền hiện tại: <code className="font-mono font-bold text-indigo-700">{getBrowserCurrentBaseUrl()}</code>
              </span>
            </div>
          </div>

          {/* STEP 3: KHO ĐỀ KIỂM TRA ONLINE ĐÃ XUẤT BẢN (FIREBASE EXAMS REPOSITORY - SCOPED BY ROLE) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-amber-300">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wide">
                    {isAdminUser
                      ? `KHO ĐỀ KIỂM TRA TOÀN HỆ THỐNG (${scopedPublishedExams.length} / ${publishedExams.length} ĐỀ)`
                      : `KHO ĐỀ KIỂM TRA CỦA ${currentUser?.fullName?.toUpperCase() || 'GIÁO VIÊN'} (${scopedPublishedExams.length})`}
                  </h3>
                  <p className="text-xs text-slate-300">
                    {isAdminUser ? (
                      <>
                        Quyền Quản trị viên (<code className="font-mono text-amber-300">Admin</code>): Nhìn thấy và quản lý toàn bộ phòng thi của tất cả giáo viên trên hệ thống.
                      </>
                    ) : (
                      <>
                        Kho đề cá nhân (<code className="font-mono text-emerald-300">createdBy: {currentUser?.username}</code>): Quản lý riêng các phòng thi do Thầy/Cô tạo mà không ảnh hưởng tới phòng thi của giáo viên khác.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {isAdminUser && distinctCreators.length > 1 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-300 font-semibold">Lọc theo Giáo viên:</span>
                  <select
                    value={adminTeacherFilter}
                    onChange={(e) => setAdminTeacherFilter(e.target.value)}
                    className="bg-slate-800 text-white border border-slate-600 rounded-lg px-2.5 py-1.5 font-bold text-xs focus:outline-none focus:border-amber-400"
                  >
                    <option value="ALL">Tất cả Giáo viên ({publishedExams.length} đề)</option>
                    {distinctCreators.map((c) => (
                      <option key={c.username} value={c.username}>
                        {c.fullName} ({c.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {scopedPublishedExams.length === 0 ? (
              <div className="p-10 text-center text-slate-500 space-y-2">
                <p className="text-sm font-semibold text-slate-700">
                  {isAdminUser
                    ? 'Chưa có đề kiểm tra nào trong Kho đề đã xuất bản'
                    : `Tài khoản ${currentUser?.fullName} (${currentUser?.username}) chưa xuất bản phòng thi nào`}
                </p>
                <p className="text-xs text-slate-500">
                  Hãy nhập Mã đề 4 chữ số (ví dụ: 1003), chọn Lớp áp dụng ở form phía trên và bấm{' '}
                  <strong>&quot;Xuất bản &amp; Lưu Cloud Kép&quot;</strong>.
                </p>
              </div>
            ) : (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {scopedPublishedExams.map((room) => {
                  const isSelected = activeRoom?.roomCode === room.roomCode;
                  const assignedClass = room.targetClass || room.grade || 'Khối 12';
                  const qCount =
                    room.totalQuestions ||
                    (room.examData?.part1?.length || 0) +
                      (room.examData?.part2?.length || 0) +
                      (room.examData?.part3?.length || 0);
                  const roomStats = roomSubmissionStats[room.roomCode] || {
                    count: 0,
                    avgScore: '0.00',
                  };
                  const creatorDisplayName =
                    room.createdByName ||
                    room.createdBy?.fullName ||
                    room.teacherName ||
                    'GV: VANHA (Quản trị viên)';
                  const creatorUsername =
                    room.createdByUsername || room.createdBy?.username || 'admin';

                  return (
                    <div
                      key={room.id || room.roomCode}
                      className={`rounded-2xl border-2 p-4 transition-all flex flex-col justify-between gap-4 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/30 shadow-md'
                          : 'border-slate-200 bg-white hover:border-indigo-300'
                      }`}
                    >
                      {/* Top row: Big 4-digit Room Code + Class + Title + Live Submissions Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-200">
                              Lớp: {assignedClass}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                              ⏱ {room.durationMinutes} phút
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {qCount} câu
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                                room.status === 'open'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  room.status === 'open' ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'
                                }`}
                              />
                              {room.status === 'open' ? 'Đang mở thi (open)' : 'Đã đóng phòng (closed)'}
                            </span>
                          </div>

                          <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                            {room.title}
                          </h4>

                          {/* Creator Teacher Badge */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                              <span>👨‍🏫 Người tạo: {creatorDisplayName}</span>
                              <code className="font-mono text-[9px] text-amber-700">({creatorUsername})</code>
                            </span>
                          </div>

                          {/* DUAL CLOUD SAVE STATUS BADGES */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {room.savedFirebase !== false && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                <span>✅ Đã lưu Firebase</span>
                              </span>
                            )}
                            {room.savedGoogleSheets ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <span>✅ Đã lưu Google Drive/Sheets</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSyncRoomToGoogleDrive(room)}
                                disabled={syncingGoogleRoomCode === room.roomCode}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 cursor-pointer transition-colors"
                                title="Đồng bộ đề thi này lên Google Drive & Google Sheets"
                              >
                                <RefreshCw
                                  className={`w-3 h-3 ${
                                    syncingGoogleRoomCode === room.roomCode ? 'animate-spin' : ''
                                  }`}
                                />
                                <span>
                                  {syncingGoogleRoomCode === room.roomCode
                                    ? 'Đang lưu Google Drive...'
                                    : hasAppsScriptConfigured
                                      ? 'Lưu thêm lên Google Drive/Sheets'
                                      : 'Cấu hình Google Drive/Sheets'}
                                </span>
                              </button>
                            )}
                          </div>

                          {/* Live Submission Stats Bar per Room Code */}
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">
                            <span className="text-indigo-700 flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              Đã nộp: {roomStats.count} HS
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-sky-700">
                              ĐTB: {roomStats.avgScore} / 10.0
                            </span>
                          </div>

                          <p className="text-[11px] text-emerald-800 font-mono truncate bg-emerald-50/80 px-2 py-0.5 rounded border border-emerald-200">
                            LINK GỬI HS: {getDirectRoomUrl(room.roomCode)}
                          </p>
                        </div>

                        {/* Prominent 4-digit Room Code Box */}
                        <div className="shrink-0 bg-slate-900 text-white px-3.5 py-2 rounded-xl text-center border border-slate-700 shadow-xs">
                          <span className="text-[9px] font-bold text-slate-300 block uppercase">
                            MÃ PHÒNG (4 SỐ)
                          </span>
                          <span className="text-2xl font-black text-amber-300 font-mono tracking-widest">
                            {room.roomCode}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons on Published Exam Card */}
                      <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyDirectLink(room.roomCode)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-1 cursor-pointer transition-colors"
                            title="Copy đường link Public gửi trực tiếp cho học sinh"
                          >
                            {copiedLinkKey === room.roomCode ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Đã copy LINK!</span>
                              </>
                            ) : (
                              <>
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>LINK GỬI HS</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyRoomCode(room.roomCode)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {copiedCodeKey === room.roomCode ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-700">Đã copy mã</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-600" />
                                <span>Copy Mã phòng</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyAssignmentMessage(room)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                          >
                            {copiedMsgKey === room.roomCode ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Đã copy tin nhắn!</span>
                              </>
                            ) : (
                              <>
                                <Share2 className="w-3.5 h-3.5" />
                                <span>Copy Tin nhắn giao bài</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setQrModalRoom(room)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <QrCode className="w-3.5 h-3.5 text-amber-800" />
                            <span>Mã QR</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Direct Open / Close Room Toggle on Card */}
                          <button
                            type="button"
                            onClick={() => handleToggleRoomStatus(room)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                              room.status === 'open'
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                            title={
                              room.status === 'open'
                                ? 'Đóng phòng thi (Học sinh sẽ không thể vào phòng)'
                                : 'Mở lại phòng thi cho học sinh vào làm bài'
                            }
                          >
                            {room.status === 'open' ? (
                              <>
                                <Lock className="w-3.5 h-3.5 text-amber-700" />
                                <span>Đóng phòng</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Mở phòng</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              setActiveRoom(room);
                              const fullRoom = await findRoomByCode(room.roomCode);
                              if (fullRoom) {
                                setActiveRoom(fullRoom);
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {isSelected
                              ? `Đang xem điểm (${roomStats.count})`
                              : `Xem Bảng Điểm (${roomStats.count})`}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeletePublishedRoom(room)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Xóa đề khỏi Kho đề Firebase"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          STUDENT JOIN PORTAL: CỔNG VÀO PHÒNG THI TRỰC TUYẾN
          (3 MANDATORY FIELDS: 4-DIGIT ROOM CODE + FULL NAME + CLASS)
          ===================================================================== */}
      {(standaloneStudentMode || !currentUser || activeSubTab === 'student') && (
        <div className="space-y-4">
          {/* Top-right compact Teacher / Admin Login Bar when in Student Portal view */}
          {(standaloneStudentMode || !currentUser) && (
            <div className="max-w-xl mx-auto flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Cổng thi trực tuyến dành cho Học sinh (Không cần tài khoản)</span>
              </div>

              {onOpenLoginModal && (
                <button
                  type="button"
                  onClick={onOpenLoginModal}
                  className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-indigo-950 text-amber-300 border border-slate-700 shadow-sm flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                  title="Đăng nhập dành cho Giáo viên & Quản trị viên (Admin) để mở khóa giao diện Tạo đề PDF & Quản lý phòng thi"
                >
                  <span>🔐 Đăng nhập Giáo viên / Admin</span>
                </button>
              )}
            </div>
          )}

          <div className="bg-white rounded-3xl border-2 border-indigo-100 shadow-xl overflow-hidden max-w-xl mx-auto">
            {/* Top Formal Banner */}
            <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-teal-900 text-white p-6 sm:p-8 text-center relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20">
                <GraduationCap className="w-8 h-8" />
              </div>
              <span className="inline-block px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-white/10 text-emerald-300 border border-white/15 mb-2">
                HỆ THỐNG KIỂM TRA ĐÁNH GIÁ TRỰC TUYẾN CHUẨN CV 7991
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
                CỔNG VÀO PHÒNG THI TRỰC TUYẾN
              </h2>
              <p className="text-xs text-indigo-200 mt-1.5 max-w-md mx-auto">
                Học sinh vui lòng điền đầy đủ và chính xác <strong>Mã phòng thi (4 số)</strong>,{' '}
                <strong>Họ và tên</strong> và <strong>Lớp</strong> trước khi bắt đầu tính giờ làm bài.
              </p>
            </div>

          <div className="p-6 sm:p-8 space-y-5">
            {joinError && (
              <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-xs sm:text-sm text-rose-800 font-bold flex items-start gap-2.5 shadow-2xs">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <span>{joinError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs sm:text-sm">
              {/* Field 1: 4-Digit Room Code */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-extrabold text-slate-800 uppercase">
                    1. Mã phòng thi (4 chữ số) <span className="text-rose-600">*</span>
                  </label>
                  {isStudentRoomCodeValid ? (
                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Đúng định dạng 4 số
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-700">
                      Bắt buộc đủ 4 chữ số
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={joinCode}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setJoinCode(digitsOnly);
                    setJoinError(null);
                  }}
                  placeholder="VD: 3203"
                  className={`w-full text-center font-mono font-black text-3xl tracking-[0.3em] uppercase border-2 rounded-xl p-3 focus:outline-none transition-colors ${
                    isStudentRoomCodeValid
                      ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950 focus:ring-2 focus:ring-emerald-200'
                      : 'border-slate-300 bg-white text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200'
                  }`}
                />
              </div>

              {/* Live Room Status Preview when 4 digits entered */}
              {isStudentRoomCodeValid && previewedStudentRoom && previewedStudentRoom.status === 'open' && (
                <div className="p-4 rounded-2xl bg-indigo-50/90 border-2 border-indigo-200 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-black text-indigo-950 text-sm">
                      {previewedStudentRoom.title}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Phòng đang mở
                    </span>
                  </div>
                  <div className="text-xs text-indigo-800 flex flex-wrap items-center gap-2 font-medium">
                    <span>
                      Khối/Lớp: <strong>{previewedStudentRoom.targetClass || previewedStudentRoom.grade}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Thời gian làm bài: <strong>{previewedStudentRoom.durationMinutes} phút</strong>
                    </span>
                    <span>•</span>
                    <span>Đề 3 phần (Tự động trộn câu hỏi &amp; đáp án)</span>
                  </div>
                </div>
              )}

              {/* Field 2: Student Full Name (Auto-capitalize each word) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-extrabold text-slate-800 uppercase">
                    2. Họ và tên học sinh <span className="text-rose-600">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Tự động viết hoa chữ cái đầu mỗi từ
                  </span>
                </div>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(formatStudentFullName(e.target.value, true));
                    setJoinError(null);
                  }}
                  onBlur={() => {
                    setStudentName((prev) => formatStudentFullName(prev, false));
                  }}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full text-base sm:text-sm border-2 border-slate-300 rounded-xl p-3 font-bold text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                />
              </div>

              {/* Field 3: Student Class + Optional SBD */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8">
                  <label className="block text-xs font-extrabold text-slate-800 uppercase mb-1">
                    3. Lớp <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={studentClass}
                    onChange={(e) => {
                      setStudentClass(e.target.value.toUpperCase());
                      setJoinError(null);
                    }}
                    placeholder="Ví dụ: 10A1, 11A2, 12A1"
                    className="w-full text-base sm:text-sm border-2 border-slate-300 rounded-xl p-3 font-bold text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-slate-500 font-semibold">Chọn nhanh:</span>
                    {STUDENT_QUICK_CLASSES.map((cls) => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => {
                          setStudentClass(cls);
                          setJoinError(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          studentClass.trim().toUpperCase() === cls
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-indigo-50'
                        }`}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                    SBD (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={studentSbd}
                    onChange={(e) => setStudentSbd(e.target.value)}
                    placeholder="VD: 015"
                    className="w-full text-base sm:text-sm border-2 border-slate-200 rounded-xl p-3 font-semibold text-slate-800 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Validation Checklist Banner */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-600">
                <span className={isStudentRoomCodeValid ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                  {isStudentRoomCodeValid ? '✓' : '○'} Mã phòng 4 số
                </span>
                <span className={isStudentNameValid ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                  {isStudentNameValid ? '✓' : '○'} Họ và tên học sinh
                </span>
                <span className={isStudentClassValid ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                  {isStudentClassValid ? '✓' : '○'} Lớp học
                </span>
              </div>

              {/* Submit Button: Disabled until all 3 mandatory fields are valid */}
              <button
                type="button"
                onClick={handleStudentJoin}
                disabled={isSearchingRoom || !isStudentLoginValid}
                className="w-full min-h-[52px] py-3.5 rounded-2xl font-black text-sm sm:text-base bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white shadow-lg shadow-emerald-200 cursor-pointer transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <span>
                  {isSearchingRoom
                    ? 'Đang xác thực Mã phòng thi trên Firebase...'
                    : `Vào phòng thi ${isStudentRoomCodeValid ? `(${joinCode.trim()})` : ''}`}
                </span>
                <ChevronRight className="w-5 h-5" />
              </button>

              {standaloneStudentMode && (
                <div className="pt-3 border-t border-slate-100 text-center">
                  {currentUser && onExitStandaloneStudentMode ? (
                    <button
                      type="button"
                      onClick={onExitStandaloneStudentMode}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                    >
                      Quay lại Giao diện Quản lý &amp; Soạn đề ({currentUser.fullName})
                    </button>
                  ) : (
                    onOpenLoginModal && (
                      <button
                        type="button"
                        onClick={onOpenLoginModal}
                        className="text-xs font-bold text-slate-500 hover:text-indigo-700 underline cursor-pointer"
                      >
                        🔐 Dành cho Giáo viên / Admin: Đăng nhập để Tạo đề &amp; Quản lý phòng thi
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: QR CODE FOR DIRECT STUDENT ROOM ACCESS
          ===================================================================== */}
      {qrModalRoom && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm sm:text-base font-bold">
                  MÃ QR VÀO PHÒNG THI ({qrModalRoom.roomCode})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQrModalRoom(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 text-center space-y-4">
              <div className="inline-block p-4 bg-white rounded-2xl border-2 border-indigo-200 shadow-sm">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
                    getDirectRoomUrl(qrModalRoom.roomCode)
                  )}`}
                  alt={`QR Phòng thi ${qrModalRoom.roomCode}`}
                  className="w-52 h-52 mx-auto object-contain"
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-500 uppercase">
                  MÃ PHÒNG THI / MÃ ĐỀ (4 SỐ)
                </div>
                <div className="text-3xl font-black text-indigo-700 font-mono tracking-widest">
                  {qrModalRoom.roomCode}
                </div>
                <div className="text-xs font-bold text-slate-800">{qrModalRoom.title}</div>
                <div className="text-xs text-slate-600">
                  Lớp: <strong>{qrModalRoom.targetClass || qrModalRoom.grade}</strong> • Thời gian:{' '}
                  <strong>{qrModalRoom.durationMinutes} phút</strong>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-700 break-all">
                {getDirectRoomUrl(qrModalRoom.roomCode)}
              </div>

              {/* Button to reset QR URL to current browser domain (window.location.origin) */}
              <button
                type="button"
                onClick={handleResetToCurrentOrigin}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                title="Đặt lại đường link Mã QR theo đúng tên miền hiện tại trên thanh địa chỉ trình duyệt"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                <span>🔄 Đặt lại theo tên miền hiện tại (window.location.origin)</span>
              </button>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopyAssignmentMessage(qrModalRoom)}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedMsgKey === qrModalRoom.roomCode ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Đã copy tin nhắn giao bài!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      <span>Copy Tin nhắn giao bài</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setQrModalRoom(null)}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: VIEW STUDENT DETAILED SUBMISSION
          ===================================================================== */}
      {selectedStudentDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">
                  BÀI LÀM CỦA HỌC SINH: {selectedStudentDetail.studentName.toUpperCase()}
                </h3>
                <p className="text-xs text-slate-300">
                  Lớp: {selectedStudentDetail.studentClass} • SBD: {selectedStudentDetail.studentId}{' '}
                  • Điểm tổng: {selectedStudentDetail.scoreTotal.toFixed(2)} / 10.0
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentDetail(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-200">
                  <span className="text-sky-700 block">Phần I:</span>
                  <span className="font-bold text-sm text-sky-900">
                    {selectedStudentDetail.scorePart1.toFixed(2)}đ
                  </span>
                </div>
                <div className="p-2.5 bg-indigo-50 rounded-lg border border-indigo-200">
                  <span className="text-indigo-700 block">Phần II:</span>
                  <span className="font-bold text-sm text-indigo-900">
                    {selectedStudentDetail.scorePart2.toFixed(2)}đ
                  </span>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-emerald-700 block">Phần III:</span>
                  <span className="font-bold text-sm text-emerald-900">
                    {selectedStudentDetail.scorePart3.toFixed(2)}đ
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-2">Đáp án Phần I đã chọn:</span>
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-1 text-center font-mono">
                  {Object.entries(selectedStudentDetail.answersPart1 || {}).map(([qId, val]) => (
                    <div key={qId} className="p-1 border rounded bg-slate-50">
                      <span className="text-[10px] text-slate-400 block">C{qId}</span>
                      <span className="font-bold text-indigo-600">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-2">
                  Đáp án Phần II (Đúng/Sai):
                </span>
                <div className="space-y-1">
                  {Object.entries(selectedStudentDetail.answersPart2 || {}).map(([qId, subMap]) => (
                    <div
                      key={qId}
                      className="flex items-center gap-3 p-2 bg-slate-50 rounded border text-xs"
                    >
                      <span className="font-bold text-slate-700">Câu {qId}:</span>
                      {Object.entries(subMap || {}).map(([k, val]) => (
                        <span key={k} className="font-bold">
                          {k}:{' '}
                          {val === true ? (
                            <span className="text-emerald-600">Đ</span>
                          ) : val === false ? (
                            <span className="text-rose-600">S</span>
                          ) : (
                            '-'
                          )}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-2">
                  Đáp án Phần III (Điền số):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(selectedStudentDetail.answersPart3 || {}).map(([qId, val]) => (
                    <div key={qId} className="p-2 border rounded bg-slate-50">
                      <span className="text-[10px] text-slate-400 block">Câu {qId}</span>
                      <span className="font-bold text-emerald-700">{val || '(Bỏ trống)'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedStudentDetail(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: DUAL CLOUD SYNC CONFIGURATION (FIREBASE & GOOGLE SHEETS/DRIVE)
          ===================================================================== */}
      <DualCloudConfigModal
        isOpen={isCloudConfigModalOpen}
        onClose={() => setIsCloudConfigModalOpen(false)}
        onConfigUpdated={() => {
          setHasAppsScriptConfigured(Boolean(getConfiguredGoogleAppsScriptUrl()));
        }}
      />
    </div>
  );
};

