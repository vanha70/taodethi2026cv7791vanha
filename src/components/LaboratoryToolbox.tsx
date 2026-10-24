import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Move,
  Info,
  Check,
  FlaskConical,
  Flame,
  TestTube,
  Layers,
  HelpCircle,
  X,
  ExternalLink,
} from 'lucide-react';

export interface ApparatusItem {
  id: string;
  name: string;
  category: 'heat_stand' | 'reaction' | 'measurement' | 'gas_transfer' | 'electro_organic';
  categoryLabel: string;
  description: string;
  defaultCaption: string;
  tags: string[];
  viewBox: string;
  renderSvg: (options?: { color?: string; liquidPercent?: number }) => React.ReactNode;
  generateStandaloneSvg: () => string;
}

export const APPARATUS_CATALOG: ApparatusItem[] = [
  // 1. Bình tam giác (Erlenmeyer)
  {
    id: 'erlenmeyer',
    name: 'Bình tam giác (Erlenmeyer)',
    category: 'reaction',
    categoryLabel: 'Chứa & Phản ứng',
    description: 'Bình 250 mL cổ hẹp chia vạch, dùng trong chuẩn độ và phản ứng có đun sôi nhẹ.',
    defaultCaption: 'Hình. Bình tam giác (Erlenmeyer flask) 250 mL dùng trong chuẩn độ và phản ứng.',
    tags: ['bình tam giác', 'erlenmeyer', 'flask', 'chuẩn độ', 'dung dịch'],
    viewBox: '0 0 120 140',
    renderSvg: () => (
      <svg viewBox="0 0 120 140" className="w-full h-full drop-shadow-xs">
        <defs>
          <clipPath id="tb-clip-erlen">
            <path d="M 48,45 L 15,128 C 13,132 17,135 22,135 L 98,135 C 103,135 107,132 105,128 L 72,45 Z" />
          </clipPath>
          <linearGradient id="tb-grad-erlen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#6b21a8" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        {/* Liquid */}
        <rect x="10" y="80" width="100" height="60" fill="url(#tb-grad-erlen)" clipPath="url(#tb-clip-erlen)" />
        {/* Glass body */}
        <path
          d="M 45,5 L 75,5 M 48,5 L 48,42 L 15,128 C 13,132 17,136 22,136 L 98,136 C 103,136 107,132 105,128 L 72,42 L 72,5"
          fill="none"
          stroke="#1e293b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Rim top */}
        <ellipse cx="60" cy="5" rx="14" ry="3" fill="#e2e8f0" stroke="#1e293b" strokeWidth="2.5" />
        {/* Graduations */}
        <line x1="38" y1="115" x2="52" y2="115" stroke="#475569" strokeWidth="2" />
        <line x1="44" y1="95" x2="56" y2="95" stroke="#475569" strokeWidth="2" />
        <line x1="50" y1="75" x2="60" y2="75" stroke="#475569" strokeWidth="2" />
        <text x="75" y="118" fontSize="8" fill="#475569" fontWeight="bold">200ml</text>
        <text x="70" y="98" fontSize="8" fill="#475569" fontWeight="bold">100ml</text>
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="400" height="320">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(140, 60)">
          <defs>
            <clipPath id="erlen-clip">
              <path d="M 48,45 L 15,128 C 13,132 17,135 22,135 L 98,135 C 103,135 107,132 105,128 L 72,45 Z" />
            </clipPath>
          </defs>
          <rect x="10" y="80" width="100" height="60" fill="#9333ea" opacity="0.85" clipPath="url(#erlen-clip)" />
          <path d="M 45,5 L 75,5 M 48,5 L 48,42 L 15,128 C 13,132 17,136 22,136 L 98,136 C 103,136 107,132 105,128 L 72,42 L 72,5" fill="none" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
          <ellipse cx="60" cy="5" rx="14" ry="3.5" fill="#e2e8f0" stroke="#0f172a" stroke-width="3" />
          <line x1="38" y1="115" x2="54" y2="115" stroke="#334155" stroke-width="2" />
          <line x1="44" y1="95" x2="58" y2="95" stroke="#334155" stroke-width="2" />
          <line x1="50" y1="75" x2="62" y2="75" stroke="#334155" stroke-width="2" />
          <text x="68" y="118" font-size="10" font-family="Arial, sans-serif" fill="#334155" font-weight="bold">200 mL</text>
          <text x="68" y="98" font-size="10" font-family="Arial, sans-serif" fill="#334155" font-weight="bold">100 mL</text>
        </g>
        <text x="200" y="270" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Bình tam giác (Erlenmeyer) 250 mL</text>
      </svg>
    `,
  },

  // 2. Ống nghiệm chịu nhiệt (Test tube)
  {
    id: 'test_tube',
    name: 'Ống nghiệm chịu nhiệt',
    category: 'reaction',
    categoryLabel: 'Chứa & Phản ứng',
    description: 'Ống nghiệm thủy tinh bo tròn đáy, vạch chia hoặc chứa hóa chất phản ứng.',
    defaultCaption: 'Hình. Ống nghiệm thủy tinh chịu nhiệt dùng trong thí nghiệm định tính.',
    tags: ['ống nghiệm', 'test tube', 'thủy tinh', 'phản ứng'],
    viewBox: '0 0 60 140',
    renderSvg: () => (
      <svg viewBox="0 0 60 140" className="w-full h-full drop-shadow-xs">
        <defs>
          <clipPath id="tb-clip-tube">
            <path d="M 12,5 L 12,112 A 18,18 0 0,0 48,112 L 48,5 Z" />
          </clipPath>
        </defs>
        {/* Liquid */}
        <rect x="12" y="70" width="36" height="60" fill="#38bdf8" opacity="0.8" clipPath="url(#tb-clip-tube)" />
        {/* Bubble */}
        <circle cx="25" cy="85" r="2.5" fill="#ffffff" opacity="0.7" />
        <circle cx="35" cy="95" r="2" fill="#ffffff" opacity="0.7" />
        {/* Tube glass */}
        <path
          d="M 8,5 L 52,5 M 12,5 L 12,112 A 18,18 0 0,0 48,112 L 48,5"
          fill="none"
          stroke="#1e293b"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <ellipse cx="30" cy="5" rx="19" ry="3" fill="#e2e8f0" stroke="#1e293b" strokeWidth="2.5" />
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 300" width="360" height="300">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(150, 40)">
          <defs>
            <clipPath id="tube-standalone-clip">
              <path d="M 12,5 L 12,140 A 20,20 0 0,0 52,140 L 52,5 Z" />
            </clipPath>
          </defs>
          <rect x="12" y="80" width="40" height="90" fill="#0284c7" opacity="0.8" clipPath="url(#tube-standalone-clip)" />
          <circle cx="28" cy="100" r="3" fill="#ffffff" opacity="0.8" />
          <circle cx="38" cy="120" r="2.5" fill="#ffffff" opacity="0.8" />
          <circle cx="26" cy="135" r="3" fill="#ffffff" opacity="0.8" />
          <path d="M 8,5 L 56,5 M 12,5 L 12,140 A 20,20 0 0,0 52,140 L 52,5" fill="none" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round" />
          <ellipse cx="32" cy="5" rx="21" ry="3.5" fill="#f1f5f9" stroke="#0f172a" stroke-width="3" />
        </g>
        <text x="180" y="255" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Ống nghiệm chịu nhiệt (Bo tròn đáy)</text>
      </svg>
    `,
  },

  // 3. Ống nghiệm có nhánh bên (Sidearm test tube)
  {
    id: 'test_tube_sidearm',
    name: 'Ống nghiệm có nhánh',
    category: 'reaction',
    categoryLabel: 'Chứa & Phản ứng',
    description: 'Ống nghiệm có nhánh thủy tinh bên hông, thường dùng sinh khí và dẫn khí sang bình khác.',
    defaultCaption: 'Hình. Ống nghiệm có nhánh bên dùng trong bộ điều chế khí.',
    tags: ['ống nghiệm có nhánh', 'sidearm', 'điều chế khí', 'etilen', 'axetilen'],
    viewBox: '0 0 90 140',
    renderSvg: () => (
      <svg viewBox="0 0 90 140" className="w-full h-full drop-shadow-xs">
        <defs>
          <clipPath id="tb-clip-tubearm">
            <path d="M 12,5 L 12,112 A 18,18 0 0,0 48,112 L 48,5 Z" />
          </clipPath>
        </defs>
        <rect x="12" y="70" width="36" height="60" fill="#f59e0b" opacity="0.8" clipPath="url(#tb-clip-tubearm)" />
        <path
          d="M 8,5 L 52,5 M 12,5 L 12,112 A 18,18 0 0,0 48,112 L 48,40 L 78,28 L 78,36 L 48,48 L 48,5"
          fill="none"
          stroke="#1e293b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <ellipse cx="30" cy="5" rx="19" ry="3" fill="#e2e8f0" stroke="#1e293b" strokeWidth="2.5" />
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 300" width="380" height="300">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(130, 40)">
          <defs>
            <clipPath id="sidearm-clip">
              <path d="M 12,5 L 12,140 A 20,20 0 0,0 52,140 L 52,5 Z" />
            </clipPath>
          </defs>
          <rect x="12" y="80" width="40" height="90" fill="#eab308" opacity="0.85" clipPath="url(#sidearm-clip)" />
          <path d="M 8,5 L 56,5 M 12,5 L 12,140 A 20,20 0 0,0 52,140 L 52,45 L 95,30 L 95,40 L 52,55 L 52,5" fill="none" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
          <ellipse cx="32" cy="5" rx="21" ry="3.5" fill="#f1f5f9" stroke="#0f172a" stroke-width="3" />
        </g>
        <text x="190" y="255" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Ống nghiệm có nhánh dẫn khí bên</text>
      </svg>
    `,
  },

  // 4. Đèn cồn (Alcohol lamp)
  {
    id: 'alcohol_lamp',
    name: 'Đèn cồn thí nghiệm',
    category: 'heat_stand',
    categoryLabel: 'Gia nhiệt & Giá đỡ',
    description: 'Nguồn cung cấp nhiệt bằng cồn $C_2H_5OH$, ngọn lửa 2 vùng nhiệt độ.',
    defaultCaption: 'Hình. Đèn cồn phòng thí nghiệm (nguồn cung cấp nhiệt độ).',
    tags: ['đèn cồn', 'ngọn lửa', 'gia nhiệt', 'nhiệt độ', 'đun nóng'],
    viewBox: '0 0 100 110',
    renderSvg: () => (
      <svg viewBox="0 0 100 110" className="w-full h-full drop-shadow-xs">
        {/* Flame */}
        <path
          d="M 50,6 C 35,22 42,38 50,45 C 58,38 65,22 50,6 Z"
          fill="#f59e0b"
          stroke="#ea580c"
          strokeWidth="2"
        />
        <path
          d="M 50,18 C 44,26 47,35 50,42 C 53,35 56,26 50,18 Z"
          fill="#38bdf8"
        />
        {/* Wick holder */}
        <rect x="42" y="44" width="16" height="8" fill="#475569" rx="1.5" stroke="#1e293b" strokeWidth="2" />
        {/* Lamp body */}
        <path
          d="M 40,52 L 60,52 L 82,88 C 86,95 82,102 75,102 L 25,102 C 18,102 14,95 18,88 Z"
          fill="#e2e8f0"
          stroke="#1e293b"
          strokeWidth="3"
        />
        {/* Alcohol liquid level */}
        <path
          d="M 26,76 L 74,76 L 79,94 C 81,99 77,100 74,100 L 26,100 C 23,100 19,99 21,94 Z"
          fill="#bae6fd"
          opacity="0.85"
        />
        <line x1="28" y1="76" x2="72" y2="76" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="3,2" />
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 300" width="360" height="300">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(130, 45)">
          <path d="M 50,6 C 35,22 42,38 50,45 C 58,38 65,22 50,6 Z" fill="#f59e0b" stroke="#ea580c" stroke-width="2.5" />
          <path d="M 50,18 C 44,26 47,35 50,42 C 53,35 56,26 50,18 Z" fill="#38bdf8" />
          <rect x="42" y="44" width="16" height="8" fill="#475569" rx="1.5" stroke="#0f172a" stroke-width="2.5" />
          <path d="M 40,52 L 60,52 L 85,92 C 89,99 85,106 78,106 L 22,106 C 15,106 11,99 15,92 Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="3.5" />
          <path d="M 24,78 L 76,78 L 81,98 C 83,103 79,104 76,104 L 24,104 C 21,104 17,103 19,98 Z" fill="#bae6fd" opacity="0.85" />
          <line x1="26" y1="78" x2="74" y2="78" stroke="#0284c7" stroke-width="2" stroke-dasharray="4,3" />
        </g>
        <text x="180" y="245" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Đèn cồn đốt phòng thí nghiệm</text>
      </svg>
    `,
  },

  // 5. Phễu chiết quả lê (Separating funnel)
  {
    id: 'separating_funnel',
    name: 'Phễu chiết quả lê',
    category: 'measurement',
    categoryLabel: 'Rót & Đo lường',
    description: 'Dụng cụ chiết tách 2 chất lỏng không tan vào nhau (vd este và nước), có khóa đóng ngắt.',
    defaultCaption: 'Hình. Phễu chiết quả lê dùng để tách các chất lỏng không trộn lẫn.',
    tags: ['phễu chiết', 'quả lê', 'tách chất', 'chiết', 'este', 'dầu'],
    viewBox: '0 0 100 160',
    renderSvg: () => (
      <svg viewBox="0 0 100 160" className="w-full h-full drop-shadow-xs">
        {/* Upper stopper */}
        <ellipse cx="50" cy="10" rx="12" ry="5" fill="#94a3b8" stroke="#1e293b" strokeWidth="2" />
        <rect x="46" y="10" width="8" height="8" fill="#64748b" stroke="#1e293b" strokeWidth="1.5" />
        {/* Pear bulb */}
        <path
          d="M 44,18 L 56,18 M 46,18 L 46,26 C 22,35 15,65 25,85 L 46,115 L 46,128 L 44,130 L 44,155 L 52,155 L 52,128 L 54,115 L 75,85 C 85,65 78,35 54,26 L 54,18"
          fill="#f8fafc"
          stroke="#1e293b"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Lower layer (water/salt) */}
        <path d="M 33,75 L 67,75 L 54,115 L 46,115 Z" fill="#93c5fd" opacity="0.8" />
        {/* Upper layer (ester/organic) */}
        <path d="M 25,48 C 22,58 24,68 33,75 L 67,75 C 76,68 78,58 75,48 Z" fill="#fde047" opacity="0.85" />
        {/* Stopcock */}
        <rect x="40" y="122" width="20" height="6" rx="2" fill="#ef4444" stroke="#991b1b" strokeWidth="1.5" />
        {/* Meniscus separator */}
        <line x1="33" y1="75" x2="67" y2="75" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="3,2" />
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 340" width="380" height="340">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(140, 30)">
          <ellipse cx="50" cy="10" rx="14" ry="5" fill="#94a3b8" stroke="#0f172a" stroke-width="2.5" />
          <rect x="45" y="10" width="10" height="10" fill="#64748b" stroke="#0f172a" stroke-width="2" />
          <path d="M 44,20 L 56,20 M 46,20 L 46,30 C 20,40 12,72 24,95 L 46,130 L 46,145 L 44,148 L 44,180 L 52,180 L 52,145 L 54,130 L 76,95 C 88,72 80,40 54,30 L 54,20" fill="#f8fafc" stroke="#0f172a" stroke-width="3" stroke-linejoin="round" />
          <path d="M 33,85 L 67,85 L 54,130 L 46,130 Z" fill="#60a5fa" opacity="0.8" />
          <path d="M 23,54 C 20,66 23,76 33,85 L 67,85 C 77,76 80,66 77,54 Z" fill="#fde047" opacity="0.85" />
          <line x1="33" y1="85" x2="67" y2="85" stroke="#0284c7" stroke-width="2" stroke-dasharray="4,3" />
          <rect x="38" y="138" width="24" height="8" rx="2" fill="#ef4444" stroke="#991b1b" stroke-width="2" />
        </g>
        <text x="190" y="295" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Phễu chiết quả lê (Tách 2 lớp chất lỏng không tan)</text>
      </svg>
    `,
  },

  // 6. Phễu thủy tinh thường (Glass conical funnel)
  {
    id: 'funnel',
    name: 'Phễu lọc thủy tinh',
    category: 'measurement',
    categoryLabel: 'Rót & Đo lường',
    description: 'Phễu hình nón kèm cuống dài vát chéo, dùng để lọc kết tủa hoặc rót chất lỏng.',
    defaultCaption: 'Hình. Phễu thủy tinh dùng để lọc tách kết tủa khỏi dung dịch.',
    tags: ['phễu', 'lọc', 'kết tủa', 'rót', 'giấy lọc'],
    viewBox: '0 0 90 120',
    renderSvg: () => (
      <svg viewBox="0 0 90 120" className="w-full h-full drop-shadow-xs">
        {/* Paper cone */}
        <polygon points="18,18 72,18 45,55" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
        {/* Glass body */}
        <path
          d="M 10,12 L 80,12 M 12,12 L 42,56 L 42,108 L 48,114 L 48,56 L 78,12"
          fill="none"
          stroke="#1e293b"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <line x1="42" y1="108" x2="48" y2="102" stroke="#1e293b" strokeWidth="2.5" />
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 300" width="360" height="300">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(135, 45)">
          <polygon points="20,18 70,18 45,55" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3,2" />
          <path d="M 10,12 L 80,12 M 12,12 L 42,56 L 42,120 L 48,128 L 48,56 L 78,12" fill="none" stroke="#0f172a" stroke-width="3.5" stroke-linejoin="round" />
        </g>
        <text x="180" y="250" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Phễu lọc thủy tinh có cuống vát</text>
      </svg>
    `,
  },

  // 7. Cốc thủy tinh chia vạch (Beaker)
  {
    id: 'beaker',
    name: 'Cốc thủy tinh chia vạch (Beaker)',
    category: 'reaction',
    categoryLabel: 'Chứa & Phản ứng',
    description: 'Cốc chịu nhiệt 250 mL có mỏ rót và vạch định mức mililit.',
    defaultCaption: 'Hình. Cốc thủy tinh chịu nhiệt chia vạch (Beaker 250 mL).',
    tags: ['cốc thủy tinh', 'beaker', 'mỏ rót', 'chia vạch', 'dung dịch'],
    viewBox: '0 0 100 120',
    renderSvg: () => (
      <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-xs">
        <defs>
          <clipPath id="tb-clip-beaker">
            <rect x="14" y="14" width="72" height="96" rx="5" />
          </clipPath>
        </defs>
        <rect x="14" y="55" width="72" height="60" fill="#0284c7" opacity="0.8" clipPath="url(#tb-clip-beaker)" />
        {/* Beaker outline with spout */}
        <path
          d="M 6,10 L 14,14 L 14,106 C 14,112 18,114 24,114 L 76,114 C 82,114 86,112 86,106 L 86,14 L 92,14"
          fill="none"
          stroke="#1e293b"
          strokeWidth="3"
        />
        {/* Ticks */}
        <line x1="22" y1="40" x2="38" y2="40" stroke="#475569" strokeWidth="2" />
        <line x1="22" y1="65" x2="45" y2="65" stroke="#475569" strokeWidth="2" />
        <line x1="22" y1="90" x2="38" y2="90" stroke="#475569" strokeWidth="2" />
        <text x="50" y="68" fontSize="8" fill="#475569" fontWeight="bold">150</text>
        <text x="44" y="93" fontSize="8" fill="#475569" fontWeight="bold">100</text>
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 300" width="360" height="300">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(130, 45)">
          <defs>
            <clipPath id="beaker-clip-standalone">
              <rect x="14" y="14" width="72" height="106" rx="6" />
            </clipPath>
          </defs>
          <rect x="14" y="60" width="72" height="70" fill="#0284c7" opacity="0.8" clipPath="url(#beaker-clip-standalone)" />
          <path d="M 6,10 L 14,14 L 14,116 C 14,122 18,124 24,124 L 76,124 C 82,124 86,122 86,116 L 86,14 L 92,14" fill="none" stroke="#0f172a" stroke-width="3.5" />
          <line x1="22" y1="45" x2="40" y2="45" stroke="#334155" stroke-width="2" />
          <line x1="22" y1="75" x2="48" y2="75" stroke="#334155" stroke-width="2" />
          <line x1="22" y1="105" x2="40" y2="105" stroke="#334155" stroke-width="2" />
          <text x="54" y="78" font-size="10" font-family="Arial, sans-serif" fill="#334155" font-weight="bold">150 mL</text>
          <text x="46" y="108" font-size="10" font-family="Arial, sans-serif" fill="#334155" font-weight="bold">100 mL</text>
        </g>
        <text x="180" y="255" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Cốc thủy tinh chia vạch chịu nhiệt (Beaker)</text>
      </svg>
    `,
  },

  // 8. Buret chuẩn độ có khóa (Burette)
  {
    id: 'burette',
    name: 'Buret chuẩn độ (Burette)',
    category: 'measurement',
    categoryLabel: 'Rót & Đo lường',
    description: 'Ống đo thể tích chính xác $0.1\\text{ mL}$ có khóa ngắt giọt, dùng trong chuẩn độ axit - bazơ.',
    defaultCaption: 'Hình. Buret chuẩn độ 25 mL có vạch chia chính xác và khóa dừng.',
    tags: ['buret', 'burette', 'chuẩn độ', 'axit', 'bazo', 'chính xác'],
    viewBox: '0 0 50 160',
    renderSvg: () => (
      <svg viewBox="0 0 50 160" className="w-full h-full drop-shadow-xs">
        {/* Solution */}
        <rect x="21" y="8" width="8" height="110" fill="#9333ea" opacity="0.75" />
        {/* Tube outline */}
        <path
          d="M 18,5 L 32,5 M 20,5 L 20,120 L 16,128 L 16,134 L 21,136 L 21,152 L 25,158 L 29,152 L 29,136 L 34,134 L 34,128 L 30,120 L 30,5"
          fill="none"
          stroke="#1e293b"
          strokeWidth="2.5"
        />
        {/* Stopcock */}
        <circle cx="25" cy="131" r="5" fill="#ef4444" stroke="#991b1b" strokeWidth="1.5" />
        {/* Ticks */}
        {[20, 35, 50, 65, 80, 95, 110].map((y) => (
          <line key={y} x1="20" y1={y} x2="26" y2={y} stroke="#334155" strokeWidth="1" />
        ))}
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 340" width="320" height="340">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(135, 20)">
          <rect x="21" y="8" width="8" height="170" fill="#9333ea" opacity="0.7" />
          <path d="M 16,5 L 34,5 M 20,5 L 20,185 L 16,195 L 16,204 L 21,207 L 21,235 L 25,244 L 29,235 L 29,207 L 34,204 L 34,195 L 30,185 L 30,5" fill="none" stroke="#0f172a" stroke-width="3" />
          <circle cx="25" cy="200" r="6" fill="#ef4444" stroke="#991b1b" stroke-width="2" />
          ${[25, 45, 65, 85, 105, 125, 145, 165].map((y) => `<line x1="20" y1="${y}" x2="28" y2="${y}" stroke="#334155" stroke-width="1.5"/>`).join('')}
        </g>
        <text x="160" y="300" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Buret chuẩn độ (Chia độ chính xác 0.1 mL)</text>
      </svg>
    `,
  },

  // 9. Kiềng sắt & lưới amiăng (Tripod & gauze)
  {
    id: 'tripod_wire',
    name: 'Kiềng sắt & Lưới amiăng',
    category: 'heat_stand',
    categoryLabel: 'Gia nhiệt & Giá đỡ',
    description: 'Kiềng 3 chân đỡ dụng cụ đun, có lưới thép bọc amiăng tản đều nhiệt chống vỡ.',
    defaultCaption: 'Hình. Kiềng sắt ba chân kết hợp lưới amiăng tản nhiệt.',
    tags: ['kiềng sắt', 'lưới amiăng', 'chân kiềng', 'đun nóng', 'giá đỡ'],
    viewBox: '0 0 100 100',
    renderSvg: () => (
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xs">
        {/* Gauze pad */}
        <rect x="14" y="12" width="72" height="8" fill="#94a3b8" rx="2" stroke="#1e293b" strokeWidth="2" />
        <ellipse cx="50" cy="16" rx="14" ry="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
        {/* 3 Legs */}
        <line x1="22" y1="20" x2="6" y2="92" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="50" y1="20" x2="50" y2="92" stroke="#334155" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="78" y1="20" x2="94" y2="92" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 280" width="360" height="280">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(130, 40)">
          <rect x="14" y="12" width="72" height="10" fill="#94a3b8" rx="2" stroke="#0f172a" stroke-width="2.5" />
          <ellipse cx="50" cy="17" rx="16" ry="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" />
          <line x1="22" y1="22" x2="6" y2="120" stroke="#0f172a" stroke-width="4" stroke-linecap="round" />
          <line x1="50" y1="22" x2="50" y2="120" stroke="#334155" stroke-width="4" stroke-linecap="round" />
          <line x1="78" y1="22" x2="94" y2="120" stroke="#0f172a" stroke-width="4" stroke-linecap="round" />
        </g>
        <text x="180" y="230" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Kiềng sắt ba chân kèm lưới amiăng tản nhiệt</text>
      </svg>
    `,
  },

  // 10. Giá sắt thí nghiệm có kẹp (Iron stand & clamp)
  {
    id: 'iron_stand',
    name: 'Giá sắt thí nghiệm có kẹp',
    category: 'heat_stand',
    categoryLabel: 'Gia nhiệt & Giá đỡ',
    description: 'Chân đế gang nặng, thanh đứng chịu lực và kẹp giữ ống nghiệm/buret.',
    defaultCaption: 'Hình. Giá sắt thí nghiệm đa năng kèm ngàm kẹp giữ dụng cụ.',
    tags: ['giá sắt', 'chân đế', 'kẹp', 'retort stand', 'giữ'],
    viewBox: '0 0 100 160',
    renderSvg: () => (
      <svg viewBox="0 0 100 160" className="w-full h-full drop-shadow-xs">
        {/* Base */}
        <rect x="10" y="145" width="75" height="10" fill="#334155" rx="2.5" stroke="#0f172a" strokeWidth="1.5" />
        {/* Rod */}
        <rect x="25" y="8" width="6" height="138" fill="#64748b" rx="1" stroke="#334155" strokeWidth="1" />
        {/* Clamp boss head & arm */}
        <rect x="21" y="55" width="14" height="10" fill="#0f172a" rx="1.5" />
        <path d="M 35,60 L 72,60" stroke="#0f172a" strokeWidth="3" fill="none" />
        <path d="M 68,48 C 82,48 82,72 68,72" stroke="#0f172a" strokeWidth="3" fill="none" />
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 340" width="340" height="340">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(120, 30)">
          <rect x="10" y="210" width="90" height="14" fill="#334155" rx="3" stroke="#0f172a" stroke-width="2" />
          <rect x="28" y="10" width="7" height="202" fill="#64748b" rx="1.5" stroke="#334155" stroke-width="1.5" />
          <rect x="23" y="75" width="18" height="14" fill="#0f172a" rx="2" />
          <path d="M 40,82 L 85,82" stroke="#0f172a" stroke-width="4" fill="none" />
          <path d="M 80,68 C 96,68 96,96 80,96" stroke="#0f172a" stroke-width="4" fill="none" />
        </g>
        <text x="170" y="300" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Giá sắt thí nghiệm có kẹp giữ</text>
      </svg>
    `,
  },

  // 11. Ống dẫn khí chữ L (L-tube)
  {
    id: 'tube_l',
    name: 'Ống dẫn khí thủy tinh chữ L',
    category: 'gas_transfer',
    categoryLabel: 'Dẫn & Thu khí',
    description: 'Ống thủy tinh uốn cong góc vuông $90^\\circ$ truyền dẫn khí từ bình phản ứng sang ống thu.',
    defaultCaption: 'Hình. Ống dẫn khí thủy tinh chữ L góc 90 độ.',
    tags: ['ống chữ l', 'dẫn khí', 'thủy tinh', 'thu khí'],
    viewBox: '0 0 80 80',
    renderSvg: () => (
      <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-xs">
        <path
          d="M 12,72 L 12,24 C 12,14 18,8 28,8 L 72,8"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M 12,72 L 12,24 C 12,14 18,8 28,8 L 72,8"
          fill="none"
          stroke="#0284c7"
          strokeWidth="2"
        />
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 280" width="320" height="280">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(100, 45)">
          <path d="M 15,120 L 15,35 C 15,18 25,12 40,12 L 120,12" fill="none" stroke="#38bdf8" stroke-width="12" stroke-linecap="round" />
          <path d="M 15,120 L 15,35 C 15,18 25,12 40,12 L 120,12" fill="none" stroke="#0284c7" stroke-width="3" />
        </g>
        <text x="160" y="235" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Ống dẫn khí thủy tinh chữ L (90°)</text>
      </svg>
    `,
  },

  // 12. Chậu thu khí qua nước (Water pneumatic trough)
  {
    id: 'trough_water',
    name: 'Chậu thu khí qua nước',
    category: 'gas_transfer',
    categoryLabel: 'Dẫn & Thu khí',
    description: 'Thu các khí ít hoặc không tan trong nước ($O_2, H_2, CH_4, C_2H_4$) bằng cách đẩy nước.',
    defaultCaption: 'Hình. Chậu thủy tinh chứa nước dùng để thu khí dời chỗ nước.',
    tags: ['chậu nước', 'thu khí', 'dời chỗ nước', 'pneumatic trough'],
    viewBox: '0 0 130 70',
    renderSvg: () => (
      <svg viewBox="0 0 130 70" className="w-full h-full drop-shadow-xs">
        <rect x="6" y="18" width="118" height="44" rx="5" fill="#38bdf8" opacity="0.35" />
        <path d="M 6,8 L 6,60 C 6,65 10,67 15,67 L 115,67 C 120,67 124,65 124,60 L 124,8" fill="none" stroke="#1e293b" strokeWidth="3" />
        <text x="65" y="45" textAnchor="middle" fontSize="11" fill="#0369a1" fontWeight="bold">
          Chậu nước
        </text>
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 260" width="380" height="260">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(60, 50)">
          <rect x="10" y="30" width="240" height="85" rx="6" fill="#38bdf8" opacity="0.4" />
          <path d="M 10,12 L 10,110 C 10,118 16,122 24,122 L 236,122 C 244,122 250,118 250,110 L 250,12" fill="none" stroke="#0f172a" stroke-width="4" />
          <text x="130" y="80" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#0369a1" font-weight="bold">Mặt nước thu khí</text>
        </g>
        <text x="190" y="225" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Chậu thủy tinh thu khí dời chỗ nước</text>
      </svg>
    `,
  },

  // 13. Nút cao su & Bông tẩm NaOH
  {
    id: 'cotton_plug',
    name: 'Bông tẩm kiềm (NaOH)',
    category: 'gas_transfer',
    categoryLabel: 'Dẫn & Thu khí',
    description: 'Miếng bông tẩm dung dịch NaOH đặc đậy miệng ống để hấp thụ khí độc dư thừa ($SO_2, Cl_2$).',
    defaultCaption: 'Hình. Nút bông tẩm dung dịch kiềm (NaOH) bảo vệ môi trường.',
    tags: ['bông naoh', 'kiềm', 'hấp thụ khí độc', 'so2', 'bảo vệ môi trường'],
    viewBox: '0 0 90 60',
    renderSvg: () => (
      <svg viewBox="0 0 90 60" className="w-full h-full drop-shadow-xs">
        <ellipse cx="45" cy="30" rx="36" ry="18" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="3,3" />
        <text x="45" y="34" textAnchor="middle" fontSize="11" fill="#0f172a" fontWeight="bold">
          Bông NaOH
        </text>
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 220" width="340" height="220">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(70, 45)">
          <ellipse cx="100" cy="50" rx="80" ry="38" fill="#f8fafc" stroke="#64748b" stroke-width="3" stroke-dasharray="5,4" />
          <text x="100" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#0f172a" font-weight="bold">Bông tẩm dung dịch NaOH</text>
        </g>
        <text x="170" y="180" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Nút bông tẩm kiềm ngăn khí độc thoát ra ngoài</text>
      </svg>
    `,
  },

  // 14. Nhiệt kế thủy ngân (Thermometer)
  {
    id: 'thermometer',
    name: 'Nhiệt kế thủy tinh',
    category: 'measurement',
    categoryLabel: 'Rót & Đo lường',
    description: 'Đo nhiệt độ hỗn hợp phản ứng ($170^\\circ\\text{C}$ điều chế etilen, $140^\\circ\\text{C}$ ete...).',
    defaultCaption: 'Hình. Nhiệt kế thủy ngân theo dõi nhiệt độ phản ứng.',
    tags: ['nhiệt kế', 'nhiệt độ', '170 độ', 'đo lường', 'thủy ngân'],
    viewBox: '0 0 40 150',
    renderSvg: () => (
      <svg viewBox="0 0 40 150" className="w-full h-full drop-shadow-xs">
        {/* Cap and stem */}
        <rect x="17" y="10" width="6" height="110" fill="#f1f5f9" stroke="#1e293b" strokeWidth="2" rx="3" />
        {/* Red mercury column */}
        <rect x="19" y="45" width="2" height="75" fill="#ef4444" />
        {/* Bulb */}
        <circle cx="20" cy="126" r="7" fill="#ef4444" stroke="#1e293b" strokeWidth="2" />
        {/* Ticks */}
        {[25, 45, 65, 85, 105].map((y) => (
          <line key={y} x1="14" y1={y} x2="17" y2={y} stroke="#334155" strokeWidth="1.5" />
        ))}
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(140, 30)">
          <rect x="16" y="10" width="8" height="180" fill="#f8fafc" stroke="#0f172a" stroke-width="2.5" rx="4" />
          <rect x="18.5" y="60" width="3" height="130" fill="#dc2626" />
          <circle cx="20" cy="198" r="10" fill="#dc2626" stroke="#0f172a" stroke-width="2.5" />
          ${[35, 65, 95, 125, 155].map((y) => `<line x1="12" y1="${y}" x2="16" y2="${y}" stroke="#334155" stroke-width="2"/>`).join('')}
          <text x="32" y="65" font-size="10" font-family="Arial, sans-serif" fill="#dc2626" font-weight="bold">170°C</text>
        </g>
        <text x="160" y="280" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Nhiệt kế theo dõi nhiệt độ phản ứng</text>
      </svg>
    `,
  },

  // 15. Cốc pin điện hóa Zn - Cu (Galvanic Daniell Cell)
  {
    id: 'battery_zn_cu',
    name: 'Mô hình Pin điện hóa Zn - Cu',
    category: 'electro_organic',
    categoryLabel: 'Điện hóa & Hóa hữu cơ',
    description: 'Pin Galvani kinh điển gồm thanh Zn nhúng $ZnSO_4$, Cu nhúng $CuSO_4$, cầu muối $KCl$ và vôn kế $1.10\\text{ V}$.',
    defaultCaption: 'Hình. Sơ đồ pin điện hóa Daniell (Zn - Cu) suất điện động chuẩn 1.10 V.',
    tags: ['pin điện hóa', 'zn-cu', 'daniell', 'cầu muối', 'vôn kế', 'thế điện cực'],
    viewBox: '0 0 200 120',
    renderSvg: () => (
      <svg viewBox="0 0 200 120" className="w-full h-full drop-shadow-xs">
        {/* Beaker 1 (Zn) */}
        <rect x="10" y="45" width="60" height="65" fill="#bae6fd" opacity="0.6" stroke="#334155" strokeWidth="2" rx="3" />
        <rect x="25" y="25" width="12" height="65" fill="#94a3b8" stroke="#334155" strokeWidth="1.5" />
        <text x="31" y="20" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">Zn (-)</text>
        <text x="40" y="80" textAnchor="middle" fontSize="8" fill="#0369a1" fontWeight="bold">ZnSO4</text>

        {/* Beaker 2 (Cu) */}
        <rect x="130" y="45" width="60" height="65" fill="#93c5fd" opacity="0.75" stroke="#334155" strokeWidth="2" rx="3" />
        <rect x="163" y="25" width="12" height="65" fill="#ea580c" stroke="#334155" strokeWidth="1.5" />
        <text x="169" y="20" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">Cu (+)</text>
        <text x="160" y="80" textAnchor="middle" fontSize="8" fill="#1e3a8a" fontWeight="bold">CuSO4</text>

        {/* Salt bridge */}
        <path d="M 55,55 L 55,28 C 55,18 145,18 145,28 L 145,55" fill="none" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" />
        <text x="100" y="16" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#b45309">Cầu muối KCl</text>

        {/* Voltmeter wire */}
        <path d="M 31,25 L 31,6 L 100,6" fill="none" stroke="#dc2626" strokeWidth="1.5" />
        <path d="M 169,25 L 169,6 L 100,6" fill="none" stroke="#dc2626" strokeWidth="1.5" />
        <circle cx="100" cy="6" r="9" fill="#ffffff" stroke="#dc2626" strokeWidth="1.5" />
        <text x="100" y="9" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#dc2626">1.10V</text>
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 300" width="460" height="300">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(45, 40)">
          <rect x="10" y="65" width="100" height="110" fill="#bae6fd" opacity="0.6" stroke="#1e293b" stroke-width="2.5" rx="5" />
          <rect x="40" y="30" width="20" height="115" fill="#94a3b8" stroke="#1e293b" stroke-width="2" />
          <text x="50" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">Anot (Zn -)</text>
          <text x="60" y="125" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#0369a1" font-weight="bold">dd ZnSO4 1M</text>

          <rect x="250" y="65" width="100" height="110" fill="#93c5fd" opacity="0.8" stroke="#1e293b" stroke-width="2.5" rx="5" />
          <rect x="290" y="30" width="20" height="115" fill="#ea580c" stroke="#1e293b" stroke-width="2" />
          <text x="300" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">Catot (Cu +)</text>
          <text x="300" y="125" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#1e3a8a" font-weight="bold">dd CuSO4 1M</text>

          <path d="M 85,85 L 85,42 C 85,25 275,25 275,42 L 275,85" fill="none" stroke="#f59e0b" stroke-width="12" stroke-linecap="round" />
          <text x="180" y="22" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#b45309">Cầu muối KCl</text>

          <path d="M 50,30 L 50,2 L 180,2" fill="none" stroke="#dc2626" stroke-width="2" />
          <path d="M 300,30 L 300,2 L 180,2" fill="none" stroke="#dc2626" stroke-width="2" />
          <circle cx="180" cy="2" r="14" fill="#ffffff" stroke="#dc2626" stroke-width="2.5" />
          <text x="180" y="6" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#dc2626">1.10 V</text>
        </g>
        <text x="230" y="260" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Sơ đồ nguyên lý hoạt động của pin điện hóa Zn - Cu</text>
      </svg>
    `,
  },

  // 16. Vòng benzen chuẩn (Benzene ring)
  {
    id: 'benzene',
    name: 'Vòng thơm Benzen (C6H6)',
    category: 'electro_organic',
    categoryLabel: 'Điện hóa & Hóa hữu cơ',
    description: 'Vòng thơm 6 cạnh đều kèm vòng tròn electron liên hợp theo quy chuẩn IUPAC.',
    defaultCaption: 'Hình. Cấu tạo nhân thơm Benzen (C6H6) chuẩn quốc tế.',
    tags: ['benzen', 'c6h6', 'nhân thơm', 'hữu cơ', 'hydrocarbon'],
    viewBox: '0 0 80 80',
    renderSvg: () => (
      <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-xs">
        <polygon points="40,6 72,24 72,60 40,78 8,60 8,24" fill="#f8fafc" stroke="#0f172a" strokeWidth="3" />
        <circle cx="40" cy="42" r="20" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeDasharray="4,3" />
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 240" width="300" height="240">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(100, 30)">
          <polygon points="50,8 90,32 90,78 50,102 10,78 10,32" fill="#f8fafc" stroke="#0f172a" stroke-width="4" stroke-linejoin="round" />
          <circle cx="50" cy="55" r="25" fill="none" stroke="#0f172a" stroke-width="3" stroke-dasharray="5,4" />
        </g>
        <text x="150" y="190" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Vòng thơm Benzen (Kekulé/IUPAC)</text>
      </svg>
    `,
  },

  // 17. Ống nhỏ giọt Pasteur (Dropper / Pipette)
  {
    id: 'pipette_dropper',
    name: 'Ống nhỏ giọt (Pipette Pasteur)',
    category: 'measurement',
    categoryLabel: 'Rót & Đo lường',
    description: 'Ống thủy tinh đầu vuốt nhọn có bóp cao su nhỏ giọt thuốc thử (chỉ thị, dung dịch ion).',
    defaultCaption: 'Hình. Ống nhỏ giọt Pasteur dùng để lấy từng giọt hóa chất.',
    tags: ['ống nhỏ giọt', 'pipette', 'giọt', 'pasteur', 'thuốc thử'],
    viewBox: '0 0 50 140',
    renderSvg: () => (
      <svg viewBox="0 0 50 140" className="w-full h-full drop-shadow-xs">
        {/* Rubber bulb */}
        <ellipse cx="25" cy="18" rx="14" ry="14" fill="#ef4444" stroke="#991b1b" strokeWidth="2" />
        {/* Glass stem */}
        <path d="M 21,32 L 21,95 L 23,122 L 27,122 L 29,95 L 29,32" fill="#f8fafc" stroke="#1e293b" strokeWidth="2.5" />
        {/* Droplet */}
        <circle cx="25" cy="132" r="3" fill="#38bdf8" />
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 300" width="320" height="300">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(135, 30)">
          <ellipse cx="25" cy="22" rx="18" ry="18" fill="#dc2626" stroke="#991b1b" stroke-width="3" />
          <path d="M 20,40 L 20,135 L 23,175 L 27,175 L 30,135 L 30,40" fill="#f8fafc" stroke="#0f172a" stroke-width="3.5" />
          <path d="M 25,188 C 22,194 22,198 25,202 C 28,198 28,194 25,188 Z" fill="#0284c7" />
        </g>
        <text x="160" y="260" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Ống nhỏ giọt Pasteur (Lấy từng giọt hóa chất)</text>
      </svg>
    `,
  },

  // 18. Ống đong hình trụ (Graduated cylinder)
  {
    id: 'cylinder',
    name: 'Ống đong hình trụ 100 mL',
    category: 'measurement',
    categoryLabel: 'Rót & Đo lường',
    description: 'Ống đong chia độ mililit, đế lục giác vững chắc dùng để đong thể tích chất lỏng.',
    defaultCaption: 'Hình. Ống đong hình trụ 100 mL đo thể tích chất lỏng.',
    tags: ['ống đong', 'đo thể tích', 'cylinder', 'mililit'],
    viewBox: '0 0 60 150',
    renderSvg: () => (
      <svg viewBox="0 0 60 150" className="w-full h-full drop-shadow-xs">
        {/* Hex base */}
        <polygon points="12,142 48,142 54,147 6,147" fill="#64748b" stroke="#1e293b" strokeWidth="2" />
        {/* Liquid */}
        <rect x="20" y="60" width="20" height="80" fill="#38bdf8" opacity="0.75" />
        {/* Cylinder body */}
        <path d="M 16,10 L 44,10 M 20,10 L 20,140 L 40,140 L 40,10" fill="none" stroke="#1e293b" strokeWidth="2.5" />
        {/* Graduations */}
        {[25, 45, 65, 85, 105, 125].map((y) => (
          <line key={y} x1="20" y1={y} x2="28" y2={y} stroke="#334155" strokeWidth="1.5" />
        ))}
      </svg>
    ),
    generateStandaloneSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <g transform="translate(130, 25)">
          <polygon points="10,185 50,185 58,193 2,193" fill="#475569" stroke="#0f172a" stroke-width="2.5" />
          <rect x="18" y="70" width="24" height="115" fill="#0284c7" opacity="0.8" />
          <path d="M 14,10 L 46,10 M 18,10 L 18,185 L 42,185 L 42,10" fill="none" stroke="#0f172a" stroke-width="3" />
          ${[25, 50, 75, 100, 125, 150, 175].map((y) => `<line x1="18" y1="${y}" x2="28" y2="${y}" stroke="#334155" stroke-width="2"/>`).join('')}
          <text x="32" y="103" font-size="10" font-family="Arial, sans-serif" fill="#334155" font-weight="bold">50 mL</text>
        </g>
        <text x="160" y="275" text-anchor="middle" font-family="'Times New Roman', serif" font-style="italic" font-size="14" fill="#1e293b">Ống đong hình trụ chia vạch 100 mL</text>
      </svg>
    `,
  },
];

export interface LaboratoryToolboxProps {
  onInsertToQuestion?: (apparatus: ApparatusItem, questionPart: '1' | '2' | '3' | 'essay', questionIndex: number) => void;
  onOpenInDrawModal?: (apparatus: ApparatusItem) => void;
  currentActiveQuestion?: { part: '1' | '2' | '3' | 'essay'; index: number };
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  totalQuestions?: { part1: number; part2: number; part3: number; essay: number };
}

export const LaboratoryToolbox: React.FC<LaboratoryToolboxProps> = ({
  onInsertToQuestion,
  onOpenInDrawModal,
  currentActiveQuestion,
  isCollapsed = false,
  onToggleCollapse,
  totalQuestions = { part1: 18, part2: 4, part3: 6, essay: 2 },
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedApparatus, setSelectedApparatus] = useState<ApparatusItem | null>(null);
  const [showQuickInsertModal, setShowQuickInsertModal] = useState(false);
  const [targetPart, setTargetPart] = useState<'1' | '2' | '3' | 'essay'>('1');
  const [targetIndex, setTargetIndex] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'Tất cả dụng cụ' },
    { id: 'reaction', label: 'Chứa & Phản ứng' },
    { id: 'heat_stand', label: 'Đun & Giá đỡ' },
    { id: 'measurement', label: 'Rót & Đo lường' },
    { id: 'gas_transfer', label: 'Dẫn & Thu khí' },
    { id: 'electro_organic', label: 'Điện hóa & Hữu cơ' },
  ];

  const filteredApparatuses = useMemo(() => {
    return APPARATUS_CATALOG.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Convert SVG string to data URL
  const getApparatusDataUrl = (apparatus: ApparatusItem): string => {
    const rawSvg = apparatus.generateStandaloneSvg();
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawSvg.trim())}`;
  };

  // Drag start handler: serializes apparatus metadata & image data into dataTransfer
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, apparatus: ApparatusItem) => {
    const dataUrl = getApparatusDataUrl(apparatus);
    const payload = {
      type: 'chem-apparatus',
      id: apparatus.id,
      name: apparatus.name,
      category: apparatus.category,
      caption: apparatus.defaultCaption,
      dataUrl,
    };

    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.setData('text/plain', apparatus.name);
    e.dataTransfer.effectAllowed = 'copy';

    // Set preview ghost if supported
    const ghost = document.createElement('div');
    ghost.style.position = 'absolute';
    ghost.style.top = '-9999px';
    ghost.style.padding = '8px 14px';
    ghost.style.background = '#0f172a';
    ghost.style.color = '#ffffff';
    ghost.style.borderRadius = '10px';
    ghost.style.fontSize = '12px';
    ghost.style.fontWeight = 'bold';
    ghost.style.border = '2px solid #38bdf8';
    ghost.innerText = `🧪 ${apparatus.name}`;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 20, 20);
    setTimeout(() => document.body.removeChild(ghost), 50);
  };

  const handleOpenInsertModal = (item: ApparatusItem) => {
    setSelectedApparatus(item);
    if (currentActiveQuestion) {
      setTargetPart(currentActiveQuestion.part);
      setTargetIndex(currentActiveQuestion.index);
    }
    setShowQuickInsertModal(true);
  };

  const handleConfirmInsert = () => {
    if (!selectedApparatus || !onInsertToQuestion) return;
    onInsertToQuestion(selectedApparatus, targetPart, targetIndex);
    showToast(`Đã chèn "${selectedApparatus.name}" vào Câu ${targetIndex + 1} (Phần ${targetPart.toUpperCase()})!`);
    setShowQuickInsertModal(false);
  };

  if (isCollapsed) {
    return (
      <div className="fixed right-0 top-36 z-40">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-2 bg-gradient-to-l from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-3.5 py-3 rounded-l-2xl shadow-xl transition-all cursor-pointer group"
          title="Mở Hộp Dụng Cụ Thí Nghiệm Hóa Học"
        >
          <div className="p-1 rounded-lg bg-white/20 group-hover:scale-110 transition-transform">
            <FlaskConical className="w-5 h-5 text-emerald-200" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold uppercase tracking-wider">Hộp Dụng Cụ</span>
            <span className="text-[10px] text-emerald-200 font-medium">Kéo thả thí nghiệm</span>
          </div>
          <ChevronLeft className="w-4 h-4 ml-1" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col w-full max-w-sm lg:max-w-md xl:max-w-lg transition-all h-[780px] sticky top-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-3 left-3 right-3 z-50 bg-slate-900/95 text-white text-xs px-3 py-2 rounded-xl shadow-lg border border-emerald-400 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-4 shrink-0 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 shadow-md">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              LABORATORY TOOLBOX
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
                {APPARATUS_CATALOG.length} dụng cụ
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Kéo thả trực tiếp vào câu hỏi hoặc chỉnh sửa trong Studio
            </p>
          </div>
        </div>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Thu gọn hộp dụng cụ"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Instructions Banner */}
      <div className="bg-emerald-50 border-b border-emerald-100 px-3.5 py-2 flex items-center gap-2 text-[11px] text-emerald-900 shrink-0">
        <Move className="w-3.5 h-3.5 text-emerald-600 shrink-0 animate-bounce" />
        <span>
          <strong>Cách dùng:</strong> Giữ chuột vào dụng cụ &amp; <strong>kéo thả vào thẻ câu hỏi</strong> bên trái!
        </span>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/70 space-y-2 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm dụng cụ (bình tam giác, ống nghiệm, đèn cồn...)"
            className="w-full pl-9 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Categories scroll pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] scrollbar-thin">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === c.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Grid (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2.5">
        {filteredApparatuses.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            className="group relative bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between hover:border-emerald-500 hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:bg-slate-50/40"
          >
            {/* Drag Handle Indicator */}
            <div className="absolute top-2 right-2 opacity-40 group-hover:opacity-100 transition-opacity">
              <Move className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
            </div>

            {/* SVG Apparatus Preview */}
            <div className="w-full h-28 flex items-center justify-center p-1 relative overflow-hidden bg-gradient-to-b from-slate-50 to-white rounded-lg border border-slate-100 group-hover:scale-105 transition-transform duration-200">
              {item.renderSvg()}
            </div>

            {/* Info */}
            <div className="mt-2 text-left space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                {item.categoryLabel}
              </span>
              <h4 className="text-xs font-bold text-slate-800 leading-tight group-hover:text-emerald-700 transition-colors">
                {item.name}
              </h4>
              <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                {item.description}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenInsertModal(item)}
                className="flex-1 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title="Chèn nhanh vào câu hỏi"
              >
                <Plus className="w-3 h-3" />
                <span>Chèn</span>
              </button>

              {onOpenInDrawModal && (
                <button
                  type="button"
                  onClick={() => onOpenInDrawModal(item)}
                  className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  title="Mở trong Studio vẽ để ghép nối thí nghiệm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredApparatuses.length === 0 && (
          <div className="col-span-2 text-center py-12 text-slate-400 space-y-2">
            <FlaskConical className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-medium text-slate-500">
              Không tìm thấy dụng cụ nào phù hợp với từ khóa "{searchQuery}"
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="text-xs text-emerald-600 hover:underline font-semibold"
            >
              Hiển thị lại tất cả dụng cụ
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Định dạng SVG Vector sắc nét</span>
        </span>
        <span className="font-semibold text-slate-700">Chuẩn GDPT 2018</span>
      </div>

      {/* Quick Insert Modal (When user clicks "Chèn" button instead of dragging) */}
      {showQuickInsertModal && selectedApparatus && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  🧪
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Chèn vào câu hỏi</h4>
                  <p className="text-xs text-slate-500">{selectedApparatus.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickInsertModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Chọn phần thi:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetPart('1');
                      setTargetIndex(0);
                    }}
                    className={`p-2 rounded-lg border font-medium text-left ${
                      targetPart === '1'
                        ? 'border-sky-500 bg-sky-50 text-sky-800 font-bold'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Phần I: TN 4 Lựa chọn
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetPart('2');
                      setTargetIndex(0);
                    }}
                    className={`p-2 rounded-lg border font-medium text-left ${
                      targetPart === '2'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-800 font-bold'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Phần II: Đúng / Sai
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetPart('3');
                      setTargetIndex(0);
                    }}
                    className={`p-2 rounded-lg border font-medium text-left ${
                      targetPart === '3'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Phần III: Trả lời ngắn
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetPart('essay');
                      setTargetIndex(0);
                    }}
                    className={`p-2 rounded-lg border font-medium text-left ${
                      targetPart === 'essay'
                        ? 'border-purple-500 bg-purple-50 text-purple-800 font-bold'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Phần Tự luận
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Chọn số thứ tự câu hỏi:
                </label>
                <select
                  value={targetIndex}
                  onChange={(e) => setTargetIndex(parseInt(e.target.value, 10))}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  {Array.from({
                    length:
                      targetPart === '1'
                        ? totalQuestions.part1
                        : targetPart === '2'
                        ? totalQuestions.part2
                        : targetPart === '3'
                        ? totalQuestions.part3
                        : totalQuestions.essay,
                  }).map((_, i) => (
                    <option key={i} value={i}>
                      Câu {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-600">
                <span className="font-semibold block text-slate-700 mb-0.5">Chú thích kèm theo:</span>
                <span className="italic">{selectedApparatus.defaultCaption}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowQuickInsertModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmInsert}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
              >
                Xác nhận chèn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
