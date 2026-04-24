import { createWorker } from "tesseract.js";
import { extractInvoiceItemsFromLines } from "./invoicePdfParser.js";

function normalizeLine(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export async function parseInvoiceImageFiles(
  files,
  invoiceMonthIndex,
  invoiceYear,
  onProgress
) {
  const imageFiles = (files || []).filter(
    (file) => file && String(file.type || "").startsWith("image/")
  );

  if (imageFiles.length === 0) {
    return { items: [], pages: 0, lines: 0 };
  }

  const worker = await createWorker("por+eng", 1, {
    logger: (message) => {
      if (message?.status === "recognizing text") {
        onProgress?.(Number(message.progress || 0));
      }
    },
  });

  const lines = [];

  try {
    await worker.setParameters({
      preserve_interword_spaces: "1",
    });

    for (let fileIndex = 0; fileIndex < imageFiles.length; fileIndex += 1) {
      const imageFile = imageFiles[fileIndex];
      const { data } = await worker.recognize(imageFile);
      const pageLines = Array.isArray(data?.lines) && data.lines.length > 0
        ? data.lines
            .map((line) => normalizeLine(line?.text || ""))
            .filter(Boolean)
        : String(data?.text || "")
            .split(/\r?\n/g)
            .map((line) => normalizeLine(line))
            .filter(Boolean);

      pageLines.forEach((line, lineIndex) => {
        lines.push({
          pageNumber: fileIndex + 1,
          lineNumber: lineIndex + 1,
          line,
        });
      });
    }
  } finally {
    await worker.terminate();
  }

  const items = extractInvoiceItemsFromLines(
    lines,
    invoiceMonthIndex,
    invoiceYear,
    "img"
  );

  return {
    items,
    pages: imageFiles.length,
    lines: lines.length,
  };
}
