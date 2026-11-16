// PDF Generator for PillSync Translated Prescriptions
// Renders formatted text onto HTML5 Canvas using browser HarfBuzz shaping with our bundled
// @fontsource Indic & Noto Nastaliq Urdu fonts so conjuncts and RTL ligatures never show empty boxes,
// then embeds high-DPI pages into a real .pdf document using jspdf.

import { jsPDF } from 'jspdf';
import { StoredPrescription, StoredMedicine, PatientProfile } from './db';
import {
  MedicineTranslationResult,
  PrescriptionTextTranslation,
} from './translationService';
import { LanguageConfig } from '../data/translations';
import { PRESCRIPTION_UI_LABELS, toSupportedLang } from '../translations/glossary';

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

export async function generateTranslatedPrescriptionPdf(params: {
  prescription: StoredPrescription;
  medicines: StoredMedicine[];
  patientProfile?: PatientProfile;
  language: LanguageConfig;
  translations: Record<string, MedicineTranslationResult>;
  rxTexts: PrescriptionTextTranslation;
}): Promise<Blob> {
  const { prescription, medicines, patientProfile, language, translations, rxTexts } = params;
  const langCode = toSupportedLang(language.code);
  const ui = PRESCRIPTION_UI_LABELS[langCode];
  const isRtl = language.code === 'ur';

  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }

  // A4 aspect ratio high-DPI canvas: 1240 x 1754 px (150 DPI equivalent)
  const PAGE_W = 1240;
  const PAGE_H = 1754;
  const MARGIN = 72;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const pages: HTMLCanvasElement[] = [];

  const createPageCanvas = (): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.textBaseline = 'top';
    pages.push(canvas);
    return { canvas, ctx };
  };

  let { ctx } = createPageCanvas();
  let y = MARGIN;

  const fontStack = `${language.fontFamily}, sans-serif`;

  const drawTextLine = (
    text: string,
    opts: {
      font: string;
      color: string;
      rtl?: boolean;
      lineHeight: number;
      xOffset?: number;
    }
  ) => {
    if (y + opts.lineHeight > PAGE_H - 130) {
      // Start a fresh page
      const next = createPageCanvas();
      ctx = next.ctx;
      y = MARGIN;
    }

    ctx.font = opts.font;
    ctx.fillStyle = opts.color;
    const padX = opts.xOffset || 0;

    if (opts.rtl) {
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillText(text, PAGE_W - MARGIN - padX, y);
    } else {
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.fillText(text, MARGIN + padX, y);
    }
    y += opts.lineHeight;
  };

  // Header Banner
  ctx.fillStyle = '#1E88E5';
  ctx.fillRect(0, 0, PAGE_W, 130);
  ctx.fillStyle = '#FFFFFF';
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.font = 'bold 42px Inter, sans-serif';
  ctx.fillText('PillSync', MARGIN, 36);
  ctx.font = `600 22px ${fontStack}`;
  ctx.fillText(`${ui.headerTitle} — ${language.nativeName} (${language.englishName})`, MARGIN, 86);

  y = 165;

  // Prescription Metadata Card
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.fillRect(MARGIN, y, CONTENT_W, 140);
  ctx.strokeRect(MARGIN, y, CONTENT_W, 140);

  y += 20;
  drawTextLine(
    `${ui.patientProfile}: ${patientProfile?.name || prescription.patientName || 'Self'}`,
    { font: `bold 24px ${fontStack}`, color: '#0F172A', rtl: isRtl, lineHeight: 34, xOffset: 24 }
  );
  drawTextLine(
    `${ui.visitDate}: ${prescription.prescriptionDate}${prescription.doctorName ? `   •   ${ui.doctorLabel}: ${prescription.doctorName}` : ''}`,
    { font: `500 22px ${fontStack}`, color: '#334155', rtl: isRtl, lineHeight: 34, xOffset: 24 }
  );
  if (prescription.clinic) {
    drawTextLine(`${ui.clinicLabel}: ${prescription.clinic}`, {
      font: `500 20px ${fontStack}`,
      color: '#475569',
      rtl: isRtl,
      lineHeight: 30,
      xOffset: 24,
    });
  }

  y += 40;

  // Doctor Notes / Follow-up if present
  if (rxTexts.notesText || rxTexts.followUpText) {
    if (rxTexts.followUpText) {
      drawTextLine(`${ui.followUpLabel}: ${rxTexts.followUpText}`, {
        font: `bold 22px ${fontStack}`,
        color: '#065F46',
        rtl: isRtl,
        lineHeight: 34,
      });
    }
    if (rxTexts.notesText) {
      const wrappedNotes = wrapCanvasText(ctx, `${ui.notesLabel}: ${rxTexts.notesText}`, CONTENT_W - 20);
      for (const line of wrappedNotes) {
        drawTextLine(line, {
          font: `500 21px ${fontStack}`,
          color: '#1E293B',
          rtl: isRtl,
          lineHeight: 30,
        });
      }
    }
    y += 18;
  }

  // Medicines Section Title
  drawTextLine(`${ui.medicationsSectionTitle} (${medicines.length})`, {
    font: `bold 28px ${fontStack}`,
    color: '#1E88E5',
    rtl: isRtl,
    lineHeight: 42,
  });

  // Render Each Medicine
  for (let i = 0; i < medicines.length; i++) {
    const med = medicines[i];
    const tr = translations[med.id];
    const origTitle = `${med.name}${med.strength ? ` ${med.strength}` : ''}`;
    const titleLine =
      language.code !== 'en' && tr?.transliteratedName && tr.transliteratedName !== med.name
        ? `${i + 1}. ${origTitle} / ${tr.transliteratedName}`
        : `${i + 1}. ${origTitle}`;

    const primarySentence = tr?.offlineSentence || '';
    const extraInstr = !tr?.hasNumberWarning && tr?.aiInstruction ? tr.aiInstruction : '';

    ctx.font = `bold 26px ${fontStack}`;
    const titleLines = wrapCanvasText(ctx, titleLine, CONTENT_W - 40);
    ctx.font = `600 24px ${fontStack}`;
    const sentenceLines = wrapCanvasText(ctx, primarySentence, CONTENT_W - 40);
    ctx.font = `400 21px ${fontStack}`;
    const extraLines = extraInstr ? wrapCanvasText(ctx, extraInstr, CONTENT_W - 40) : [];

    const blockHeight =
      32 + titleLines.length * 36 + sentenceLines.length * 34 + extraLines.length * 30 + 24;

    if (y + blockHeight > PAGE_H - 130) {
      const next = createPageCanvas();
      ctx = next.ctx;
      y = MARGIN;
    }

    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.fillRect(MARGIN, y, CONTENT_W, blockHeight);
    ctx.strokeRect(MARGIN, y, CONTENT_W, blockHeight);

    y += 20;
    for (const line of titleLines) {
      drawTextLine(line, {
        font: `bold 26px ${fontStack}`,
        color: '#0F172A',
        rtl: isRtl,
        lineHeight: 36,
        xOffset: 20,
      });
    }
    for (const line of sentenceLines) {
      drawTextLine(line, {
        font: `600 24px ${fontStack}`,
        color: '#1D4ED8',
        rtl: isRtl,
        lineHeight: 34,
        xOffset: 20,
      });
    }
    for (const line of extraLines) {
      drawTextLine(line, {
        font: `400 21px ${fontStack}`,
        color: '#475569',
        rtl: isRtl,
        lineHeight: 30,
        xOffset: 20,
      });
    }
    y += 28;
  }

  // Draw localized statutory disclaimer footer on every page
  for (const canvas of pages) {
    const fCtx = canvas.getContext('2d')!;
    fCtx.fillStyle = '#EFF6FF';
    fCtx.fillRect(MARGIN, PAGE_H - 105, CONTENT_W, 68);
    fCtx.strokeStyle = '#BFDBFE';
    fCtx.lineWidth = 2;
    fCtx.strokeRect(MARGIN, PAGE_H - 105, CONTENT_W, 68);
    fCtx.font = `600 20px ${fontStack}`;
    fCtx.fillStyle = '#1E3A8A';
    fCtx.direction = isRtl ? 'rtl' : 'ltr';
    fCtx.textAlign = isRtl ? 'right' : 'left';
    const xPos = isRtl ? PAGE_W - MARGIN - 16 : MARGIN + 16;
    fCtx.fillText(ui.disclaimer, xPos, PAGE_H - 80);
  }

  // Compile pages into PDF
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  pages.forEach((canvas, idx) => {
    if (idx > 0) pdf.addPage();
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
  });

  return pdf.output('blob');
}
