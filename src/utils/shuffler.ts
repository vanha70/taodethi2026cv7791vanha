import { ExamData, Part1Question, Part2Question, Part3Question, ShuffledExamCode } from '../types/exam';
import { stripLeakedAnswerMarkers } from './chemMathNormalizer';

// Fisher-Yates array shuffle with seed or pseudo-random
function shuffleArray<T>(array: T[], seedOffset: number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const pseudoRandom = (Math.sin(seedOffset * 997 + i * 1337) + 1) / 2;
    const j = Math.floor(pseudoRandom * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Checks if an option is an "All of A, B, C are correct/incorrect" style choice
 * that must stay fixed at position D when shuffling Part I options.
 */
export function isFixedAtDOptionText(text: string): boolean {
  const clean = text.trim();
  return /cả\s*a\s*,\s*b\s*(?:,\s*c|\s*và\s*c)\s*đều|tất\s*cả\s*(?:các\s*(?:phương\s*án|đáp\s*án|ý)\s*)?đều\s*(?:đúng|sai)|cả\s*3\s*(?:phương\s*án|đáp\s*án|ý)\s*(?:trên\s*)?đều/i.test(
    clean
  );
}

/**
 * Checks if an option references specific pair letters like "Cả A và B đều đúng"
 * or visual diagram labels "Hình A", "Hình B", "Hình C", "Hình D",
 * in which case all 4 option positions A, B, C, D should remain in place so letter references stay valid.
 */
export function hasSpecificPairReference(text: string): boolean {
  const clean = text.trim();
  return /cả\s*[a-c]\s*và\s*[a-c]\s*đều|^hình\s*[a-d]\b/i.test(clean);
}

/**
 * Permutes the 4 options (A, B, C, D) of a Part I question while respecting fixed-D rules:
 * - If an option is "Cả A, B, C đều đúng" / "Tất cả đều đúng", keep it fixed at D and only permute A, B, C.
 * - If an option references specific pairs like "Cả A và B đều đúng", keep A, B, C, D order intact.
 * - Always updates `correctAnswer` to match the new letter where the correct option landed.
 */
export function permutePart1QuestionOptions(
  q: Part1Question,
  customShuffleFn?: <T>(arr: T[]) => T[]
): {
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  fixedDApplied: boolean;
} {
  const shuffler =
    customShuffleFn ||
    (<T,>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    });

  const letters: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  const entries = letters.map((letter) => ({
    origLetter: letter,
    text: stripLeakedAnswerMarkers(q.options[letter]),
    isCorrect: q.correctAnswer === letter,
  }));

  // Case 1: Specific pair reference like "Cả A và B đều đúng" -> keep all 4 positions fixed
  if (entries.some((e) => hasSpecificPairReference(e.text))) {
    return {
      options: {
        A: entries[0].text,
        B: entries[1].text,
        C: entries[2].text,
        D: entries[3].text,
      },
      correctAnswer: q.correctAnswer,
      fixedDApplied: true,
    };
  }

  // Case 2: Option like "Cả A, B, C đều đúng" or "Tất cả đều đúng" -> keep that option fixed at D, shuffle the other 3 in A, B, C
  const fixedDIdx = entries.findIndex((e) => isFixedAtDOptionText(e.text));
  if (fixedDIdx !== -1) {
    const fixedDEntry = entries[fixedDIdx];
    const otherThree = entries.filter((_, idx) => idx !== fixedDIdx);
    const shuffledThree = shuffler(otherThree);
    const finalEntries = [...shuffledThree, fixedDEntry]; // fixedDEntry is strictly at index 3 ('D')

    const newCorrectIdx = finalEntries.findIndex((e) => e.isCorrect);
    return {
      options: {
        A: finalEntries[0].text,
        B: finalEntries[1].text,
        C: finalEntries[2].text,
        D: finalEntries[3].text,
      },
      correctAnswer: letters[newCorrectIdx >= 0 ? newCorrectIdx : 0],
      fixedDApplied: true,
    };
  }

  // Case 3: Standard shuffle of all 4 options A, B, C, D
  const permuted = shuffler(entries);
  const newCorrectIdx = permuted.findIndex((e) => e.isCorrect);

  return {
    options: {
      A: permuted[0].text,
      B: permuted[1].text,
      C: permuted[2].text,
      D: permuted[3].text,
    },
    correctAnswer: letters[newCorrectIdx >= 0 ? newCorrectIdx : 0],
    fixedDApplied: false,
  };
}

export function generateShuffledExams(
  originalExam: ExamData,
  count: number = 4,
  baseCode: number = 101
): ShuffledExamCode[] {
  const codes: ShuffledExamCode[] = [];

  for (let c = 0; c < count; c++) {
    const currentCode = (baseCode + c).toString();
    const seed = (baseCode + c) * 31;

    // 1. Shuffle Part 1 questions (kept strictly within Part I, re-indexed 1..18)
    const shuffledPart1Questions = shuffleArray(originalExam.part1, seed + 1);
    const newPart1: Part1Question[] = [];
    const answerKeyPart1: Record<number, 'A' | 'B' | 'C' | 'D'> = {};

    shuffledPart1Questions.forEach((origQ, idx) => {
      const newQuestionId = idx + 1;
      const permuted = permutePart1QuestionOptions(origQ, (arr) =>
        shuffleArray(arr, seed + idx * 7 + 3)
      );

      newPart1.push({
        ...origQ,
        id: newQuestionId,
        content: stripLeakedAnswerMarkers(origQ.content),
        options: permuted.options,
        correctAnswer: permuted.correctAnswer,
      });

      answerKeyPart1[newQuestionId] = permuted.correctAnswer;
    });

    // 2. Shuffle Part 2 questions & items (a, b, c, d), re-indexed 1..4
    const shuffledPart2Questions = shuffleArray(originalExam.part2, seed + 2);
    const newPart2: Part2Question[] = [];
    const answerKeyPart2: Record<number, Record<string, boolean>> = {};

    shuffledPart2Questions.forEach((origQ, idx) => {
      const newQuestionId = idx + 1;
      const shuffledItems = shuffleArray(origQ.items, seed + idx * 11 + 5);
      const labels: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];

      const reindexedItems = shuffledItems.map((item, itemIdx) => ({
        ...item,
        label: labels[itemIdx],
        text: stripLeakedAnswerMarkers(item.text),
      }));

      newPart2.push({
        ...origQ,
        id: newQuestionId,
        content: stripLeakedAnswerMarkers(origQ.content),
        items: reindexedItems,
      });

      answerKeyPart2[newQuestionId] = {};
      reindexedItems.forEach((it) => {
        answerKeyPart2[newQuestionId][it.label] = it.isCorrect;
      });
    });

    // 3. Shuffle Part 3 questions, re-indexed 1..6
    const shuffledPart3Questions = shuffleArray(originalExam.part3, seed + 3);
    const newPart3: Part3Question[] = [];
    const answerKeyPart3: Record<number, string> = {};

    shuffledPart3Questions.forEach((origQ, idx) => {
      const newQuestionId = idx + 1;
      newPart3.push({
        ...origQ,
        id: newQuestionId,
        content: stripLeakedAnswerMarkers(origQ.content),
      });
      answerKeyPart3[newQuestionId] = origQ.correctAnswer;
    });

    const newEssay = [...originalExam.essay];

    codes.push({
      code: currentCode,
      part1: newPart1,
      part2: newPart2,
      part3: newPart3,
      essay: newEssay,
      answerKeyPart1,
      answerKeyPart2,
      answerKeyPart3,
    });
  }

  return codes;
}
