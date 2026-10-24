/**
 * Utility for normalizing broken Chemical, Atomic, Isotope & Mathematical formulas extracted from PDF files
 * into standard LaTeX / mhchem (\ce{...}) syntax, repairing split Vietnamese words from PDF spans,
 * and sanitizing leaked answer markers.
 */

/**
 * Repairs Vietnamese words that were split into separate tokens by PDF character spans
 * (e.g., "PH Ầ N" -> "PHẦN", "nguy ê n t ử" -> "nguyên tử") while preserving normal word spacing.
 */
export function repairSplitVietnameseWords(text: string): string {
  if (!text) return '';
  let s = text;

  // Normalize common section headers that may have intra-word spaces from PDF spans
  s = s.replace(/P\s*H\s*[ẦAÀ]\s*N\s+(I{1,3}|[123])\s*([.:])/gi, 'PHẦN $1$2 ');
  s = s.replace(/P\s*H\s*[ẦAÀ]\s*N\s+(I{1,3}|[123])\b/gi, 'PHẦN $1');
  s = s.replace(/C\s*[âa]\s*u\s+(\d+)\s*([.:])/gi, 'Câu $1$2 ');
  s = s.replace(/Đ\s*[áa]\s*p\s+[áa]\s*n\s*:/gi, 'Đáp án:');
  s = s.replace(/Đ\s*[áa]\s*p\s+s\s*[ốo]\s*/gi, 'Đáp số ');

  return s;
}

/**
 * Automatically converts broken PDF chemical formulas, electron configurations, isotopes, ions,
 * and reaction arrows (e.g. 1s22s22p63s23p6, 235 92U, C12H4Cl4O2, H2SO4, Fe3+, X2+, R+, t0)
 * into LaTeX / mhchem ($\ce{...}$) while preserving existing $...$ and $$...$$ LaTeX blocks and [svg:...] tokens.
 */
export function normalizeBrokenFormulasToLatex(input: string): string {
  if (!input) return '';

  const repairedInput = repairSplitVietnameseWords(input);

  // Split by existing math blocks ($$...$$ or $...$) and [svg:...] tokens so we don't double-wrap them
  const tokenRegex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$|\[svg:[a-zA-Z0-9_-]+\])/g;
  const parts = repairedInput.split(tokenRegex);

  return parts
    .map((segment) => {
      if (
        (segment.startsWith('$') && segment.endsWith('$')) ||
        (segment.startsWith('[svg:') && segment.endsWith(']'))
      ) {
        return segment;
      }

      let s = segment;

      // 1. Electron configurations:
      // Multi-subshell configs like "1s22s22p63s23p63d104s2", "1s2 2s2 2p6 3s2 3p6", "[Ne]3s23p1", "[Ar]3d54s1"
      s = s.replace(
        /(\[(?:He|Ne|Ar|Kr|Xe)\]\s*)?(?:(?:[1-7]s\^?[12]|[2-7]p\^?[1-6]|[3-6]d\^?(?:10(?=[1-7][spdf]|\s|$|[.,;:])|[1-9])|[4-5]f\^?(?:1[0-4](?=[1-7][spdf]|\s|$|[.,;:])|[1-9]))\s*)+/g,
        (match) => {
          const formatted = match
            .trim()
            .replace(/\[(He|Ne|Ar|Kr|Xe)\]/g, '[\\text{$1}]')
            .replace(
              /([1-7]s)\^?([12])|([2-7]p)\^?([1-6])|([3-6]d)\^?(10(?=[1-7][spdf]|\s|$)|[1-9])|([4-5]f)\^?(1[0-4](?=[1-7][spdf]|\s|$)|[1-9])/g,
              (_, sOrb, sE, pOrb, pE, dOrb, dE, fOrb, fE) => {
                const orb = sOrb || pOrb || dOrb || fOrb;
                const el = sE || pE || dE || fE;
                return `${orb}^{${el}}`;
              }
            )
            .replace(/\s+/g, '');
          const trailingSpace = /\s$/.test(match) ? ' ' : '';
          return `$${formatted}$${trailingSpace}`;
        }
      );

      // 2. Isotope notations from PDF (e.g. "235 92U", "238 92U", "14 6 X", "28 14 X", "40 18 X")
      s = s.replace(
        /(^|[\s(,;:])(\d{2,3})\s+(\d{1,2})\s*([A-Z][a-z]?)(?=$|[\s,.;:!?)/])/g,
        (match, prefix, massStr, atomicStr, sym) => {
          const mass = Number(massStr);
          const atomic = Number(atomicStr);
          if (mass >= atomic && atomic >= 1 && atomic <= 118) {
            return `${prefix}$^{${mass}}_{${atomic}}\\text{${sym}}$`;
          }
          return match;
        }
      );

      // Single mass-number isotopes like "nguyên tử 39X"
      s = s.replace(
        /(nguyên\s+tử\s+)(\d{1,3})([A-Z][a-z]?)(?=$|[\s,.;:!?)/])/gi,
        '$1$^{$2}\\text{$3}$'
      );

      // 3. Reaction arrows with conditions: --t0, xt-->, --t0-->, -t0->, -to->, --xt-->
      s = s.replace(
        /-+\s*(?:t0|t°|to|nhiệt độ)\s*,\s*(?:xt|xúc tác)\s*-+>/gi,
        ' $\\xrightarrow{t^\\circ, \\text{xt}}$ '
      );
      s = s.replace(/-+\s*(?:t0|t°|to)\s*-+>/gi, ' $\\xrightarrow{t^\\circ}$ ');
      s = s.replace(/-+\s*(?:xt|H2SO4\s*đặc|H\+)\s*-+>/gi, ' $\\xrightarrow{\\text{xt}}$ ');
      s = s.replace(
        /->\s*\(\s*(?:t0|t°|to)\s*,\s*xt\s*\)/gi,
        ' $\\xrightarrow{t^\\circ, \\text{xt}}$ '
      );
      s = s.replace(/->\s*\(\s*(?:t0|t°|to)\s*\)/gi, ' $\\xrightarrow{t^\\circ}$ ');

      // 4. Standalone temperature symbols: t0C, t0, t°C
      s = s.replace(/(^|[\s,(])t0C(?=[\s,.)]|$)/g, '$1$t^\\circ\\text{C}$');
      s = s.replace(/(^|[\s,(])t0(?=[\s,.)]|$)/g, '$1$t^\\circ$');

      // 5. Equilibrium & standard reaction arrows
      s = s.replace(/\s*<=>\s*/g, ' $\\rightleftharpoons$ ');
      s = s.replace(/\s*<->\s*/g, ' $\\rightleftharpoons$ ');

      // 6. Common polyatomic ions with charges
      s = s.replace(
        /\b(SO4|CO3|SO3|CrO4|Cr2O7|HPO4)\^?2-(?=$|[\s,.;:!?)/])/g,
        '$\\ce{$1^{2-}}$'
      );
      s = s.replace(/\b(PO4)\^?3-(?=$|[\s,.;:!?)/])/g, '$\\ce{$1^{3-}}$');
      s = s.replace(
        /\b(NO3|NO2|HCO3|HSO4|HSO3|ClO4|ClO3|ClO|MnO4|AlO2|CH3COO|OH)\^?-(?=$|[\s,.;:!?)/])/g,
        '$\\ce{$1-}$'
      );
      s = s.replace(/\b(NH4|H3O)\^?\+(?=$|[\s,.;:!?)/])/g, '$\\ce{$1+}$');

      // 7. Metal, monatomic & generic ions (Fe3+, Fe2+, X2+, R+, X+, M2+, etc.)
      s = s.replace(
        /\b(Fe|Al|Cr|Au|X|M|R|Y)\^?3\+(?=$|[\s,.;:!?)/])/g,
        '$\\ce{$1^{3+}}$'
      );
      s = s.replace(
        /\b(Fe|Cu|Ca|Ba|Mg|Zn|Pb|Sn|Ni|Mn|Hg|Be|Sr|X|M|R|Y)\^?2\+(?=$|[\s,.;:!?)/])/g,
        '$\\ce{$1^{2+}}$'
      );
      s = s.replace(
        /\b(Ag|Na|K|Li|H|Cu|R|X|M|Y)\^?\+(?=$|[\s,.;:!?)/])/g,
        '$\\ce{$1+}$'
      );
      s = s.replace(/\b(S|O|X|Y)\^?2-(?=$|[\s,.;:!?)/])/g, '$\\ce{$1^{2-}}$');

      // 8. Multi-element chemical formulas with subscripts:
      // e.g. C12H4Cl4O2, RX2, MX3, Cu(OH)2, Fe(OH)3, (C17H35COO)3C3H5, CH3COOC2H5
      s = s.replace(
        /(^|[\s(,;:])(\[?(?:[A-Z][a-z]?\d*|\([A-Za-z0-9]+\)\d+){2,}\]?(?:\^\d*[+-])?)(?=$|[\s,.;:!?)/])/g,
        (match, prefix, formula) => {
          if (!/\d/.test(formula)) return match;
          if (/^(?:A|B|C|D|P|M|V|U|I|R|Z|E)\d{1,2}$/.test(formula)) return match;
          if (/^(?:MP3|MP4|A4|A3|B5|G7|G20|F1|F2|K12)$/i.test(formula)) return match;
          return `${prefix}$\\ce{${formula}}$`;
        }
      );

      // 9. Simple diatomic/triatomic molecules with digits
      s = s.replace(
        /(^|[\s(,;:])(H2O2|H2O|H2SO4|H2SO3|HNO3|H3PO4|H2CO3|H2S|CO2|SO2|SO3|NO2|N2O|N2O5|P2O5|NH3|CH4|C2H4|C2H2|C2H6|C6H6|C6H12O6|C12H22O11|H2|O2|N2|Cl2|Br2|I2|O3)(?=$|[\s,.;:!?)/])/g,
        '$1$\\ce{$2}$'
      );

      return s;
    })
    .join('');
}

/**
 * Strips any leaked answer indicators from option text or question text
 * (e.g., leading asterisk "*A.", trailing "(Đúng)", "Đáp án: 125", "Đáp số 22.", standalone "A. 2", "---Hết---")
 * so the student test view never leaks the correct answer.
 */
export function stripLeakedAnswerMarkers(text: string): string {
  if (!text) return '';
  return text
    .replace(/^\s*\*\s*/, '')
    .replace(/\s*\*\s*$/, '')
    .replace(/<\/?u>/gi, '')
    .replace(/\[(?:Đáp án|ĐÁP ÁN|Correct|GẠCH CHÂN|TÔ ĐỎ|IN ĐẬM)[^\]]*\]/gi, '')
    .replace(/\((?:Đáp án đúng|Đúng|Sai)\)\s*$/gi, '')
    .replace(/(?:^|\n)\s*(?:Đáp\s*án|Đáp\s*số|ĐS|Kết\s*quả)\s*[:\-]?\s*-?[0-9]+(?:[.,][0-9]+)?\.?\s*(?:---Hết---)?\s*$/gi, '')
    .replace(/\s*---+\s*Hết\s*---+\s*$/gi, '')
    .trim();
}
