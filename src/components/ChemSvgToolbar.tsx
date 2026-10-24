import React, { useState } from 'react';
import {
  FlaskConical,
  Hexagon,
  Move,
  Plus,
  Image as ImageIcon,
  Type,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface ChemSvgToolbarItem {
  id: string;
  name: string;
  shortLabel: string;
  category: 'apparatus' | 'structure';
  defaultCaption: string;
  inlineSvg: string;
  standaloneSvg: string;
}

export const CHEM_SVG_ITEMS: ChemSvgToolbarItem[] = [
  // ======================== DỤNG CỤ THÍ NGHIỆM (APPARATUS) ========================
  {
    id: 'volumetric_flask',
    name: 'Bình định mức 100 mL',
    shortLabel: 'Bình định mức',
    category: 'apparatus',
    defaultCaption: 'Hình. Bình định mức 100 mL dùng pha chế dung dịch có nồng độ chính xác.',
    inlineSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 110" width="46" height="62" style="display:inline-block;vertical-align:middle;margin:0 4px;"><path d="M33,8 L47,8 M36,8 L36,48 L14,86 C10,94 16,102 26,102 L54,102 C64,102 70,94 66,86 L44,48 L44,8" fill="#e0f2fe" fill-opacity="0.55" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="31" y1="30" x2="49" y2="30" stroke="#dc2626" stroke-width="2.2"/><text x="40" y="90" text-anchor="middle" font-size="10" font-family="Arial" font-weight="bold" fill="#0369a1">100mL</text></svg>`,
    standaloneSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 280" width="360" height="280">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <g transform="translate(115, 20)">
        <defs>
          <clipPath id="vf-clip">
            <path d="M54,18 L54,95 L16,162 C8,176 18,192 35,192 L95,192 C112,192 122,176 114,162 L76,95 L76,18 Z"/>
          </clipPath>
        </defs>
        <rect x="8" y="62" width="115" height="135" fill="#bae6fd" opacity="0.75" clip-path="url(#vf-clip)"/>
        <path d="M54,62 Q65,67 76,62" fill="none" stroke="#0284c7" stroke-width="2.5"/>
        <path d="M48,18 L82,18 M54,18 L54,95 L16,162 C8,176 18,192 35,192 L95,192 C112,192 122,176 114,162 L76,95 L76,18" fill="none" stroke="#0f172a" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="52" y="4" width="26" height="14" rx="3" fill="#cbd5e1" stroke="#0f172a" stroke-width="2.5"/>
        <line x1="44" y1="62" x2="86" y2="62" stroke="#dc2626" stroke-width="2.8"/>
        <text x="92" y="66" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#dc2626">Vạch định mức</text>
        <text x="65" y="156" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#0c4a6e">100 mL</text>
        <text x="65" y="174" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#334155">20°C ± 0.10</text>
      </g>
      <text x="180" y="255" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="15" fill="#1e293b">Bình định mức 100 mL có nút nhám</text>
    </svg>`,
  },
  {
    id: 'test_tube',
    name: 'Ống nghiệm chứa hóa chất',
    shortLabel: 'Ống nghiệm',
    category: 'apparatus',
    defaultCaption: 'Hình. Ống nghiệm thủy tinh chịu nhiệt chứa dung dịch phản ứng.',
    inlineSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 110" width="32" height="60" style="display:inline-block;vertical-align:middle;margin:0 4px;"><path d="M14,10 L14,84 A11,11 0 0,0 36,84 L36,10" fill="#bae6fd" fill-opacity="0.45" stroke="#0f172a" stroke-width="2.5"/><path d="M15,52 L15,84 A10,10 0 0,0 35,84 L35,52 Z" fill="#38bdf8" fill-opacity="0.75"/><ellipse cx="25" cy="10" rx="13" ry="3" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/><circle cx="22" cy="74" r="2.2" fill="#fff"/><circle cx="28" cy="64" r="1.8" fill="#fff"/></svg>`,
    standaloneSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 280" width="340" height="280">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <g transform="translate(135, 25)">
        <defs>
          <clipPath id="tt-clip">
            <path d="M16,12 L16,155 A19,19 0 0,0 54,155 L54,12 Z"/>
          </clipPath>
        </defs>
        <rect x="16" y="88" width="38" height="90" fill="#38bdf8" opacity="0.8" clip-path="url(#tt-clip)"/>
        <path d="M16,88 Q35,94 54,88" fill="none" stroke="#0284c7" stroke-width="2.5"/>
        <circle cx="28" cy="145" r="3.5" fill="#ffffff" opacity="0.85"/>
        <circle cx="40" cy="125" r="2.8" fill="#ffffff" opacity="0.85"/>
        <circle cx="32" cy="106" r="2.2" fill="#ffffff" opacity="0.85"/>
        <path d="M16,12 L16,155 A19,19 0 0,0 54,155 L54,12" fill="none" stroke="#0f172a" stroke-width="3.2" stroke-linecap="round"/>
        <ellipse cx="35" cy="12" rx="22" ry="4" fill="#e2e8f0" stroke="#0f172a" stroke-width="2.8"/>
      </g>
      <text x="170" y="250" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="15" fill="#1e293b">Ống nghiệm thủy tinh chịu nhiệt</text>
    </svg>`,
  },
  {
    id: 'erlenmeyer_flask',
    name: 'Bình tam giác (Erlenmeyer)',
    shortLabel: 'Bình tam giác',
    category: 'apparatus',
    defaultCaption: 'Hình. Bình tam giác (Erlenmeyer) 250 mL dùng trong chuẩn độ.',
    inlineSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 110" width="48" height="60" style="display:inline-block;vertical-align:middle;margin:0 4px;"><path d="M35,10 L55,10 M37,10 L37,36 L14,92 C11,98 15,102 22,102 L68,102 C75,102 79,98 76,92 L53,36 L53,10" fill="#f3e8ff" fill-opacity="0.6" stroke="#0f172a" stroke-width="2.5"/><path d="M23,70 L14,92 C12,97 16,101 22,101 L68,101 C74,101 78,97 76,92 L67,70 Z" fill="#a855f7" fill-opacity="0.65"/></svg>`,
    standaloneSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 280" width="360" height="280">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <g transform="translate(120, 35)">
        <defs>
          <clipPath id="ef-clip">
            <path d="M48,42 L15,152 C12,160 17,166 25,166 L95,166 C103,166 108,160 105,152 L72,42 Z"/>
          </clipPath>
        </defs>
        <rect x="10" y="105" width="100" height="65" fill="#c084fc" opacity="0.75" clip-path="url(#ef-clip)"/>
        <path d="M44,8 L76,8 M48,8 L48,42 L15,152 C12,160 17,166 25,166 L95,166 C103,166 108,160 105,152 L72,42 L72,8" fill="none" stroke="#0f172a" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="36" y1="140" x2="52" y2="140" stroke="#334155" stroke-width="2"/>
        <line x1="42" y1="115" x2="56" y2="115" stroke="#334155" stroke-width="2"/>
        <line x1="48" y1="90" x2="60" y2="90" stroke="#334155" stroke-width="2"/>
        <text x="64" y="144" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#334155">100 mL</text>
        <text x="64" y="119" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#334155">200 mL</text>
      </g>
      <text x="180" y="250" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="15" fill="#1e293b">Bình tam giác (Erlenmeyer) 250 mL</text>
    </svg>`,
  },
  {
    id: 'separatory_funnel',
    name: 'Phễu chiết tách chất lỏng',
    shortLabel: 'Phễu chiết',
    category: 'apparatus',
    defaultCaption: 'Hình. Phễu chiết tách hai lớp chất lỏng không tan vào nhau (ví dụ: ester và nước).',
    inlineSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 120" width="44" height="64" style="display:inline-block;vertical-align:middle;margin:0 4px;"><path d="M32,8 L48,8 M35,8 L35,20 C16,28 16,58 36,80 L36,112 L44,112 L44,80 C64,58 64,28 45,20 L45,8" fill="#fef3c7" fill-opacity="0.7" stroke="#0f172a" stroke-width="2.4"/><line x1="23" y1="52" x2="57" y2="52" stroke="#d97706" stroke-width="2"/><line x1="30" y1="86" x2="50" y2="86" stroke="#dc2626" stroke-width="3"/></svg>`,
    standaloneSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 300" width="360" height="300">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <g transform="translate(120, 20)">
        <path d="M22,72 C22,95 36,118 54,142 L66,142 C84,118 98,95 98,72 Z" fill="#bae6fd" opacity="0.8"/>
        <path d="M22,72 C20,52 32,36 48,28 L72,28 C88,36 100,52 98,72 Z" fill="#fde047" opacity="0.8"/>
        <path d="M46,12 L74,12 M50,12 L50,26 C22,36 16,78 54,142 L54,210 L66,210 L66,142 C104,78 98,36 70,26 L70,12" fill="none" stroke="#0f172a" stroke-width="3.2" stroke-linejoin="round"/>
        <rect x="42" y="160" width="36" height="10" rx="3" fill="#dc2626" stroke="#0f172a" stroke-width="2"/>
        <text x="108" y="56" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#b45309">Lớp Ester (nhẹ)</text>
        <text x="108" y="106" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0369a1">Lớp Nước (nặng)</text>
      </g>
      <text x="180" y="272" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="15" fill="#1e293b">Phễu chiết phân lớp chất lỏng</text>
    </svg>`,
  },
  {
    id: 'graduated_cylinder',
    name: 'Ống đong chia vạch 50 mL',
    shortLabel: 'Ống đong',
    category: 'apparatus',
    defaultCaption: 'Hình. Ống đong thủy tinh chia vạch dùng lấy thể tích dung dịch.',
    inlineSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 110" width="36" height="62" style="display:inline-block;vertical-align:middle;margin:0 4px;"><rect x="18" y="12" width="24" height="86" fill="#e0f2fe" fill-opacity="0.55" stroke="#0f172a" stroke-width="2.4"/><rect x="19" y="48" width="22" height="49" fill="#38bdf8" fill-opacity="0.7"/><line x1="10" y1="98" x2="50" y2="98" stroke="#0f172a" stroke-width="3.5"/><line x1="20" y1="30" x2="30" y2="30" stroke="#334155" stroke-width="1.8"/><line x1="20" y1="50" x2="30" y2="50" stroke="#334155" stroke-width="1.8"/><line x1="20" y1="70" x2="30" y2="70" stroke="#334155" stroke-width="1.8"/></svg>`,
    standaloneSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 280" width="340" height="280">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <g transform="translate(125, 25)">
        <rect x="24" y="85" width="42" height="115" fill="#7dd3fc" opacity="0.75"/>
        <path d="M20,16 L24,16 L24,200 L66,200 L66,16 L72,12" fill="none" stroke="#0f172a" stroke-width="3.2" stroke-linejoin="round"/>
        <rect x="10" y="200" width="70" height="10" rx="3" fill="#cbd5e1" stroke="#0f172a" stroke-width="2.8"/>
        <line x1="24" y1="50" x2="42" y2="50" stroke="#1e293b" stroke-width="2"/>
        <line x1="24" y1="85" x2="42" y2="85" stroke="#1e293b" stroke-width="2"/>
        <line x1="24" y1="120" x2="42" y2="120" stroke="#1e293b" stroke-width="2"/>
        <line x1="24" y1="155" x2="42" y2="155" stroke="#1e293b" stroke-width="2"/>
        <text x="48" y="54" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#1e293b">50</text>
        <text x="48" y="89" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#1e293b">40</text>
        <text x="48" y="124" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#1e293b">30</text>
        <text x="48" y="159" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#1e293b">20</text>
      </g>
      <text x="170" y="260" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="15" fill="#1e293b">Ống đong chia độ 50 mL</text>
    </svg>`,
  },

  // ======================== CÔNG THỨC CẤU TẠO HÓA HỌC (STRUCTURES) ========================
  {
    id: 'struct_benzene',
    name: 'Vòng Benzene (C₆H₆)',
    shortLabel: 'Vòng Benzene',
    category: 'structure',
    defaultCaption: 'Hình. Công thức cấu tạo vòng thơm Benzene (C₆H₆).',
    inlineSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 86" width="44" height="48" style="display:inline-block;vertical-align:middle;margin:0 4px;"><polygon points="40,6 72,24 72,62 40,80 8,62 8,24" fill="none" stroke="#0f172a" stroke-width="3"/><circle cx="40" cy="43" r="19" fill="none" stroke="#2563eb" stroke-width="2.5"/></svg>`,
    standaloneSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 260" width="340" height="260">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <g transform="translate(55, 25)">
        <!-- Kekule Form -->
        <polygon points="55,15 100,41 100,93 55,119 10,93 10,41" fill="none" stroke="#0f172a" stroke-width="3.2"/>
        <line x1="55" y1="24" x2="91" y2="45" stroke="#0f172a" stroke-width="2.6"/>
        <line x1="91" y1="88" x2="55" y2="109" stroke="#0f172a" stroke-width="2.6"/>
        <line x1="19" y1="88" x2="19" y2="45" stroke="#0f172a" stroke-width="2.6"/>
        <text x="115" y="72" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#475569">↔</text>
        <!-- Delocalized Ring Form -->
        <g transform="translate(130, 0)">
          <polygon points="55,15 100,41 100,93 55,119 10,93 10,41" fill="none" stroke="#0f172a" stroke-width="3.2"/>
          <circle cx="55" cy="67" r="27" fill="none" stroke="#2563eb" stroke-width="2.8"/>
        </g>
      </g>
      <text x="170" y="215" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="15" fill="#1e293b">Công thức cấu tạo vòng Benzene (C₆H₆)</text>
    </svg>`,
  },
  {
    id: 'struct_ester',
    name: 'Nhóm chức Ester (-COO-)',
    shortLabel: 'CTCT Ester (-COO-)',
    category: 'structure',
    defaultCaption: 'Hình. Công thức cấu tạo nhóm chức Ester (R - COO - R\').',
    inlineSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 155 85" width="95" height="52" style="display:inline-block;vertical-align:middle;margin:0 4px;"><text x="10" y="64" font-family="Arial" font-size="16" font-weight="bold" fill="#0f172a">R</text><line x1="26" y1="58" x2="50" y2="58" stroke="#0f172a" stroke-width="2.5"/><text x="54" y="64" font-family="Arial" font-size="16" font-weight="bold" fill="#0f172a">C</text><line x1="57" y1="45" x2="57" y2="24" stroke="#dc2626" stroke-width="2.5"/><line x1="63" y1="45" x2="63" y2="24" stroke="#dc2626" stroke-width="2.5"/><text x="54" y="19" font-family="Arial" font-size="16" font-weight="bold" fill="#dc2626">O</text><line x1="70" y1="58" x2="94" y2="58" stroke="#0f172a" stroke-width="2.5"/><text x="97" y="64" font-family="Arial" font-size="16" font-weight="bold" fill="#dc2626">O</text><line x1="113" y1="58" x2="132" y2="58" stroke="#0f172a" stroke-width="2.5"/><text x="135" y="64" font-family="Arial" font-size="16" font-weight="bold" fill="#2563eb">R'</text></svg>`,
    standaloneSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 240" width="380" height="240">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <g transform="translate(55, 35)">
        <text x="15" y="110" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#0f172a">R</text>
        <line x1="42" y1="102" x2="88" y2="102" stroke="#0f172a" stroke-width="3.2"/>
        <text x="95" y="110" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#0f172a">C</text>
        <!-- Double bond C=O -->
        <line x1="100" y1="82" x2="100" y2="38" stroke="#dc2626" stroke-width="3.2"/>
        <line x1="108" y1="82" x2="108" y2="38" stroke="#dc2626" stroke-width="3.2"/>
        <text x="95" y="30" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#dc2626">O</text>
        <!-- Single bond C-O-R' -->
        <line x1="120" y1="102" x2="168" y2="102" stroke="#0f172a" stroke-width="3.2"/>
        <text x="174" y="110" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#dc2626">O</text>
        <line x1="200" y1="102" x2="245" y2="102" stroke="#0f172a" stroke-width="3.2"/>
        <text x="252" y="110" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#2563eb">R'</text>
      </g>
      <text x="190" y="205" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="15" fill="#1e293b">Công thức cấu tạo chung của Ester (R-COO-R')</text>
    </svg>`,
  },
  {
    id: 'struct_carboxyl',
    name: 'Nhóm Carboxyl (-COOH)',
    shortLabel: 'CTCT -COOH',
    category: 'structure',
    defaultCaption: 'Hình. Công thức cấu tạo nhóm chức Carboxyl (-COOH).',
    inlineSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 155 85" width="95" height="52" style="display:inline-block;vertical-align:middle;margin:0 4px;"><text x="8" y="64" font-family="Arial" font-size="16" font-weight="bold" fill="#0f172a">R</text><line x1="25" y1="58" x2="48" y2="58" stroke="#0f172a" stroke-width="2.5"/><text x="52" y="64" font-family="Arial" font-size="16" font-weight="bold" fill="#0f172a">C</text><line x1="55" y1="45" x2="55" y2="24" stroke="#dc2626" stroke-width="2.5"/><line x1="61" y1="45" x2="61" y2="24" stroke="#dc2626" stroke-width="2.5"/><text x="52" y="19" font-family="Arial" font-size="16" font-weight="bold" fill="#dc2626">O</text><line x1="68" y1="58" x2="90" y2="58" stroke="#0f172a" stroke-width="2.5"/><text x="94" y="64" font-family="Arial" font-size="16" font-weight="bold" fill="#dc2626">O</text><line x1="110" y1="58" x2="128" y2="58" stroke="#0f172a" stroke-width="2.5"/><text x="132" y="64" font-family="Arial" font-size="16" font-weight="bold" fill="#0284c7">H</text></svg>`,
    standaloneSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 240" width="380" height="240">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <g transform="translate(55, 35)">
        <text x="15" y="110" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#0f172a">R</text>
        <line x1="42" y1="102" x2="88" y2="102" stroke="#0f172a" stroke-width="3.2"/>
        <text x="95" y="110" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#0f172a">C</text>
        <line x1="100" y1="82" x2="100" y2="38" stroke="#dc2626" stroke-width="3.2"/>
        <line x1="108" y1="82" x2="108" y2="38" stroke="#dc2626" stroke-width="3.2"/>
        <text x="95" y="30" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#dc2626">O</text>
        <line x1="120" y1="102" x2="168" y2="102" stroke="#0f172a" stroke-width="3.2"/>
        <text x="174" y="110" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#dc2626">O</text>
        <line x1="200" y1="102" x2="245" y2="102" stroke="#0f172a" stroke-width="3.2"/>
        <text x="252" y="110" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#0284c7">H</text>
      </g>
      <text x="190" y="205" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="15" fill="#1e293b">Công thức cấu tạo nhóm Carboxyl (R-COOH)</text>
    </svg>`,
  },
  {
    id: 'struct_amino_acid',
    name: 'Cấu tạo α-Amino Acid',
    shortLabel: 'α-Amino Acid',
    category: 'structure',
    defaultCaption: 'Hình. Công thức cấu tạo tổng quát của α-Amino Acid (H₂N-CH(R)-COOH).',
    inlineSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 95" width="108" height="56" style="display:inline-block;vertical-align:middle;margin:0 4px;"><text x="6" y="48" font-family="Arial" font-size="15" font-weight="bold" fill="#2563eb">H₂N</text><line x1="40" y1="43" x2="64" y2="43" stroke="#0f172a" stroke-width="2.4"/><text x="68" y="48" font-family="Arial" font-size="15" font-weight="bold" fill="#0f172a">CH</text><line x1="76" y1="53" x2="76" y2="74" stroke="#0f172a" stroke-width="2.4"/><text x="70" y="90" font-family="Arial" font-size="15" font-weight="bold" fill="#059669">R</text><line x1="94" y1="43" x2="118" y2="43" stroke="#0f172a" stroke-width="2.4"/><text x="122" y="48" font-family="Arial" font-size="15" font-weight="bold" fill="#dc2626">COOH</text></svg>`,
    standaloneSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250" width="400" height="250">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <g transform="translate(55, 35)">
        <text x="10" y="75" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#2563eb">H₂N</text>
        <line x1="62" y1="68" x2="112" y2="68" stroke="#0f172a" stroke-width="3.2"/>
        <text x="118" y="75" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#0f172a">CH</text>
        <line x1="132" y1="84" x2="132" y2="130" stroke="#0f172a" stroke-width="3.2"/>
        <text x="123" y="155" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#059669">R</text>
        <line x1="158" y1="68" x2="208" y2="68" stroke="#0f172a" stroke-width="3.2"/>
        <text x="215" y="75" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#dc2626">COOH</text>
      </g>
      <text x="200" y="220" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="15" fill="#1e293b">Cấu tạo phân tử α-Amino Acid</text>
    </svg>`,
  },
  {
    id: 'struct_glucose_ring',
    name: 'Vòng α-Glucose (Haworth)',
    shortLabel: 'Vòng α-Glucose',
    category: 'structure',
    defaultCaption: 'Hình. Công thức cấu tạo dạng mạch vòng 6 cạnh của α-Glucose.',
    inlineSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 90" width="66" height="54" style="display:inline-block;vertical-align:middle;margin:0 4px;"><polygon points="30,22 72,22 94,52 72,80 30,80 12,52" fill="none" stroke="#0f172a" stroke-width="2.5"/><circle cx="72" cy="22" r="7" fill="#ffffff"/><text x="67" y="27" font-family="Arial" font-size="13" font-weight="bold" fill="#dc2626">O</text><line x1="30" y1="22" x2="30" y2="6" stroke="#0f172a" stroke-width="2"/><text x="18" y="8" font-family="Arial" font-size="9" font-weight="bold" fill="#0369a1">CH₂OH</text></svg>`,
    standaloneSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 260" width="380" height="260">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <g transform="translate(75, 25)">
        <polyline points="155,45 195,95 155,145 65,145 25,95 65,45 138,45" fill="none" stroke="#0f172a" stroke-width="3.2" stroke-linejoin="round"/>
        <text x="143" y="52" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#dc2626">O</text>
        <!-- C6 CH2OH -->
        <line x1="65" y1="45" x2="65" y2="18" stroke="#0f172a" stroke-width="2.5"/>
        <text x="45" y="14" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#0369a1">CH₂OH</text>
        <!-- C1 hemiacetal OH (down in alpha) -->
        <line x1="195" y1="95" x2="195" y2="128" stroke="#dc2626" stroke-width="2.5"/>
        <text x="186" y="144" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#dc2626">OH (C1)</text>
        <!-- C2, C3, C4 OHs -->
        <line x1="155" y1="145" x2="155" y2="170" stroke="#0f172a" stroke-width="2.2"/>
        <text x="146" y="184" font-family="Arial, sans-serif" font-size="12" fill="#0f172a">OH</text>
        <line x1="65" y1="145" x2="65" y2="122" stroke="#0f172a" stroke-width="2.2"/>
        <text x="56" y="118" font-family="Arial, sans-serif" font-size="12" fill="#0f172a">OH</text>
        <line x1="25" y1="95" x2="25" y2="122" stroke="#0f172a" stroke-width="2.2"/>
        <text x="16" y="136" font-family="Arial, sans-serif" font-size="12" fill="#0f172a">OH</text>
      </g>
      <text x="190" y="235" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="15" fill="#1e293b">Công thức Haworth vòng 6 cạnh của α-Glucose</text>
    </svg>`,
  },
];

/**
 * Helper used by MathChemView to render inline `[svg:id]` tokens directly inside question content
 */
export function replaceInlineSvgTokens(text: string): string {
  if (!text || !text.includes('[svg:')) return text;
  return text.replace(/\[svg:([a-zA-Z0-9_]+)\]/g, (fullMatch, id) => {
    const found = CHEM_SVG_ITEMS.find((item) => item.id === id);
    if (!found) return fullMatch;
    return `<span class="inline-flex items-center align-middle mx-1 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200" title="${found.name}">${found.inlineSvg}</span>`;
  });
}

interface ChemSvgToolbarProps {
  activeQuestionLabel: string;
  onInsertInlineToContent: (item: ChemSvgToolbarItem) => void;
  onAttachAsQuestionImage: (item: ChemSvgToolbarItem) => void;
}

export const ChemSvgToolbar: React.FC<ChemSvgToolbarProps> = ({
  activeQuestionLabel,
  onInsertInlineToContent,
  onAttachAsQuestionImage,
}) => {
  const [filter, setFilter] = useState<'all' | 'apparatus' | 'structure'>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const visibleItems = CHEM_SVG_ITEMS.filter((it) =>
    filter === 'all' ? true : it.category === filter
  );

  const handleDragStart = (e: React.DragEvent, item: ChemSvgToolbarItem) => {
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      item.standaloneSvg.trim()
    )}`;

    e.dataTransfer.effectAllowed = 'copy';
    // Set JSON payload for question card dropzone / apparatus drop handler
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'chem-svg-toolbar-item',
        id: item.id,
        name: item.name,
        token: `[svg:${item.id}]`,
        dataUrl: svgDataUrl,
        caption: item.defaultCaption,
      })
    );
    // Also set plain text token so dropping directly into a <textarea> inserts `[svg:id]`
    e.dataTransfer.setData('text/plain', ` [svg:${item.id}] `);
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-200/90 shadow-2xs overflow-hidden">
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-50 via-sky-50 to-teal-50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
            <Hexagon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                THANH CÔNG CỤ CHÈN & KÉO THẢ SVG THÍ NGHIỆM - CẤU TẠO HÓA HỌC
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                Đang chọn: {activeQuestionLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              Kéo thả biểu tượng SVG trực tiếp vào <strong>ô nhập nội dung câu hỏi</strong> (hoặc bấm nút chèn nhanh) để hiển thị công thức cấu tạo & bình định mức, ống nghiệm
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Category Filter Pills */}
          <div className="inline-flex bg-white p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({CHEM_SVG_ITEMS.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('apparatus')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                filter === 'apparatus'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FlaskConical className="w-3 h-3" />
              <span>Thí nghiệm</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter('structure')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                filter === 'structure'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Hexagon className="w-3 h-3" />
              <span>Cấu tạo hóa học</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
            title={isExpanded ? 'Thu gọn thanh SVG' : 'Mở rộng thanh SVG'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Horizontal Draggable SVG Strip */}
      {isExpanded && (
        <div className="p-3 bg-slate-50/60 overflow-x-auto">
          <div className="flex items-stretch gap-2.5 min-w-max">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                className="w-40 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 p-2.5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group cursor-grab active:cursor-grabbing"
                title={`Kéo thả "${item.name}" vào nội dung câu hỏi hoặc nhấn nút bên dưới`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mb-1">
                    <span
                      className={`px-1.5 py-0.2 rounded ${
                        item.category === 'apparatus'
                          ? 'bg-sky-50 text-sky-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {item.category === 'apparatus' ? 'Dụng cụ' : 'Cấu tạo'}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-indigo-500">
                      <Move className="w-2.5 h-2.5" /> Kéo thả
                    </span>
                  </div>

                  {/* SVG Preview Box */}
                  <div
                    className="h-16 w-full rounded-lg bg-slate-50/80 border border-slate-100 flex items-center justify-center p-1 overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: item.inlineSvg }}
                  />

                  <div className="mt-1.5 text-center">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {item.shortLabel}
                    </div>
                  </div>
                </div>

                {/* Quick Insert Buttons */}
                <div className="mt-2 pt-1.5 border-t border-slate-100 grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => onInsertInlineToContent(item)}
                    className="px-1.5 py-1 rounded text-[10px] font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-0.5"
                    title="Chèn trực tiếp ký hiệu SVG vào nội dung văn bản câu hỏi"
                  >
                    <Type className="w-2.5 h-2.5" />
                    <span>Vào nội dung</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onAttachAsQuestionImage(item)}
                    className="px-1.5 py-1 rounded text-[10px] font-bold bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-0.5"
                    title="Gắn làm hình vẽ minh họa chính của câu hỏi"
                  >
                    <ImageIcon className="w-2.5 h-2.5" />
                    <span>Hình câu hỏi</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
