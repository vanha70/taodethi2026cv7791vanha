import {
  Part1Question,
  Part2Question,
  Part3Question,
  EssayQuestion,
  CognitiveLevel,
  PdfQuestionCropBox,
} from '../types/exam';
import {
  normalizeBrokenFormulasToLatex,
  stripLeakedAnswerMarkers,
  repairSplitVietnameseWords,
} from './chemMathNormalizer';

declare global {
  interface Window {
    pdfjsLib?: any;
    SmilesDrawer?: any;
  }
}

export interface AutoCroppedFigure {
  id: string;
  label: string;
  dataUrl: string;
  partHint?: 1 | 2 | 3;
  questionHint?: number;
  seqInPartHint?: number;
  globalQuestionHint?: number;
  cropBox?: PdfQuestionCropBox;
}

export interface AutoSlicedQuestion {
  id: string;
  partHint: 1 | 2 | 3;
  questionHint: number; // Original question number in PDF (e.g. 1..28 or 1..18, 1..4, 1..6)
  seqInPartHint: number; // 1-based index within its Part
  pageNumber: number;
  pdfSliceUrl: string;
  stemSliceUrl?: string;
  cropBox: PdfQuestionCropBox;
}

export interface RenderedPdfPage {
  pageNumber: number;
  dataUrl: string;
  cleanDataUrl?: string; // Page image with answer underlines & Part III answer lines erased
  diagramSourceDataUrl?: string; // Page image with all prose text lines masked to pure #FFFFFF for clean diagram-only cropping
  width: number;
  height: number;
  extractedText: string;
  autoCroppedFigures: AutoCroppedFigure[];
  autoSlicedQuestions?: AutoSlicedQuestion[];
}

export interface ParsedPdfExamResult {
  part1: Part1Question[];
  part2: Part2Question[];
  part3: Part3Question[];
  essay: EssayQuestion[];
  detectedAnswerSummary: {
    part1Count: number;
    part2Count: number;
    part3Count: number;
    detectionMethods: string[];
  };
  rawExtractedText: string;
  pages: RenderedPdfPage[];
}

interface PdfUnderlineRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Step 3 (Pixel Bounding Box Detection):
 * Scans a region on the prose-masked canvas for non-white pixels (R < 245 || G < 245 || B < 245).
 * If the detected non-white bounding box has height > 25px and width > 40px, it is guaranteed to be an illustration
 * (photo, lab experiment diagram, Pauli orbital box, structural formula, or table).
 * Returns the tight bounding box [tightX, tightY, tightW, tightH] + white padding (10px).
 */
function getCanvasNonWhiteBounds(
  ctx: CanvasRenderingContext2D,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
  pixelThreshold: number = 245,
  minHeightPx: number = 25,
  minWidthPx: number = 40,
  paddingPx: number = 10
): { hasContent: boolean; tightX: number; tightY: number; tightW: number; tightH: number } {
  const safeX = Math.max(0, Math.round(cropX));
  const safeY = Math.max(0, Math.round(cropY));
  const safeW = Math.min(ctx.canvas.width - safeX, Math.round(cropW));
  const safeH = Math.min(ctx.canvas.height - safeY, Math.round(cropH));

  if (safeW <= 12 || safeH <= 12) {
    return { hasContent: false, tightX: safeX, tightY: safeY, tightW: safeW, tightH: safeH };
  }
  const imgData = ctx.getImageData(safeX, safeY, safeW, safeH);
  const data = imgData.data;

  let minRow = safeH;
  let maxRow = -1;
  let minCol = safeW;
  let maxCol = -1;
  let nonWhiteCount = 0;

  for (let r = 0; r < safeH; r++) {
    let rowDark = 0;
    let rowMinC = safeW;
    let rowMaxC = -1;
    for (let c = 0; c < safeW; c++) {
      const idx = (r * safeW + c) * 4;
      if (
        data[idx] < pixelThreshold ||
        data[idx + 1] < pixelThreshold ||
        data[idx + 2] < pixelThreshold
      ) {
        rowDark++;
        nonWhiteCount++;
        if (c < rowMinC) rowMinC = c;
        if (c > rowMaxC) rowMaxC = c;
      }
    }
    if (rowDark >= 2) {
      if (r < minRow) minRow = r;
      if (r > maxRow) maxRow = r;
      if (rowMinC < minCol) minCol = rowMinC;
      if (rowMaxC > maxCol) maxCol = rowMaxC;
    }
  }

  const contentHeight = maxRow - minRow;
  const contentWidth = maxCol - minCol;
  if (nonWhiteCount < 25 || contentHeight <= minHeightPx || contentWidth <= minWidthPx) {
    return { hasContent: false, tightX: safeX, tightY: safeY, tightW: safeW, tightH: safeH };
  }

  const tightY = Math.max(0, safeY + minRow - paddingPx);
  const tightBottom = Math.min(ctx.canvas.height, safeY + maxRow + paddingPx);
  const tightX = Math.max(0, safeX + minCol - paddingPx);
  const tightRight = Math.min(ctx.canvas.width, safeX + maxCol + paddingPx);

  return {
    hasContent: true,
    tightX,
    tightY,
    tightW: Math.max(40, tightRight - tightX),
    tightH: Math.max(26, tightBottom - tightY),
  };
}

/**
 * Exports a HTMLCanvasElement to a compressed Base64 Data URL:
 * Uses `image/jpeg` at quality 0.8 (or `image/webp` when requested) for crisp, fast-loading diagrams.
 */
export function canvasToCompressedDataUrl(
  canvas: HTMLCanvasElement,
  webpQuality: number = 0.78,
  jpegFallbackQuality: number = 0.8
): string {
  try {
    const jpegUrl = canvas.toDataURL('image/jpeg', jpegFallbackQuality);
    if (jpegUrl && jpegUrl.startsWith('data:image/jpeg')) {
      return jpegUrl;
    }
  } catch {
    // Fallback below
  }
  try {
    const webpUrl = canvas.toDataURL('image/webp', webpQuality);
    if (webpUrl && webpUrl.startsWith('data:image/webp')) {
      return webpUrl;
    }
  } catch {
    // Ignore
  }
  return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Helper to crop an isolated diagram region from a source canvas into a crisp Base64 image (`image/jpeg`, quality: 0.8)
 * with a clean flat #FFFFFF white padding border (10px) on all 4 sides.
 */
function exportCanvasSliceToDataUrl(
  sourceCanvas: HTMLCanvasElement,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
  maxOutputWidth: number = 960,
  jpegQuality: number = 0.8
): string {
  const safeX = Math.max(0, Math.round(cropX));
  const safeY = Math.max(0, Math.round(cropY));
  const safeW = Math.max(20, Math.min(sourceCanvas.width - safeX, Math.round(cropW)));
  const safeH = Math.max(20, Math.min(sourceCanvas.height - safeY, Math.round(cropH)));

  const scaleDown = safeW > maxOutputWidth ? maxOutputWidth / safeW : 1;
  const innerW = Math.max(20, Math.round(safeW * scaleDown));
  const innerH = Math.max(20, Math.round(safeH * scaleDown));
  const whitePad = 10;
  const outW = innerW + whitePad * 2;
  const outH = innerH + whitePad * 2;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return '';

  outCtx.fillStyle = '#FFFFFF';
  outCtx.fillRect(0, 0, outW, outH);
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(sourceCanvas, safeX, safeY, safeW, safeH, whitePad, whitePad, innerW, innerH);
  return outCanvas.toDataURL('image/jpeg', jpegQuality);
}

/**
 * Allows Teacher to re-crop a diagram region on demand (e.g. expanding/shrinking top or bottom bounds).
 */
export function cropRegionFromRenderedPage(
  page: RenderedPdfPage,
  cropBox: PdfQuestionCropBox,
  useCleanPage: boolean = true
): Promise<string> {
  return new Promise((resolve) => {
    const srcUrl =
      useCleanPage && (page.diagramSourceDataUrl || page.cleanDataUrl)
        ? page.diagramSourceDataUrl || page.cleanDataUrl!
        : page.dataUrl;
    const img = new Image();
    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) {
        resolve('');
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      ctx.drawImage(img, 0, 0);

      const xStart = cropBox.xStart ?? Math.round(tempCanvas.width * 0.055);
      const xEnd = cropBox.xEnd ?? Math.round(tempCanvas.width * 0.945);
      const yStart = Math.max(0, Math.min(tempCanvas.height - 20, Math.round(cropBox.yStart)));
      const yEnd = Math.max(yStart + 24, Math.min(tempCanvas.height, Math.round(cropBox.yEnd)));

      const dataUrl = exportCanvasSliceToDataUrl(
        tempCanvas,
        xStart,
        yStart,
        xEnd - xStart,
        yEnd - yStart,
        960,
        0.8
      );
      resolve(dataUrl);
    };
    img.onerror = () => resolve('');
    img.src = srcUrl;
  });
}

/**
 * Checks if there is a horizontal underline bar rendered on the canvas right below a token at (pdfX, pdfY).
 */
function hasCanvasUnderlineBelowToken(
  ctx: CanvasRenderingContext2D,
  pdfX: number,
  pdfY: number,
  scale: number,
  viewportHeight: number
): boolean {
  const cx = Math.round(pdfX * scale);
  const baselineY = Math.round(viewportHeight - pdfY * scale);
  const stripW = Math.round(10 * (scale / 2.0));
  const stripH = Math.round(7 * (scale / 2.0));
  const startX = Math.max(0, cx + 1);
  const startY = Math.max(0, baselineY + 2);

  if (startX + stripW >= ctx.canvas.width || startY + stripH >= ctx.canvas.height) {
    return false;
  }

  const data = ctx.getImageData(startX, startY, stripW, stripH).data;
  for (let r = 0; r < stripH; r++) {
    let darkPixelsInRow = 0;
    for (let c = 0; c < stripW; c++) {
      const idx = (r * stripW + c) * 4;
      if (data[idx] < 195 || data[idx + 1] < 195 || data[idx + 2] < 195) {
        darkPixelsInRow++;
      }
    }
    if (darkPixelsInRow >= 6) {
      return true;
    }
  }
  return false;
}

/**
 * Extracts text, underline/bold/color answer hints, and 100% accurate cropped diagrams (autoCroppedFigures)
 * from an uploaded PDF file using PDF.js via:
 * - Step 1: High-res auxiliary <canvas> rendering (scale: 2.0, #FFFFFF background)
 * - Step 2: White-out (ctx.fillStyle = '#FFFFFF') question stem & option text items while preserving internal diagram labels
 * - Step 3: Pixel Bounding Box Detection (R < 245 || G < 245 || B < 245, height > 25px, width > 40px, padding: 10px)
 * - Fallback Gap Detection: Mandatory cropping when vertical gap Delta Y > 45px between stem and options or within stem
 */
export async function extractPdfDocumentPages(file: File | Blob): Promise<{
  pages: RenderedPdfPage[];
  fullText: string;
}> {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) {
    throw new Error('Thư viện PDF.js chưa sẵn sàng. Vui lòng tải lại trang.');
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const pages: RenderedPdfPage[] = [];
  const fullTextParts: string[] = [];

  // Track active section (Part I, II, III), sequential counters, and global question counter across page boundaries
  let currentPartAcrossPages: 1 | 2 | 3 = 1;
  let lastQuestionNumAcrossPages = 0;
  let globalQuestionCounter = 0;
  const seqCounterByPart: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    // Step 1: Render PDF page onto auxiliary <canvas> at high resolution (scale: 2.0), pure white #FFFFFF background
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
    }

    const pageDataUrl = canvas.toDataURL('image/jpeg', 0.85);

    // 2. Extract underline rectangles from PDF operator list (e.g. Word underline "x y w h re f*")
    const underlineRects: PdfUnderlineRect[] = [];
    try {
      const opList = await page.getOperatorList();
      const fnArray: number[] = opList.fnArray || [];
      const argsArray: any[] = opList.argsArray || [];
      const constructPathOp = pdfjsLib.OPS?.constructPath ?? 91;
      const rectOp = pdfjsLib.OPS?.rectangle ?? 19;

      for (let i = 0; i < fnArray.length; i++) {
        if (fnArray[i] === constructPathOp && Array.isArray(argsArray[i])) {
          const ops = argsArray[i][0];
          const coords = argsArray[i][1];
          if (coords && coords.length >= 4) {
            if (ops && ops[0] === rectOp) {
              const rx = Number(coords[0]);
              const ry = Number(coords[1]);
              const rw = Number(coords[2]);
              const rh = Number(coords[3]);
              if (Math.abs(rh) <= 3.2 && Math.abs(rw) >= 3.0 && Math.abs(rw) <= 55) {
                underlineRects.push({
                  x: Math.min(rx, rx + rw),
                  y: Math.min(ry, ry + rh),
                  w: Math.abs(rw),
                  h: Math.abs(rh),
                });
              }
            } else {
              let minX = Infinity;
              let maxX = -Infinity;
              let minY = Infinity;
              let maxY = -Infinity;
              for (let k = 0; k < coords.length - 1; k += 2) {
                const px = Number(coords[k]);
                const py = Number(coords[k + 1]);
                if (px < minX) minX = px;
                if (px > maxX) maxX = px;
                if (py < minY) minY = py;
                if (py > maxY) maxY = py;
              }
              const rw = maxX - minX;
              const rh = maxY - minY;
              if (rh <= 3.2 && rw >= 3.0 && rw <= 55) {
                underlineRects.push({ x: minX, y: minY, w: rw, h: rh });
              }
            }
          }
        }
      }
    } catch {
      // Fallback to canvas pixel underline detection below
    }

    // Create a clean copy of the page canvas with underline bars erased so cropped diagrams
    // never leak underlined answers (A., B., C., D. or a), b), c), d)) to students
    const cleanCanvas = document.createElement('canvas');
    cleanCanvas.width = canvas.width;
    cleanCanvas.height = canvas.height;
    const cleanCtx = cleanCanvas.getContext('2d');
    if (cleanCtx) {
      cleanCtx.fillStyle = '#FFFFFF';
      cleanCtx.fillRect(0, 0, cleanCanvas.width, cleanCanvas.height);
      cleanCtx.drawImage(canvas, 0, 0);
      cleanCtx.fillStyle = '#FFFFFF';
      for (const uRect of underlineRects) {
        const ux = Math.max(0, Math.floor(uRect.x * scale) - 3);
        const uy = Math.max(0, Math.floor(viewport.height - (uRect.y + uRect.h) * scale) - 2);
        const uw = Math.ceil(uRect.w * scale) + 6;
        const uh = Math.ceil(uRect.h * scale) + 5;
        cleanCtx.fillRect(ux, uy, uw, uh);
      }
    }

    // 3. Extract text items with PDF coordinates and font sizes
    const textContent = await page.getTextContent();
    const styles = textContent.styles || {};

    interface RawPdfTextItem {
      str: string;
      pdfX: number;
      pdfY: number;
      pdfWidth: number;
      fontSize: number;
      canvasX: number;
      canvasY: number;
      isBold: boolean;
    }

    const rawItems: RawPdfTextItem[] = (textContent.items || [])
      .filter((it: any) => it.str && it.str.trim().length > 0)
      .map((it: any) => {
        const tx = it.transform || [1, 0, 0, 1, 0, 0];
        const pdfX = Number(tx[4] || 0);
        const pdfY = Number(tx[5] || 0);
        const fontSize = Math.hypot(Number(tx[0] || 12), Number(tx[1] || 0)) || Number(it.height || 12);
        const pdfWidth = Number(it.width || fontSize * 0.5 * it.str.length);
        const fontName = String(it.fontName || '');
        const fontObj = styles[fontName] || {};
        const fontFamily = String(fontObj.fontFamily || '');
        const isBold = /bold|black|heavy|demi/i.test(fontName + ' ' + fontFamily);
        const rawStr = String(it.str);
        const normalizedStr = typeof rawStr.normalize === 'function' ? rawStr.normalize('NFC') : rawStr;

        return {
          str: normalizedStr,
          pdfX,
          pdfY,
          pdfWidth,
          fontSize,
          canvasX: pdfX * scale,
          canvasY: viewport.height - pdfY * scale,
          isBold,
        };
      });

    // Separate main-line items (fontSize >= 9.5) from small superscript/subscript/isotope items (fontSize < 9.5)
    const mainItems = rawItems.filter((it) => it.fontSize >= 9.5);
    const smallItems = rawItems.filter((it) => it.fontSize < 9.5);

    // Sort main items top-to-bottom (higher pdfY first), then left-to-right
    mainItems.sort((a, b) => {
      if (Math.abs(a.pdfY - b.pdfY) > 5.0) {
        return b.pdfY - a.pdfY;
      }
      return a.pdfX - b.pdfX;
    });

    interface LineCluster {
      pdfY: number;
      canvasY: number;
      items: RawPdfTextItem[];
    }

    const clusters: LineCluster[] = [];
    for (const item of mainItems) {
      const existing = clusters.find((c) => Math.abs(c.pdfY - item.pdfY) <= 5.5);
      if (existing) {
        existing.items.push(item);
      } else {
        clusters.push({
          pdfY: item.pdfY,
          canvasY: item.canvasY,
          items: [item],
        });
      }
    }

    // Attach small superscript/subscript/isotope items to their nearest main line cluster (within 11pt)
    for (const sm of smallItems) {
      let bestCluster: LineCluster | null = null;
      let bestDist = Infinity;
      for (const c of clusters) {
        const dist = Math.abs(c.pdfY - sm.pdfY);
        if (dist <= 11.5 && dist < bestDist) {
          bestDist = dist;
          bestCluster = c;
        }
      }
      if (bestCluster) {
        bestCluster.items.push(sm);
      } else {
        clusters.push({
          pdfY: sm.pdfY,
          canvasY: sm.canvasY,
          items: [sm],
        });
      }
    }

    // Sort clusters top-to-bottom by canvasY
    clusters.sort((a, b) => a.canvasY - b.canvasY);

    // Helper to check if a token at (pdfX, pdfY) is underlined
    const isTokenUnderlined = (pdfX: number, pdfY: number): boolean => {
      const matchedRect = underlineRects.some(
        (u) =>
          Math.abs(u.x - pdfX) <= 13 &&
          pdfY - u.y >= -1.0 &&
          pdfY - u.y <= 6.5
      );
      if (matchedRect) return true;
      if (ctx) {
        return hasCanvasUnderlineBelowToken(ctx, pdfX, pdfY, scale, viewport.height);
      }
      return false;
    };

    interface ReconstructedPdfLine {
      y: number; // baseline in canvas px
      pdfY: number; // baseline in PDF pt
      top: number; // top of ascenders & diacritics in canvas px
      bottom: number; // bottom of descenders & subscripts in canvas px
      minX: number;
      maxX: number;
      maxTokenGapPt: number;
      wordCount: number;
      text: string;
      items: RawPdfTextItem[];
      part: 1 | 2 | 3;
      origQuestionNum: number;
      seqInPart: number;
      globalQuestionNum: number;
      isSectionHeaderOrFooter: boolean;
      isQuestionStart: boolean;
      isImageOnlyOptionLine: boolean;
      isOptionOrAnswerLine: boolean;
      isProseLine: boolean;
    }

    const lines: ReconstructedPdfLine[] = [];

    for (const cluster of clusters) {
      const clusterSmall = cluster.items.filter((it) => it.fontSize < 9.5);
      const clusterNormal = cluster.items.filter((it) => it.fontSize >= 9.5);
      const usedSmall = new Set<RawPdfTextItem>();
      const mergedClusterItems: RawPdfTextItem[] = [...clusterNormal];

      for (let i = 0; i < clusterSmall.length; i++) {
        const s1 = clusterSmall[i];
        if (usedSmall.has(s1)) continue;
        let paired: RawPdfTextItem | null = null;
        for (let j = i + 1; j < clusterSmall.length; j++) {
          const s2 = clusterSmall[j];
          if (usedSmall.has(s2)) continue;
          if (
            Math.abs(s1.pdfX - s2.pdfX) <= 8.0 &&
            Math.abs(s1.pdfY - s2.pdfY) >= 4.0
          ) {
            paired = s2;
            break;
          }
        }
        if (paired) {
          usedSmall.add(s1);
          usedSmall.add(paired);
          const topItem = s1.pdfY >= paired.pdfY ? s1 : paired;
          const botItem = s1.pdfY >= paired.pdfY ? paired : s1;
          mergedClusterItems.push({
            str: ` ${topItem.str.trim()} ${botItem.str.trim()} `,
            pdfX: Math.min(topItem.pdfX, botItem.pdfX),
            pdfY: cluster.pdfY,
            pdfWidth: Math.max(topItem.pdfWidth, botItem.pdfWidth),
            fontSize: 12,
            canvasX: Math.min(topItem.canvasX, botItem.canvasX),
            canvasY: cluster.canvasY,
            isBold: false,
          });
        } else {
          mergedClusterItems.push(s1);
        }
      }

      // Sort left-to-right by pdfX
      mergedClusterItems.sort((a, b) => a.pdfX - b.pdfX);

      // Group adjacent glyph spans into word tokens when horizontal gap <= 1.8pt
      interface WordToken {
        text: string;
        pdfX: number;
        pdfY: number;
        endPdfX: number;
      }

      const wordTokens: WordToken[] = [];
      let maxTokenGapPt = 0;
      for (const it of mergedClusterItems) {
        const prev = wordTokens[wordTokens.length - 1];
        if (!prev) {
          wordTokens.push({
            text: it.str,
            pdfX: it.pdfX,
            pdfY: cluster.pdfY,
            endPdfX: it.pdfX + it.pdfWidth,
          });
        } else {
          const gapPt = it.pdfX - prev.endPdfX;
          if (gapPt <= 1.8 && !prev.text.endsWith(' ') && !it.str.startsWith(' ')) {
            prev.text += it.str;
            prev.endPdfX = Math.max(prev.endPdfX, it.pdfX + it.pdfWidth);
          } else {
            if (gapPt > maxTokenGapPt) {
              maxTokenGapPt = gapPt;
            }
            wordTokens.push({
              text: it.str,
              pdfX: it.pdfX,
              pdfY: cluster.pdfY,
              endPdfX: it.pdfX + it.pdfWidth,
            });
          }
        }
      }

      // Mark underlined option labels (A., B., C., D.) and Part II statement labels (a), b), c), d)) with leading '*'
      // AND proactively erase any underline area right beneath A., B., C., D., a), b), c), d) on cleanCanvas!
      const formattedTokens = wordTokens.map((wt) => {
        const trimmed = wt.text.trim();
        if (/^(?:[A-D]\.|[a-d]\))/.test(trimmed)) {
          if (cleanCtx) {
            cleanCtx.fillStyle = '#FFFFFF';
            const eraseX = Math.max(0, Math.floor(wt.pdfX * scale) - 3);
            const eraseY = Math.max(0, Math.round(viewport.height - wt.pdfY * scale) + 2);
            cleanCtx.fillRect(
              eraseX,
              eraseY,
              Math.round(30 * (scale / 2.0)),
              Math.round(8 * (scale / 2.0))
            );
          }
          if (isTokenUnderlined(wt.pdfX, wt.pdfY)) {
            return `*${trimmed}`;
          }
        }
        return trimmed;
      });

      const lineText = formattedTokens.join(' ').replace(/\s+/g, ' ').trim();
      if (lineText) {
        let lineTop = canvas.height;
        let lineBottom = 0;
        let lineMinX = canvas.width;
        let lineMaxX = 0;

        for (const it of cluster.items) {
          const itTop = Math.floor(it.canvasY - it.fontSize * scale * 1.2);
          const itBottom = Math.ceil(it.canvasY + it.fontSize * scale * 0.46);
          const itLeft = Math.floor(it.canvasX);
          const itRight = Math.ceil(it.canvasX + it.pdfWidth * scale);
          if (itTop < lineTop) lineTop = itTop;
          if (itBottom > lineBottom) lineBottom = itBottom;
          if (itLeft < lineMinX) lineMinX = itLeft;
          if (itRight > lineMaxX) lineMaxX = itRight;
        }

        lines.push({
          y: cluster.canvasY,
          pdfY: cluster.pdfY,
          top: Math.max(0, lineTop),
          bottom: Math.min(canvas.height, lineBottom),
          minX: Math.max(0, lineMinX),
          maxX: Math.min(canvas.width, lineMaxX),
          maxTokenGapPt,
          wordCount: lineText.split(/\s+/).length,
          text: lineText,
          items: cluster.items,
          part: currentPartAcrossPages,
          origQuestionNum: Math.max(1, lastQuestionNumAcrossPages),
          seqInPart: Math.max(1, seqCounterByPart[currentPartAcrossPages]),
          globalQuestionNum: Math.max(1, globalQuestionCounter),
          isSectionHeaderOrFooter: false,
          isQuestionStart: false,
          isImageOnlyOptionLine: false,
          isOptionOrAnswerLine: false,
          isProseLine: false,
        });
      }
    }

    // Determine standard left margin X of question starts on this page
    const questionStartMinXs: number[] = [];
    for (const L of lines) {
      const rep = repairSplitVietnameseWords(L.text);
      if (/^(\*?\s*Câu\s+\d+)\s*[.:]/i.test(rep) || /^\s*PHẦN\s*(?:I|II|III|1|2|3)\b/i.test(rep)) {
        questionStartMinXs.push(L.minX);
      }
    }
    questionStartMinXs.sort((a, b) => a - b);
    const pageLeftMarginX =
      questionStartMinXs.length > 0
        ? questionStartMinXs[Math.floor(questionStartMinXs.length * 0.25)]
        : Math.round(canvas.width * 0.085);

    // 4. First pass over lines: detect section headers, footers, and question starts ("Câu X.")
    let seenFirstQuestionOnPage1 = pageNum > 1;
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      const repairedLine = repairSplitVietnameseWords(L.text);

      // Detect section headers & footers
      if (/^(?:[I123]+\.\s*)?PHẦN\s*(?:III|3)\b/i.test(repairedLine.trim())) {
        currentPartAcrossPages = 3;
        L.isSectionHeaderOrFooter = true;
        L.isProseLine = true;
      } else if (/^(?:[I123]+\.\s*)?PHẦN\s*(?:II|2)\b/i.test(repairedLine.trim())) {
        currentPartAcrossPages = 2;
        L.isSectionHeaderOrFooter = true;
        L.isProseLine = true;
      } else if (/^(?:[I123]+\.\s*)?PHẦN\s*(?:I|1)\b/i.test(repairedLine.trim())) {
        currentPartAcrossPages = 1;
        L.isSectionHeaderOrFooter = true;
        L.isProseLine = true;
      } else if (
        /(?:^|\s)(?:BẢNG\s*ĐÁP\s*ÁN|ĐÁP\s*ÁN\s*CHẤM|HƯỚNG\s*DẪN\s*CHẤM|---+\s*Hết\s*---+)/i.test(
          repairedLine
        ) ||
        (L.y > canvas.height * 0.91 && /^(?:Trang\s+\d+|Mã\s*đề)/i.test(repairedLine.trim()))
      ) {
        L.isSectionHeaderOrFooter = true;
        L.isProseLine = true;
      }

      // Detect Question start "Câu X."
      const qStartMatch = repairedLine.match(/^(\*?\s*Câu\s+(\d+))\s*[.:]/i);
      if (qStartMatch) {
        seenFirstQuestionOnPage1 = true;
        const origNum = Number(qStartMatch[2]);

        // Look ahead up to next "Câu" or section header to see if this question has a), b), c), d)
        let hasSubItemsLookahead = false;
        let hasABCDLookahead = false;
        for (let k = i + 1; k < lines.length; k++) {
          const nextRep = repairSplitVietnameseWords(lines[k].text);
          if (/^(\*?\s*Câu\s+\d+)\s*[.:]/i.test(nextRep) || /^\s*PHẦN\s*(?:I|II|III|1|2|3)\b/i.test(nextRep)) {
            break;
          }
          if (/^\s*\*?[a-d]\s*\)/i.test(nextRep)) {
            hasSubItemsLookahead = true;
          }
          if (/(?:^|\s)\*?[A-D]\s*\./.test(nextRep)) {
            hasABCDLookahead = true;
          }
        }

        if (hasSubItemsLookahead && !hasABCDLookahead) {
          currentPartAcrossPages = 2;
        } else if (origNum >= 23 && origNum <= 28 && !hasABCDLookahead && !hasSubItemsLookahead) {
          currentPartAcrossPages = 3;
        } else if (origNum >= 19 && origNum <= 22 && !hasABCDLookahead) {
          currentPartAcrossPages = 2;
        } else if (origNum === 1 && lastQuestionNumAcrossPages >= 10 && currentPartAcrossPages === 1) {
          currentPartAcrossPages = 2;
        } else if (origNum === 1 && currentPartAcrossPages === 2 && seqCounterByPart[2] >= 2 && !hasSubItemsLookahead) {
          currentPartAcrossPages = 3;
        }

        lastQuestionNumAcrossPages = origNum;
        seqCounterByPart[currentPartAcrossPages] += 1;
        globalQuestionCounter += 1;
        L.isQuestionStart = true;
        L.isProseLine = true;
      } else if (!seenFirstQuestionOnPage1 && pageNum === 1) {
        // Exam header lines above Câu 1 on Page 1
        L.isSectionHeaderOrFooter = true;
        L.isProseLine = true;
      }

      L.part = currentPartAcrossPages;
      L.origQuestionNum = Math.max(1, lastQuestionNumAcrossPages);
      L.seqInPart = Math.max(1, seqCounterByPart[currentPartAcrossPages]);
      L.globalQuestionNum = Math.max(1, globalQuestionCounter);
    }

    // Group lines on this page into QuestionPageBlocks so we can accurately white-out stem & option prose
    // while preserving 100% of internal diagram labels ('Anode', 'Cathode', 'Xăng E5', 'Lớp K, L, M, N', etc.)
    interface QuestionPageBlock {
      startIdx: number;
      endIdx: number;
      firstTextOptionIdx: number;
      hasImageOnlyOptionLine: boolean;
      part: 1 | 2 | 3;
      origQuestionNum: number;
      seqInPart: number;
      globalQuestionNum: number;
      regionTopY: number;
      regionBottomY: number;
    }

    const questionBlocks: QuestionPageBlock[] = [];
    let currentBlockStart = -1;

    // If pageNum > 1 and the page starts with continuation lines of the previous page's last question
    if (pageNum > 1 && lines.length > 0 && !lines[0].isQuestionStart && !lines[0].isSectionHeaderOrFooter) {
      currentBlockStart = 0;
    }

    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      if (L.isSectionHeaderOrFooter) {
        if (currentBlockStart !== -1 && i - 1 >= currentBlockStart) {
          const refL = lines[currentBlockStart];
          questionBlocks.push({
            startIdx: currentBlockStart,
            endIdx: i - 1,
            firstTextOptionIdx: -1,
            hasImageOnlyOptionLine: false,
            part: refL.part,
            origQuestionNum: refL.origQuestionNum,
            seqInPart: refL.seqInPart,
            globalQuestionNum: refL.globalQuestionNum,
            regionTopY: lines[currentBlockStart].isQuestionStart
              ? lines[currentBlockStart].top
              : Math.round(32 * (scale / 2.0)),
            regionBottomY: Math.max(0, L.top - Math.round(6 * (scale / 2.0))),
          });
        }
        currentBlockStart = -1;
        continue;
      }

      if (L.isQuestionStart) {
        if (currentBlockStart !== -1 && i - 1 >= currentBlockStart) {
          const refL = lines[currentBlockStart];
          questionBlocks.push({
            startIdx: currentBlockStart,
            endIdx: i - 1,
            firstTextOptionIdx: -1,
            hasImageOnlyOptionLine: false,
            part: refL.part,
            origQuestionNum: refL.origQuestionNum,
            seqInPart: refL.seqInPart,
            globalQuestionNum: refL.globalQuestionNum,
            regionTopY: lines[currentBlockStart].isQuestionStart
              ? lines[currentBlockStart].top
              : Math.round(32 * (scale / 2.0)),
            regionBottomY: Math.max(0, L.top - Math.round(6 * (scale / 2.0))),
          });
        }
        currentBlockStart = i;
      }
    }

    if (currentBlockStart !== -1 && lines.length - 1 >= currentBlockStart) {
      const refL = lines[currentBlockStart];
      questionBlocks.push({
        startIdx: currentBlockStart,
        endIdx: lines.length - 1,
        firstTextOptionIdx: -1,
        hasImageOnlyOptionLine: false,
        part: refL.part,
        origQuestionNum: refL.origQuestionNum,
        seqInPart: refL.seqInPart,
        globalQuestionNum: refL.globalQuestionNum,
        regionTopY: lines[currentBlockStart].isQuestionStart
          ? lines[currentBlockStart].top
          : Math.round(32 * (scale / 2.0)),
        regionBottomY: Math.min(
          Math.round(canvas.height * 0.94),
          lines[lines.length - 1].bottom + Math.round(220 * (scale / 2.0))
        ),
      });
    }

    // Step 2 Classification inside each QuestionPageBlock:
    // Mark Top Stem Paragraph, Bottom Stem Prompt, and Options (A,B,C,D / a,b,c,d) as isProseLine = true
    // while keeping internal diagram labels ('Anode', 'Cathode', 'Xăng E5', 'Lớp K, L, M, N', orbital box labels) as isProseLine = false!
    for (const block of questionBlocks) {
      let hasEnteredOptions = false;
      for (let i = block.startIdx; i <= block.endIdx; i++) {
        const L = lines[i];
        const repairedLine = repairSplitVietnameseWords(L.text);

        // Detect image-only / Pauli orbital box option line in Part I (e.g. Câu 14: "A. B. C. *D.")
        const textWithoutOptionLabels = repairedLine
          .replace(/\*?[A-D]\s*\./g, '')
          .replace(/\s+/g, '')
          .trim();
        const isImgOnlyOpt =
          block.part === 1 &&
          /(?:^|\s)\*?[A-D]\s*\./.test(repairedLine) &&
          textWithoutOptionLabels.length === 0;

        if (isImgOnlyOpt) {
          L.isImageOnlyOptionLine = true;
          block.hasImageOnlyOptionLine = true;
          continue;
        }

        // Detect Part III inline answer lines (e.g. "Đáp án: 125", "Đáp số 22.", or standalone "A. 2")
        const isPart3AnswerLine =
          /^\s*(?:Đáp\s*án|Đáp\s*số|ĐS|Kết\s*quả)\s*[:\-]?\s*-?[0-9]+/i.test(repairedLine) ||
          (block.part === 3 && /^\s*\*?A\s*[.:]\s*-?[0-9]+(?:[.,][0-9]+)?\s*\.?\s*$/i.test(repairedLine));

        if (isPart3AnswerLine && cleanCtx) {
          cleanCtx.fillStyle = '#FFFFFF';
          const maskY = Math.max(0, L.top - Math.round(4 * (scale / 2.0)));
          const maskH = Math.min(
            cleanCanvas.height - maskY,
            L.bottom - maskY + Math.round(6 * (scale / 2.0))
          );
          cleanCtx.fillRect(0, maskY, cleanCanvas.width, maskH);
        }

        const isExplicitTextOption =
          (block.part === 1 && /(?:^|\s)\*?[A-D]\s*\./.test(repairedLine)) ||
          (block.part === 2 && /^\s*\*?[a-d]\s*\)/i.test(repairedLine)) ||
          isPart3AnswerLine;

        if (isExplicitTextOption) {
          if (block.firstTextOptionIdx === -1) {
            block.firstTextOptionIdx = i;
          }
          hasEnteredOptions = true;
          L.isOptionOrAnswerLine = true;
          L.isProseLine = true;
        } else if (hasEnteredOptions) {
          L.isOptionOrAnswerLine = true;
          L.isProseLine = true;
        }
      }

      // Walk Top Stem Continuation lines starting from block.startIdx
      if (lines[block.startIdx].isQuestionStart) {
        lines[block.startIdx].isProseLine = true;
        for (let i = block.startIdx + 1; i <= block.endIdx; i++) {
          const L = lines[i];
          if (L.isOptionOrAnswerLine || L.isImageOnlyOptionLine) break;
          const prevL = lines[i - 1];
          const vGap = L.top - prevL.bottom;
          const startsNearLeft = L.minX <= pageLeftMarginX + Math.round(36 * (scale / 2.0));
          const isNormalProseSpacing = L.maxTokenGapPt <= 28;
          if (vGap <= Math.round(22 * (scale / 2.0)) && startsNearLeft && isNormalProseSpacing) {
            L.isProseLine = true;
          } else {
            // Hit a diagram gap or indented/multi-column diagram label -> stop Top Stem Continuation
            break;
          }
        }
      }

      // Walk Bottom Stem Prompt lines immediately above block.firstTextOptionIdx (e.g., Câu 1 post-diagram question line)
      const optionAnchorIdx =
        block.firstTextOptionIdx !== -1 ? block.firstTextOptionIdx : block.endIdx + 1;
      for (let i = optionAnchorIdx - 1; i > block.startIdx; i--) {
        const L = lines[i];
        if (L.isProseLine || L.isImageOnlyOptionLine) break;
        const nextL = i + 1 < lines.length ? lines[i + 1] : null;
        const vGapToBelow = nextL ? nextL.top - L.bottom : 0;
        const startsNearLeft = L.minX <= pageLeftMarginX + Math.round(32 * (scale / 2.0));
        const isNormalProseSpacing = L.maxTokenGapPt <= 26;
        const repText = repairSplitVietnameseWords(L.text).trim();
        const looksLikeFullPromptSentence =
          L.wordCount >= 6 || (L.wordCount >= 4 && /[?:.]\s*$/.test(repText));

        if (
          vGapToBelow <= Math.round(26 * (scale / 2.0)) &&
          startsNearLeft &&
          isNormalProseSpacing &&
          looksLikeFullPromptSentence
        ) {
          L.isProseLine = true;
        } else {
          break;
        }
      }
    }

    // 5. Step 2: Create `proseMaskedCanvas`:
    // Use ctx.fillStyle = '#FFFFFF' to white-out all question stem prose lines and option lines (A,B,C,D / a,b,c,d)
    // while keeping internal diagram labels ('Anode', 'Cathode', 'Xăng E5', 'Lớp K, L, M, N', etc.) untouched!
    const proseMaskedCanvas = document.createElement('canvas');
    proseMaskedCanvas.width = cleanCanvas.width;
    proseMaskedCanvas.height = cleanCanvas.height;
    const proseMaskedCtx = proseMaskedCanvas.getContext('2d');
    if (proseMaskedCtx) {
      proseMaskedCtx.fillStyle = '#FFFFFF';
      proseMaskedCtx.fillRect(0, 0, proseMaskedCanvas.width, proseMaskedCanvas.height);
      proseMaskedCtx.drawImage(cleanCanvas, 0, 0);

      proseMaskedCtx.fillStyle = '#FFFFFF';
      const maskPadY = Math.round(4 * (scale / 2.0));
      for (const L of lines) {
        if (L.isProseLine) {
          const y0 = Math.max(0, L.top - maskPadY);
          const y1 = Math.min(proseMaskedCanvas.height, L.bottom + maskPadY);
          if (
            L.isSectionHeaderOrFooter ||
            L.isOptionOrAnswerLine ||
            L.maxX >= proseMaskedCanvas.width * 0.58
          ) {
            proseMaskedCtx.fillRect(0, y0, proseMaskedCanvas.width, y1 - y0);
          } else {
            const x0 = Math.max(0, L.minX - Math.round(12 * (scale / 2.0)));
            const x1 = Math.min(
              proseMaskedCanvas.width,
              L.maxX + Math.round(24 * (scale / 2.0))
            );
            proseMaskedCtx.fillRect(x0, y0, x1 - x0, y1 - y0);
          }
        }
      }
    }

    // 6. Step 3 (Pixel Bounding Box Detection) + Fallback Gap Detection (Delta Y > 45px):
    const autoCroppedFigures: AutoCroppedFigure[] = [];
    const diagramCtx = proseMaskedCtx || cleanCtx || ctx;
    const diagramCanvas = proseMaskedCtx ? proseMaskedCanvas : cleanCanvas;
    const cropX = Math.round(canvas.width * 0.045);
    const cropW = Math.round(canvas.width * 0.91);

    // Helper to register at most 1 figure per question on this page (keeping the largest/most complete diagram)
    const figureHeightByQuestionKey = new Map<string, number>();
    const registerQuestionFigure = (fig: AutoCroppedFigure, pixelHeight: number) => {
      const qKey = `${fig.partHint || 1}_${fig.seqInPartHint || 0}_${fig.questionHint || 0}`;
      const existingIdx = autoCroppedFigures.findIndex(
        (f) =>
          `${f.partHint || 1}_${f.seqInPartHint || 0}_${f.questionHint || 0}` === qKey
      );
      if (existingIdx === -1) {
        figureHeightByQuestionKey.set(qKey, pixelHeight);
        autoCroppedFigures.push(fig);
      } else {
        const prevHeight = figureHeightByQuestionKey.get(qKey) || 0;
        if (pixelHeight > prevHeight) {
          figureHeightByQuestionKey.set(qKey, pixelHeight);
          autoCroppedFigures[existingIdx] = fig;
        }
      }
    };

    if (diagramCtx && questionBlocks.length > 0) {
      for (const block of questionBlocks) {
        const qKey = `${block.part}_${block.seqInPart}_${block.origQuestionNum}`;
        const partRoman = block.part === 1 ? 'I' : block.part === 2 ? 'II' : 'III';

        // Primary Scan Window: from top of question block to top of first text option line (or bottom of question block)
        const primaryScanTop = Math.max(0, block.regionTopY);
        const primaryScanBottom =
          block.firstTextOptionIdx !== -1 && !block.hasImageOnlyOptionLine
            ? Math.max(primaryScanTop + 10, lines[block.firstTextOptionIdx].top - 2)
            : block.regionBottomY;

        // Step 3A: Scan primary window for non-white pixels (R < 245 || G < 245 || B < 245) with height > 25px and width > 40px
        if (primaryScanBottom - primaryScanTop > 25) {
          const primaryBounds = getCanvasNonWhiteBounds(
            diagramCtx,
            cropX,
            primaryScanTop,
            cropW,
            primaryScanBottom - primaryScanTop,
            245,
            25,
            40,
            10
          );
          if (primaryBounds.hasContent) {
            const dataUrl = exportCanvasSliceToDataUrl(
              diagramCanvas,
              primaryBounds.tightX,
              primaryBounds.tightY,
              primaryBounds.tightW,
              primaryBounds.tightH,
              960,
              0.8
            );
            if (dataUrl) {
              registerQuestionFigure(
                {
                  id: `fig_p${pageNum}_pt${block.part}_q${block.origQuestionNum}`,
                  label: `Trang ${pageNum} - Hình minh họa (Phần ${partRoman} - Câu ${block.origQuestionNum})`,
                  dataUrl,
                  partHint: block.part,
                  questionHint: block.origQuestionNum,
                  seqInPartHint: block.seqInPart,
                  globalQuestionHint: block.globalQuestionNum,
                  cropBox: {
                    pageNumber: pageNum,
                    yStart: primaryBounds.tightY,
                    yEnd: primaryBounds.tightY + primaryBounds.tightH,
                    xStart: primaryBounds.tightX,
                    xEnd: primaryBounds.tightX + primaryBounds.tightW,
                  },
                },
                primaryBounds.tightH
              );
            }
          }
        }

        // Step 3B: If not found in primary window, scan the full question vertical range [regionTopY, regionBottomY]
        // (catches orbital boxes in options like Câu 14 or diagrams placed beside/below options)
        if (!figureHeightByQuestionKey.has(qKey) && block.regionBottomY - primaryScanTop > 25) {
          const fullBounds = getCanvasNonWhiteBounds(
            diagramCtx,
            cropX,
            primaryScanTop,
            cropW,
            block.regionBottomY - primaryScanTop,
            245,
            25,
            40,
            10
          );
          if (fullBounds.hasContent) {
            const dataUrl = exportCanvasSliceToDataUrl(
              diagramCanvas,
              fullBounds.tightX,
              fullBounds.tightY,
              fullBounds.tightW,
              fullBounds.tightH,
              960,
              0.8
            );
            if (dataUrl) {
              registerQuestionFigure(
                {
                  id: `fig_p${pageNum}_pt${block.part}_q${block.origQuestionNum}_full`,
                  label: `Trang ${pageNum} - Hình minh họa (Phần ${partRoman} - Câu ${block.origQuestionNum})`,
                  dataUrl,
                  partHint: block.part,
                  questionHint: block.origQuestionNum,
                  seqInPartHint: block.seqInPart,
                  globalQuestionHint: block.globalQuestionNum,
                  cropBox: {
                    pageNumber: pageNum,
                    yStart: fullBounds.tightY,
                    yEnd: fullBounds.tightY + fullBounds.tightH,
                    xStart: fullBounds.tightX,
                    xEnd: fullBounds.tightX + fullBounds.tightW,
                  },
                },
                fullBounds.tightH
              );
            }
          }
        }

        // Step 3C (Fallback Gap Detection):
        // If vertical gap Delta Y > 45px between consecutive prose lines in the question (e.g. last stem line -> option A./a) or within stem),
        // mandatorily crop that gap region as question.image so no diagram is ever missed!
        const blockProseIndices: number[] = [];
        for (let i = block.startIdx; i <= block.endIdx; i++) {
          if (lines[i].isProseLine) {
            blockProseIndices.push(i);
          }
        }

        for (let pIdx = 0; pIdx < blockProseIndices.length - 1; pIdx++) {
          const proseA = lines[blockProseIndices[pIdx]];
          const proseB = lines[blockProseIndices[pIdx + 1]];
          if (proseA.isOptionOrAnswerLine) continue;

          const gapPx = proseB.top - proseA.bottom;
          if (gapPx > 45) {
            const gapTop = Math.max(0, proseA.bottom + 4);
            const gapBottom = Math.min(canvas.height, proseB.top - 4);
            const gapH = gapBottom - gapTop;
            if (gapH > 25 && !figureHeightByQuestionKey.has(qKey)) {
              const relaxedBounds = getCanvasNonWhiteBounds(
                diagramCtx,
                cropX,
                gapTop,
                cropW,
                gapH,
                250,
                16,
                24,
                10
              );
              const finalX = relaxedBounds.hasContent ? relaxedBounds.tightX : cropX;
              const finalY = relaxedBounds.hasContent ? relaxedBounds.tightY : gapTop;
              const finalW = relaxedBounds.hasContent ? relaxedBounds.tightW : cropW;
              const finalH = relaxedBounds.hasContent ? relaxedBounds.tightH : gapH;

              const dataUrl = exportCanvasSliceToDataUrl(
                diagramCanvas,
                finalX,
                finalY,
                finalW,
                finalH,
                960,
                0.8
              );
              if (dataUrl) {
                registerQuestionFigure(
                  {
                    id: `fig_p${pageNum}_pt${block.part}_q${block.origQuestionNum}_gap`,
                    label: `Trang ${pageNum} - Hình minh họa (Phần ${partRoman} - Câu ${block.origQuestionNum})`,
                    dataUrl,
                    partHint: block.part,
                    questionHint: block.origQuestionNum,
                    seqInPartHint: block.seqInPart,
                    globalQuestionHint: block.globalQuestionNum,
                    cropBox: {
                      pageNumber: pageNum,
                      yStart: finalY,
                      yEnd: finalY + finalH,
                      xStart: finalX,
                      xEnd: finalX + finalW,
                    },
                  },
                  finalH
                );
              }
            }
          }
        }
      }
    }

    const cleanPageDataUrl = cleanCanvas.toDataURL('image/jpeg', 0.85);
    const diagramSourceDataUrl = proseMaskedCanvas.toDataURL('image/jpeg', 0.85);
    const pageText = lines.map((l) => l.text).join('\n');
    fullTextParts.push(pageText);

    pages.push({
      pageNumber: pageNum,
      dataUrl: pageDataUrl,
      cleanDataUrl: cleanPageDataUrl,
      diagramSourceDataUrl,
      width: canvas.width,
      height: canvas.height,
      extractedText: pageText,
      autoCroppedFigures,
      autoSlicedQuestions: [],
    });
  }

  return {
    pages,
    fullText: fullTextParts.join('\n\n'),
  };
}

/**
 * Parses extracted PDF/raw text into the official 3-part structure:
 * - PHẦN I (Câu 1 -> 18): Multiple-choice A, B, C, D (0.25 pts each = 4.50 pts)
 * - PHẦN II (Câu 1 -> 4 / Câu 19 -> 22): True/False a), b), c), d) (max 1.0 pt each = 4.00 pts)
 * - PHẦN III (Câu 1 -> 6 / Câu 23 -> 28): Short Answer numeric (0.25 pts each = 1.50 pts)
 * Supports both section headers (PHẦN I., PHẦN II., PHẦN III: / PHẦN III.) AND structural detection.
 */
export function parseExamTextToStructuredData(
  rawText: string,
  autoFigures: AutoCroppedFigure[] = [],
  _autoSlices: AutoSlicedQuestion[] = []
): Omit<ParsedPdfExamResult, 'pages' | 'rawExtractedText'> {
  const detectionMethods = new Set<string>();
  const cleanedRawText = repairSplitVietnameseWords(rawText);

  // 1. Parse end-of-file Answer Key Table if present
  const answerTablePart1: Record<number, 'A' | 'B' | 'C' | 'D'> = {};
  const answerTablePart2: Record<number, Record<'a' | 'b' | 'c' | 'd', boolean>> = {};
  const answerTablePart3: Record<number, string> = {};

  const answerSectionMatch = cleanedRawText.match(
    /(?:BẢNG\s*ĐÁP\s*ÁN|ĐÁP\s*ÁN\s*CHẤM|HƯỚNG\s*DẪN\s*CHẤM)([\s\S]*)$/i
  );
  const mainBodyText = answerSectionMatch
    ? cleanedRawText.slice(0, answerSectionMatch.index).trim()
    : cleanedRawText;

  if (answerSectionMatch) {
    const ansSection = answerSectionMatch[1];
    const ansP2Idx = ansSection.search(/PHẦN\s*(?:II|2)\s*[.:]?/i);
    const ansP3Idx = ansSection.search(/PHẦN\s*(?:III|3)\s*[.:]?/i);

    const ansP1Slice =
      ansP2Idx >= 0
        ? ansSection.slice(0, ansP2Idx)
        : ansP3Idx >= 0
        ? ansSection.slice(0, ansP3Idx)
        : ansSection;
    const ansP2Slice =
      ansP2Idx >= 0
        ? ansSection.slice(ansP2Idx, ansP3Idx > ansP2Idx ? ansP3Idx : ansSection.length)
        : ansSection;
    const ansP3Slice = ansP3Idx >= 0 ? ansSection.slice(ansP3Idx) : '';

    const p1KeyRegex = /(?:Câu\s*)?(\d+)\s*[.:\-)\s]\s*([A-D])\b/gi;
    let m1: RegExpExecArray | null;
    while ((m1 = p1KeyRegex.exec(ansP1Slice)) !== null) {
      answerTablePart1[Number(m1[1])] = m1[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      detectionMethods.add('Bảng đáp án cuối trang (Phần I)');
    }

    const p2CompactRegex =
      /(?:Câu\s*)?(\d+)\s*[:.)\-]\s*(Đ|S|Đúng|Sai)\s*[\s,\-|/]+\s*(Đ|S|Đúng|Sai)\s*[\s,\-|/]+\s*(Đ|S|Đúng|Sai)\s*[\s,\-|/]+\s*(Đ|S|Đúng|Sai)/gi;
    let m2c: RegExpExecArray | null;
    while ((m2c = p2CompactRegex.exec(ansP2Slice)) !== null) {
      const qNum = Number(m2c[1]);
      const parseTF = (s: string) => /^đ/i.test(s.trim());
      answerTablePart2[qNum] = {
        a: parseTF(m2c[2]),
        b: parseTF(m2c[3]),
        c: parseTF(m2c[4]),
        d: parseTF(m2c[5]),
      };
      detectionMethods.add('Bảng đáp án cuối trang (Phần II)');
    }

    const p2LabeledLineRegex = /(?:Câu\s*)?(\d+)\s*[:.)\-]\s*([^\n]+)/gi;
    let m2l: RegExpExecArray | null;
    while ((m2l = p2LabeledLineRegex.exec(ansP2Slice)) !== null) {
      const qNum = Number(m2l[1]);
      const subMatches = [...m2l[2].matchAll(/([a-d])\s*[.):\-]?\s*(Đúng|Sai|Đ|S)\b/gi)];
      if (subMatches.length >= 2) {
        if (!answerTablePart2[qNum]) {
          answerTablePart2[qNum] = { a: true, b: false, c: true, d: false };
        }
        subMatches.forEach((sm) => {
          const lbl = sm[1].toLowerCase() as 'a' | 'b' | 'c' | 'd';
          answerTablePart2[qNum][lbl] = /^đ/i.test(sm[2]);
        });
        detectionMethods.add('Bảng đáp án cuối trang (Phần II)');
      }
    }

    if (ansP3Slice) {
      const p3Regex = /(?:Câu\s*)?(\d+)\s*[:.)\-]\s*(-?[0-9]+(?:[.,][0-9]+)?)/gi;
      let m3: RegExpExecArray | null;
      while ((m3 = p3Regex.exec(ansP3Slice)) !== null) {
        answerTablePart3[Number(m3[1])] = m3[2].replace(/\.$/, '').trim();
        detectionMethods.add('Bảng đáp án cuối trang (Phần III)');
      }
    }
  }

  // 2. Split sections using flexible regexes supporting both "PHẦN III:" and "PHẦN III."
  const part2HeaderRegex = /(?:^|\n)\s*PHẦN\s*(?:II|2)\s*[.:]?/i;
  const part3HeaderRegex = /(?:^|\n)\s*PHẦN\s*(?:III|3)\s*[.:]?/i;
  const essayHeaderRegex = /(?:^|\n)\s*PHẦN\s*(?:IV|4|TỰ\s*LUẬN)\s*[.:]?/i;

  const part2Index = mainBodyText.search(part2HeaderRegex);
  const part3Index = mainBodyText.search(part3HeaderRegex);
  const essayIndex = mainBodyText.search(essayHeaderRegex);

  const questionSplitRegex = /(?:^|\n)\s*(?=Câu\s+\d+\s*[.:])/gi;
  const rawBlocksWithOffsets: { text: string; offset: number }[] = [];
  let splitMatch: RegExpExecArray | null;
  const splitStarts: number[] = [];

  while ((splitMatch = questionSplitRegex.exec(mainBodyText)) !== null) {
    splitStarts.push(splitMatch.index);
  }

  for (let i = 0; i < splitStarts.length; i++) {
    const start = splitStarts[i];
    const end = i + 1 < splitStarts.length ? splitStarts[i + 1] : mainBodyText.length;
    let blockText = mainBodyText.slice(start, end).trim();

    blockText = blockText
      .replace(/(?:^|\n)\s*PHẦN\s*(?:II|III|IV|2|3|4|TỰ\s*LUẬN)\s*[.:][\s\S]*$/i, '')
      .replace(/\s*---+\s*Hết\s*---+\s*$/i, '')
      .trim();

    if (/^Câu\s+\d+/i.test(blockText)) {
      rawBlocksWithOffsets.push({ text: blockText, offset: start });
    }
  }

  const p1Blocks: { text: string; origNum: number; globalNum: number }[] = [];
  const p2Blocks: { text: string; origNum: number; globalNum: number }[] = [];
  const p3Blocks: { text: string; origNum: number; globalNum: number }[] = [];
  const essayBlocks: { text: string; origNum: number; globalNum: number }[] = [];

  rawBlocksWithOffsets.forEach((b, globalIdx) => {
    const qNumMatch = b.text.match(/^Câu\s+(\d+)\s*[.:]/i);
    const origNum = qNumMatch ? Number(qNumMatch[1]) : globalIdx + 1;
    const globalNum = globalIdx + 1;

    const hasSubItemsABCD =
      /(?:^|\n)\s*\*?a\s*\)/i.test(b.text) &&
      /(?:^|\n)\s*\*?b\s*\)/i.test(b.text) &&
      /(?:^|\n)\s*\*?c\s*\)/i.test(b.text) &&
      /(?:^|\n)\s*\*?d\s*\)/i.test(b.text);

    const hasMultipleChoiceABCD =
      /(?:^|\s|\n)\*?[A-D]\s*\*\s*[.)]|(?:^|\s|\n)\*?A\s*[.)][\s\S]+(?:^|\s|\n)\*?B\s*[.)][\s\S]+(?:^|\s|\n)\*?C\s*[.)]/i.test(
        b.text
      );

    const hasShortAnswerMarker =
      /(?:^|\n)\s*(?:Đáp\s*án|Đáp\s*số|ĐS|Kết\s*quả)\s*[:\-]?\s*-?[0-9]+/i.test(b.text) ||
      (!hasMultipleChoiceABCD &&
        !hasSubItemsABCD &&
        /(?:^|\n)\s*\*?A\s*[.:]\s*-?[0-9]+(?:[.,][0-9]+)?\s*\.?\s*$/i.test(b.text));

    if (essayIndex > 0 && b.offset >= essayIndex) {
      essayBlocks.push({ text: b.text, origNum, globalNum });
    } else if (hasSubItemsABCD && !hasMultipleChoiceABCD) {
      p2Blocks.push({ text: b.text, origNum, globalNum });
    } else if (
      (part3Index > 0 && b.offset >= part3Index) ||
      (hasShortAnswerMarker && !hasMultipleChoiceABCD) ||
      (origNum >= 23 && origNum <= 28 && !hasMultipleChoiceABCD && !hasSubItemsABCD)
    ) {
      p3Blocks.push({ text: b.text, origNum, globalNum });
    } else if (
      (part2Index > 0 && b.offset >= part2Index && (part3Index < 0 || b.offset < part3Index)) ||
      (origNum >= 19 && origNum <= 22 && !hasMultipleChoiceABCD)
    ) {
      p2Blocks.push({ text: b.text, origNum, globalNum });
    } else {
      p1Blocks.push({ text: b.text, origNum, globalNum });
    }
  });

  // Helper to match an isolated AutoCroppedFigure for (part, qId, origNum, globalNum)
  const findQuestionFigure = (
    part: 1 | 2 | 3,
    qId: number,
    origNum: number,
    globalNum: number
  ): AutoCroppedFigure | undefined => {
    return (
      autoFigures.find(
        (f) =>
          f.partHint === part &&
          (f.seqInPartHint === qId || f.questionHint === origNum || f.questionHint === qId)
      ) ||
      autoFigures.find((f) => f.globalQuestionHint === globalNum) ||
      autoFigures.find(
        (f) =>
          (f.partHint === part || (part === 1 && !f.partHint)) &&
          (f.questionHint === origNum || f.seqInPartHint === qId || f.questionHint === qId)
      )
    );
  };

  // 3. Parse Part I Questions (18 questions, 0.25 pts each = 4.50 pts)
  const part1: Part1Question[] = [];

  p1Blocks.forEach((bObj, idx) => {
    const qId = idx + 1;
    const origNum = bObj.origNum;
    const globalNum = bObj.globalNum;
    let body = bObj.text.replace(/^Câu\s+\d+\s*[.:]\s*/i, '').trim();

    let detectedAns: 'A' | 'B' | 'C' | 'D' =
      answerTablePart1[qId] || answerTablePart1[origNum] || 'A';
    let explanation = '';

    const inlineAnsMatch = body.match(
      /(?:^|\n)\s*(?:Đáp\s*án|ĐÁP\s*ÁN|Chọn)\s*[:\-]?\s*([A-D])\b/i
    );
    if (inlineAnsMatch) {
      detectedAns = inlineAnsMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      detectionMethods.add('Dòng đáp án trực tiếp');
      body = body.replace(inlineAnsMatch[0], '\n');
    }

    const expMatch = body.match(
      /(?:^|\n)\s*(?:Lời\s*giải|Giải\s*thích|Hướng\s*dẫn)\s*[:\-]?\s*([\s\S]+)$/i
    );
    if (expMatch) {
      explanation = normalizeBrokenFormulasToLatex(expMatch[1].trim());
      const chooseMatch = explanation.match(/Chọn\s+(?:đáp\s+án\s+)?([A-D])\b/i);
      if (chooseMatch) {
        detectedAns = chooseMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      }
      body = body.slice(0, expMatch.index).trim();
    }

    const optRegex =
      /(?:^|\s|\n)(\*+|<u>|\[GẠCH CHÂN\]|\[TÔ ĐỎ\]|\[IN ĐẬM\])?\s*([A-D])\s*(\*+)?\s*[.)](?=\s|$)/g;
    const matches: {
      letter: 'A' | 'B' | 'C' | 'D';
      markedCorrect: boolean;
      startIndex: number;
      contentStart: number;
    }[] = [];

    let mOpt: RegExpExecArray | null;
    while ((mOpt = optRegex.exec(body)) !== null) {
      const prefixMarker = mOpt[1] || '';
      const letter = mOpt[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      const suffixMarker = mOpt[3] || '';
      const markedCorrect = Boolean(prefixMarker || suffixMarker);
      matches.push({
        letter,
        markedCorrect,
        startIndex: mOpt.index,
        contentStart: mOpt.index + mOpt[0].length,
      });
    }

    const activeMatches = matches.length > 4 ? matches.slice(-4) : matches;

    let questionStem = body;
    const options: { A: string; B: string; C: string; D: string } = {
      A: 'Phương án A',
      B: 'Phương án B',
      C: 'Phương án C',
      D: 'Phương án D',
    };

    const matchedFig = findQuestionFigure(1, qId, origNum, globalNum);

    if (activeMatches.length >= 2) {
      questionStem = body.slice(0, activeMatches[0].startIndex).trim();
      for (let i = 0; i < activeMatches.length; i++) {
        const cur = activeMatches[i];
        const nextStart =
          i + 1 < activeMatches.length ? activeMatches[i + 1].startIndex : body.length;
        let rawOptText = body.slice(cur.contentStart, nextStart).trim();

        if (
          cur.markedCorrect ||
          /\[GẠCH CHÂN\]|\[TÔ ĐỎ\]|<u>|\(\s*Đúng\s*\)|\*$/i.test(rawOptText)
        ) {
          detectedAns = cur.letter;
          detectionMethods.add('Gạch chân / Tô màu / In đậm (Phần I)');
        }

        rawOptText = rawOptText
          .replace(/\[GẠCH CHÂN\]|\[TÔ ĐỎ\]|\[IN ĐẬM\]/gi, '')
          .trim();

        const cleanedOpt = normalizeBrokenFormulasToLatex(
          stripLeakedAnswerMarkers(rawOptText)
        );

        options[cur.letter] = cleanedOpt || `Phương án ${cur.letter} (Xem hình minh họa)`;
      }
    }

    const levels: CognitiveLevel[] = ['Biết', 'Hiểu', 'Vận dụng', 'Vận dụng cao'];
    const level: CognitiveLevel =
      idx < p1Blocks.length * 0.45
        ? 'Biết'
        : idx < p1Blocks.length * 0.75
        ? 'Hiểu'
        : idx < p1Blocks.length * 0.9
        ? 'Vận dụng'
        : levels[3];

    part1.push({
      id: qId,
      content: normalizeBrokenFormulasToLatex(stripLeakedAnswerMarkers(questionStem)),
      options,
      correctAnswer: detectedAns,
      level,
      explanation:
        explanation ||
        `Đáp án đúng là ${detectedAns} (Tự động nhận diện từ ký hiệu gạch chân trong PDF và ẩn trên giao diện làm bài của học sinh).`,
      ...(matchedFig
        ? {
            image: matchedFig.dataUrl,
            imageUrl: matchedFig.dataUrl,
            imageCaption: `Hình minh họa Phần I - Câu ${qId}`,
            ...(matchedFig.cropBox ? { sourceCropBox: matchedFig.cropBox } : {}),
          }
        : {}),
    });
  });

  // 4. Parse Part II Questions (4 questions, True/False a), b), c), d) - max 1.0 pt each = 4.00 pts)
  const part2: Part2Question[] = [];

  p2Blocks.forEach((bObj, idx) => {
    const qId = idx + 1;
    const origNum = bObj.origNum;
    const globalNum = bObj.globalNum;
    const body = bObj.text.replace(/^Câu\s+\d+\s*[.:]\s*/i, '').trim();

    const itemRegex =
      /(?:^|\n)\s*(\*+|<u>|\[GẠCH CHÂN\]|\[TÔ ĐỎ\])?\s*([a-d])\s*(\*+)?\s*\)\s*/gi;
    const itemMatches: {
      label: 'a' | 'b' | 'c' | 'd';
      starred: boolean;
      startIndex: number;
      contentStart: number;
    }[] = [];

    let mItem: RegExpExecArray | null;
    while ((mItem = itemRegex.exec(body)) !== null) {
      const label = mItem[2].toLowerCase() as 'a' | 'b' | 'c' | 'd';
      const starred = Boolean(mItem[1] || mItem[3]);
      itemMatches.push({
        label,
        starred,
        startIndex: mItem.index,
        contentStart: mItem.index + mItem[0].length,
      });
    }

    const tableKeysForQ = answerTablePart2[qId] || answerTablePart2[origNum];

    let stem = body;
    const items: Part2Question['items'] = [
      { label: 'a', text: 'Phát biểu a', isCorrect: tableKeysForQ?.a ?? false },
      { label: 'b', text: 'Phát biểu b', isCorrect: tableKeysForQ?.b ?? false },
      { label: 'c', text: 'Phát biểu c', isCorrect: tableKeysForQ?.c ?? false },
      { label: 'd', text: 'Phát biểu d', isCorrect: tableKeysForQ?.d ?? false },
    ];

    if (itemMatches.length > 0) {
      stem = body.slice(0, itemMatches[0].startIndex).trim();
      itemMatches.forEach((im, i) => {
        const nextStart =
          i + 1 < itemMatches.length ? itemMatches[i + 1].startIndex : body.length;
        let rawStatement = body.slice(im.contentStart, nextStart).trim();

        let isCorrect =
          tableKeysForQ && typeof tableKeysForQ[im.label] === 'boolean'
            ? tableKeysForQ[im.label]
            : im.starred;

        if (im.starred) {
          detectionMethods.add('Gạch chân ý đúng a), b), c), d) (Phần II)');
        }

        if (/\(\s*(?:Đúng|Đ|True)\s*\)|\[\s*(?:Đúng|Đ)\s*\]/i.test(rawStatement)) {
          isCorrect = true;
          detectionMethods.add('Nhãn Đúng/Sai trong câu Phần II');
        } else if (/\(\s*(?:Sai|S|False)\s*\)|\[\s*(?:Sai|S)\s*\]/i.test(rawStatement)) {
          isCorrect = false;
          detectionMethods.add('Nhãn Đúng/Sai trong câu Phần II');
        } else if (/<u>|\[GẠCH CHÂN\]|\[TÔ ĐỎ\]/i.test(rawStatement)) {
          isCorrect = true;
          detectionMethods.add('Gạch chân ý đúng a), b), c), d) (Phần II)');
        }

        rawStatement = rawStatement
          .replace(/\(\s*(?:Đúng|Sai|Đ|S|True|False)\s*\)/gi, '')
          .replace(/\[\s*(?:Đúng|Sai|Đ|S|GẠCH CHÂN|TÔ ĐỎ)\s*\]/gi, '')
          .trim();

        const targetIdx = ['a', 'b', 'c', 'd'].indexOf(im.label);
        if (targetIdx !== -1) {
          items[targetIdx] = {
            label: im.label,
            text: normalizeBrokenFormulasToLatex(stripLeakedAnswerMarkers(rawStatement)),
            isCorrect,
          };
        }
      });
    }

    const matchedFig = findQuestionFigure(2, qId, origNum, globalNum);

    part2.push({
      id: qId,
      content: normalizeBrokenFormulasToLatex(stripLeakedAnswerMarkers(stem)),
      items,
      level: 'Hiểu',
      ...(matchedFig
        ? {
            image: matchedFig.dataUrl,
            imageUrl: matchedFig.dataUrl,
            imageCaption: `Hình minh họa Phần II - Câu ${qId}`,
            ...(matchedFig.cropBox ? { sourceCropBox: matchedFig.cropBox } : {}),
          }
        : {}),
    });
  });

  // 5. Parse Part III Questions (6 questions, Short Answer - 0.25 pts each = 1.50 pts)
  const part3: Part3Question[] = [];

  p3Blocks.forEach((bObj, idx) => {
    const qId = idx + 1;
    const origNum = bObj.origNum;
    const globalNum = bObj.globalNum;
    let body = bObj.text
      .replace(/^Câu\s+\d+\s*[.:]\s*/i, '')
      .replace(/\s*---+\s*Hết\s*---+\s*$/gi, '')
      .trim();

    let correctAnswer = answerTablePart3[qId] || answerTablePart3[origNum] || '';
    let explanation = '';

    const expMatch = body.match(
      /(?:^|\n)\s*(?:Lời\s*giải|Giải\s*thích|Hướng\s*dẫn)\s*[:\-]?\s*([\s\S]+)$/i
    );
    if (expMatch) {
      explanation = normalizeBrokenFormulasToLatex(expMatch[1].trim());
      body = body.slice(0, expMatch.index).trim();
    }

    const ansLabelRegex =
      /(?:^|\n|\s)(?:Đáp\s*án|Đáp\s*số|ĐS|Kết\s*quả)\s*[:\-]?\s*(-?[0-9]+(?:[.,][0-9]+)?)\s*\.?\s*(?:[a-zA-Z%°/]*)?\s*$/i;
    const ansMatch = body.match(ansLabelRegex);
    if (ansMatch) {
      correctAnswer = ansMatch[1].replace(/\.$/, '').trim();
      detectionMethods.add('Đáp án / Đáp số Phần III');
      body = body.slice(0, ansMatch.index).trim();
    } else {
      const standaloneAMatch = body.match(
        /(?:^|\n|\s)\*?A\s*[.:]\s*(-?[0-9]+(?:[.,][0-9]+)?)\s*\.?\s*$/i
      );
      if (standaloneAMatch) {
        correctAnswer = standaloneAMatch[1].replace(/\.$/, '').trim();
        detectionMethods.add('Đáp số ký hiệu A. (Phần III)');
        body = body.slice(0, standaloneAMatch.index).trim();
      }
    }

    const matchedFig = findQuestionFigure(3, qId, origNum, globalNum);

    part3.push({
      id: qId,
      content: normalizeBrokenFormulasToLatex(stripLeakedAnswerMarkers(body)),
      correctAnswer: correctAnswer || '1',
      level: idx >= p3Blocks.length - 2 ? 'Vận dụng cao' : 'Vận dụng',
      explanation: explanation || `Đáp số chuẩn: ${correctAnswer || '1'}`,
      ...(matchedFig
        ? {
            image: matchedFig.dataUrl,
            imageUrl: matchedFig.dataUrl,
            imageCaption: `Hình minh họa Phần III - Câu ${qId}`,
            ...(matchedFig.cropBox ? { sourceCropBox: matchedFig.cropBox } : {}),
          }
        : {}),
    });
  });

  // 6. Parse Essay Questions (if any)
  const essay: EssayQuestion[] = [];
  essayBlocks.forEach((bObj, idx) => {
    const body = bObj.text.replace(/^Câu\s+\d+\s*[.:]\s*/i, '').trim();
    essay.push({
      id: idx + 1,
      content: normalizeBrokenFormulasToLatex(body),
      points: 1.5,
      guide: 'Học sinh trình bày đầy đủ phương trình hóa học và các bước tính toán.',
    });
  });

  return {
    part1,
    part2,
    part3,
    essay,
    detectedAnswerSummary: {
      part1Count: part1.length,
      part2Count: part2.length,
      part3Count: part3.length,
      detectionMethods:
        detectionMethods.size > 0
          ? Array.from(detectionMethods)
          : ['Nhận diện tự động theo cấu trúc 3 phần chuẩn'],
    },
  };
}

/**
 * Generates a realistic 28-question Demo PDF Exam (18 câu Phần I + 4 câu Phần II + 6 câu Phần III = 10,0 điểm)
 * on a <canvas> so teachers can also test synthetic PDF extraction or load ĐỀ ONLINE 0103.pdf directly.
 */
export function generateSamplePdfExamDemo(): RenderedPdfPage & { fullRawText: string } {
  const canvas = document.createElement('canvas');
  canvas.width = 1100;
  canvas.height = 1480;
  const ctx = canvas.getContext('2d');

  const labDiagramCanvas = document.createElement('canvas');
  labDiagramCanvas.width = 640;
  labDiagramCanvas.height = 240;
  const lctx = labDiagramCanvas.getContext('2d');
  if (lctx) {
    lctx.fillStyle = '#ffffff';
    lctx.fillRect(0, 0, 640, 240);
    lctx.strokeStyle = '#0f172a';
    lctx.lineWidth = 2.5;

    lctx.save();
    lctx.translate(160, 110);
    lctx.rotate(-0.22);
    lctx.beginPath();
    lctx.roundRect(-22, -70, 44, 130, [0, 0, 22, 22]);
    lctx.stroke();
    lctx.fillStyle = '#bae6fd';
    lctx.beginPath();
    lctx.roundRect(-20, 5, 40, 53, [0, 0, 20, 20]);
    lctx.fill();
    lctx.restore();

    lctx.fillStyle = '#f97316';
    lctx.beginPath();
    lctx.arc(145, 195, 14, 0, Math.PI * 2);
    lctx.fill();
    lctx.fillStyle = '#facc15';
    lctx.beginPath();
    lctx.arc(145, 197, 8, 0, Math.PI * 2);
    lctx.fill();
    lctx.fillStyle = '#0f172a';
    lctx.font = 'bold 13px sans-serif';
    lctx.fillText('Đèn cồn (t0)', 110, 225);
    lctx.fillText('CH3COOH + C2H5OH + H2SO4 đặc', 50, 32);

    lctx.beginPath();
    lctx.moveTo(175, 45);
    lctx.lineTo(310, 45);
    lctx.lineTo(430, 135);
    lctx.stroke();

    lctx.strokeRect(385, 100, 95, 105);
    lctx.fillStyle = '#fef08a';
    lctx.fillRect(387, 130, 91, 22);
    lctx.fillStyle = '#e0f2fe';
    lctx.fillRect(387, 152, 91, 51);
    lctx.fillStyle = '#0f172a';
    lctx.font = 'bold 13px sans-serif';
    lctx.fillText('Lớp Ester (CH3COOC2H5)', 490, 145);
    lctx.fillText('Dung dịch NaCl bão hòa', 490, 180);
  }

  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(
      'SỞ GD&ĐT HÀ NỘI - ĐỀ THI CHUẨN CẤU TRÚC 3 PHẦN MÔN HÓA HỌC (MÃ ĐỀ 101)',
      55,
      52
    );
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(
      'Cấu trúc: Phần I (18 câu = 4,5đ) • Phần II (4 câu Đ/S = 4,0đ) • Phần III (6 câu trả lời ngắn = 1,5đ) • Tổng: 10,0 điểm',
      55,
      78
    );

    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(55, 92);
    ctx.lineTo(1045, 92);
    ctx.stroke();

    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(
      'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (Từ câu 1 đến câu 18 - 4,5 điểm)',
      55,
      124
    );

    ctx.fillStyle = '#0f172a';
    ctx.font = '15px sans-serif';
    ctx.fillText(
      'Câu 1: Đun nóng hỗn hợp CH3COOH và C2H5OH có mặt H2SO4 đặc (--t0-->) thu được ester là:',
      55,
      156
    );
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('*A. CH3COOC2H5.', 75, 184);
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(75, 189);
    ctx.lineTo(220, 189);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '15px sans-serif';
    ctx.fillText('B. HCOOCH3.', 305, 184);
    ctx.fillText('C. C2H5COOCH3.', 535, 184);
    ctx.fillText('D. CH3COOCH3.', 785, 184);

    ctx.fillText(
      'Câu 2: Cho sơ đồ thí nghiệm điều chế và thu ester ethyl acetate như hình vẽ bên dưới:',
      55,
      224
    );
    ctx.drawImage(labDiagramCanvas, 120, 240);
  }

  const demoRawText = `PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn
Câu 1: Đun nóng hỗn hợp CH3COOH và C2H5OH có mặt H2SO4 đặc (--t0-->) thu được ester có công thức là:
*A. CH3COOC2H5
B. HCOOCH3
C. C2H5COOCH3
D. CH3COOCH3

Câu 2: Cho sơ đồ thí nghiệm điều chế ester ethyl acetate trong phòng thí nghiệm như hình vẽ. Dung dịch H2SO4 đặc trong ống nghiệm đóng vai trò nào sau đây?
A. Chất bị khử tạo khí SO2
*B. Vừa làm chất xúc tác, vừa hút nước để tăng hiệu suất phản ứng thuận nghịch
C. Chất tạo kết tủa với C2H5OH
D. Chất làm giảm nhiệt độ sôi của CH3COOC2H5

Câu 3: Dung dịch chất nào sau đây hòa tan được Cu(OH)2 ở nhiệt độ thường tạo dung dịch phức chất màu xanh lam thẫm?
A. CH3CHO
B. C6H6
*C. C6H12O6 (Glucose)
D. CH3COOC2H5

Câu 4: Nhỏ dung dịch NaOH dư vào dung dịch chứa ion Fe3+ và SO42-, thu được kết tủa màu nâu đỏ có công thức là:
A. Fe(OH)2
B. Cu(OH)2
C. BaSO4
*D. Fe(OH)3

Câu 5: Thủy phân hoàn toàn chất béo tristearin (C17H35COO)3C3H5 trong dung dịch NaOH đun nóng (t0), thu được glycerol và muối nào sau đây?
A. C17H33COONa
*B. C17H35COONa
C. C15H31COONa
D. CH3COONa

Câu 6: Cation X2+ có cấu hình electron 1s22s22p63s23p6. X thuộc chu kì:
A. 3
B. 8
C. 2
*D. 4

Câu 7: Nguyên tử X có cấu hình electron [Ne]3s23p1. Vị trí của X trong bảng tuần hoàn là:
A. số thứ tự 3, chu kì 3, nhóm IIIA
B. số thứ tự 11, chu kì 3, nhóm IIIA
C. số thứ tự 13, chu kì 2, nhóm IA
*D. số thứ tự 13, chu kì 3, nhóm IIIA

Câu 8: Để làm dịch chuyển cân bằng theo chiều thuận trong phản ứng điều chế ester CH3COOC2H5 từ CH3COOH và C2H5OH, biện pháp nào sau đây được áp dụng?
A. Tăng nồng độ của CH3COOH hoặc C2H5OH
B. Dùng dung dịch H2SO4 đặc để hút H2O tạo thành
C. Chưng cất tách lấy CH3COOC2H5 ra khỏi hỗn hợp phản ứng
*D. Cả A, B, C đều đúng

Câu 9: Dãy nào sau đây gồm các đồng vị của cùng một nguyên tố hóa học?
A. 14 6 X, 14 7 Y, 14 8 Z
B. 19 9 X, 19 10 Y, 20 10 Z
*C. 28 14 X, 29 14 Y, 30 14 Z
D. 40 18 X, 40 19 Y, 40 20 Z

Câu 10: Mỗi orbital nguyên tử chứa tối đa:
A. 1 electron
*B. 2 electron
C. 3 electron
D. 4 electron

Câu 11: Nguyên tử R tạo được cation R+. Cấu hình electron ở phân lớp ngoài cùng của R+ (ở trạng thái cơ bản) là 2p6. Tổng số hạt mang điện trong nguyên tử R là:
A. 10
B. 11
*C. 22
D. 23

Câu 12: Định luật tuần hoàn phát biểu rằng tính chất của các đơn chất cũng như thành phần và tính chất của hợp chất tạo nên từ các nguyên tố biến đổi tuần hoàn theo chiều tăng của yếu tố nào sau đây?
*A. Điện tích hạt nhân nguyên tử
B. Khối lượng nguyên tử
C. Bán kính nguyên tử
D. Số lớp electron

Câu 13: Khi cho kim loại Cu tác dụng với dung dịch HNO3 loãng dư, sản phẩm khử là khí không màu, hóa nâu ngoài không khí có công thức là:
A. NO2
*B. NO
C. N2O
D. N2

Câu 14: Nước cứng vĩnh cửu chứa các ion Ca2+, Mg2+ cùng với các anion nào sau đây?
A. HCO3-
*B. Cl- và SO42-
C. CO32- và PO43-
D. OH-

Câu 15: Ở trạng thái cơ bản, cấu hình electron lớp ngoài cùng của nguyên tử X là 3s2. Số hiệu nguyên tử của nguyên tố X là:
*A. 12
B. 13
C. 11
D. 14

Câu 16: Theo chiều tăng dần của điện tích hạt nhân, tính kim loại của các nguyên tố trong nhóm IA thay đổi như thế nào?
*A. Tăng dần
B. Giảm dần
C. Không thay đổi
D. Vừa tăng vừa giảm

Câu 17: Trong nhóm IIA, theo chiều tăng của điện tích hạt nhân, tính base của các hydroxide tương ứng với nguyên tố biến đổi như thế nào?
*A. Mạnh dần
B. Yếu dần
C. Không biến đổi
D. Biến đổi không quy luật

Câu 18: Cho cặp oxi hóa - khử Fe2+/Fe và Cu2+/Cu. Phản ứng hóa học xảy ra khi nhúng thanh Fe vào dung dịch CuSO4 là:
A. Fe + Cu2+ -> Fe3+ + Cu
*B. Fe + Cu2+ -> Fe2+ + Cu
C. Cu + Fe2+ -> Cu2+ + Fe
D. Fe2+ + Cu2+ -> Fe3+ + Cu+

PHẦN II. Câu trắc nghiệm đúng sai
Câu 1: Trong tự nhiên, uranium có 2 đồng vị cơ bản là 235 92U và 238 92U:
*a) Số khối của hai đồng vị lần lượt là 235 và 238.
b) Số electron của hai đồng vị này lần lượt là 92 và 93.
*c) Điện tích hạt nhân của hai đồng vị này đều là +92.
d) Số neutron của hai đồng vị này lần lượt là 133 và 136.

Câu 2: Cho mô hình nguyên tử theo Rutherford – Bohr (hình a) và cấu trúc nguyên tử aluminium theo Rutherford – Bohr (hình b):
*a) Số electron tối đa ở lớp L là 8 electron.
*b) Nguyên tử aluminium có 13 electron.
*c) Các electron trên lớp K đều có mức năng lượng bằng nhau.
d) Lớp electron ngoài cùng là lớp N và có 2 electron.

Câu 3: Hợp chất RX2 tạo thành từ hai nguyên tố R và X đều có số hạt proton bằng số hạt neutron. Mặt khác, R và X đều có cùng số electron ở lớp ngoài cùng. Phân tử khối của RX2 là 64:
*a) Ở trạng thái cơ bản, R và X đều có 2 electron độc thân.
b) Số electron lớp ngoài cùng của R và X đều bằng 4.
*c) Khí RX2 là một trong những nguyên nhân gây ra hiện tượng mưa acid.
d) Số hiệu nguyên tử của R và X lần lượt là 18 và 7.

Câu 4: 2, 3, 7, 8 – TCDD là một trong những chất thuộc nhóm dioxin có công thức C12H4Cl4O2:
*a) 2, 3, 7, 8 – TCDD gồm 4 nguyên tố.
b) Trong các nguyên tố tạo thành 2, 3, 7, 8 – TCDD thì có 3 nguyên tố thuộc chu kì 2.
*c) Các nguyên tố tạo thành 2, 3, 7, 8 – TCDD đều có tính phi kim yếu hơn F.
d) Trong các nguyên tố tạo thành 2, 3, 7, 8 – TCDD thì nguyên tố có bán kính nguyên tử lớn nhất là C.

PHẦN III: Câu trắc nghiệm yêu cầu trả lời ngắn
Câu 1: Cho 6 nguyên tố có số hiệu nguyên tử lần lượt là 10, 13, 16, 18, 19. Trong số các nguyên tố trên có bao nhiêu nguyên tố kim loại?
Đáp án:2

Câu 2: Nguyên tố Y thuộc chu kì 3, nhóm VA trong bảng tuần hoàn các nguyên tố hóa học. Trong công thức oxide cao nhất của Y số nguyên tử oxygen là bao nhiêu?
Đáp án:5

Câu 3: Hợp chất MX3 có tổng số hạt mang điện tích là 128. Trong hợp chất, số proton của nguyên tử X nhiều hơn số proton của nguyên tử M là 38. Số hạt mang điện âm của nguyên tử M là
Đáp án:13

Câu 4: Cho các phát biểu (1), (2), (3), (4), (5) về cấu tạo nguyên tử và cấu hình electron 1s22s22p63s23p63d104s2. Sắp xếp các phát biểu đúng theo thứ tự tăng dần (vd: 12, 135, 2345...):
Đáp án:125

Câu 5: Nguyên tử của nguyên tố X có cấu hình electron đã xây dựng đến phân lớp 3d2. Tổng số electron của nguyên tử nguyên tố X là bao nhiêu?
Đáp số 22.

Câu 6: Nguyên tử của nguyên tố potassium có 19 electron. Ở trạng thái cơ bản, potassium có số orbital chứa electron là bao nhiêu?
Đáp số 10.`;

  return {
    pageNumber: 1,
    dataUrl: canvasToCompressedDataUrl(canvas, 0.72, 0.78),
    width: canvas.width,
    height: canvas.height,
    extractedText: demoRawText,
    autoCroppedFigures: [
      {
        id: 'fig_demo_q2',
        label: 'Trang 1 - Hình vẽ thí nghiệm điều chế Ester (Phần I - Câu 2)',
        dataUrl: canvasToCompressedDataUrl(labDiagramCanvas, 0.65, 0.7),
        partHint: 1,
        questionHint: 2,
      },
    ],
    fullRawText: demoRawText,
  };
}
