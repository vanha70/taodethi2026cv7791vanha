import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  Award,
  X,
  FileCheck,
  Pause,
  Play,
  RotateCcw,
  Timer,
  Bell,
  ChevronDown,
  ChevronUp,
  Shuffle,
  ShieldCheck,
  LayoutGrid,
  KeyRound,
  Check,
  Sparkles,
  Eye,
  ListChecks,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';
import {
  ExamData,
  Part1Question,
  Part2Question,
  Part3Question,
  QuestionDisplayMode,
} from '../types/exam';
import { MathChemView } from './MathChemView';
import { submitStudentResult } from '../services/roomService';
import { stripLeakedAnswerMarkers } from '../utils/chemMathNormalizer';
import { permutePart1QuestionOptions, isFixedAtDOptionText } from '../utils/shuffler';

// Fisher-Yates array shuffle helper
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Helper to compare Part III numeric short answers so that comma ',' and dot '.'
 * in decimals are treated identically (e.g. "2,5" === "2.5", "-1,5" === "-1.5", "7,04" === "7.04").
 */
export function isShortAnswerMatch(studentRaw: string, correctRaw: string): boolean {
  const sClean = (studentRaw || '').trim().replace(/\s+/g, '').replace(/,/g, '.');
  const cClean = (correctRaw || '').trim().replace(/\s+/g, '').replace(/,/g, '.');
  if (!sClean || !cClean) return false;
  if (sClean === cClean) return true;

  const sNum = Number(sClean);
  const cNum = Number(cClean);
  if (!Number.isNaN(sNum) && !Number.isNaN(cNum)) {
    return Math.abs(sNum - cNum) < 1e-6;
  }
  return false;
}

/**
 * Smart Shuffle builder per separate section (Part I -> Part II -> Part III):
 * - Shuffles question order ONLY within each part and re-numbers Part I (1..18), Part II (1..4), Part III (1..6).
 * - In Part I: shuffles options A, B, C, D EXCEPT options like "Cả A, B, C đều đúng" which stay fixed at D,
 *   while updating correctAnswer accurately. When a question uses `pdfSliceUrl` in PDF-slice display mode,
 *   options A, B, C, D can stay aligned with the original PDF image so clicking [A]/[B]/[C]/[D] matches the image 100%.
 * - In Part II: can either keep or shuffle the 4 statements a), b), c), d) while updating True/False keys
 *   and re-labeling display order as a), b), c), d).
 */
function createSmartShuffledExam(
  sourceExam: ExamData,
  enableShuffle: boolean,
  shufflePart2SubItems: boolean = true,
  keepOptionsAlignedWithPdfSlice: boolean = false
): {
  part1: Part1Question[];
  part2: Part2Question[];
  part3: Part3Question[];
  examVariantCode: string;
} {
  const fixedItemLabels: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
  const rawPart1 = Array.isArray(sourceExam?.part1) ? sourceExam.part1 : [];
  const rawPart2 = Array.isArray(sourceExam?.part2) ? sourceExam.part2 : [];
  const rawPart3 = Array.isArray(sourceExam?.part3) ? sourceExam.part3 : [];

  if (!enableShuffle) {
    return {
      part1: rawPart1.map((q, idx) => {
        const imgSrc = q?.image || q?.imageUrl;
        return {
          ...q,
          id: idx + 1,
          content: stripLeakedAnswerMarkers(q?.content || ''),
          ...(imgSrc ? { image: imgSrc, imageUrl: imgSrc } : {}),
          options: {
            A: stripLeakedAnswerMarkers(q?.options?.A || ''),
            B: stripLeakedAnswerMarkers(q?.options?.B || ''),
            C: stripLeakedAnswerMarkers(q?.options?.C || ''),
            D: stripLeakedAnswerMarkers(q?.options?.D || ''),
          },
        };
      }),
      part2: rawPart2.map((q, idx) => {
        const imgSrc = q?.image || q?.imageUrl;
        const safeItems = Array.isArray(q?.items) ? q.items : [];
        return {
          ...q,
          id: idx + 1,
          content: stripLeakedAnswerMarkers(q?.content || ''),
          ...(imgSrc ? { image: imgSrc, imageUrl: imgSrc } : {}),
          items: safeItems.map((it, itemIdx) => ({
            ...it,
            label: fixedItemLabels[itemIdx] || it?.label || 'a',
            text: stripLeakedAnswerMarkers(it?.text || ''),
          })),
        };
      }),
      part3: rawPart3.map((q, idx) => {
        const imgSrc = q?.image || q?.imageUrl;
        return {
          ...q,
          id: idx + 1,
          content: stripLeakedAnswerMarkers(q?.content || ''),
          ...(imgSrc ? { image: imgSrc, imageUrl: imgSrc } : {}),
        };
      }),
      examVariantCode: sourceExam?.metadata?.examCode || '101',
    };
  }

  // 1. Shuffle Part I questions (re-indexed 1..18) and shuffle A, B, C, D (unless aligned with PDF slice image)
  const shuffledPart1: Part1Question[] = shuffleArray(rawPart1).map((q, idx) => {
    const shouldKeepOriginalABCD = keepOptionsAlignedWithPdfSlice && Boolean(q?.pdfSliceUrl);
    const permuted = shouldKeepOriginalABCD
      ? {
          options: {
            A: stripLeakedAnswerMarkers(q?.options?.A || ''),
            B: stripLeakedAnswerMarkers(q?.options?.B || ''),
            C: stripLeakedAnswerMarkers(q?.options?.C || ''),
            D: stripLeakedAnswerMarkers(q?.options?.D || ''),
          },
          correctAnswer: q?.correctAnswer || 'A',
        }
      : permutePart1QuestionOptions(q, shuffleArray);
    const imgSrc = q?.image || q?.imageUrl;
    return {
      ...q,
      id: idx + 1,
      content: stripLeakedAnswerMarkers(q?.content || ''),
      ...(imgSrc ? { image: imgSrc, imageUrl: imgSrc } : {}),
      options: permuted.options,
      correctAnswer: permuted.correctAnswer,
    };
  });

  // 2. Shuffle Part II questions (re-indexed 1..4) and optionally shuffle statements a), b), c), d)
  const shuffledPart2: Part2Question[] = shuffleArray(rawPart2).map((q, idx) => {
    const safeItems = Array.isArray(q?.items) ? q.items : [];
    const shouldKeepOriginalItems =
      !shufflePart2SubItems || (keepOptionsAlignedWithPdfSlice && Boolean(q?.pdfSliceUrl));
    const sourceItems = shouldKeepOriginalItems ? [...safeItems] : shuffleArray(safeItems);
    const permutedItems = sourceItems.map((it, itemIdx) => ({
      ...it,
      label: fixedItemLabels[itemIdx] || it?.label || 'a',
      text: stripLeakedAnswerMarkers(it?.text || ''),
    }));
    const imgSrc = q?.image || q?.imageUrl;

    return {
      ...q,
      id: idx + 1,
      content: stripLeakedAnswerMarkers(q?.content || ''),
      ...(imgSrc ? { image: imgSrc, imageUrl: imgSrc } : {}),
      items: permutedItems,
    };
  });

  // 3. Shuffle Part III questions (re-indexed 1..6)
  const shuffledPart3: Part3Question[] = shuffleArray(rawPart3).map((q, idx) => {
    const imgSrc = q?.image || q?.imageUrl;
    return {
      ...q,
      id: idx + 1,
      content: stripLeakedAnswerMarkers(q?.content || ''),
      ...(imgSrc ? { image: imgSrc, imageUrl: imgSrc } : {}),
    };
  });

  const randomCode = String(Math.floor(100 + Math.random() * 900));

  return {
    part1: shuffledPart1,
    part2: shuffledPart2,
    part3: shuffledPart3,
    examVariantCode: randomCode,
  };
}

interface OnlineTestRoomProps {
  exam: ExamData;
  onExitTest: () => void;
  onUpdateExam?: (updatedExam: ExamData) => void;
  studentInfo?: {
    name: string;
    className: string;
    sbd: string;
  };
  roomId?: string;
  roomCode?: string;
  allowReview?: boolean;
}

export const OnlineTestRoom: React.FC<OnlineTestRoomProps> = ({
  exam,
  onExitTest,
  onUpdateExam,
  studentInfo,
  roomId,
  roomCode,
}) => {
  const initialTotalSeconds = Math.max(60, (exam?.metadata?.durationMinutes || 45) * 60);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState<number>(initialTotalSeconds);
  const [timeLeft, setTimeLeft] = useState<number>(initialTotalSeconds);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showTimerSettings, setShowTimerSettings] = useState<boolean>(false);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState<boolean>(false);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState<boolean>(false);
  const [milestoneAlert, setMilestoneAlert] = useState<string | null>(null);

  // Teacher Answer Key Configuration State (for Part I & Part II)
  const [showAnswerKeyModal, setShowAnswerKeyModal] = useState<boolean>(false);
  const [isTeacherKeyEditMode, setIsTeacherKeyEditMode] = useState<boolean>(false);
  const [bulkPart1KeyInput, setBulkPart1KeyInput] = useState<string>('');
  const [bulkPart2KeyInput, setBulkPart2KeyInput] = useState<string>('');
  const [keyUpdateBanner, setKeyUpdateBanner] = useState<string | null>(null);
  const [showDetailedResultTable, setShowDetailedResultTable] = useState<boolean>(true);

  // Enforce principle: "CHỮ ĐỂ NGUYÊN DẠNG VĂN BẢN - CHỈ CẮT RIÊNG VÙNG HÌNH VẼ"
  // Never display duplicate whole-question PDF slices; always render HTML+KaTeX + isolated diagram imageUrl
  const hasAnyPdfSlices = false;

  const [displayMode, setDisplayMode] = useState<QuestionDisplayMode>('text_katex');

  // Smart Shuffle State (Automatically shuffles questions within each part and options A/B/C/D)
  const [isSmartShuffleEnabled, setIsSmartShuffleEnabled] = useState<boolean>(true);
  const [shufflePart2Items, setShufflePart2Items] = useState<boolean>(true);
  const [activeExamState, setActiveExamState] = useState(() =>
    createSmartShuffledExam(exam, true, true, false)
  );

  useEffect(() => {
    setDisplayMode('text_katex');
    setActiveExamState(
      createSmartShuffledExam(exam, isSmartShuffleEnabled, shufflePart2Items, false)
    );
  }, [exam]);

  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isSubmittingToFirebase, setIsSubmittingToFirebase] = useState<boolean>(false);

  // Editable student info when entering directly via ?room=3203 or QR scan
  const [localStudentName, setLocalStudentName] = useState<string>(studentInfo?.name || '');
  const [localStudentClass, setLocalStudentClass] = useState<string>(
    studentInfo?.className || exam.metadata.grade || '12A1'
  );
  const [localStudentSbd, setLocalStudentSbd] = useState<string>(studentInfo?.sbd || '');
  const [submitIdentityError, setSubmitIdentityError] = useState<string | null>(null);

  useEffect(() => {
    if (studentInfo) {
      if (studentInfo.name) setLocalStudentName(studentInfo.name);
      if (studentInfo.className) setLocalStudentClass(studentInfo.className);
      if (studentInfo.sbd) setLocalStudentSbd(studentInfo.sbd);
    }
  }, [studentInfo]);

  // Student answers
  const [part1Answers, setPart1Answers] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>({});
  const [part2Answers, setPart2Answers] = useState<
    Record<number, Record<'a' | 'b' | 'c' | 'd', boolean | null>>
  >({});
  const [part3Answers, setPart3Answers] = useState<Record<number, string>>({});

  /**
   * Sync updated activeExamState answer keys back to parent ExamData (matching by question content)
   */
  const syncAnswerKeyToParentExam = (
    nextPart1: Part1Question[],
    nextPart2: Part2Question[],
    nextPart3: Part3Question[] = activeExamState.part3
  ) => {
    if (!onUpdateExam) return;

    const updatedSourcePart1 = exam.part1.map((srcQ, idx) => {
      // Match by normalized content or fallback to index when unshuffled
      const matched =
        nextPart1.find(
          (activeQ) =>
            stripLeakedAnswerMarkers(activeQ.content).trim() ===
            stripLeakedAnswerMarkers(srcQ.content).trim()
        ) || (!isSmartShuffleEnabled ? nextPart1[idx] : undefined);

      if (!matched) return srcQ;
      // Find which source option (A, B, C, D) has the same text as matched.options[matched.correctAnswer]
      const winningText = stripLeakedAnswerMarkers(matched.options[matched.correctAnswer]).trim();
      const matchedSourceKey = (['A', 'B', 'C', 'D'] as const).find(
        (k) => stripLeakedAnswerMarkers(srcQ.options[k]).trim() === winningText
      );
      return {
        ...srcQ,
        correctAnswer: matchedSourceKey || matched.correctAnswer,
      };
    });

    const updatedSourcePart2 = exam.part2.map((srcQ, idx) => {
      const matched =
        nextPart2.find(
          (activeQ) =>
            stripLeakedAnswerMarkers(activeQ.content).trim() ===
            stripLeakedAnswerMarkers(srcQ.content).trim()
        ) || (!isSmartShuffleEnabled ? nextPart2[idx] : undefined);

      if (!matched) return srcQ;
      const updatedItems = srcQ.items.map((srcItem, itemIdx) => {
        const matchedItem =
          matched.items.find(
            (actIt) =>
              stripLeakedAnswerMarkers(actIt.text).trim() ===
              stripLeakedAnswerMarkers(srcItem.text).trim()
          ) || (!shufflePart2Items ? matched.items[itemIdx] : undefined);
        return matchedItem ? { ...srcItem, isCorrect: matchedItem.isCorrect } : srcItem;
      });
      return {
        ...srcQ,
        items: updatedItems,
      };
    });

    const updatedSourcePart3 = exam.part3.map((srcQ, idx) => {
      const matched =
        nextPart3.find(
          (activeQ) =>
            stripLeakedAnswerMarkers(activeQ.content).trim() ===
            stripLeakedAnswerMarkers(srcQ.content).trim()
        ) || (!isSmartShuffleEnabled ? nextPart3[idx] : undefined);
      return matched ? { ...srcQ, correctAnswer: matched.correctAnswer } : srcQ;
    });

    onUpdateExam({
      ...exam,
      part1: updatedSourcePart1,
      part2: updatedSourcePart2,
      part3: updatedSourcePart3,
    });
  };

  // Teacher sets correct answer for a Part I question
  const handleSetPart1CorrectKey = (qId: number, newKey: 'A' | 'B' | 'C' | 'D') => {
    const nextPart1 = activeExamState.part1.map((q) =>
      q.id === qId ? { ...q, correctAnswer: newKey } : q
    );
    setActiveExamState((prev) => ({ ...prev, part1: nextPart1 }));
    syncAnswerKeyToParentExam(nextPart1, activeExamState.part2, activeExamState.part3);
  };

  // Teacher sets correct True/False for a Part II sub-item (a, b, c, d)
  const handleSetPart2ItemCorrectKey = (
    qId: number,
    label: 'a' | 'b' | 'c' | 'd',
    isCorrectVal: boolean
  ) => {
    const nextPart2 = activeExamState.part2.map((q) =>
      q.id === qId
        ? {
            ...q,
            items: q.items.map((it) =>
              it.label === label ? { ...it, isCorrect: isCorrectVal } : it
            ),
          }
        : q
    );
    setActiveExamState((prev) => ({ ...prev, part2: nextPart2 }));
    syncAnswerKeyToParentExam(activeExamState.part1, nextPart2, activeExamState.part3);
  };

  // Teacher sets all 4 sub-items of a Part II question at once
  const handleSetPart2AllItemsPattern = (qId: number, pattern: [boolean, boolean, boolean, boolean]) => {
    const labels: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
    const nextPart2 = activeExamState.part2.map((q) =>
      q.id === qId
        ? {
            ...q,
            items: q.items.map((it, idx) => ({
              ...it,
              label: labels[idx] || it.label,
              isCorrect: pattern[idx] ?? it.isCorrect,
            })),
          }
        : q
    );
    setActiveExamState((prev) => ({ ...prev, part2: nextPart2 }));
    syncAnswerKeyToParentExam(activeExamState.part1, nextPart2, activeExamState.part3);
  };

  // Parse bulk Part I key string (supports "1A 2B 3C..." or "ABCD...")
  const handleApplyBulkPart1Key = () => {
    const raw = bulkPart1KeyInput.trim().toUpperCase();
    if (!raw) return;

    const nextPart1 = [...activeExamState.part1];
    const numberedMatches = Array.from(raw.matchAll(/(\d+)\s*[:.-]?\s*([ABCD])/g));

    if (numberedMatches.length > 0) {
      numberedMatches.forEach((m) => {
        const qIndex = parseInt(m[1], 10) - 1;
        const choice = m[2] as 'A' | 'B' | 'C' | 'D';
        if (nextPart1[qIndex]) {
          nextPart1[qIndex] = { ...nextPart1[qIndex], correctAnswer: choice };
        }
      });
    } else {
      const lettersOnly = raw.replace(/[^ABCD]/g, '');
      for (let i = 0; i < Math.min(lettersOnly.length, nextPart1.length); i++) {
        const choice = lettersOnly[i] as 'A' | 'B' | 'C' | 'D';
        nextPart1[i] = { ...nextPart1[i], correctAnswer: choice };
      }
    }

    setActiveExamState((prev) => ({ ...prev, part1: nextPart1 }));
    syncAnswerKeyToParentExam(nextPart1, activeExamState.part2, activeExamState.part3);
    setKeyUpdateBanner('Đã cập nhật nhanh đáp án đúng cho Phần I!');
    setTimeout(() => setKeyUpdateBanner(null), 3500);
  };

  // Parse bulk Part II key string (e.g. "1: ĐSĐS, 2: SĐSĐ" or "ĐSĐS SĐSĐ")
  const handleApplyBulkPart2Key = () => {
    const raw = bulkPart2KeyInput.trim().toUpperCase();
    if (!raw) return;

    // Normalize Đ/D/T -> true, S/F -> false
    const groups = raw
      .split(/[,;\n|]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const nextPart2 = [...activeExamState.part2];
    groups.forEach((grp, idx) => {
      const cleaned = grp.replace(/^\d+\s*[:.-]?\s*/, '');
      const tokens = Array.from(cleaned.matchAll(/[ĐDSTF]/g)).map((m) => m[0]);
      const targetIndex = (() => {
        const numPrefix = grp.match(/^(\d+)\s*[:.-]/);
        return numPrefix ? parseInt(numPrefix[1], 10) - 1 : idx;
      })();

      if (nextPart2[targetIndex] && tokens.length > 0) {
        nextPart2[targetIndex] = {
          ...nextPart2[targetIndex],
          items: nextPart2[targetIndex].items.map((it, itemIdx) => {
            const tok = tokens[itemIdx];
            if (!tok) return it;
            const isTrue = tok === 'Đ' || tok === 'D' || tok === 'T';
            return { ...it, isCorrect: isTrue };
          }),
        };
      }
    });

    setActiveExamState((prev) => ({ ...prev, part2: nextPart2 }));
    syncAnswerKeyToParentExam(activeExamState.part1, nextPart2, activeExamState.part3);
    setKeyUpdateBanner('Đã cập nhật nhanh đáp án Đúng/Sai cho Phần II!');
    setTimeout(() => setKeyUpdateBanner(null), 3500);
  };

  // Copy currently selected choices on the test sheet into the official Answer Key
  const handleCopyCurrentSelectionsAsAnswerKey = () => {
    const nextPart1 = activeExamState.part1.map((q) => ({
      ...q,
      correctAnswer: part1Answers[q.id] || q.correctAnswer,
    }));

    const nextPart2 = activeExamState.part2.map((q) => {
      const qSel = part2Answers[q.id];
      if (!qSel) return q;
      return {
        ...q,
        items: q.items.map((it) => ({
          ...it,
          isCorrect:
            qSel[it.label] !== null && qSel[it.label] !== undefined
              ? Boolean(qSel[it.label])
              : it.isCorrect,
        })),
      };
    });

    setActiveExamState((prev) => ({
      ...prev,
      part1: nextPart1,
      part2: nextPart2,
    }));
    syncAnswerKeyToParentExam(nextPart1, nextPart2, activeExamState.part3);
    setKeyUpdateBanner(
      'Đã lấy toàn bộ phương án đang chọn trên bài làm để lưu thành Đáp án đúng chuẩn (Phần I & II)!'
    );
    setTimeout(() => setKeyUpdateBanner(null), 4000);
  };

  const handleReshuffleNewAttempt = (
    enableShuffle: boolean,
    nextShufflePart2: boolean = shufflePart2Items,
    nextDisplayMode: QuestionDisplayMode = displayMode
  ) => {
    setIsSmartShuffleEnabled(enableShuffle);
    setShufflePart2Items(nextShufflePart2);
    setActiveExamState(
      createSmartShuffledExam(
        exam,
        enableShuffle,
        nextShufflePart2,
        hasAnyPdfSlices && nextDisplayMode !== 'text_katex'
      )
    );
    setPart1Answers({});
    setPart2Answers({});
    setPart3Answers({});
    setIsSubmitted(false);
    setTimeLeft(totalDurationSeconds);
  };

  // Sanitize Part III input: only allow digits 0-9, minus sign '-', comma ',', dot '.', max 4 characters
  const handlePart3InputChange = (qId: number, rawValue: string) => {
    // Keep only digits, '-', ',', '.'
    let cleaned = rawValue.replace(/[^0-9.,-]/g, '');
    // Minus sign only allowed at the first character
    if (cleaned.indexOf('-') > 0) {
      cleaned = (cleaned.startsWith('-') ? '-' : '') + cleaned.replace(/-/g, '');
    }
    // Enforce max 4 characters as required by standard answer sheet
    if (cleaned.length > 4) {
      cleaned = cleaned.slice(0, 4);
    }
    setPart3Answers((prev) => ({ ...prev, [qId]: cleaned }));
  };

  // Countdown timer effect
  useEffect(() => {
    if (isSubmitted || isPaused || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleDoSubmit(true);
          return 0;
        }
        const nextVal = prev - 1;
        if (nextVal === 600) {
          setMilestoneAlert('Còn 10 phút làm bài! Hãy kiểm tra lại các câu chưa điền đáp án.');
        } else if (nextVal === 300) {
          setMilestoneAlert('Cảnh báo: Chỉ còn 5 phút cuối cùng trước khi hệ thống tự động thu bài!');
        } else if (nextVal === 60) {
          setMilestoneAlert('Còn 60 giây cuối cùng! Hệ thống sẽ tự động nộp bài khi hết giờ.');
        }
        return nextVal;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSubmitted, isPaused, timeLeft]);

  const formatTimeSegments = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return {
      hrs: hrs > 0 ? hrs.toString().padStart(2, '0') : null,
      mins: mins.toString().padStart(2, '0'),
      secs: s.toString().padStart(2, '0'),
      formatted:
        hrs > 0
          ? `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s
              .toString()
              .padStart(2, '0')}`
          : `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`,
    };
  };

  const handleSelectCustomDuration = (minutes: number) => {
    const newTotal = minutes * 60;
    setTotalDurationSeconds(newTotal);
    setTimeLeft(newTotal);
    setIsPaused(false);
    setShowTimerSettings(false);
  };

  const handleResetTimer = () => {
    setTimeLeft(totalDurationSeconds);
    setIsPaused(false);
    setShowTimerSettings(false);
  };

  /**
   * Standard Auto-Grading Scale (Total 10.0 points):
   * - Part I (4.5 points for 18 questions): 0.25 points / correct question.
   * - Part II (4.0 points for 4 questions, max 1.0 point / question):
   *     + 1 correct statement: 0.1 point
   *     + 2 correct statements: 0.25 points
   *     + 3 correct statements: 0.5 points
   *     + All 4 correct statements (a, b, c, d): 1.0 point
   * - Part III (1.5 points for 6 questions): 0.25 points / correct question
   *   (automatically treats '.' and ',' in decimals identically, e.g. 2,5 === 2.5).
   */
  const calculateScore = () => {
    let scoreP1 = 0;
    let scoreP2 = 0;
    let scoreP3 = 0;
    let correctCountP1 = 0;
    let correctCountP3 = 0;
    const part2QuestionScores: Record<number, { correctSubCount: number; points: number }> = {};

    // Part I: 0.25 pts per question
    activeExamState.part1.forEach((q) => {
      if (part1Answers[q.id] === q.correctAnswer) {
        scoreP1 += 0.25;
        correctCountP1++;
      }
    });

    // Part II: 1 -> 0.1đ, 2 -> 0.25đ, 3 -> 0.5đ, 4 -> 1.0đ
    activeExamState.part2.forEach((q) => {
      const studentQAns = part2Answers[q.id] || { a: null, b: null, c: null, d: null };
      let correctSubCount = 0;
      q.items.forEach((item) => {
        if (studentQAns[item.label] === item.isCorrect) {
          correctSubCount++;
        }
      });

      let qPts = 0;
      if (correctSubCount === 1) qPts = 0.1;
      else if (correctSubCount === 2) qPts = 0.25;
      else if (correctSubCount === 3) qPts = 0.5;
      else if (correctSubCount === 4) qPts = 1.0;

      scoreP2 += qPts;
      part2QuestionScores[q.id] = { correctSubCount, points: qPts };
    });

    // Part III: 0.25 pts per question (comma ',' and dot '.' treated identically)
    activeExamState.part3.forEach((q) => {
      if (isShortAnswerMatch(part3Answers[q.id] || '', q.correctAnswer)) {
        scoreP3 += 0.25;
        correctCountP3++;
      }
    });

    const totalScore = Number((scoreP1 + scoreP2 + scoreP3).toFixed(2));
    return {
      scoreP1: Number(scoreP1.toFixed(2)),
      scoreP2: Number(scoreP2.toFixed(2)),
      scoreP3: Number(scoreP3.toFixed(2)),
      totalScore,
      correctCountP1,
      correctCountP3,
      part2QuestionScores,
    };
  };

  const handleDoSubmit = async (isAutoTimerExpiry: boolean = false) => {
    const resolvedName = (localStudentName || studentInfo?.name || '').trim();
    const resolvedClass = (
      localStudentClass ||
      studentInfo?.className ||
      exam.metadata.grade ||
      '12A1'
    ).trim();
    const resolvedSbd =
      (localStudentSbd || studentInfo?.sbd || '').trim() ||
      `HS-${Math.floor(100 + Math.random() * 900)}`;

    if (roomId && !isAutoTimerExpiry && resolvedName.length < 2) {
      setSubmitIdentityError('Vui lòng nhập Họ và tên học sinh (tối thiểu 2 ký tự) trước khi nộp bài!');
      setShowSubmitConfirmModal(true);
      return;
    }

    setSubmitIdentityError(null);
    setShowSubmitConfirmModal(false);
    setIsTeacherKeyEditMode(false);
    setIsPaused(false);
    setIsSubmitted(true);
    setShowDetailedResultTable(true);
    const scores = calculateScore();

    // Smoothly scroll to the top results banner immediately upon submission
    setTimeout(() => {
      const bannerEl = document.getElementById('exam-results-banner');
      if (bannerEl) {
        bannerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 80);

    if (roomId) {
      try {
        setIsSubmittingToFirebase(true);
        const timeSpent = Math.max(0, totalDurationSeconds - timeLeft);
        await submitStudentResult(roomId, {
          roomId,
          roomCode: roomCode || 'ROOM',
          studentName: resolvedName.length >= 2 ? resolvedName : 'Học sinh trực tuyến',
          studentClass: resolvedClass || '12A1',
          studentId: resolvedSbd,
          scoreTotal: scores.totalScore,
          scorePart1: scores.scoreP1,
          scorePart2: scores.scoreP2,
          scorePart3: scores.scoreP3,
          answersPart1: part1Answers,
          answersPart2: part2Answers,
          answersPart3: part3Answers,
          timeSpentSeconds: timeSpent,
          submittedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to submit to Firebase:', err);
      } finally {
        setIsSubmittingToFirebase(false);
      }
    }
  };

  // Triggered when student clicks "Nộp bài" button
  const handleTriggerSubmitClick = () => {
    const resolvedName = (localStudentName || studentInfo?.name || '').trim();
    if (roomId && resolvedName.length < 2) {
      setSubmitIdentityError('Vui lòng nhập Họ và tên học sinh trước khi nộp bài!');
      setShowSubmitConfirmModal(true);
      return;
    }
    handleDoSubmit(false);
  };

  const results = isSubmitted ? calculateScore() : null;

  // Progress tracking per part
  const answeredP1Count = Object.keys(part1Answers).length;
  const answeredP2Count = activeExamState.part2.filter((q) => {
    const ansObj = part2Answers[q.id];
    if (!ansObj) return false;
    return Object.values(ansObj).some((v) => v !== null && v !== undefined);
  }).length;
  const answeredP3Count = Object.keys(part3Answers).filter((k) =>
    Boolean(part3Answers[Number(k)]?.trim())
  ).length;

  const totalQuestions =
    activeExamState.part1.length +
    activeExamState.part2.length +
    activeExamState.part3.length;
  const answeredCount = answeredP1Count + answeredP2Count + answeredP3Count;

  const elapsedSeconds = Math.max(0, totalDurationSeconds - timeLeft);
  const timePercentRemaining = Math.max(
    0,
    Math.min(100, (timeLeft / Math.max(1, totalDurationSeconds)) * 100)
  );
  const remainingParts = formatTimeSegments(timeLeft);
  const elapsedParts = formatTimeSegments(elapsedSeconds);
  const isCriticalTime = !isSubmitted && timeLeft <= 300;
  const isWarningTime = !isSubmitted && timeLeft > 300 && timeLeft <= 600;

  return (
    <div className="max-w-7xl mx-auto min-h-[100dvh] space-y-6 pb-28 md:pb-12 overflow-x-clip">
      {/* Milestone Time Alert Toast */}
      {milestoneAlert && !isSubmitted && (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 px-4 py-3 rounded-2xl shadow-sm flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            <Bell className="w-4 h-4 text-amber-600 shrink-0 animate-bounce" />
            <span>{milestoneAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setMilestoneAlert(null)}
            className="p-1 rounded-lg hover:bg-amber-200/60 text-amber-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Teacher Key Update Notification Toast */}
      {keyUpdateBanner && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 px-4 py-3 rounded-2xl shadow-sm flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{keyUpdateBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setKeyUpdateBanner(null)}
            className="p-1 rounded-lg hover:bg-emerald-200/60 text-emerald-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Test Room Top Sticky Toolbar with Real-Time Countdown Widget & Per-Part Smart Shuffle Control */}
      <div className="sticky top-20 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 uppercase">
              PHÒNG THI TRỰC TUYẾN CHUẨN 3 PHẦN (10 ĐIỂM)
            </span>
            <span className="text-xs font-bold text-purple-800 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 flex items-center gap-1">
              <Shuffle className="w-3.5 h-3.5 text-purple-600" />
              <span>
                {isSmartShuffleEnabled
                  ? `Mã đề trộn: ${activeExamState.examVariantCode}`
                  : `Đề gốc: ${activeExamState.examVariantCode}`}
              </span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ẩn đáp án ngầm & Chuẩn hóa KaTeX (mhchem)</span>
            </span>
            {(localStudentName || studentInfo?.name) && (
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                Thí sinh: <strong>{localStudentName || studentInfo?.name}</strong> (
                {localStudentClass || studentInfo?.className})
              </span>
            )}
            {roomCode && (
              <span className="text-xs font-black text-amber-900 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-300 font-mono">
                Mã Phòng: {roomCode}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {exam.metadata.examTitle} - MÔN {exam.metadata.subject.toUpperCase()}
            </h2>
            {!isSubmitted && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleReshuffleNewAttempt(true, shufflePart2Items)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
                  title="Trộn câu hỏi trong phạm vi từng phần (Phần I -> Phần II -> Phần III) và trộn đáp án A, B, C, D (giữ cố định đáp án 'Cả A, B, C đều đúng' ở D)"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Trộn Đề Theo Từng Phần</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleReshuffleNewAttempt(true, !shufflePart2Items)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                    shufflePart2Items
                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                  title="Tùy chọn giữ nguyên hoặc trộn thứ tự 4 ý a), b), c), d) ở Phần II"
                >
                  {shufflePart2Items ? 'Phần II: Đang trộn ý a,b,c,d' : 'Phần II: Giữ nguyên a,b,c,d'}
                </button>
                <button
                  type="button"
                  onClick={() => handleReshuffleNewAttempt(!isSmartShuffleEnabled, shufflePart2Items)}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  {isSmartShuffleEnabled ? 'Xem thứ tự gốc' : 'Bật trộn đề'}
                </button>
              </div>
            )}

            {/* Dual Display Mode Selector (Nguyên bản PDF 100% / Chế độ Kép / Văn bản KaTeX) */}
            {hasAnyPdfSlices && (
              <div className="flex flex-wrap items-center gap-1 bg-indigo-50/80 border border-indigo-200 rounded-xl p-1">
                <span className="text-[10px] font-bold text-indigo-900 px-1.5 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-indigo-600" />
                  <span>Hiển thị đề:</span>
                </span>
                {(
                  [
                    { id: 'hybrid', label: 'Kép (PDF gốc + KaTeX)' },
                    { id: 'pdf_original', label: 'Nguyên bản PDF 100%' },
                    { id: 'text_katex', label: 'Văn bản KaTeX + Hình' },
                  ] as { id: QuestionDisplayMode; label: string }[]
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setDisplayMode(mode.id)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      displayMode === mode.id
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            )}

            {/* Teacher Answer Key Setup Controls for Part I & Part II */}
            {!studentInfo && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowAnswerKeyModal(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer shadow-2xs"
                  title="Mở bảng thiết lập nhanh đáp án đúng cho các câu hỏi Phần I (ABCD) và Phần II (Đúng/Sai)"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                  <span>Thiết lập Đáp án (Phần I & II)</span>
                </button>
                {!isSubmitted && (
                  <button
                    type="button"
                    onClick={() => setIsTeacherKeyEditMode((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      isTeacherKeyEditMode
                        ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-2 ring-amber-300'
                        : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                    }`}
                    title="Bật chế độ click trực tiếp vào câu hỏi Phần I & II trên đề thi để đặt làm đáp án đúng"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {isTeacherKeyEditMode
                        ? 'Đang bật: Gán Đáp án trực tiếp'
                        : 'Gán đáp án trên đề'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Toolbar: Interactive Countdown Timer Widget + Submit Action */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Countdown Timer Widget */}
          <div className="relative">
            <div
              className={`rounded-2xl border px-3.5 py-2 transition-all shadow-xs flex items-center gap-3 ${
                isSubmitted
                  ? 'bg-slate-100 border-slate-300 text-slate-700'
                  : isCriticalTime
                  ? 'bg-rose-950 text-white border-rose-500 ring-2 ring-rose-400/40 animate-pulse'
                  : isWarningTime
                  ? 'bg-amber-950 text-white border-amber-500'
                  : isPaused
                  ? 'bg-slate-800 text-amber-200 border-amber-400/60'
                  : 'bg-slate-900 text-white border-slate-800'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isSubmitted
                    ? 'bg-slate-200 text-slate-600'
                    : isCriticalTime
                    ? 'bg-rose-600 text-white'
                    : isWarningTime
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-white/10 text-emerald-400'
                }`}
              >
                <Timer className="w-5 h-5" />
              </div>

              <div className="min-w-[145px]">
                <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider opacity-80">
                  <span>
                    {isSubmitted
                      ? 'Đã nộp bài'
                      : isPaused
                      ? 'Đang tạm dừng'
                      : isCriticalTime
                      ? 'Sắp hết giờ!'
                      : 'Thời gian còn lại'}
                  </span>
                  {!isSubmitted && (
                    <span className="font-mono">{Math.ceil(timePercentRemaining)}%</span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 font-mono font-black text-lg sm:text-xl tracking-tight leading-tight">
                  {isSubmitted ? (
                    <span className="text-sm font-bold text-slate-700">
                      Hoàn thành ({elapsedParts.formatted})
                    </span>
                  ) : (
                    <>
                      {remainingParts.hrs && (
                        <>
                          <span>{remainingParts.hrs}</span>
                          <span className="text-emerald-400">:</span>
                        </>
                      )}
                      <span>{remainingParts.mins}</span>
                      <span className={isCriticalTime ? 'text-rose-300' : 'text-emerald-400'}>
                        :
                      </span>
                      <span className={isCriticalTime ? 'text-rose-300' : 'text-amber-300'}>
                        {remainingParts.secs}
                      </span>
                      <span className="text-[10px] font-sans font-normal opacity-75 ml-1.5">
                        / {Math.round(totalDurationSeconds / 60)}p
                      </span>
                    </>
                  )}
                </div>

                {!isSubmitted && (
                  <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isCriticalTime
                          ? 'bg-rose-500'
                          : isWarningTime
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: `${timePercentRemaining}%` }}
                    />
                  </div>
                )}
              </div>

              {!isSubmitted && !roomId && (
                <div className="flex items-center gap-1 pl-2 border-l border-white/15">
                  <button
                    type="button"
                    onClick={() => setIsPaused((prev) => !prev)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title={isPaused ? 'Tiếp tục tính giờ' : 'Tạm dừng đồng hồ'}
                  >
                    {isPaused ? (
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Pause className="w-3.5 h-3.5 text-amber-300" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTimerSettings((prev) => !prev)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="Tùy chỉnh thời gian luyện tập"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {showTimerSettings && !isSubmitted && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-40 space-y-3 text-xs text-slate-700">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    Chi tiết thời gian làm bài
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTimerSettings(false)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Đã làm bài</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {elapsedParts.formatted}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Tốc độ trung bình</span>
                    <span className="font-mono font-bold text-indigo-700 text-sm">
                      {answeredCount > 0
                        ? `${Math.round(elapsedSeconds / answeredCount)}s / câu`
                        : 'Chưa chọn'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                    Đặt thời gian luyện tập:
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[15, 30, 45, 50].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => handleSelectCustomDuration(mins)}
                        className={`py-1.5 rounded-lg font-bold border text-center cursor-pointer transition-colors ${
                          Math.round(totalDurationSeconds / 60) === mins
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {mins}p
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetTimer}
                  className="w-full py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đặt lại đồng hồ về đầu</span>
                </button>
              </div>
            )}
          </div>

          {!isSubmitted ? (
            <button
              type="button"
              onClick={handleTriggerSubmitClick}
              disabled={isSubmittingToFirebase}
              className="min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-200 cursor-pointer transition-all"
            >
              {isSubmittingToFirebase ? 'Đang gửi bài...' : 'Nộp Bài'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleReshuffleNewAttempt(isSmartShuffleEnabled, shufflePart2Items)}
                className="min-h-[44px] px-4 py-2 rounded-xl font-bold text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer"
              >
                Làm lại đề này
              </button>
              <button
                type="button"
                onClick={onExitTest}
                className="min-h-[44px] px-4 py-2 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
              >
                Quay Lại
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline Teacher Answer Key Edit Mode Banner */}
      {isTeacherKeyEditMode && !isSubmitted && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-400 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-amber-950 uppercase">
              <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
              <span>CHẾ ĐỘ GIÁO VIÊN: GÁN ĐÁP ÁN ĐÚNG TRỰC TIẾP TRÊN ĐỀ (PHẦN I & PHẦN II)</span>
            </div>
            <p className="text-xs text-amber-900">
              Nhấn vào các nút <strong>Đặt làm Đáp án đúng (A, B, C, D)</strong> ở từng câu Phần I hoặc chọn <strong>Đáp án chuẩn: Đúng / Sai</strong> ở từng ý a), b), c), d) Phần II. Khi học sinh nhấn <strong>&ldquo;Nộp bài&rdquo;</strong>, hệ thống sẽ tự động chấm điểm và hiển thị bảng kết quả chi tiết theo đúng đáp án này.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {answeredP1Count + answeredP2Count > 0 && (
              <button
                type="button"
                onClick={handleCopyCurrentSelectionsAsAnswerKey}
                className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
              >
                Lấy bài đang chọn làm Đáp án
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAnswerKeyModal(true)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
            >
              Bảng Thiết lập Nhanh
            </button>
            <button
              type="button"
              onClick={() => setIsTeacherKeyEditMode(false)}
              className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 cursor-pointer"
            >
              Hoàn tất
            </button>
          </div>
        </div>
      )}

      {/* TEACHER ANSWER KEY SETUP MODAL (FOR PART I & PART II) */}
      {showAnswerKeyModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
          onClick={() => setShowAnswerKeyModal(false)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90dvh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wide">
                    THIẾT LẬP ĐÁP ÁN ĐÚNG (PHẦN I & PHẦN II)
                  </h3>
                  <p className="text-[11px] sm:text-xs text-white/90">
                    Cấu hình đáp án chuẩn để hệ thống tự động chấm điểm và hiển thị kết quả chi tiết ngay khi học sinh nhấn &ldquo;Nộp bài&rdquo;
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAnswerKeyModal(false)}
                className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {/* Quick Sync from Current Student/Teacher Selections on Screen */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-indigo-950 space-y-0.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Mẹo thiết lập siêu tốc cho Giáo viên:</span>
                  </div>
                  <p className="text-slate-600">
                    Bạn có thể tích chọn trực tiếp đáp án trên giao diện bài thi rồi bấm nút bên cạnh, hoặc chọn/nhập chuỗi đáp án cho Phần I và Phần II ngay dưới đây.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCurrentSelectionsAsAnswerKey}
                  className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shrink-0 cursor-pointer"
                >
                  Lấy các câu đang chọn trên đề làm Đáp án đúng
                </button>
              </div>

              {/* SECTION 1: PART I (MULTIPLE CHOICE A, B, C, D) */}
              {activeExamState.part1.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-sky-900 uppercase">
                        1. ĐÁP ÁN PHẦN I — TRẮC NGHIỆM 4 LỰA CHỌN A, B, C, D ({activeExamState.part1.length} CÂU • 0,25Đ/CÂU)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Nhấn vào A, B, C hoặc D để đặt đáp án đúng cho từng câu hỏi
                      </p>
                    </div>
                    <span className="text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                      Tổng Phần I: {(activeExamState.part1.length * 0.25).toFixed(2).replace('.', ',')} điểm
                    </span>
                  </div>

                  {/* Quick Bulk Input for Part I */}
                  <div className="flex flex-col sm:flex-row gap-2 bg-sky-50/60 p-3 rounded-xl border border-sky-200/80">
                    <input
                      type="text"
                      value={bulkPart1KeyInput}
                      onChange={(e) => setBulkPart1KeyInput(e.target.value)}
                      placeholder="Nhập nhanh chuỗi đáp án Phần I (VD: 1A 2C 3B 4D... hoặc ACDbaBCD...)"
                      className="flex-1 min-h-[40px] text-base sm:text-xs px-3 py-1.5 rounded-lg border border-sky-300 bg-white text-slate-900 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleApplyBulkPart1Key}
                      className="min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shrink-0 cursor-pointer"
                    >
                      Áp dụng chuỗi Phần I
                    </button>
                  </div>

                  {/* Interactive Grid of Part I Questions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {activeExamState.part1.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-900 block">
                            Câu {idx + 1}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate block">
                            Đang chọn: <strong className="text-emerald-700">{q.correctAnswer}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                            const isCurrentKey = q.correctAnswer === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleSetPart1CorrectKey(q.id, opt)}
                                className={`w-9 h-9 rounded-lg font-bold text-xs transition-all cursor-pointer border ${
                                  isCurrentKey
                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-300'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-sky-50 hover:border-sky-300'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION 2: PART II (TRUE / FALSE STATEMENTS a, b, c, d) */}
              {activeExamState.part2.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-indigo-900 uppercase">
                        2. ĐÁP ÁN PHẦN II — TRẮC NGHIỆM ĐÚNG / SAI a), b), c), d) ({activeExamState.part2.length} CÂU • TỐI ĐA 1,0Đ/CÂU)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Quy tắc chuẩn Bộ GD&ĐT: Đúng 1 ý = 0,1đ • Đúng 2 ý = 0,25đ • Đúng 3 ý = 0,5đ • Đúng cả 4 ý = 1,0đ
                      </p>
                    </div>
                    <span className="text-xs font-bold text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                      Tổng Phần II: {(activeExamState.part2.length * 1.0).toFixed(2).replace('.', ',')} điểm
                    </span>
                  </div>

                  {/* Quick Bulk Input for Part II */}
                  <div className="flex flex-col sm:flex-row gap-2 bg-indigo-50/60 p-3 rounded-xl border border-indigo-200/80">
                    <input
                      type="text"
                      value={bulkPart2KeyInput}
                      onChange={(e) => setBulkPart2KeyInput(e.target.value)}
                      placeholder="Nhập nhanh chuỗi Phần II (VD: 1: ĐSĐS, 2: SĐSĐ, 3: ĐĐSS, 4: SĐĐS)"
                      className="flex-1 min-h-[40px] text-base sm:text-xs px-3 py-1.5 rounded-lg border border-indigo-300 bg-white text-slate-900 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleApplyBulkPart2Key}
                      className="min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 cursor-pointer"
                    >
                      Áp dụng chuỗi Phần II
                    </button>
                  </div>

                  {/* Interactive Cards for Each Part II Question */}
                  <div className="space-y-3">
                    {activeExamState.part2.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-3.5 rounded-2xl border border-indigo-200/80 bg-white space-y-2.5 shadow-2xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-900 font-bold text-xs">
                              Câu {idx + 1} (Phần II)
                            </span>
                            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Chuỗi đáp án:{' '}
                              {q.items
                                .map((it) => `${it.label}-${it.isCorrect ? 'Đ' : 'S'}`)
                                .join(' • ')}
                            </span>
                          </div>
                          {/* Quick Preset Buttons */}
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] text-slate-400 mr-1">Mẫu nhanh:</span>
                            {(
                              [
                                { label: 'Đ-S-Đ-S', pat: [true, false, true, false] },
                                { label: 'S-Đ-S-Đ', pat: [false, true, false, true] },
                                { label: 'Đ-Đ-S-S', pat: [true, true, false, false] },
                                { label: '4 Đúng', pat: [true, true, true, true] },
                                { label: '4 Sai', pat: [false, false, false, false] },
                              ] as { label: string; pat: [boolean, boolean, boolean, boolean] }[]
                            ).map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => handleSetPart2AllItemsPattern(q.id, preset.pat)}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-900 border border-slate-200 cursor-pointer"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.items.map((item) => (
                            <div
                              key={item.label}
                              className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1 text-xs text-slate-800 flex items-start gap-1.5">
                                <span className="font-bold text-indigo-900 shrink-0">
                                  {item.label})
                                </span>
                                <div className="truncate max-w-[200px]">
                                  <MathChemView content={item.text} />
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSetPart2ItemCorrectKey(q.id, item.label, true)
                                  }
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                    item.isCorrect
                                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                      : 'bg-white text-slate-600 border-slate-300 hover:bg-emerald-50'
                                  }`}
                                >
                                  Đúng
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSetPart2ItemCorrectKey(q.id, item.label, false)
                                  }
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                    !item.isCorrect
                                      ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                                      : 'bg-white text-slate-600 border-slate-300 hover:bg-rose-50'
                                  }`}
                                >
                                  Sai
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-600">
                Mọi thay đổi đáp án được lưu tự động và áp dụng ngay khi học sinh nhấn <strong>&ldquo;Nộp bài&rdquo;</strong>.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAnswerKeyModal(false);
                    setKeyUpdateBanner(
                      'Đã lưu cấu hình Đáp án đúng cho Phần I & Phần II thành công!'
                    );
                    setTimeout(() => setKeyUpdateBanner(null), 3500);
                  }}
                  className="min-h-[42px] px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Lưu & Đóng bảng thiết lập</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirmModal && !isSubmitted && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xác nhận nộp bài thi?</h3>
                <p className="text-xs text-slate-500">
                  Thời gian còn lại:{' '}
                  <strong className="font-mono text-slate-800">{remainingParts.formatted}</strong>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-600">Phần I (Trắc nghiệm ABCD):</span>
                <span className="font-bold text-sky-700">
                  {answeredP1Count} / {activeExamState.part1.length} câu
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Phần II (Đúng / Sai a,b,c,d):</span>
                <span className="font-bold text-indigo-700">
                  {answeredP2Count} / {activeExamState.part2.length} câu
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Phần III (Trả lời ngắn):</span>
                <span className="font-bold text-emerald-700">
                  {answeredP3Count} / {activeExamState.part3.length} câu
                </span>
              </div>
              {answeredCount < totalQuestions && (
                <p className="text-amber-700 font-medium pt-1 border-t border-slate-200/80">
                  Lưu ý: Bạn vẫn còn {totalQuestions - answeredCount} câu chưa hoàn thành.
                </p>
              )}
            </div>

            {roomId && (
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2.5 text-xs">
                <div className="font-bold text-indigo-950">
                  Thông tin học sinh nộp bài (Mã phòng: {roomCode}):
                </div>
                {submitIdentityError && (
                  <div className="p-2 rounded-lg bg-rose-100 text-rose-800 font-semibold border border-rose-300">
                    {submitIdentityError}
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Họ và tên học sinh <span className="text-rose-600">*</span>:
                  </label>
                  <input
                    type="text"
                    value={localStudentName}
                    onChange={(e) => {
                      setLocalStudentName(e.target.value);
                      setSubmitIdentityError(null);
                    }}
                    placeholder="Nhập Họ và tên (VD: Nguyễn Văn A)"
                    className="w-full min-h-[44px] text-base sm:text-xs border border-indigo-300 rounded-lg px-3 py-2 font-semibold bg-white text-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Lớp:</label>
                    <input
                      type="text"
                      value={localStudentClass}
                      onChange={(e) => setLocalStudentClass(e.target.value)}
                      placeholder="12A1"
                      className="w-full min-h-[44px] text-base sm:text-xs border border-indigo-300 rounded-lg px-3 py-2 font-semibold bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">SBD:</label>
                    <input
                      type="text"
                      value={localStudentSbd}
                      onChange={(e) => setLocalStudentSbd(e.target.value)}
                      placeholder="012"
                      className="w-full min-h-[44px] text-base sm:text-xs border border-indigo-300 rounded-lg px-3 py-2 font-semibold bg-white text-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirmModal(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Làm tiếp
              </button>
              <button
                type="button"
                onClick={() => handleDoSubmit(false)}
                className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer"
              >
                Xác nhận Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Student Identity Bar when taking an online room exam (e.g. opened via /?room=3203) */}
      {roomId && !isSubmitted && (
        <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 p-4 rounded-2xl border border-indigo-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-black text-indigo-950 uppercase tracking-wide block">
              THÔNG TIN HỌC SINH DỰ THI (PHÒNG THI MÃ: {roomCode})
            </span>
            <span className="text-[11px] text-slate-600">
              Nhập Họ tên và Lớp của bạn để hệ thống lưu điểm trực tiếp vào bảng điểm của giáo viên khi nộp bài.
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1 max-w-2xl">
            <input
              type="text"
              value={localStudentName}
              onChange={(e) => {
                setLocalStudentName(e.target.value);
                setSubmitIdentityError(null);
              }}
              placeholder="Họ và tên học sinh *"
              className="min-h-[44px] border-2 border-indigo-300 focus:border-indigo-600 rounded-xl px-3 py-2 text-base sm:text-xs font-bold bg-white text-slate-900"
            />
            <input
              type="text"
              value={localStudentClass}
              onChange={(e) => setLocalStudentClass(e.target.value)}
              placeholder="Lớp (VD: 12A1) *"
              className="min-h-[44px] border border-slate-300 focus:border-indigo-600 rounded-xl px-3 py-2 text-base sm:text-xs font-semibold bg-white text-slate-900"
            />
            <input
              type="text"
              value={localStudentSbd}
              onChange={(e) => setLocalStudentSbd(e.target.value)}
              placeholder="Số báo danh (SBD)"
              className="min-h-[44px] border border-slate-300 focus:border-indigo-600 rounded-xl px-3 py-2 text-base sm:text-xs font-semibold bg-white text-slate-900"
            />
          </div>
        </div>
      )}

      {/* RESULTS BANNER & AUTOMATIC DETAILED BREAKDOWN TABLE (IMMEDIATELY SHOWN ON SUBMIT) */}
      {isSubmitted && results && (
        <div
          id="exam-results-banner"
          className="space-y-4 animate-in fade-in duration-200"
        >
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-sky-900 text-white p-6 sm:p-8 rounded-2xl shadow-xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    <CheckCircle2 className="w-4 h-4" /> Đã chấm điểm tự động theo thang điểm 10,0 chuẩn Bộ GD&ĐT (Thời gian: {elapsedParts.formatted})
                  </div>
                  {roomId && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-200 border border-sky-400/30">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
                      <span>Đã lưu kết quả lên Firebase Phòng {roomCode || ''}</span>
                    </div>
                  )}
                </div>
                <h3 className="text-2xl font-black tracking-tight">
                  KẾT QUẢ CHẤM ĐIỂM & CHI TIẾT ĐÁP ÁN BÀI LÀM
                </h3>
                {(localStudentName || studentInfo?.name) && (
                  <p className="text-xs text-amber-200 font-semibold">
                    Thí sinh: {localStudentName || studentInfo?.name} • Lớp:{' '}
                    {localStudentClass || studentInfo?.className}
                    {(localStudentSbd || studentInfo?.sbd)
                      ? ` • SBD: ${localStudentSbd || studentInfo?.sbd}`
                      : ''}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20">
                <Award className="w-12 h-12 text-amber-300" />
                <div>
                  <span className="text-xs font-medium text-indigo-200 block">
                    TỔNG ĐIỂM ĐẠT ĐƯỢC
                  </span>
                  <span className="text-4xl font-black text-amber-300 leading-none">
                    {results.totalScore.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-sm text-indigo-200 ml-1">/ 10,0 điểm</span>
                </div>
              </div>
            </div>

            {/* Breakdown cards per official 3-part grading scale */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
              <div className="bg-white/10 rounded-xl p-3.5 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-sky-200 font-semibold">
                    Phần I: Trắc nghiệm ABCD
                  </span>
                  <span className="text-[11px] bg-sky-500/30 text-sky-100 px-2 py-0.5 rounded">
                    Đúng {results.correctCountP1}/{activeExamState.part1.length} câu
                  </span>
                </div>
                <div className="text-xl font-black text-white mt-1">
                  {results.scoreP1.toFixed(2).replace('.', ',')}{' '}
                  <span className="text-xs font-normal text-sky-200">
                    / {(activeExamState.part1.length * 0.25).toFixed(2).replace('.', ',')} điểm (0,25đ/câu)
                  </span>
                </div>
              </div>

              <div className="bg-white/10 rounded-xl p-3.5 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-indigo-200 font-semibold">
                    Phần II: Đúng / Sai (a, b, c, d)
                  </span>
                  <span className="text-[11px] bg-indigo-500/30 text-indigo-100 px-2 py-0.5 rounded">
                    0,1 • 0,25 • 0,5 • 1,0đ
                  </span>
                </div>
                <div className="text-xl font-black text-white mt-1">
                  {results.scoreP2.toFixed(2).replace('.', ',')}{' '}
                  <span className="text-xs font-normal text-indigo-200">
                    / {(activeExamState.part2.length * 1.0).toFixed(2).replace('.', ',')} điểm (tối đa 1,0đ/câu)
                  </span>
                </div>
              </div>

              <div className="bg-white/10 rounded-xl p-3.5 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-200 font-semibold">
                    Phần III: Trả lời ngắn
                  </span>
                  <span className="text-[11px] bg-emerald-500/30 text-emerald-100 px-2 py-0.5 rounded">
                    Đúng {results.correctCountP3}/{activeExamState.part3.length} câu
                  </span>
                </div>
                <div className="text-xl font-black text-white mt-1">
                  {results.scoreP3.toFixed(2).replace('.', ',')}{' '}
                  <span className="text-xs font-normal text-emerald-200">
                    / {(activeExamState.part3.length * 0.25).toFixed(2).replace('.', ',')} điểm (0,25đ/câu)
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowDetailedResultTable((prev) => !prev)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 cursor-pointer transition-colors"
              >
                <ListChecks className="w-4 h-4 text-amber-300" />
                <span>
                  {showDetailedResultTable
                    ? 'Thu gọn Bảng kết quả đối chiếu chi tiết'
                    : 'Xem Bảng kết quả đối chiếu chi tiết từng câu'}
                </span>
              </button>

              {!studentInfo && (
                <button
                  type="button"
                  onClick={() => setShowAnswerKeyModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-300/40 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa lại Đáp án đúng & Chấm lại tự động</span>
                </button>
              )}
            </div>
          </div>

          {/* DETAILED ANSWER COMPARISON TABLE (PART I, PART II, PART III) */}
          {showDetailedResultTable && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-600" />
                  <h4 className="text-sm sm:text-base font-black text-slate-900 uppercase">
                    BẢNG ĐỐI CHIẾU KẾT QUẢ CHI TIẾT (PHẦN I, PHẦN II & PHẦN III)
                  </h4>
                </div>
                <span className="text-xs text-slate-500">
                  Nhấn vào từng câu trong bảng để xem nội dung và lời giải chi tiết bên dưới
                </span>
              </div>

              {/* 1. Detailed Table for Part I */}
              {activeExamState.part1.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-sky-900 uppercase">
                      PHẦN I. TRẮC NGHIỆM 4 PHƯƠNG ÁN A, B, C, D — ĐÚNG {results.correctCountP1}/
                      {activeExamState.part1.length} CÂU ({results.scoreP1.toFixed(2).replace('.', ',')} ĐIỂM)
                    </h5>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {activeExamState.part1.map((q, idx) => {
                      const sChoice = part1Answers[q.id];
                      const isRight = sChoice === q.correctAnswer;
                      return (
                        <a
                          key={q.id}
                          href={`#q-p1-${q.id}`}
                          className={`p-2.5 rounded-xl border text-xs transition-all flex flex-col justify-between gap-1 ${
                            isRight
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                              : sChoice
                              ? 'bg-rose-50/70 border-rose-300 text-rose-950'
                              : 'bg-amber-50/60 border-amber-300 text-amber-950'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span>Câu {idx + 1}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                isRight
                                  ? 'bg-emerald-600 text-white'
                                  : sChoice
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-amber-500 text-white'
                              }`}
                            >
                              {isRight ? '+0,25đ' : '0đ'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-black/5">
                            <span>
                              Chọn: <strong>{sChoice || '—'}</strong>
                            </span>
                            <span>
                              Đ/A: <strong className="text-emerald-700">{q.correctAnswer}</strong>
                            </span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Detailed Table for Part II */}
              {activeExamState.part2.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-indigo-900 uppercase">
                      PHẦN II. TRẮC NGHIỆM ĐÚNG / SAI (a, b, c, d) — ĐẠT{' '}
                      {results.scoreP2.toFixed(2).replace('.', ',')} /{' '}
                      {(activeExamState.part2.length * 1.0).toFixed(2).replace('.', ',')} ĐIỂM
                    </h5>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeExamState.part2.map((q, idx) => {
                      const qScore = results.part2QuestionScores[q.id] || {
                        correctSubCount: 0,
                        points: 0,
                      };
                      const studentQAns = part2Answers[q.id] || {
                        a: null,
                        b: null,
                        c: null,
                        d: null,
                      };

                      return (
                        <a
                          key={q.id}
                          href={`#q-p2-${q.id}`}
                          className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/60 transition-all space-y-2.5 block"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-indigo-950">
                              Câu {idx + 1} (Phần II)
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                                qScore.correctSubCount === 4
                                  ? 'bg-emerald-600 text-white'
                                  : qScore.correctSubCount > 0
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-rose-600 text-white'
                              }`}
                            >
                              Đúng {qScore.correctSubCount}/4 ý (+
                              {qScore.points.toString().replace('.', ',')}đ)
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
                            {q.items.map((item) => {
                              const sVal = studentQAns[item.label];
                              const subRight = sVal === item.isCorrect;
                              const sLabel =
                                sVal === true ? 'Đ' : sVal === false ? 'S' : '—';
                              const cLabel = item.isCorrect ? 'Đ' : 'S';

                              return (
                                <div
                                  key={item.label}
                                  className={`p-1.5 rounded-lg border ${
                                    subRight
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                      : 'bg-rose-50 border-rose-300 text-rose-900'
                                  }`}
                                >
                                  <div className="font-bold">
                                    Ý {item.label}){' '}
                                    {subRight ? '✓' : '✗'}
                                  </div>
                                  <div className="text-[10px] mt-0.5">
                                    HS: <strong>{sLabel}</strong> | ĐA:{' '}
                                    <strong className="text-emerald-700">{cLabel}</strong>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Detailed Table for Part III */}
              {activeExamState.part3.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-emerald-900 uppercase">
                      PHẦN III. TRẢ LỜI NGẮN — ĐÚNG {results.correctCountP3}/
                      {activeExamState.part3.length} CÂU ({results.scoreP3.toFixed(2).replace('.', ',')} ĐIỂM)
                    </h5>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {activeExamState.part3.map((q, idx) => {
                      const sVal = (part3Answers[q.id] || '').trim();
                      const isRight = isShortAnswerMatch(sVal, q.correctAnswer);
                      return (
                        <a
                          key={q.id}
                          href={`#q-p3-${q.id}`}
                          className={`p-2.5 rounded-xl border text-xs transition-all flex flex-col justify-between gap-1 ${
                            isRight
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                              : sVal
                              ? 'bg-rose-50/70 border-rose-300 text-rose-950'
                              : 'bg-amber-50/60 border-amber-300 text-amber-950'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span>Câu {idx + 1}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                isRight ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                              }`}
                            >
                              {isRight ? '+0,25đ' : '0đ'}
                            </span>
                          </div>
                          <div className="text-[11px] pt-1 border-t border-black/5 space-y-0.5 font-mono">
                            <div>
                              HS: <strong>{sVal || '—'}</strong>
                            </div>
                            <div>
                              Đ/A: <strong className="text-emerald-700">{q.correctAnswer}</strong>
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MAIN LAYOUT: Questions on left (8 cols on md+), Question Palette on right (4 cols on md+) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* QUESTIONS COLUMN */}
        <div className="md:col-span-8 space-y-8 min-w-0">
          {/* =================================================================
              PHẦN I: CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN (4 RADIO A, B, C, D)
              ================================================================= */}
          {activeExamState.part1.length > 0 && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sky-900 text-sm">
                    PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (Từ câu 1 đến câu {activeExamState.part1.length})
                  </h3>
                  <p className="text-xs text-sky-700">
                    Mỗi câu hỏi có 4 phương án A, B, C, D. Học sinh chỉ chọn 1 phương án đúng.
                  </p>
                </div>
                <span className="text-xs font-bold bg-white text-sky-800 px-2.5 py-1 rounded-md border border-sky-200">
                  0,25 điểm / câu (Tổng {(activeExamState.part1.length * 0.25).toFixed(2).replace('.', ',')}đ)
                </span>
              </div>

              {activeExamState.part1.map((q, idx) => {
                const studentChoice = part1Answers[q.id];
                const isCorrect = studentChoice === q.correctAnswer;
                const hasFixedDOption = isFixedAtDOptionText(q.options.D);

                return (
                  <div
                    key={q.id}
                    id={`q-p1-${q.id}`}
                    className={`bg-white rounded-xl border p-4 sm:p-5 transition-all shadow-2xs overflow-hidden ${
                      isSubmitted
                        ? isCorrect
                          ? 'border-emerald-300 bg-emerald-50/20'
                          : studentChoice
                          ? 'border-rose-300 bg-rose-50/20'
                          : 'border-amber-300'
                        : isTeacherKeyEditMode
                        ? 'border-amber-300 ring-1 ring-amber-200'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 font-bold text-xs shrink-0 mt-0.5">
                          Câu {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0 max-w-full overflow-x-auto text-sm text-slate-900 font-medium leading-relaxed">
                          <MathChemView content={q.content} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isTeacherKeyEditMode && (
                          <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1">
                            <span className="text-[10px] font-bold text-amber-900 mr-1">
                              Đáp án đúng:
                            </span>
                            {(['A', 'B', 'C', 'D'] as const).map((k) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => handleSetPart1CorrectKey(q.id, k)}
                                className={`w-6 h-6 rounded text-[11px] font-black cursor-pointer transition-colors ${
                                  q.correctAnswer === k
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-amber-100'
                                }`}
                              >
                                {k}
                              </button>
                            ))}
                          </div>
                        )}
                        {hasFixedDOption && !isSubmitted && (
                          <span className="shrink-0 text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
                            Cố định phương án D
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Single Isolated Diagram Image Between Stem and Options */}
                    {(q.image || q.imageUrl) && (
                      <div className="exam-diagram-wrapper my-3 text-center pl-0 sm:pl-12 pr-0 sm:pr-2 max-w-full overflow-x-auto">
                        <img
                          src={q.image || q.imageUrl}
                          alt={q.imageCaption || `Hình thí nghiệm Câu ${idx + 1}`}
                          className="exam-diagram-img my-3 max-h-80 w-auto mx-auto rounded border border-slate-200 shadow-sm object-contain bg-white p-1"
                        />
                        {q.imageCaption && (
                          <p className="text-xs italic text-slate-600 mt-1 font-serif">
                            {q.imageCaption}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 4 Interactive Answer Buttons ([A], [B], [C], [D]) - Minimum 44px touch target height */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-0 sm:pl-12">
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                        const isChosen = studentChoice === opt;
                        const isThisKey = q.correctAnswer === opt;

                        let labelStyle =
                          'bg-white border-slate-200 text-slate-800 hover:bg-slate-50';
                        if (isSubmitted) {
                          if (isThisKey) {
                            labelStyle =
                              'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold ring-2 ring-emerald-400';
                          } else if (isChosen && !isThisKey) {
                            labelStyle =
                              'bg-rose-100 border-rose-400 text-rose-950 font-bold';
                          }
                        } else if (isTeacherKeyEditMode && isThisKey) {
                          labelStyle =
                            'bg-amber-50 border-amber-500 text-amber-950 font-bold ring-2 ring-amber-300';
                        } else if (isChosen) {
                          labelStyle =
                            'bg-sky-50 border-sky-500 text-sky-950 font-bold ring-2 ring-sky-400';
                        }

                        return (
                          <label
                            key={opt}
                            className={`min-h-[44px] flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs sm:text-sm transition-all ${
                              isSubmitted ? 'cursor-default' : 'cursor-pointer'
                            } ${labelStyle}`}
                          >
                            <input
                              type="radio"
                              name={`part1_q_${q.id}`}
                              value={opt}
                              checked={isTeacherKeyEditMode ? isThisKey : isChosen}
                              disabled={isSubmitted}
                              onChange={() => {
                                if (!isSubmitted) {
                                  if (isTeacherKeyEditMode) {
                                    handleSetPart1CorrectKey(q.id, opt);
                                  } else {
                                    setPart1Answers((prev) => ({ ...prev, [q.id]: opt }));
                                  }
                                }
                              }}
                              className="w-4 h-4 text-sky-600 border-slate-300 focus:ring-sky-500 shrink-0 accent-sky-600"
                            />
                            <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-900 font-black shrink-0">
                              [{opt}]
                            </span>
                            <div className="flex-1 min-w-0 max-w-full overflow-x-auto">
                              <MathChemView content={q.options[opt]} />
                            </div>
                            {isTeacherKeyEditMode && isThisKey && (
                              <span className="shrink-0 text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded">
                                Đáp án đúng
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {isSubmitted && (
                      <div className="mt-4 sm:ml-12 p-3 bg-amber-50 rounded-lg border border-amber-200/80 text-xs">
                        <span className="font-bold text-amber-900 block mb-1">
                          {isCorrect
                            ? '✓ Chính xác (+0,25 điểm)'
                            : studentChoice
                            ? `✗ Sai (0 điểm) • Bạn chọn: ${studentChoice}`
                            : '⚠ Chưa chọn đáp án (0 điểm)'}{' '}
                          • Đáp án đúng chuẩn: {q.correctAnswer}
                        </span>
                        {q.explanation && (
                          <MathChemView content={q.explanation} className="text-slate-700" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* =================================================================
              PHẦN II: CÂU TRẮC NGHIỆM ĐÚNG SAI (4 DÒNG a, b, c, d VỚI [Đúng] / [Sai])
              ================================================================= */}
          {activeExamState.part2.length > 0 && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-indigo-900 text-sm">
                    PHẦN II. Câu trắc nghiệm đúng sai (Từ câu 1 đến câu {activeExamState.part2.length})
                  </h3>
                  <p className="text-xs text-indigo-700">
                    Mỗi câu hỏi có 4 ý a), b), c), d). Học sinh chọn <strong>[Đúng]</strong> hoặc <strong>[Sai]</strong> cho từng ý (Đúng 1 ý: 0,1đ • 2 ý: 0,25đ • 3 ý: 0,5đ • 4 ý: 1,0đ).
                  </p>
                </div>
                <span className="text-xs font-bold bg-white text-indigo-800 px-2.5 py-1 rounded-md border border-indigo-200">
                  Tối đa 1,0 điểm / câu (Tổng {(activeExamState.part2.length * 1.0).toFixed(1).replace('.', ',')}đ)
                </span>
              </div>

              {activeExamState.part2.map((q, idx) => {
                const qScoreInfo = results?.part2QuestionScores[q.id];

                return (
                  <div
                    key={q.id}
                    id={`q-p2-${q.id}`}
                    className={`bg-white rounded-xl border shadow-2xs p-4 sm:p-5 space-y-4 overflow-hidden ${
                      isTeacherKeyEditMode
                        ? 'border-amber-300 ring-1 ring-amber-200'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 font-bold text-xs shrink-0 mt-0.5">
                          Câu {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0 max-w-full overflow-x-auto text-sm text-slate-900 font-medium leading-relaxed">
                          <MathChemView content={q.content} />
                        </div>
                      </div>
                      {isTeacherKeyEditMode && !isSubmitted && (
                        <span className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-300">
                          Đáp án chuẩn:{' '}
                          {q.items.map((it) => `${it.label}-${it.isCorrect ? 'Đ' : 'S'}`).join(' ')}
                        </span>
                      )}
                      {isSubmitted && qScoreInfo && (
                        <span className="shrink-0 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 font-bold text-xs">
                          Đúng {qScoreInfo.correctSubCount}/4 ý (+{qScoreInfo.points.toString().replace('.', ',')}đ)
                        </span>
                      )}
                    </div>

                    {(q.image || q.imageUrl) && (
                      <div className="exam-diagram-wrapper my-3 text-center pl-0 sm:pl-12 pr-0 sm:pr-2 max-w-full overflow-x-auto">
                        <img
                          src={q.image || q.imageUrl}
                          alt={q.imageCaption || `Hình thí nghiệm Câu ${idx + 1}`}
                          className="exam-diagram-img my-3 max-h-80 w-auto mx-auto rounded border border-slate-200 shadow-sm object-contain bg-white p-1"
                        />
                        {q.imageCaption && (
                          <p className="text-xs italic text-slate-600 mt-1 font-serif">
                            {q.imageCaption}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Responsive 4-Statement Layout for a), b), c), d) with >=44px [Đúng] and [Sai] buttons */}
                    <div className="sm:ml-12 overflow-hidden rounded-xl border border-slate-200 divide-y divide-slate-200">
                      <div className="hidden sm:grid sm:grid-cols-12 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase py-2 px-3">
                        <div className="col-span-1 text-center">Ý</div>
                        <div className="col-span-7">Nội dung mệnh đề</div>
                        <div className="col-span-4 text-center">
                          {isTeacherKeyEditMode
                            ? 'Thiết lập Đáp án chuẩn (Đúng / Sai)'
                            : 'Lựa chọn Đúng / Sai'}
                        </div>
                      </div>

                      {q.items.map((item) => {
                        const studentVal = part2Answers[q.id]?.[item.label];
                        const isSubCorrect = studentVal === item.isCorrect;
                        const activeTrueState = isTeacherKeyEditMode
                          ? item.isCorrect === true
                          : studentVal === true;
                        const activeFalseState = isTeacherKeyEditMode
                          ? item.isCorrect === false
                          : studentVal === false;

                        return (
                          <div
                            key={item.label}
                            className={`p-3 flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-2.5 text-xs sm:text-sm ${
                              isSubmitted
                                ? isSubCorrect
                                  ? 'bg-emerald-50/40'
                                  : 'bg-rose-50/40'
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <div className="flex items-start gap-2 sm:col-span-8 min-w-0">
                              <span className="font-bold text-indigo-900 shrink-0 sm:w-8 sm:text-center">
                                {item.label})
                              </span>
                              <div className="flex-1 min-w-0 max-w-full overflow-x-auto text-slate-800">
                                <MathChemView content={item.text} />
                                {isSubmitted && (
                                  <div className="mt-1">
                                    <span
                                      className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded ${
                                        isSubCorrect
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {isSubCorrect ? '✓ Chọn đúng' : '✗ Chọn sai'} (Bạn chọn:{' '}
                                      {studentVal === true
                                        ? 'Đúng'
                                        : studentVal === false
                                        ? 'Sai'
                                        : 'Chưa chọn'}{' '}
                                      • Đáp án chuẩn: {item.isCorrect ? 'Đúng' : 'Sai'})
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="sm:col-span-4 flex items-center justify-end sm:justify-center gap-2 pt-1 sm:pt-0">
                              <button
                                type="button"
                                disabled={isSubmitted}
                                onClick={() => {
                                  if (isTeacherKeyEditMode) {
                                    handleSetPart2ItemCorrectKey(q.id, item.label, true);
                                  } else {
                                    const currentQ = part2Answers[q.id] || {
                                      a: null,
                                      b: null,
                                      c: null,
                                      d: null,
                                    };
                                    setPart2Answers({
                                      ...part2Answers,
                                      [q.id]: { ...currentQ, [item.label]: true },
                                    });
                                  }
                                }}
                                className={`min-h-[44px] flex-1 sm:flex-initial min-w-[78px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                  activeTrueState
                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-300'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
                                }`}
                              >
                                {isTeacherKeyEditMode ? 'ĐA: Đúng' : '[Đúng]'}
                              </button>

                              <button
                                type="button"
                                disabled={isSubmitted}
                                onClick={() => {
                                  if (isTeacherKeyEditMode) {
                                    handleSetPart2ItemCorrectKey(q.id, item.label, false);
                                  } else {
                                    const currentQ = part2Answers[q.id] || {
                                      a: null,
                                      b: null,
                                      c: null,
                                      d: null,
                                    };
                                    setPart2Answers({
                                      ...part2Answers,
                                      [q.id]: { ...currentQ, [item.label]: false },
                                    });
                                  }
                                }}
                                className={`min-h-[44px] flex-1 sm:flex-initial min-w-[78px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                  activeFalseState
                                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs ring-2 ring-rose-300'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-rose-50'
                                }`}
                              >
                                {isTeacherKeyEditMode ? 'ĐA: Sai' : '[Sai]'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* =================================================================
              PHẦN III: CÂU TRẮC NGHIỆM YÊU CẦU TRẢ LỜI NGẮN (Ô NHẬP TỐI ĐA 4 KÝ TỰ)
              ================================================================= */}
          {activeExamState.part3.length > 0 && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-emerald-900 text-sm">
                    PHẦN III. Câu trắc nghiệm yêu cầu trả lời ngắn (Từ câu 1 đến câu {activeExamState.part3.length})
                  </h3>
                  <p className="text-xs text-emerald-700">
                    Học sinh điền kết quả là số (số nguyên hoặc số thập phân, hỗ trợ dấu âm <code className="font-bold">-</code>, dấu phẩy <code className="font-bold">,</code> và dấu chấm <code className="font-bold">.</code>, tối đa 4 ký tự). Quy đổi <code className="font-bold">2,5</code> và <code className="font-bold">2.5</code> như nhau.
                  </p>
                </div>
                <span className="text-xs font-bold bg-white text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-200">
                  0,25 điểm / câu (Tổng {(activeExamState.part3.length * 0.25).toFixed(2).replace('.', ',')}đ)
                </span>
              </div>

              {activeExamState.part3.map((q, idx) => {
                const rawVal = part3Answers[q.id] || '';
                const isCorrect = isShortAnswerMatch(rawVal, q.correctAnswer);
                const charBoxes = [0, 1, 2, 3].map((i) => rawVal[i] || '');

                return (
                  <div
                    key={q.id}
                    id={`q-p3-${q.id}`}
                    className={`bg-white rounded-xl border p-4 sm:p-5 space-y-3 shadow-2xs overflow-hidden ${
                      isSubmitted
                        ? isCorrect
                          ? 'border-emerald-300 bg-emerald-50/20'
                          : rawVal
                          ? 'border-rose-300 bg-rose-50/20'
                          : 'border-amber-300'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs shrink-0 mt-0.5">
                        Câu {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0 max-w-full overflow-x-auto text-sm text-slate-900 font-medium leading-relaxed">
                        <MathChemView content={q.content} />
                      </div>
                    </div>

                    {(q.image || q.imageUrl) && (
                      <div className="exam-diagram-wrapper my-3 text-center pl-0 sm:pl-12 pr-0 sm:pr-2 max-w-full overflow-x-auto">
                        <img
                          src={q.image || q.imageUrl}
                          alt={q.imageCaption || `Hình thí nghiệm Câu ${idx + 1}`}
                          className="exam-diagram-img my-3 max-h-80 w-auto mx-auto rounded border border-slate-200 shadow-sm object-contain bg-white p-1"
                        />
                        {q.imageCaption && (
                          <p className="text-xs italic text-slate-600 mt-1 font-serif">
                            {q.imageCaption}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="sm:pl-12 flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-700">
                          Điền đáp số (tối đa 4 ký tự):
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          maxLength={4}
                          disabled={isSubmitted}
                          value={rawVal}
                          onChange={(e) => handlePart3InputChange(q.id, e.target.value)}
                          placeholder="VD: 2,5"
                          className="w-28 min-h-[44px] text-base font-mono font-bold text-center text-slate-900 border-2 border-emerald-400 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                        {q.unit && <span className="text-xs text-slate-500">({q.unit})</span>}
                      </div>

                      {/* 4-character Answer Sheet Box Visualization */}
                      <div className="flex items-center gap-1" title="4 ô ký tự trên phiếu trả lời trắc nghiệm">
                        <span className="text-[11px] text-slate-500 mr-1">Ô phiếu:</span>
                        {charBoxes.map((ch, boxIdx) => (
                          <span
                            key={boxIdx}
                            className={`w-7 h-8 rounded-md border font-mono font-bold text-xs flex items-center justify-center ${
                              ch
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                          >
                            {ch || '·'}
                          </span>
                        ))}
                      </div>

                      {isSubmitted && (
                        <div
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                            isCorrect
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isCorrect
                            ? '✓ Chính xác! (+0,25 điểm)'
                            : `✗ Sai • Đáp số đúng: ${q.correctAnswer} (chấp nhận cả ${q.correctAnswer.replace(',', '.')} và ${q.correctAnswer.replace('.', ',')})`}
                        </div>
                      )}
                    </div>

                    {isSubmitted && q.explanation && (
                      <div className="mt-3 sm:ml-12 p-3 bg-amber-50 rounded-lg border border-amber-200/80 text-xs max-w-full overflow-x-auto">
                        <span className="font-bold text-amber-900 block mb-1">
                          Hướng dẫn giải chi tiết:
                        </span>
                        <MathChemView content={q.explanation} className="text-slate-700" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* =================================================================
            QUESTION PALETTE SIDEBAR ON DESKTOP (>= 768px)
            ================================================================= */}
        <div className="hidden md:block md:col-span-4">
          <div className="sticky top-40 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                <span>BẢNG DANH SÁCH CÂU HỎI (QUESTION PALETTE)</span>
                <span className="text-indigo-600">
                  {answeredCount} / {totalQuestions} câu
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-sky-500 via-indigo-600 to-emerald-500 h-full transition-all duration-300"
                  style={{
                    width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                <span>Tổng thang điểm: <strong>10,0 điểm</strong></span>
                <span>4,5đ + 4,0đ + 1,5đ</span>
              </div>
            </div>

            {/* KHU VỰC 1: PHẦN I (1 - 18) */}
            {activeExamState.part1.length > 0 && (
              <div className="p-3 rounded-xl bg-sky-50/50 border border-sky-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-900 uppercase">
                    Phần I (1–{activeExamState.part1.length})
                  </span>
                  <span className="text-[11px] font-semibold text-sky-700">
                    {answeredP1Count}/{activeExamState.part1.length} câu • {(activeExamState.part1.length * 0.25).toFixed(2).replace('.', ',')}đ
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5 text-xs">
                  {activeExamState.part1.map((q, idx) => {
                    const ans = part1Answers[q.id];
                    const isRight = isSubmitted && ans === q.correctAnswer;
                    const isWrong = isSubmitted && ans !== q.correctAnswer;

                    return (
                      <a
                        key={q.id}
                        href={`#q-p1-${q.id}`}
                        className={`h-8 rounded-lg flex items-center justify-center font-bold transition-all border text-[11px] ${
                          isSubmitted
                            ? isRight
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : isWrong
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-amber-100 text-amber-900 border-amber-300'
                            : ans
                            ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-100'
                        }`}
                      >
                        {idx + 1}
                        {ans && <span className="ml-0.5 text-[10px]">.{ans}</span>}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* KHU VỰC 2: PHẦN II (1 - 4) */}
            {activeExamState.part2.length > 0 && (
              <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 uppercase">
                    Phần II (1–{activeExamState.part2.length})
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-700">
                    {answeredP2Count}/{activeExamState.part2.length} câu • {(activeExamState.part2.length * 1.0).toFixed(1).replace('.', ',')}đ
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {activeExamState.part2.map((q, idx) => {
                    const qAns = part2Answers[q.id] || { a: null, b: null, c: null, d: null };
                    const subCount = Object.values(qAns).filter(
                      (v) => v !== null && v !== undefined
                    ).length;

                    return (
                      <a
                        key={q.id}
                        href={`#q-p2-${q.id}`}
                        className={`p-2 rounded-lg flex items-center justify-between font-bold transition-all border ${
                          subCount === 4
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : subCount > 0
                            ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-100'
                        }`}
                      >
                        <span>Câu {idx + 1}</span>
                        <span className="text-[10px] font-mono opacity-90">
                          {subCount}/4 ý
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* KHU VỰC 3: PHẦN III (1 - 6) */}
            {activeExamState.part3.length > 0 && (
              <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 uppercase">
                    Phần III (1–{activeExamState.part3.length})
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {answeredP3Count}/{activeExamState.part3.length} câu • {(activeExamState.part3.length * 0.25).toFixed(2).replace('.', ',')}đ
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {activeExamState.part3.map((q, idx) => {
                    const val = part3Answers[q.id]?.trim() || '';
                    const hasVal = Boolean(val);
                    const isRight = isSubmitted && isShortAnswerMatch(val, q.correctAnswer);

                    return (
                      <a
                        key={q.id}
                        href={`#q-p3-${q.id}`}
                        className={`h-8 px-1.5 rounded-lg flex items-center justify-between font-bold transition-all border text-[11px] ${
                          isSubmitted
                            ? isRight
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-rose-600 text-white border-rose-600'
                            : hasVal
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-100'
                        }`}
                      >
                        <span>C{idx + 1}</span>
                        <span className="font-mono text-[10px] truncate max-w-[36px]">
                          {hasVal ? val : '—'}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {!isSubmitted && (
              <button
                type="button"
                onClick={handleTriggerSubmitClick}
                disabled={isSubmittingToFirebase}
                className="w-full min-h-[44px] py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-200 hover:from-emerald-700 hover:to-teal-700 transition-all cursor-pointer"
              >
                {isSubmittingToFirebase ? 'Đang gửi bài lên Firebase...' : 'Nộp Bài & Xem Điểm Ngay'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================
          MOBILE STICKY BOTTOM ACTION BAR & COLLAPSIBLE QUESTION PALETTE DRAWER (< 768px)
          ================================================================= */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2.5 shadow-xl flex items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={() => setIsMobilePaletteOpen((prev) => !prev)}
          className="min-h-[44px] flex-1 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-900 font-bold text-xs flex items-center justify-between gap-2 cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <LayoutGrid className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Bảng câu hỏi</span>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-mono text-[11px]">
            {answeredCount}/{totalQuestions}
          </span>
          {isMobilePaletteOpen ? (
            <ChevronDown className="w-4 h-4 text-indigo-600 shrink-0" />
          ) : (
            <ChevronUp className="w-4 h-4 text-indigo-600 shrink-0" />
          )}
        </button>

        {!isSubmitted ? (
          <button
            type="button"
            onClick={handleTriggerSubmitClick}
            disabled={isSubmittingToFirebase}
            className="min-h-[44px] px-4 py-2 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-200 cursor-pointer shrink-0"
          >
            {isSubmittingToFirebase ? 'Đang gửi...' : 'Nộp Bài'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onExitTest}
            className="min-h-[44px] px-4 py-2 rounded-xl font-bold text-xs bg-slate-200 text-slate-800 cursor-pointer shrink-0"
          >
            Quay Lại
          </button>
        )}
      </div>

      {/* Collapsible Mobile Question Palette Bottom Drawer Modal (< 768px) */}
      {isMobilePaletteOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setIsMobilePaletteOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl border-t border-slate-200 shadow-2xl p-4 pb-20 max-h-[80dvh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase">
                  BẢNG DANH SÁCH CÂU HỎI ({answeredCount}/{totalQuestions} CÂU)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Chạm vào số thứ tự câu để di chuyển nhanh đến câu hỏi đó
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobilePaletteOpen(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeExamState.part1.length > 0 && (
              <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-sky-900">
                  <span>Phần I (1–{activeExamState.part1.length})</span>
                  <span>
                    {answeredP1Count}/{activeExamState.part1.length} câu
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5 text-xs">
                  {activeExamState.part1.map((q, idx) => {
                    const ans = part1Answers[q.id];
                    const isRight = isSubmitted && ans === q.correctAnswer;
                    const isWrong = isSubmitted && ans !== q.correctAnswer;

                    return (
                      <a
                        key={q.id}
                        href={`#q-p1-${q.id}`}
                        onClick={() => setIsMobilePaletteOpen(false)}
                        className={`min-h-[38px] rounded-lg flex items-center justify-center font-bold border text-[11px] ${
                          isSubmitted
                            ? isRight
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : isWrong
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-amber-100 text-amber-900 border-amber-300'
                            : ans
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {idx + 1}
                        {ans && <span className="ml-0.5 text-[10px]">.{ans}</span>}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {activeExamState.part2.length > 0 && (
              <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                  <span>Phần II (1–{activeExamState.part2.length})</span>
                  <span>
                    {answeredP2Count}/{activeExamState.part2.length} câu
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {activeExamState.part2.map((q, idx) => {
                    const qAns = part2Answers[q.id] || { a: null, b: null, c: null, d: null };
                    const subCount = Object.values(qAns).filter(
                      (v) => v !== null && v !== undefined
                    ).length;

                    return (
                      <a
                        key={q.id}
                        href={`#q-p2-${q.id}`}
                        onClick={() => setIsMobilePaletteOpen(false)}
                        className={`min-h-[40px] p-2 rounded-lg flex items-center justify-between font-bold border ${
                          subCount === 4
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : subCount > 0
                            ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>Câu {idx + 1}</span>
                        <span className="text-[10px] font-mono">{subCount}/4 ý</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {activeExamState.part3.length > 0 && (
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                  <span>Phần III (1–{activeExamState.part3.length})</span>
                  <span>
                    {answeredP3Count}/{activeExamState.part3.length} câu
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {activeExamState.part3.map((q, idx) => {
                    const val = part3Answers[q.id]?.trim() || '';
                    const hasVal = Boolean(val);
                    const isRight = isSubmitted && isShortAnswerMatch(val, q.correctAnswer);

                    return (
                      <a
                        key={q.id}
                        href={`#q-p3-${q.id}`}
                        onClick={() => setIsMobilePaletteOpen(false)}
                        className={`min-h-[38px] px-2 rounded-lg flex items-center justify-between font-bold border text-[11px] ${
                          isSubmitted
                            ? isRight
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-rose-600 text-white border-rose-600'
                            : hasVal
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>C{idx + 1}</span>
                        <span className="font-mono text-[10px] truncate max-w-[36px]">
                          {hasVal ? val : '—'}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
