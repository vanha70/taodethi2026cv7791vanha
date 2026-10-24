import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  Plus,
  Trash2,
  Download,
  Copy,
  Sparkles,
  Move,
  Layers,
  ArrowRight,
  Maximize2,
  Minimize2,
  Palette,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  RotateCcw,
  Zap,
  Edit3,
  BookOpen,
  HelpCircle,
  FileText,
  CornerDownRight,
  Grid,
} from 'lucide-react';

export interface ReactionBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveToQuestion: (imageDataUrl: string, caption: string) => void;
  initialCaption?: string;
  questionNumber?: number;
}

export interface SchemeNode {
  id: string;
  formula: string;
  label?: string; // Optional subtitle / name e.g. "ancol etylic"
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SchemeArrow {
  id: string;
  fromId: string;
  toId: string;
  reagent?: string; // Text above arrow: e.g. "+ O₂", "+ Cl₂", "+ NaOH"
  condition?: string; // Text below arrow: e.g. "t°", "xt, 1500°C", "H₂SO₄ đ, 170°C"
  stepNumber?: string; // Optional step number badge: "1", "2", "(1)", "①"
  isReversible?: boolean; // Reversible equilibrium arrow
}

export interface SchemeTemplate {
  id: string;
  title: string;
  grade: '10' | '11' | '12' | 'Chung';
  description: string;
  caption: string;
  nodes: SchemeNode[];
  arrows: SchemeArrow[];
}

export type ThemeStyle = 'monochrome' | 'emerald' | 'blue' | 'indigo' | 'slate';
export type NodeBoxStyle = 'badge' | 'box' | 'plain';

// Helper: Tokenize chemical formula for subscript/superscript rendering
export interface FormulaToken {
  text: string;
  isSub?: boolean;
  isSup?: boolean;
}

export function parseChemicalFormula(formula: string): FormulaToken[] {
  if (!formula) return [];
  const str = formula.trim();
  const tokens: FormulaToken[] = [];
  let i = 0;
  let currentNormal = '';

  while (i < str.length) {
    const ch = str[i];

    // Explicit superscript marker '^'
    if (ch === '^') {
      if (currentNormal) {
        tokens.push({ text: currentNormal });
        currentNormal = '';
      }
      i++;
      let supText = '';
      if (str[i] === '{') {
        i++;
        while (i < str.length && str[i] !== '}') {
          supText += str[i];
          i++;
        }
        if (str[i] === '}') i++;
      } else {
        while (i < str.length && /[0-9\+\-a-zA-Z°]/.test(str[i])) {
          supText += str[i];
          i++;
        }
      }
      tokens.push({ text: supText, isSup: true });
      continue;
    }

    // Subscript: digits or 'n' or 'm' immediately after a chemical letter or ')' or ']'
    const prevChar = i > 0 ? str[i - 1] : '';
    const canBeSubscript = /[A-Za-z\)\]]/.test(prevChar);

    if (canBeSubscript && /[0-9]/.test(ch)) {
      if (currentNormal) {
        tokens.push({ text: currentNormal });
        currentNormal = '';
      }
      let subText = '';
      while (i < str.length && /[0-9]/.test(str[i])) {
        subText += str[i];
        i++;
      }
      tokens.push({ text: subText, isSub: true });
      continue;
    }

    // 'n' or 'm' as polymer index e.g. (C6H10O5)n
    if (canBeSubscript && (ch === 'n' || ch === 'm') && (i + 1 === str.length || /[^a-zA-Z]/.test(str[i + 1]))) {
      if (currentNormal) {
        tokens.push({ text: currentNormal });
        currentNormal = '';
      }
      tokens.push({ text: ch, isSub: true });
      i++;
      continue;
    }

    // Ion charge e.g. 2+, 3+, +, -
    if (canBeSubscript && (ch === '+' || ch === '-') && (i + 1 === str.length || /\s/.test(str[i + 1]))) {
      if (currentNormal) {
        tokens.push({ text: currentNormal });
        currentNormal = '';
      }
      tokens.push({ text: ch, isSup: true });
      i++;
      continue;
    }

    currentNormal += ch;
    i++;
  }

  if (currentNormal) {
    tokens.push({ text: currentNormal });
  }

  return tokens;
}

// Calculate standard node size based on formula text length
export function calculateNodeDimensions(formula: string, label?: string): { width: number; height: number } {
  const cleanLen = (formula || '').length;
  const labelLen = (label || '').length;
  const maxLen = Math.max(cleanLen, labelLen * 0.75);
  const width = Math.max(86, Math.round(maxLen * 10 + 28));
  const height = label ? 46 : 38;
  return { width, height };
}

// Standard GDPT 2018 Preset Templates
const PRESET_TEMPLATES: SchemeTemplate[] = [
  {
    id: 'acetic_acid_chain',
    title: 'Chuỗi điều chế Axit Axetic từ Metan',
    grade: '12',
    description: 'CH₄ → C₂H₂ → C₂H₄ → C₂H₅OH → CH₃CHO → CH₃COOH',
    caption: 'Sơ đồ chuyển hóa điều chế axit axetic từ khí thiên nhiên metan',
    nodes: [
      { id: 'n1', formula: 'CH4', label: 'Metan', x: 70, y: 120, width: 90, height: 46 },
      { id: 'n2', formula: 'C2H2', label: 'Axetilen', x: 230, y: 120, width: 90, height: 46 },
      { id: 'n3', formula: 'C2H4', label: 'Etilen', x: 390, y: 120, width: 90, height: 46 },
      { id: 'n4', formula: 'C2H5OH', label: 'Etanol', x: 550, y: 120, width: 96, height: 46 },
      { id: 'n5', formula: 'CH3CHO', label: 'Axetandehit', x: 710, y: 120, width: 104, height: 46 },
      { id: 'n6', formula: 'CH3COOH', label: 'Axit axetic', x: 880, y: 120, width: 110, height: 46 },
    ],
    arrows: [
      { id: 'a1', fromId: 'n1', toId: 'n2', condition: '1500°C, lln', stepNumber: '(1)' },
      { id: 'a2', fromId: 'n2', toId: 'n3', reagent: '+ H₂', condition: 'Pd/PbCO₃, t°', stepNumber: '(2)' },
      { id: 'a3', fromId: 'n3', toId: 'n4', reagent: '+ H₂O', condition: 'H⁺, t°', stepNumber: '(3)' },
      { id: 'a4', fromId: 'n4', toId: 'n5', reagent: '+ CuO', condition: 't°', stepNumber: '(4)' },
      { id: 'a5', fromId: 'n5', toId: 'n6', reagent: '+ O₂', condition: 'xt, t°', stepNumber: '(5)' },
    ],
  },
  {
    id: 'iron_series',
    title: 'Chuỗi biến hóa Hợp chất của Sắt (Fe)',
    grade: '12',
    description: 'Fe → FeCl₃ → Fe(OH)₃ → Fe₂O₃ → Fe',
    caption: 'Sơ đồ chuyển hóa các hợp chất quan trọng của sắt',
    nodes: [
      { id: 'n1', formula: 'Fe', label: 'Sắt', x: 80, y: 120, width: 86, height: 46 },
      { id: 'n2', formula: 'FeCl3', label: 'Sắt(III) clorua', x: 260, y: 120, width: 106, height: 46 },
      { id: 'n3', formula: 'Fe(OH)3', label: 'Sắt(III) hiđroxit', x: 460, y: 120, width: 114, height: 46 },
      { id: 'n4', formula: 'Fe2O3', label: 'Sắt(III) oxit', x: 660, y: 120, width: 106, height: 46 },
      { id: 'n5', formula: 'Fe', label: 'Sắt nguyên chất', x: 840, y: 120, width: 90, height: 46 },
    ],
    arrows: [
      { id: 'a1', fromId: 'n1', toId: 'n2', reagent: '+ Cl₂', condition: 't°', stepNumber: '(1)' },
      { id: 'a2', fromId: 'n2', toId: 'n3', reagent: '+ NaOH', condition: 'dd', stepNumber: '(2)' },
      { id: 'a3', fromId: 'n3', toId: 'n4', condition: 't° nung', stepNumber: '(3)' },
      { id: 'a4', fromId: 'n4', toId: 'n5', reagent: '+ CO', condition: 't° cao', stepNumber: '(4)' },
    ],
  },
  {
    id: 'unknown_xyzt',
    title: 'Biện luận chất ẩn X, Y, Z, T trong đề thi',
    grade: '12',
    description: 'X → Y → Z → T (Bài toán tìm chất hữu cơ)',
    caption: 'Sơ đồ phản ứng xác định các chất hữu cơ chưa biết X, Y, Z, T',
    nodes: [
      { id: 'n1', formula: 'X', label: 'C₄H₆O₄', x: 90, y: 120, width: 90, height: 46 },
      { id: 'n2', formula: 'Y', label: 'Muối natri', x: 280, y: 120, width: 90, height: 46 },
      { id: 'n3', formula: 'Z', label: 'Axit hữu cơ', x: 470, y: 120, width: 90, height: 46 },
      { id: 'n4', formula: 'T', label: 'Este đa chức', x: 670, y: 120, width: 90, height: 46 },
    ],
    arrows: [
      { id: 'a1', fromId: 'n1', toId: 'n2', reagent: '+ 2NaOH', condition: 't°', stepNumber: '(1)' },
      { id: 'a2', fromId: 'n2', toId: 'n3', reagent: '+ H₂SO₄', condition: 'loãng', stepNumber: '(2)' },
      { id: 'a3', fromId: 'n3', toId: 'n4', reagent: '+ CH₃OH', condition: 'H₂SO₄ đ, t°', stepNumber: '(3)' },
    ],
  },
  {
    id: 'buna_rubber',
    title: 'Sản xuất Cao su Buna từ Tinh bột',
    grade: '12',
    description: '(C₆H₁₀O₅)ₙ → C₆H₁₂O₆ → C₂H₅OH → C₄H₆ → Cao su Buna',
    caption: 'Sơ đồ chuyển hóa tổng hợp cao su Buna từ tinh bột',
    nodes: [
      { id: 'n1', formula: '(C6H10O5)n', label: 'Tinh bột', x: 80, y: 120, width: 110, height: 46 },
      { id: 'n2', formula: 'C6H12O6', label: 'Glucozơ', x: 270, y: 120, width: 104, height: 46 },
      { id: 'n3', formula: 'C2H5OH', label: 'Etanol', x: 460, y: 120, width: 96, height: 46 },
      { id: 'n4', formula: 'C4H6', label: 'Buta-1,3-đien', x: 640, y: 120, width: 104, height: 46 },
      { id: 'n5', formula: 'Cao su Buna', label: 'Polibutađien', x: 830, y: 120, width: 110, height: 46 },
    ],
    arrows: [
      { id: 'a1', fromId: 'n1', toId: 'n2', reagent: '+ H₂O', condition: 'H⁺, t°', stepNumber: '1' },
      { id: 'a2', fromId: 'n2', toId: 'n3', condition: 'men rượu, 30-35°C', stepNumber: '2' },
      { id: 'a3', fromId: 'n3', toId: 'n4', condition: 'ZnO, MgO, 450°C', stepNumber: '3' },
      { id: 'a4', fromId: 'n4', toId: 'n5', reagent: 'Na', condition: 't°, p', stepNumber: '4' },
    ],
  },
  {
    id: 'sulfur_acid_contact',
    title: 'Sản xuất Axit Sunfuric theo phương pháp tiếp xúc',
    grade: '10',
    description: 'FeS₂ → SO₂ → SO₃ → H₂SO₄',
    caption: 'Sơ đồ các giai đoạn sản xuất axit sunfuric trong công nghiệp',
    nodes: [
      { id: 'n1', formula: 'FeS2', label: 'Quặng pirit sắt', x: 90, y: 120, width: 106, height: 46 },
      { id: 'n2', formula: 'SO2', label: 'Lưu huỳnh đioxit', x: 290, y: 120, width: 106, height: 46 },
      { id: 'n3', formula: 'SO3', label: 'Lưu huỳnh trioxit', x: 490, y: 120, width: 106, height: 46 },
      { id: 'n4', formula: 'H2SO4', label: 'Axit sunfuric', x: 680, y: 120, width: 100, height: 46 },
    ],
    arrows: [
      { id: 'a1', fromId: 'n1', toId: 'n2', reagent: '+ O₂', condition: 't° nung', stepNumber: '(1)' },
      { id: 'a2', fromId: 'n2', toId: 'n3', reagent: '+ O₂', condition: 'V₂O₅, 450°C', stepNumber: '(2)' },
      { id: 'a3', fromId: 'n3', toId: 'n4', reagent: '+ H₂O', condition: 'H₂SO₄ đặc hấp thụ', stepNumber: '(3)' },
    ],
  },
  {
    id: 'nitrogen_nitric_acid',
    title: 'Chuỗi chuyển hóa Nitơ và Axit Nitric',
    grade: '11',
    description: 'N₂ → NH₃ → NO → NO₂ → HNO₃',
    caption: 'Sơ đồ chuyển hóa từ nitơ đơn chất thành axit nitric',
    nodes: [
      { id: 'n1', formula: 'N2', label: 'Khí nitơ', x: 70, y: 120, width: 86, height: 46 },
      { id: 'n2', formula: 'NH3', label: 'Amoniac', x: 240, y: 120, width: 90, height: 46 },
      { id: 'n3', formula: 'NO', label: 'Nitơ monoxit', x: 420, y: 120, width: 90, height: 46 },
      { id: 'n4', formula: 'NO2', label: 'Nitơ đioxit', x: 600, y: 120, width: 90, height: 46 },
      { id: 'n5', formula: 'HNO3', label: 'Axit nitric', x: 780, y: 120, width: 96, height: 46 },
    ],
    arrows: [
      { id: 'a1', fromId: 'n1', toId: 'n2', reagent: '+ H₂', condition: 'Fe, 450°C, 200atm', stepNumber: '(1)' },
      { id: 'a2', fromId: 'n2', toId: 'n3', reagent: '+ O₂', condition: 'Pt, 850°C', stepNumber: '(2)' },
      { id: 'a3', fromId: 'n3', toId: 'n4', reagent: '+ O₂', condition: 'nhiệt độ thường', stepNumber: '(3)' },
      { id: 'a4', fromId: 'n4', toId: 'n5', reagent: '+ O₂ + H₂O', condition: '', stepNumber: '(4)' },
    ],
  },
  {
    id: 'branching_ester',
    title: 'Sơ đồ phân nhánh Thủy phân Este',
    grade: '12',
    description: 'E → X (muối) + Y (ancol) phân hai nhánh',
    caption: 'Sơ đồ phân nhánh phản ứng xà phòng hóa este đa chức',
    nodes: [
      { id: 'n1', formula: 'E', label: 'Este C₅H₈O₂', x: 100, y: 150, width: 96, height: 46 },
      { id: 'n2', formula: 'X', label: 'Muối Natri', x: 300, y: 80, width: 90, height: 46 },
      { id: 'n3', formula: 'Y', label: 'Ancol', x: 300, y: 220, width: 90, height: 46 },
      { id: 'n4', formula: 'Z', label: 'Axit tự do', x: 500, y: 80, width: 90, height: 46 },
      { id: 'n5', formula: 'T', label: 'Andehit', x: 500, y: 220, width: 90, height: 46 },
    ],
    arrows: [
      { id: 'a1', fromId: 'n1', toId: 'n2', reagent: '+ NaOH', condition: 't°', stepNumber: '(1)' },
      { id: 'a2', fromId: 'n1', toId: 'n3', reagent: '+ NaOH', condition: 't°', stepNumber: '(2)' },
      { id: 'a3', fromId: 'n2', toId: 'n4', reagent: '+ HCl', condition: 'loãng', stepNumber: '(3)' },
      { id: 'a4', fromId: 'n3', toId: 'n5', reagent: '+ CuO', condition: 't°', stepNumber: '(4)' },
    ],
  },
  {
    id: 'aluminum_amphoteric',
    title: 'Chuỗi hợp chất Lưỡng tính của Nhôm (Al)',
    grade: '12',
    description: 'Al → Al₂O₃ → Na[Al(OH)₄] → Al(OH)₃ → AlCl₃',
    caption: 'Sơ đồ chuyển hóa tính chất lưỡng tính của nhôm và hợp chất',
    nodes: [
      { id: 'n1', formula: 'Al', label: 'Nhôm', x: 80, y: 120, width: 86, height: 46 },
      { id: 'n2', formula: 'Al2O3', label: 'Nhôm oxit', x: 260, y: 120, width: 100, height: 46 },
      { id: 'n3', formula: 'Na[Al(OH)4]', label: 'Natri aluminat', x: 470, y: 120, width: 126, height: 46 },
      { id: 'n4', formula: 'Al(OH)3', label: 'Nhôm hiđroxit', x: 690, y: 120, width: 110, height: 46 },
      { id: 'n5', formula: 'AlCl3', label: 'Nhôm clorua', x: 880, y: 120, width: 100, height: 46 },
    ],
    arrows: [
      { id: 'a1', fromId: 'n1', toId: 'n2', reagent: '+ O₂', condition: 't°', stepNumber: '(1)' },
      { id: 'a2', fromId: 'n2', toId: 'n3', reagent: '+ NaOH dd', condition: '', stepNumber: '(2)' },
      { id: 'a3', fromId: 'n3', toId: 'n4', reagent: '+ CO₂ + H₂O', condition: 'sục dư', stepNumber: '(3)' },
      { id: 'a4', fromId: 'n4', toId: 'n5', reagent: '+ HCl dd', condition: '', stepNumber: '(4)' },
    ],
  },
];

// Palette of Quick Compounds for High School Chemistry
interface PaletteCategory {
  name: string;
  items: { formula: string; label?: string }[];
}

const PALETTE_CATEGORIES: PaletteCategory[] = [
  {
    name: 'Chất ẩn đề thi',
    items: [
      { formula: 'X', label: 'Chất ẩn' },
      { formula: 'Y', label: 'Chất ẩn' },
      { formula: 'Z', label: 'Chất ẩn' },
      { formula: 'T', label: 'Chất ẩn' },
      { formula: 'E', label: 'Este E' },
      { formula: 'F', label: 'Hợp chất F' },
      { formula: 'X1', label: 'Muối X1' },
      { formula: 'X2', label: 'Khí X2' },
      { formula: 'Y1', label: 'Chất Y1' },
      { formula: 'Y2', label: 'Chất Y2' },
    ],
  },
  {
    name: 'Hydrocarbon',
    items: [
      { formula: 'CH4', label: 'Metan' },
      { formula: 'C2H6', label: 'Etan' },
      { formula: 'C2H4', label: 'Etilen' },
      { formula: 'C2H2', label: 'Axetilen' },
      { formula: 'C3H6', label: 'Propen' },
      { formula: 'C3H4', label: 'Propin' },
      { formula: 'C4H6', label: 'Butađien' },
      { formula: 'C6H6', label: 'Benzen' },
      { formula: 'C6H5CH3', label: 'Toluen' },
      { formula: 'C8H8', label: 'Stiren' },
    ],
  },
  {
    name: 'Hợp chất chứa Oxi',
    items: [
      { formula: 'CH3OH', label: 'Metanol' },
      { formula: 'C2H5OH', label: 'Etanol' },
      { formula: 'HCHO', label: 'Fomanđehit' },
      { formula: 'CH3CHO', label: 'Axetanđehit' },
      { formula: 'HCOOH', label: 'Axit fomic' },
      { formula: 'CH3COOH', label: 'Axit axetic' },
      { formula: 'HCOOCH3', label: 'Metyl fomat' },
      { formula: 'CH3COOC2H5', label: 'Etyl axetat' },
      { formula: 'C6H12O6', label: 'Glucozơ' },
      { formula: '(C6H10O5)n', label: 'Tinh bột / Xen' },
    ],
  },
  {
    name: 'Vô cơ - Kim loại',
    items: [
      { formula: 'Fe', label: 'Sắt' },
      { formula: 'FeCl2', label: 'Sắt(II) clorua' },
      { formula: 'FeCl3', label: 'Sắt(III) clorua' },
      { formula: 'Fe(OH)2', label: 'Sắt(II) hiđroxit' },
      { formula: 'Fe(OH)3', label: 'Sắt(III) hiđroxit' },
      { formula: 'Fe2O3', label: 'Sắt(III) oxit' },
      { formula: 'Fe3O4', label: 'Oxit sắt từ' },
      { formula: 'Al', label: 'Nhôm' },
      { formula: 'Al2O3', label: 'Nhôm oxit' },
      { formula: 'Al(OH)3', label: 'Nhôm hiđroxit' },
      { formula: 'Na[Al(OH)4]', label: 'Natri aluminat' },
      { formula: 'Cu', label: 'Đồng' },
      { formula: 'CuO', label: 'Đồng(II) oxit' },
      { formula: 'CuSO4', label: 'Đồng sunfat' },
    ],
  },
  {
    name: 'Vô cơ - Phi kim & Axit',
    items: [
      { formula: 'Cl2', label: 'Khí clo' },
      { formula: 'HCl', label: 'Axit clohiđric' },
      { formula: 'O2', label: 'Khí oxi' },
      { formula: 'SO2', label: 'Khí sunfurơ' },
      { formula: 'SO3', label: 'Lưu huỳnh trioxit' },
      { formula: 'H2SO4', label: 'Axit sunfuric' },
      { formula: 'N2', label: 'Khí nitơ' },
      { formula: 'NH3', label: 'Amoniac' },
      { formula: 'NO', label: 'Nitơ monoxit' },
      { formula: 'NO2', label: 'Nitơ đioxit' },
      { formula: 'HNO3', label: 'Axit nitric' },
      { formula: 'NaOH', label: 'Natri hiđroxit' },
      { formula: 'CO2', label: 'Cacbon đioxit' },
      { formula: 'CaCO3', label: 'Canxi cacbonat' },
    ],
  },
];

// Quick Reagent and Condition chips for teachers
const QUICK_REAGENTS = [
  '+ O₂',
  '+ Cl₂',
  '+ H₂',
  '+ H₂O',
  '+ NaOH',
  '+ HCl',
  '+ HNO₃',
  '+ H₂SO₄',
  '+ AgNO₃/NH₃',
  '+ Cu(OH)₂',
  '+ CuO',
  '+ Na',
  '+ CO',
  '+ Br₂',
];

const QUICK_CONDITIONS = [
  't°',
  'xt, t°',
  '1500°C, lln',
  'as (ánh sáng)',
  'đpdd (điện phân)',
  'H₂SO₄ đ, 170°C',
  'H₂SO₄ đ, 140°C',
  'men rượu, 30°C',
  'men giấm',
  'p, xt, t°',
  'Ni, t°',
  'Pd/PbCO₃, t°',
];

// Helper: Calculate intersection point of arrow line with rounded rectangle node
function getEdgeIntersection(
  source: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number }
): { x: number; y: number } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  if (dx === 0 && dy === 0) return { x: source.x, y: source.y };

  const hw = source.width / 2;
  const hh = source.height / 2;

  // Scale factor to hit edge of bounding box
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let scale = 1;
  if (absDx * hh > absDy * hw) {
    // Hits left or right edge
    scale = hw / absDx;
  } else {
    // Hits top or bottom edge
    scale = hh / absDy;
  }

  return {
    x: source.x + dx * scale,
    y: source.y + dy * scale,
  };
}

export const ReactionBuilderModal: React.FC<ReactionBuilderModalProps> = ({
  isOpen,
  onClose,
  onSaveToQuestion,
  initialCaption = '',
  questionNumber,
}) => {
  // Main states
  const [nodes, setNodes] = useState<SchemeNode[]>(PRESET_TEMPLATES[0].nodes);
  const [arrows, setArrows] = useState<SchemeArrow[]>(PRESET_TEMPLATES[0].arrows);
  const [caption, setCaption] = useState<string>(
    initialCaption ||
      (questionNumber
        ? `Hình ${questionNumber}. Sơ đồ chuyển hóa hóa học`
        : 'Sơ đồ chuyển hóa hóa học')
  );

  // Selection & drag states
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Styling states
  const [theme, setTheme] = useState<ThemeStyle>('monochrome'); // Default clean print monochrome
  const [boxStyle, setBoxStyle] = useState<NodeBoxStyle>('badge');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Undo / Redo history
  const [history, setHistory] = useState<{ nodes: SchemeNode[]; arrows: SchemeArrow[] }[]>([
    { nodes: PRESET_TEMPLATES[0].nodes, arrows: PRESET_TEMPLATES[0].arrows },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Active palette tab
  const [paletteTab, setPaletteTab] = useState<number>(0);
  const [customFormulaInput, setCustomFormulaInput] = useState<string>('');
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Connecting arrow creation mode
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);

  const canvasRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update caption if questionNumber changes
  useEffect(() => {
    if (initialCaption) {
      setCaption(initialCaption);
    } else if (questionNumber) {
      setCaption(`Hình ${questionNumber}. Sơ đồ chuyển hóa hóa học`);
    }
  }, [initialCaption, questionNumber]);

  // Push state to history
  const pushHistory = (newNodes: SchemeNode[], newArrows: SchemeArrow[]) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push({ nodes: newNodes, arrows: newArrows });
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setNodes(prev.nodes);
      setArrows(prev.arrows);
      setHistoryIndex(historyIndex - 1);
      setSelectedNodeId(null);
      setSelectedArrowId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setNodes(next.nodes);
      setArrows(next.arrows);
      setHistoryIndex(historyIndex + 1);
      setSelectedNodeId(null);
      setSelectedArrowId(null);
    }
  };

  // Theme color palettes
  const themeColors = useMemo(() => {
    switch (theme) {
      case 'emerald':
        return {
          nodeBg: '#ecfdf5',
          nodeBorder: '#10b981',
          nodeText: '#064e3b',
          labelText: '#047857',
          arrowStroke: '#059669',
          arrowTextTop: '#047857',
          arrowTextBottom: '#065f46',
          badgeBg: '#10b981',
          badgeText: '#ffffff',
        };
      case 'blue':
        return {
          nodeBg: '#eff6ff',
          nodeBorder: '#3b82f6',
          nodeText: '#1e3a8a',
          labelText: '#1d4ed8',
          arrowStroke: '#2563eb',
          arrowTextTop: '#1d4ed8',
          arrowTextBottom: '#1e40af',
          badgeBg: '#2563eb',
          badgeText: '#ffffff',
        };
      case 'indigo':
        return {
          nodeBg: '#eef2ff',
          nodeBorder: '#6366f1',
          nodeText: '#312e81',
          labelText: '#4338ca',
          arrowStroke: '#4f46e5',
          arrowTextTop: '#4338ca',
          arrowTextBottom: '#3730a3',
          badgeBg: '#4f46e5',
          badgeText: '#ffffff',
        };
      case 'slate':
        return {
          nodeBg: '#f8fafc',
          nodeBorder: '#64748b',
          nodeText: '#0f172a',
          labelText: '#475569',
          arrowStroke: '#334155',
          arrowTextTop: '#1e293b',
          arrowTextBottom: '#475569',
          badgeBg: '#334155',
          badgeText: '#ffffff',
        };
      case 'monochrome':
      default:
        return {
          nodeBg: '#ffffff',
          nodeBorder: '#0f172a',
          nodeText: '#0f172a',
          labelText: '#475569',
          arrowStroke: '#0f172a',
          arrowTextTop: '#0f172a',
          arrowTextBottom: '#334155',
          badgeBg: '#0f172a',
          badgeText: '#ffffff',
        };
    }
  }, [theme]);

  // Load a preset template
  const handleLoadTemplate = (tpl: SchemeTemplate) => {
    setNodes(tpl.nodes);
    setArrows(tpl.arrows);
    if (tpl.caption) setCaption(tpl.caption);
    setSelectedNodeId(null);
    setSelectedArrowId(null);
    pushHistory(tpl.nodes, tpl.arrows);
  };

  // Add a compound node
  const handleAddNode = (formula: string, label?: string) => {
    const dim = calculateNodeDimensions(formula, label);
    // Find rightmost node to place next to it, or center
    let newX = 100;
    let newY = 140;

    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      newX = lastNode.x + lastNode.width / 2 + dim.width / 2 + 70;
      newY = lastNode.y;
      // If exceeds right bound, wrap to next row
      if (newX > 850) {
        newX = 100;
        newY = lastNode.y + 110;
      }
    }

    const newNode: SchemeNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      formula: formula.trim(),
      label: label?.trim() || undefined,
      x: newX,
      y: newY,
      width: dim.width,
      height: dim.height,
    };

    const nextNodes = [...nodes, newNode];
    // Automatically connect with arrow if there was a previous node selected
    let nextArrows = [...arrows];
    if (selectedNodeId) {
      const prevNode = nodes.find((n) => n.id === selectedNodeId);
      if (prevNode) {
        const newArrow: SchemeArrow = {
          id: `arr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          fromId: prevNode.id,
          toId: newNode.id,
          stepNumber: `(${nextArrows.length + 1})`,
        };
        nextArrows.push(newArrow);
      }
    } else if (nodes.length > 0) {
      const prevNode = nodes[nodes.length - 1];
      const newArrow: SchemeArrow = {
        id: `arr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        fromId: prevNode.id,
        toId: newNode.id,
        stepNumber: `(${nextArrows.length + 1})`,
      };
      nextArrows.push(newArrow);
    }

    setNodes(nextNodes);
    setArrows(nextArrows);
    setSelectedNodeId(newNode.id);
    setSelectedArrowId(null);
    pushHistory(nextNodes, nextArrows);
  };

  // Update selected node formula or label
  const handleUpdateNode = (id: string, formula: string, label?: string) => {
    const dim = calculateNodeDimensions(formula, label);
    const updated = nodes.map((n) =>
      n.id === id ? { ...n, formula, label, width: dim.width, height: dim.height } : n
    );
    setNodes(updated);
    pushHistory(updated, arrows);
  };

  // Delete node and associated arrows
  const handleDeleteNode = (id: string) => {
    const nextNodes = nodes.filter((n) => n.id !== id);
    const nextArrows = arrows.filter((a) => a.fromId !== id && a.toId !== id);
    setNodes(nextNodes);
    setArrows(nextArrows);
    setSelectedNodeId(null);
    setSelectedArrowId(null);
    pushHistory(nextNodes, nextArrows);
  };

  // Update arrow properties
  const handleUpdateArrow = (
    id: string,
    updates: Partial<Pick<SchemeArrow, 'reagent' | 'condition' | 'stepNumber' | 'isReversible'>>
  ) => {
    const updated = arrows.map((a) => (a.id === id ? { ...a, ...updates } : a));
    setArrows(updated);
    pushHistory(nodes, updated);
  };

  // Delete arrow
  const handleDeleteArrow = (id: string) => {
    const nextArrows = arrows.filter((a) => a.id !== id);
    setArrows(nextArrows);
    setSelectedArrowId(null);
    pushHistory(nodes, nextArrows);
  };

  // Auto-align nodes linearly
  const handleAutoAlignLinear = () => {
    if (nodes.length === 0) return;
    const startX = 80;
    const y = 140;
    let currentX = startX;

    const updated = nodes.map((n) => {
      const nodeX = currentX + n.width / 2;
      currentX += n.width + 75;
      return { ...n, x: nodeX, y };
    });

    setNodes(updated);
    pushHistory(updated, arrows);
  };

  // Auto-align in 2 rows (snake wrap)
  const handleAutoAlignTwoRows = () => {
    if (nodes.length === 0) return;
    const half = Math.ceil(nodes.length / 2);
    const updated = nodes.map((n, i) => {
      if (i < half) {
        return { ...n, x: 80 + i * 170, y: 90 };
      } else {
        const col = i - half;
        return { ...n, x: 80 + col * 170, y: 220 };
      }
    });

    setNodes(updated);
    pushHistory(updated, arrows);
  };

  // Dragging node on canvas
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (connectingSourceId) {
      if (connectingSourceId !== nodeId) {
        // Create arrow from connectingSourceId to nodeId
        const newArrow: SchemeArrow = {
          id: `arr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          fromId: connectingSourceId,
          toId: nodeId,
          stepNumber: `(${arrows.length + 1})`,
        };
        const nextArrows = [...arrows, newArrow];
        setArrows(nextArrows);
        pushHistory(nodes, nextArrows);
      }
      setConnectingSourceId(null);
      return;
    }

    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !canvasRef.current) return;

    setSelectedNodeId(nodeId);
    setSelectedArrowId(null);
    setDraggingNodeId(nodeId);

    const svgRect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - svgRect.left) / zoomLevel;
    const mouseY = (e.clientY - svgRect.top) / zoomLevel;

    setDragOffset({
      x: mouseX - node.x,
      y: mouseY - node.y,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId || !canvasRef.current) return;

    const svgRect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - svgRect.left) / zoomLevel;
    const mouseY = (e.clientY - svgRect.top) / zoomLevel;

    let targetX = mouseX - dragOffset.x;
    let targetY = mouseY - dragOffset.y;

    // Optional snap to 10px grid
    if (showGrid) {
      targetX = Math.round(targetX / 10) * 10;
      targetY = Math.round(targetY / 10) * 10;
    }

    setNodes((prev) =>
      prev.map((n) => (n.id === draggingNodeId ? { ...n, x: Math.max(40, targetX), y: Math.max(30, targetY) } : n))
    );
  };

  const handleCanvasMouseUp = () => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
      pushHistory(nodes, arrows);
    }
  };

  // Generate Standalone SVG string
  const generateCleanSvgMarkup = (): { svgString: string; width: number; height: number } => {
    if (nodes.length === 0) {
      return {
        svgString: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" width="400" height="100"><text x="200" y="50" text-anchor="middle" fill="#64748b" font-family="sans-serif">Chưa có hợp chất trong sơ đồ</text></svg>`,
        width: 400,
        height: 100,
      };
    }

    // Compute bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((n) => {
      minX = Math.min(minX, n.x - n.width / 2);
      maxX = Math.max(maxX, n.x + n.width / 2);
      minY = Math.min(minY, n.y - n.height / 2);
      maxY = Math.max(maxY, n.y + n.height / 2);
    });

    // Also take arrow labels into account
    arrows.forEach((a) => {
      const fromNode = nodes.find((n) => n.id === a.fromId);
      const toNode = nodes.find((n) => n.id === a.toId);
      if (fromNode && toNode) {
        const midY = (fromNode.y + toNode.y) / 2;
        minY = Math.min(minY, midY - 30);
        maxY = Math.max(maxY, midY + 30);
      }
    });

    const pad = 36;
    const finalMinX = Math.floor(minX - pad);
    const finalMinY = Math.floor(minY - pad);
    const width = Math.ceil(maxX - minX + pad * 2);
    const height = Math.ceil(maxY - minY + pad * 2);

    // Marker defs
    const arrowMarkerId = 'rb-arrow-marker';
    const markerDef = `
      <defs>
        <marker id="${arrowMarkerId}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${themeColors.arrowStroke}" />
        </marker>
      </defs>
    `;

    // Render arrows
    const arrowsMarkup = arrows
      .map((arr) => {
        const fromNode = nodes.find((n) => n.id === arr.fromId);
        const toNode = nodes.find((n) => n.id === arr.toId);
        if (!fromNode || !toNode) return '';

        const startPt = getEdgeIntersection(fromNode, toNode);
        const endPt = getEdgeIntersection(toNode, fromNode);

        const midX = (startPt.x + endPt.x) / 2;
        const midY = (startPt.y + endPt.y) / 2;

        let labelMarkup = '';
        if (arr.reagent) {
          const reagentTokens = parseChemicalFormula(arr.reagent);
          const tspanString = reagentTokens
            .map((t) => {
              if (t.isSub) return `<tspan font-size="70%" dy="3">${t.text}</tspan><tspan dy="-3"></tspan>`;
              if (t.isSup) return `<tspan font-size="70%" dy="-3">${t.text}</tspan><tspan dy="3"></tspan>`;
              return t.text;
            })
            .join('');
          labelMarkup += `<text x="${midX}" y="${midY - 8}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="${themeColors.arrowTextTop}">${tspanString}</text>`;
        }

        if (arr.condition) {
          labelMarkup += `<text x="${midX}" y="${midY + 16}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-style="italic" fill="${themeColors.arrowTextBottom}">${arr.condition}</text>`;
        }

        if (arr.stepNumber) {
          // Circle or badge above arrow or at center
          const badgeX = midX;
          const badgeY = arr.reagent ? midY - 24 : midY - 14;
          labelMarkup += `
            <g>
              <circle cx="${badgeX}" cy="${badgeY}" r="7" fill="${themeColors.badgeBg}" />
              <text x="${badgeX}" y="${badgeY + 3.5}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9" font-weight="bold" fill="${themeColors.badgeText}">${arr.stepNumber.replace(/[\(\)]/g, '')}</text>
            </g>
          `;
        }

        return `
          <g class="reaction-arrow">
            <line x1="${startPt.x}" y1="${startPt.y}" x2="${endPt.x}" y2="${endPt.y}" stroke="${themeColors.arrowStroke}" stroke-width="1.8" stroke-linecap="round" marker-end="url(#${arrowMarkerId})" />
            ${labelMarkup}
          </g>
        `;
      })
      .join('\n');

    // Render nodes
    const nodesMarkup = nodes
      .map((node) => {
        const tokens = parseChemicalFormula(node.formula);
        const tspanString = tokens
          .map((t) => {
            if (t.isSub) return `<tspan font-size="72%" dy="3.5">${t.text}</tspan><tspan dy="-3.5"></tspan>`;
            if (t.isSup) return `<tspan font-size="72%" dy="-4">${t.text}</tspan><tspan dy="4"></tspan>`;
            return t.text;
          })
          .join('');

        const labelY = node.y + (node.label ? 12 : 0);
        const formulaY = node.y - (node.label ? 4 : 0);

        let boxElement = '';
        if (boxStyle === 'badge') {
          boxElement = `<rect x="${node.x - node.width / 2}" y="${node.y - node.height / 2}" width="${node.width}" height="${node.height}" rx="8" ry="8" fill="${themeColors.nodeBg}" stroke="${themeColors.nodeBorder}" stroke-width="1.5" />`;
        } else if (boxStyle === 'box') {
          boxElement = `<rect x="${node.x - node.width / 2}" y="${node.y - node.height / 2}" width="${node.width}" height="${node.height}" rx="2" ry="2" fill="${themeColors.nodeBg}" stroke="${themeColors.nodeBorder}" stroke-width="1.5" />`;
        } else {
          // Plain style: transparent background
          boxElement = `<rect x="${node.x - node.width / 2}" y="${node.y - node.height / 2}" width="${node.width}" height="${node.height}" fill="transparent" />`;
        }

        const labelMarkup = node.label
          ? `<text x="${node.x}" y="${labelY}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="500" fill="${themeColors.labelText}">${node.label}</text>`
          : '';

        return `
          <g class="reaction-node">
            ${boxElement}
            <text x="${node.x}" y="${formulaY}" text-anchor="middle" dominant-baseline="central" font-family="'Times New Roman', Times, serif" font-size="16" font-weight="bold" fill="${themeColors.nodeText}">${tspanString}</text>
            ${labelMarkup}
          </g>
        `;
      })
      .join('\n');

    const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${finalMinX} ${finalMinY} ${width} ${height}" width="${width}" height="${height}">
  <style>
    text { user-select: none; }
  </style>
  <rect x="${finalMinX}" y="${finalMinY}" width="${width}" height="${height}" fill="#ffffff" />
  ${markerDef}
  <g class="arrows-layer">
    ${arrowsMarkup}
  </g>
  <g class="nodes-layer">
    ${nodesMarkup}
  </g>
</svg>`.trim();

    return { svgString, width, height };
  };

  // Export to high-res PNG / SVG Data URL
  const convertSvgToPngDataUrl = async (svgString: string, width: number, height: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobUrl = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const scale = 2; // 2x Retina resolution for sharp printing & DOCX export
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          const pngUrl = canvas.toDataURL('image/png', 0.95);
          URL.revokeObjectURL(blobUrl);
          resolve(pngUrl);
        } else {
          URL.revokeObjectURL(blobUrl);
          resolve(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        resolve(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`);
      };

      img.src = blobUrl;
    });
  };

  // Action: Save to Question
  const handleSaveToQuestion = async () => {
    const { svgString, width, height } = generateCleanSvgMarkup();
    const pngDataUrl = await convertSvgToPngDataUrl(svgString, width, height);
    onSaveToQuestion(pngDataUrl, caption.trim() || 'Sơ đồ chuyển hóa hóa học');
    onClose();
  };

  // Action: Download SVG file
  const handleDownloadSvg = () => {
    const { svgString } = generateCleanSvgMarkup();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `so_do_chuyen_hoa_${Date.now()}.svg`;
    link.click();
  };

  // Action: Download PNG file
  const handleDownloadPng = async () => {
    const { svgString, width, height } = generateCleanSvgMarkup();
    const pngUrl = await convertSvgToPngDataUrl(svgString, width, height);
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `so_do_chuyen_hoa_${Date.now()}.png`;
    link.click();
  };

  // Action: Copy SVG code
  const handleCopySvg = () => {
    const { svgString } = generateCleanSvgMarkup();
    navigator.clipboard.writeText(svgString).then(() => {
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    });
  };

  if (!isOpen) return null;

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedArrow = arrows.find((a) => a.id === selectedArrowId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-7xl h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  ReactionBuilder: Trình biên tập Sơ đồ chuyển hóa hóa học
                </h2>
                <span className="text-[10px] font-semibold bg-emerald-400/20 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  GDPT 2018
                </span>
              </div>
              <p className="text-xs text-emerald-200/80">
                Kéo thả các công thức, tự động tạo chuỗi phản ứng & xuất vector SVG chuẩn đề thi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
              title="Hoàn tác (Undo)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
              title="Làm lại (Redo)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <div className="h-5 w-px bg-white/20 mx-1" />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Workspace Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 bg-slate-100">
          {/* Left Sidebar: Templates & Compound Palette */}
          <div className="w-full lg:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
            {/* Template Selector dropdown */}
            <div className="p-3 border-b border-slate-200 bg-slate-50">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mẫu chuỗi phản ứng GDPT (1-Click):</span>
              </label>
              <select
                onChange={(e) => {
                  const tpl = PRESET_TEMPLATES.find((t) => t.id === e.target.value);
                  if (tpl) handleLoadTemplate(tpl);
                }}
                defaultValue={PRESET_TEMPLATES[0].id}
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {PRESET_TEMPLATES.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    [{tpl.grade}] {tpl.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom formula add input */}
            <div className="p-3 border-b border-slate-200">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Nhập công thức tự do:
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={customFormulaInput}
                  onChange={(e) => setCustomFormulaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customFormulaInput.trim()) {
                      handleAddNode(customFormulaInput.trim());
                      setCustomFormulaInput('');
                    }
                  }}
                  placeholder="Ví dụ: K2Cr2O7, CH3NH2..."
                  className="flex-1 text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customFormulaInput.trim()) {
                      handleAddNode(customFormulaInput.trim());
                      setCustomFormulaInput('');
                    }
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Tự động định dạng chỉ số dưới (CH4 → CH₄)
              </p>
            </div>

            {/* Palette categories tabs */}
            <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50 shrink-0 text-xs">
              {PALETTE_CATEGORIES.map((cat, idx) => (
                <button
                  key={cat.name}
                  onClick={() => setPaletteTab(idx)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                    paletteTab === idx
                      ? 'border-emerald-600 text-emerald-800 bg-white font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Palette compounds list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              <div className="text-[11px] text-slate-500 font-medium mb-1">
                Nhấp chuột để thêm vào chuỗi phản ứng:
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PALETTE_CATEGORIES[paletteTab].items.map((item, idx) => {
                  const tokens = parseChemicalFormula(item.formula);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleAddNode(item.formula, item.label)}
                      className="p-2 rounded-lg border border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/60 text-left transition-all group flex flex-col justify-between shadow-2xs cursor-pointer"
                    >
                      <div className="text-sm font-bold text-slate-800 group-hover:text-emerald-800 font-serif">
                        {tokens.map((t, ti) => {
                          if (t.isSub) return <sub key={ti} className="text-[70%]">{t.text}</sub>;
                          if (t.isSup) return <sup key={ti} className="text-[70%]">{t.text}</sup>;
                          return <span key={ti}>{t.text}</span>;
                        })}
                      </div>
                      {item.label && (
                        <div className="text-[10px] text-slate-400 group-hover:text-emerald-600 truncate mt-0.5">
                          {item.label}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Alignment Actions */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-2">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Căn chỉnh tự động:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleAutoAlignLinear}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <span>Căn 1 hàng</span>
                </button>
                <button
                  onClick={handleAutoAlignTwoRows}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <CornerDownRight className="w-3.5 h-3.5 text-slate-500" />
                  <span>Căn 2 hàng</span>
                </button>
              </div>
            </div>
          </div>

          {/* Center: Interactive SVG Canvas */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            {/* Canvas Toolbar */}
            <div className="px-4 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Theme & Style options */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-semibold text-slate-600">Kiểu màu:</span>
                </div>
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'monochrome', label: 'In ấn (Đen trắng)' },
                      { id: 'emerald', label: 'Ngọc lục bảo' },
                      { id: 'blue', label: 'Xanh dương' },
                      { id: 'indigo', label: 'Chàm tím' },
                      { id: 'slate', label: 'Xám đậm' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        theme === t.id
                          ? 'bg-slate-800 text-white font-semibold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="h-4 w-px bg-slate-200 mx-1" />

                {/* Box Style */}
                <span className="font-semibold text-slate-600">Khung:</span>
                <select
                  value={boxStyle}
                  onChange={(e) => setBoxStyle(e.target.value as NodeBoxStyle)}
                  className="text-xs border border-slate-300 rounded px-2 py-0.5 bg-white text-slate-700"
                >
                  <option value="badge">Bo góc nhẹ (Khuyên dùng)</option>
                  <option value="box">Khung chữ nhật</option>
                  <option value="plain">Không viền (Chữ đơn)</option>
                </select>
              </div>

              {/* View options: Grid & Zoom */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={`p-1.5 rounded border text-xs flex items-center gap-1 cursor-pointer ${
                    showGrid ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-300 text-slate-600'
                  }`}
                  title="Bật/Tắt lưới chấm căn tọa độ"
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Lưới</span>
                </button>

                <div className="flex items-center border border-slate-300 rounded overflow-hidden">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.1))}
                    className="p-1.5 hover:bg-slate-100 text-slate-600 cursor-pointer"
                    title="Thu nhỏ"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 text-[11px] font-medium text-slate-700 select-none">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(1.6, z + 0.1))}
                    className="p-1.5 hover:bg-slate-100 text-slate-600 cursor-pointer"
                    title="Phóng to"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="p-1.5 hover:bg-slate-100 text-slate-600 border-l border-slate-200 cursor-pointer"
                    title="100%"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Connecting mode notification banner */}
            {connectingSourceId && (
              <div className="bg-amber-100 border-b border-amber-300 text-amber-900 px-4 py-2 text-xs flex items-center justify-between animate-in fade-in">
                <span>
                  Đang chọn nguồn mũi tên. <strong>Nhấp vào chất tiếp theo</strong> để tạo liên kết phản ứng!
                </span>
                <button
                  onClick={() => setConnectingSourceId(null)}
                  className="px-2 py-0.5 rounded bg-amber-200 hover:bg-amber-300 text-amber-950 text-xs font-semibold"
                >
                  Hủy tạo mũi tên
                </button>
              </div>
            )}

            {/* SVG Interactive Canvas */}
            <div
              ref={containerRef}
              className="flex-1 overflow-auto bg-slate-100 p-6 flex items-center justify-center relative cursor-default"
              onClick={() => {
                setSelectedNodeId(null);
                setSelectedArrowId(null);
                setConnectingSourceId(null);
              }}
            >
              <div
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.1s ease',
                }}
                className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 min-w-[850px] min-h-[380px] relative select-none"
              >
                <svg
                  ref={canvasRef}
                  width="100%"
                  height="100%"
                  viewBox="0 0 1000 450"
                  className="overflow-visible min-h-[380px]"
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                >
                  <defs>
                    {/* Grid Pattern */}
                    <pattern id="canvas-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="1" fill="#cbd5e1" opacity="0.6" />
                    </pattern>

                    {/* Arrowhead marker */}
                    <marker
                      id="canvas-arrow-marker"
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={themeColors.arrowStroke} />
                    </marker>

                    {/* Selected arrow marker */}
                    <marker
                      id="canvas-arrow-marker-selected"
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
                    </marker>
                  </defs>

                  {/* Grid background */}
                  {showGrid && <rect width="100%" height="100%" fill="url(#canvas-grid)" />}

                  {/* Arrows Layer */}
                  <g className="arrows-group">
                    {arrows.map((arr) => {
                      const fromNode = nodes.find((n) => n.id === arr.fromId);
                      const toNode = nodes.find((n) => n.id === arr.toId);
                      if (!fromNode || !toNode) return null;

                      const isSelected = selectedArrowId === arr.id;
                      const startPt = getEdgeIntersection(fromNode, toNode);
                      const endPt = getEdgeIntersection(toNode, fromNode);

                      const midX = (startPt.x + endPt.x) / 2;
                      const midY = (startPt.y + endPt.y) / 2;

                      const reagentTokens = arr.reagent ? parseChemicalFormula(arr.reagent) : [];

                      return (
                        <g
                          key={arr.id}
                          className="cursor-pointer group"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedArrowId(arr.id);
                            setSelectedNodeId(null);
                          }}
                        >
                          {/* Invisible thicker stroke for easy clicking */}
                          <line
                            x1={startPt.x}
                            y1={startPt.y}
                            x2={endPt.x}
                            y2={endPt.y}
                            stroke="transparent"
                            strokeWidth="18"
                          />

                          {/* Actual visible arrow */}
                          <line
                            x1={startPt.x}
                            y1={startPt.y}
                            x2={endPt.x}
                            y2={endPt.y}
                            stroke={isSelected ? '#0284c7' : themeColors.arrowStroke}
                            strokeWidth={isSelected ? 2.6 : 1.8}
                            strokeDasharray={arr.isReversible ? '4 3' : undefined}
                            strokeLinecap="round"
                            markerEnd={`url(#${isSelected ? 'canvas-arrow-marker-selected' : 'canvas-arrow-marker'})`}
                          />

                          {/* Step number badge */}
                          {arr.stepNumber && (
                            <g>
                              <circle
                                cx={midX}
                                cy={arr.reagent ? midY - 24 : midY - 14}
                                r="7.5"
                                fill={isSelected ? '#0284c7' : themeColors.badgeBg}
                              />
                              <text
                                x={midX}
                                y={arr.reagent ? midY - 20.5 : midY - 10.5}
                                textAnchor="middle"
                                fontSize="9"
                                fontWeight="bold"
                                fill="#ffffff"
                              >
                                {arr.stepNumber.replace(/[\(\)]/g, '')}
                              </text>
                            </g>
                          )}

                          {/* Reagent text above */}
                          {arr.reagent && (
                            <text
                              x={midX}
                              y={midY - 8}
                              textAnchor="middle"
                              fontSize="12"
                              fontWeight="600"
                              fill={isSelected ? '#0284c7' : themeColors.arrowTextTop}
                              className="font-sans"
                            >
                              {reagentTokens.map((t, idx) => {
                                if (t.isSub) return <tspan key={idx} fontSize="70%" dy="3">{t.text}</tspan>;
                                if (t.isSup) return <tspan key={idx} fontSize="70%" dy="-3">{t.text}</tspan>;
                                const prev = reagentTokens[idx - 1];
                                const dyReset = prev?.isSub ? -3 : prev?.isSup ? 3 : 0;
                                return <tspan key={idx} dy={dyReset !== 0 ? dyReset : undefined}>{t.text}</tspan>;
                              })}
                            </text>
                          )}

                          {/* Condition text below */}
                          {arr.condition && (
                            <text
                              x={midX}
                              y={midY + 16}
                              textAnchor="middle"
                              fontSize="11"
                              fontStyle="italic"
                              fill={isSelected ? '#0369a1' : themeColors.arrowTextBottom}
                              className="font-sans"
                            >
                              {arr.condition}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>

                  {/* Nodes Layer */}
                  <g className="nodes-group">
                    {nodes.map((node) => {
                      const isSelected = selectedNodeId === node.id;
                      const isConnecting = connectingSourceId === node.id;
                      const tokens = parseChemicalFormula(node.formula);

                      const formulaY = node.y - (node.label ? 4 : 0);
                      const labelY = node.y + (node.label ? 12 : 0);

                      return (
                        <g
                          key={node.id}
                          className="cursor-move group"
                          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                        >
                          {/* Node boundary box */}
                          {boxStyle === 'badge' && (
                            <rect
                              x={node.x - node.width / 2}
                              y={node.y - node.height / 2}
                              width={node.width}
                              height={node.height}
                              rx="8"
                              ry="8"
                              fill={themeColors.nodeBg}
                              stroke={isSelected ? '#0284c7' : isConnecting ? '#f59e0b' : themeColors.nodeBorder}
                              strokeWidth={isSelected || isConnecting ? 2.5 : 1.5}
                              className="transition-all drop-shadow-xs group-hover:stroke-emerald-500"
                            />
                          )}

                          {boxStyle === 'box' && (
                            <rect
                              x={node.x - node.width / 2}
                              y={node.y - node.height / 2}
                              width={node.width}
                              height={node.height}
                              rx="2"
                              ry="2"
                              fill={themeColors.nodeBg}
                              stroke={isSelected ? '#0284c7' : isConnecting ? '#f59e0b' : themeColors.nodeBorder}
                              strokeWidth={isSelected || isConnecting ? 2.5 : 1.5}
                              className="transition-all drop-shadow-xs group-hover:stroke-emerald-500"
                            />
                          )}

                          {boxStyle === 'plain' && (
                            <rect
                              x={node.x - node.width / 2}
                              y={node.y - node.height / 2}
                              width={node.width}
                              height={node.height}
                              fill="transparent"
                              stroke={isSelected ? '#0284c7' : 'transparent'}
                              strokeWidth={1.5}
                              strokeDasharray={isSelected ? '3 3' : undefined}
                            />
                          )}

                          {/* Chemical formula text */}
                          <text
                            x={node.x}
                            y={formulaY}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="16"
                            fontWeight="bold"
                            fill={themeColors.nodeText}
                            className="font-serif select-none"
                          >
                            {tokens.map((t, idx) => {
                              if (t.isSub) return <tspan key={idx} fontSize="72%" dy="3.5">{t.text}</tspan>;
                              if (t.isSup) return <tspan key={idx} fontSize="72%" dy="-4">{t.text}</tspan>;
                              const prev = tokens[idx - 1];
                              const dyReset = prev?.isSub ? -3.5 : prev?.isSup ? 4 : 0;
                              return <tspan key={idx} dy={dyReset !== 0 ? dyReset : undefined}>{t.text}</tspan>;
                            })}
                          </text>

                          {/* Subtitle label */}
                          {node.label && (
                            <text
                              x={node.x}
                              y={labelY}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize="10"
                              fontWeight="500"
                              fill={themeColors.labelText}
                              className="font-sans select-none"
                            >
                              {node.label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Selected Element Inspector & Details */}
          <div className="w-full lg:w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto">
            {selectedNode ? (
              /* Selected Node Inspector */
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Chỉnh sửa hợp chất</span>
                  </span>
                  <button
                    onClick={() => handleDeleteNode(selectedNode.id)}
                    className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer font-medium"
                    title="Xóa chất này khỏi sơ đồ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Công thức hóa học:
                  </label>
                  <input
                    type="text"
                    value={selectedNode.formula}
                    onChange={(e) => handleUpdateNode(selectedNode.id, e.target.value, selectedNode.label)}
                    placeholder="VD: C2H5OH, CH3COOH, X..."
                    className="w-full text-sm font-serif font-bold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Gõ số thường tự thành chỉ số dưới (CH4 → CH₄)
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Tên gọi / Ghi chú dưới (tùy chọn):
                  </label>
                  <input
                    type="text"
                    value={selectedNode.label || ''}
                    onChange={(e) => handleUpdateNode(selectedNode.id, selectedNode.formula, e.target.value)}
                    placeholder="VD: Etanol, Axetilen, Axit fomic..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Arrow connector creation from this node */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="text-[11px] font-bold text-slate-600">Liên kết phản ứng:</div>
                  <button
                    onClick={() => setConnectingSourceId(selectedNode.id)}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ArrowRight className="w-4 h-4 text-emerald-600" />
                    <span>Nối mũi tên tới chất khác</span>
                  </button>
                </div>

                {/* Coordinate adjustment */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-[11px] font-bold text-slate-600 mb-2">Tọa độ vị trí:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">X:</span>{' '}
                      <input
                        type="number"
                        value={selectedNode.x}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? { ...n, x: val } : n)));
                        }}
                        className="w-16 border border-slate-300 rounded px-1.5 py-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400">Y:</span>{' '}
                      <input
                        type="number"
                        value={selectedNode.y}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? { ...n, y: val } : n)));
                        }}
                        className="w-16 border border-slate-300 rounded px-1.5 py-0.5"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedArrow ? (
              /* Selected Arrow Inspector */
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-sky-600" />
                    <span>Chỉnh sửa Mũi tên phản ứng</span>
                  </span>
                  <button
                    onClick={() => handleDeleteArrow(selectedArrow.id)}
                    className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer font-medium"
                    title="Xóa mũi tên này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </button>
                </div>

                {/* Reagent (above) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Tác nhân phản ứng (Trên mũi tên):
                  </label>
                  <input
                    type="text"
                    value={selectedArrow.reagent || ''}
                    onChange={(e) => handleUpdateArrow(selectedArrow.id, { reagent: e.target.value })}
                    placeholder="VD: + Cl₂, + H₂O, + NaOH..."
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                  {/* Quick Reagent chips */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {QUICK_REAGENTS.map((item) => (
                      <button
                        key={item}
                        onClick={() => handleUpdateArrow(selectedArrow.id, { reagent: item })}
                        className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 hover:bg-sky-100 hover:text-sky-800 border border-slate-200 cursor-pointer"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditions (below) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Điều kiện phản ứng (Dưới mũi tên):
                  </label>
                  <input
                    type="text"
                    value={selectedArrow.condition || ''}
                    onChange={(e) => handleUpdateArrow(selectedArrow.id, { condition: e.target.value })}
                    placeholder="VD: t°, xt, 1500°C..."
                    className="w-full text-xs italic border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:ring-2 focus:ring-sky-500"
                  />
                  {/* Quick Condition chips */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {QUICK_CONDITIONS.map((cond) => (
                      <button
                        key={cond}
                        onClick={() => handleUpdateArrow(selectedArrow.id, { condition: cond })}
                        className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 hover:bg-sky-100 hover:text-sky-800 border border-slate-200 cursor-pointer"
                      >
                        {cond}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step Number Badge */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Số thứ tự phản ứng:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={selectedArrow.stepNumber || ''}
                      onChange={(e) => handleUpdateArrow(selectedArrow.id, { stepNumber: e.target.value })}
                      placeholder="VD: (1), (2), 1, ①..."
                      className="w-24 text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:ring-2 focus:ring-sky-500 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateArrow(selectedArrow.id, { stepNumber: undefined })}
                      className="text-[11px] text-slate-500 hover:text-slate-800 px-2 py-1"
                    >
                      Xóa số thứ tự
                    </button>
                  </div>
                </div>

                {/* Equilibrium toggle */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selectedArrow.isReversible}
                      onChange={(e) => handleUpdateArrow(selectedArrow.id, { isReversible: e.target.checked })}
                      className="rounded text-sky-600 focus:ring-sky-500"
                    />
                    <span>Phản ứng thuận nghịch (Nét đứt / ⇌)</span>
                  </label>
                </div>
              </div>
            ) : (
              /* Instructions when nothing is selected */
              <div className="p-5 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Hướng dẫn thao tác nhanh
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Nhấp vào bất kỳ <strong>ô hợp chất</strong> hoặc <strong>mũi tên</strong> trên canvas để tùy chỉnh công thức, tác nhân hoặc điều kiện phản ứng.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 text-left border border-slate-200 space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span><strong>Kéo thả chuột:</strong> Di chuyển vị trí các ô tự do.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span><strong>Thêm chất tiếp theo:</strong> Bấm vào chất bất kỳ ở danh mục bên trái.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span><strong>Căn chỉnh nhanh:</strong> Dùng nút &ldquo;Căn 1 hàng&rdquo; hoặc &ldquo;Căn 2 hàng&rdquo;.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0">
              Chú thích hình:
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="VD: Hình 1. Sơ đồ chuyển hóa hóa học..."
              className="flex-1 text-xs font-serif italic border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Copy SVG */}
            <button
              onClick={handleCopySvg}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Sao chép mã SVG"
            >
              {copiedNotification ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Đã sao chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Sao chép SVG</span>
                </>
              )}
            </button>

            {/* Download SVG */}
            <button
              onClick={handleDownloadSvg}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Tải tệp .svg vector độ nét cao"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Tải SVG (.svg)</span>
            </button>

            {/* Download PNG */}
            <button
              onClick={handleDownloadPng}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Tải ảnh PNG nền trắng cho Word"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Tải PNG (.png)</span>
            </button>

            {/* Insert directly into Question */}
            <button
              onClick={handleSaveToQuestion}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white flex items-center gap-2 cursor-pointer shadow-md transition-all scale-100 hover:scale-[1.02]"
            >
              <Check className="w-4 h-4" />
              <span>Chèn vào Câu hỏi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
