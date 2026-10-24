import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/contrib/mhchem';
import { replaceInlineSvgTokens } from './ChemSvgToolbar';
import { normalizeBrokenFormulasToLatex } from '../utils/chemMathNormalizer';

interface MathChemViewProps {
  content: string;
  className?: string;
  autoNormalize?: boolean;
}

export const MathChemView: React.FC<MathChemViewProps> = ({
  content,
  className = '',
  autoNormalize = true,
}) => {
  const renderedContent = useMemo(() => {
    if (!content) return '';

    // 1. Auto-normalize broken chemical formulas (H2SO4, Fe3+, t0, --t0-->) into $\ce{...}$
    let processed = autoNormalize ? normalizeBrokenFormulasToLatex(content) : content;

    // 2. Also support standalone \ce{...} not wrapped in $...$
    processed = processed.replace(/(?<!\$)\\ce\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}(?!\$)/g, '$\\ce{$1}$');

    // 3. Pattern for $$...$$ (display mode)
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, equation) => {
      try {
        return `<span class="katex-display-wrapper block my-2 overflow-x-auto text-center">${katex.renderToString(
          equation,
          {
            displayMode: true,
            throwOnError: false,
            trust: true,
          }
        )}</span>`;
      } catch {
        return `$$${equation}$$`;
      }
    });

    // 4. Pattern for $...$ (inline mode)
    processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, equation) => {
      try {
        return `<span class="katex-inline-wrapper mx-0.5 inline-block">${katex.renderToString(
          equation,
          {
            displayMode: false,
            throwOnError: false,
            trust: true,
          }
        )}</span>`;
      } catch {
        return `$${equation}$`;
      }
    });

    // 5. Replace inline SVG tokens [svg:volumetric_flask], [svg:struct_benzene], etc.
    processed = replaceInlineSvgTokens(processed);

    // 6. Auto format remaining arrows or comparison operators
    processed = processed
      .replace(/->/g, '→')
      .replace(/<=>/g, '⇌')
      .replace(/<=/g, '≤')
      .replace(/>=/g, '≥');

    return processed;
  }, [content, autoNormalize]);

  return (
    <span
      className={`math-chem-text leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
};
