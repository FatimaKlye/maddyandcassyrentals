import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

export interface BookingReportField {
  label: string;
  value: string;
}

export interface BookingReportSection {
  title: string;
  fields: BookingReportField[];
}

export interface BookingReportAttachment {
  label: string;
  fileName: string;
  bytes?: Uint8Array;
  contentType?: string;
}

export interface BookingReportInput {
  bookingReference: string;
  generatedAt: string;
  status: string;
  sections: BookingReportSection[];
  attachments: BookingReportAttachment[];
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ROSE = rgb(0.66, 0.36, 0.42);
const BLUSH = rgb(0.97, 0.91, 0.91);
const INK = rgb(0.15, 0.15, 0.15);
const MUTED = rgb(0.37, 0.37, 0.37);
const BORDER = rgb(0.86, 0.84, 0.84);

function safeText(value: string): string {
  return value
    .replaceAll("₱", "PHP ")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("’", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replace(/[^\x20-\x7E\n]/g, "");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];

  for (const paragraph of safeText(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

function addFooter(page: PDFPage, font: PDFFont, pageNumber: number) {
  page.drawLine({
    start: { x: MARGIN, y: 34 },
    end: { x: PAGE_WIDTH - MARGIN, y: 34 },
    thickness: 0.6,
    color: BORDER,
  });
  page.drawText("Private admin booking report", {
    x: MARGIN,
    y: 20,
    size: 8,
    font,
    color: MUTED,
  });
  page.drawText(`Page ${pageNumber}`, {
    x: PAGE_WIDTH - MARGIN - 38,
    y: 20,
    size: 8,
    font,
    color: MUTED,
  });
}

export async function createBookingReportPdf(
  input: BookingReportInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let pageNumber = 1;
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    addFooter(page, regular, pageNumber);
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNumber += 1;
    page.drawText(`Booking ${safeText(input.bookingReference)}`, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN,
      size: 9,
      font: bold,
      color: ROSE,
    });
    page.drawLine({
      start: { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 12 },
      end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN - 12 },
      thickness: 0.6,
      color: BORDER,
    });
    y = PAGE_HEIGHT - MARGIN - 36;
  };

  const ensureSpace = (height: number) => {
    if (y - height < 54) newPage();
  };

  const drawWrapped = (
    text: string,
    options: {
      x?: number;
      size?: number;
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      width?: number;
      lineHeight?: number;
    } = {},
  ) => {
    const x = options.x ?? MARGIN;
    const size = options.size ?? 10;
    const selectedFont = options.font ?? regular;
    const color = options.color ?? INK;
    const width = options.width ?? CONTENT_WIDTH;
    const lineHeight = options.lineHeight ?? size * 1.35;
    const lines = wrapText(text || "-", selectedFont, size, width);
    ensureSpace(lines.length * lineHeight + 4);
    for (const line of lines) {
      page.drawText(line || " ", { x, y, size, font: selectedFont, color });
      y -= lineHeight;
    }
  };

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 150,
    width: PAGE_WIDTH,
    height: 150,
    color: BLUSH,
  });
  page.drawText("MADDY & CASSY RENTALS", {
    x: MARGIN,
    y: PAGE_HEIGHT - 65,
    size: 11,
    font: bold,
    color: ROSE,
  });
  page.drawText("Booking Review Report", {
    x: MARGIN,
    y: PAGE_HEIGHT - 94,
    size: 24,
    font: bold,
    color: INK,
  });
  page.drawText(safeText(input.bookingReference), {
    x: MARGIN,
    y: PAGE_HEIGHT - 119,
    size: 12,
    font: bold,
    color: ROSE,
  });
  y = PAGE_HEIGHT - 181;

  drawWrapped(`Status: ${input.status}`, { font: bold, size: 11 });
  drawWrapped(`Generated: ${input.generatedAt}`, { color: MUTED, size: 9 });
  y -= 24;

  for (const section of input.sections) {
    ensureSpace(62);
    page.drawRectangle({
      x: MARGIN,
      y: y - 5,
      width: CONTENT_WIDTH,
      height: 28,
      color: BLUSH,
    });
    page.drawText(safeText(section.title.toUpperCase()), {
      x: MARGIN + 10,
      y: y + 4,
      size: 10,
      font: bold,
      color: ROSE,
    });
    y -= 35;

    for (const field of section.fields) {
      ensureSpace(42);
      drawWrapped(field.label.toUpperCase(), {
        size: 7.5,
        font: bold,
        color: MUTED,
        lineHeight: 10,
      });
      drawWrapped(field.value || "Not provided", {
        size: 10,
        lineHeight: 14,
      });
      y -= 5;
    }
    y -= 9;
  }

  if (input.attachments.length) {
    ensureSpace(70);
    page.drawRectangle({
      x: MARGIN,
      y: y - 5,
      width: CONTENT_WIDTH,
      height: 28,
      color: BLUSH,
    });
    page.drawText("ATTACHMENT REGISTER", {
      x: MARGIN + 10,
      y: y + 4,
      size: 10,
      font: bold,
      color: ROSE,
    });
    y -= 37;

    input.attachments.forEach((attachment, index) => {
      drawWrapped(
        `${index + 1}. ${attachment.label} - ${attachment.fileName}${
          attachment.bytes ? "" : " (not embedded - view in admin portal)"
        }`,
        { size: 9.5, lineHeight: 13 },
      );
    });
  }

  addFooter(page, regular, pageNumber);

  for (const attachment of input.attachments) {
    if (!attachment.bytes) continue;

    const contentType = attachment.contentType?.toLowerCase() ?? "";
    const fileName = attachment.fileName.toLowerCase();

    try {
      if (contentType.includes("pdf") || fileName.endsWith(".pdf")) {
        const sourcePdf = await PDFDocument.load(attachment.bytes);
        const copiedPages = await pdf.copyPages(
          sourcePdf,
          sourcePdf.getPageIndices(),
        );
        for (const copiedPage of copiedPages) {
          pdf.addPage(copiedPage);
        }
        continue;
      }

      const image =
        contentType.includes("png") || fileName.endsWith(".png")
          ? await pdf.embedPng(attachment.bytes)
          : await pdf.embedJpg(attachment.bytes);

      const attachmentPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pageNumber += 1;
      attachmentPage.drawText(safeText(attachment.label), {
        x: MARGIN,
        y: PAGE_HEIGHT - MARGIN,
        size: 15,
        font: bold,
        color: ROSE,
      });
      attachmentPage.drawText(safeText(attachment.fileName), {
        x: MARGIN,
        y: PAGE_HEIGHT - MARGIN - 20,
        size: 8,
        font: regular,
        color: MUTED,
      });

      const maxWidth = CONTENT_WIDTH;
      const maxHeight = PAGE_HEIGHT - 160;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const width = image.width * scale;
      const height = image.height * scale;
      attachmentPage.drawImage(image, {
        x: (PAGE_WIDTH - width) / 2,
        y: 62 + (maxHeight - height) / 2,
        width,
        height,
      });
      addFooter(attachmentPage, regular, pageNumber);
    } catch {
      // A corrupt or unsupported attachment should not prevent export of the
      // verified booking report and remaining documents.
    }
  }

  pdf.setTitle(`Booking ${safeText(input.bookingReference)}`);
  pdf.setSubject("Private rental booking review report");
  pdf.setAuthor("Rental by Maddy & Cassy");
  pdf.setCreator("Rental by Maddy & Cassy Admin");

  return pdf.save();
}
