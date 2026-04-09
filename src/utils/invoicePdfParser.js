import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerSrc from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const DATE_RE = /\b(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\b/;
const MONEY_RE = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
const INSTALLMENT_RE = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/;

const IGNORED_KEYWORDS = [
  "PAGAMENTO",
  "TOTAL",
  "LIMITE",
  "VENCIMENTO",
  "ENCARGOS",
  "JUROS",
  "MULTA",
  "IOF",
  "ESTORNO",
  "CREDITO",
  "SALDO",
];

function toMoneyNumber(value) {
  const normalized = String(value || "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLine(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function shouldIgnoreDescription(description) {
  const upper = description.toUpperCase();
  return IGNORED_KEYWORDS.some((keyword) => upper.includes(keyword));
}

function parseDateFromMatch(dateMatch, invoiceMonthIndex, invoiceYear) {
  if (!dateMatch) return null;
  const day = Number(dateMatch[1]);
  const monthIndex = Number(dateMatch[2]) - 1;
  const yearToken = dateMatch[3];

  let year = invoiceYear;
  if (yearToken) {
    year = yearToken.length === 2 ? 2000 + Number(yearToken) : Number(yearToken);
  } else if (monthIndex > invoiceMonthIndex) {
    year = invoiceYear - 1;
  }

  if (!Number.isInteger(day) || !Number.isInteger(monthIndex) || !Number.isInteger(year)) {
    return null;
  }

  const date = new Date(year, monthIndex, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function buildTextLines(textItems) {
  const buckets = new Map();

  for (const item of textItems || []) {
    const value = normalizeLine(item?.str || "");
    if (!value) continue;

    const x = Number(item?.transform?.[4] || 0);
    const y = Number(item?.transform?.[5] || 0);
    const rowKey = Math.round(y * 2) / 2;

    if (!buckets.has(rowKey)) buckets.set(rowKey, []);
    buckets.get(rowKey).push({ x, value });
  }

  const rows = [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, parts]) =>
      parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.value)
        .join(" ")
    )
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  return rows;
}

export function extractInvoiceItemsFromLines(
  lines,
  invoiceMonthIndex,
  invoiceYear,
  sourcePrefix = "src"
) {
  const items = [];
  const seen = new Set();

  for (const candidate of lines || []) {
    const normalized = normalizeLine(candidate?.line || "");
    const dateMatch = normalized.match(DATE_RE);
    if (!dateMatch) continue;

    const moneyMatches = [...normalized.matchAll(MONEY_RE)];
    if (moneyMatches.length === 0) continue;

    const rawAmount = moneyMatches[moneyMatches.length - 1][0];
    const amount = toMoneyNumber(rawAmount);
    if (!(amount > 0)) continue;

    const purchaseDate = parseDateFromMatch(dateMatch, invoiceMonthIndex, invoiceYear);
    if (!purchaseDate) continue;

    let description = normalized;
    description = description.replace(dateMatch[0], " ");
    description = description.replace(rawAmount, " ");

    let installmentNumber = 1;
    let totalInstallments = 1;
    const installmentMatch = normalized.match(INSTALLMENT_RE);
    if (installmentMatch) {
      installmentNumber = Number(installmentMatch[1]) || 1;
      totalInstallments = Number(installmentMatch[2]) || 1;
      description = description.replace(installmentMatch[0], " ");
    }

    description = normalizeLine(description);
    if (description.length < 3) continue;
    if (shouldIgnoreDescription(description)) continue;

    const signature = [
      purchaseDate.toISOString().slice(0, 10),
      description.toLowerCase(),
      amount.toFixed(2),
      `${installmentNumber}/${totalInstallments}`,
    ].join("|");

    if (seen.has(signature)) continue;
    seen.add(signature);

    const pageNumber = Number(candidate?.pageNumber || 1);
    const lineNumber = Number(candidate?.lineNumber || 1);

    items.push({
      key: `${sourcePrefix}-${pageNumber}-${lineNumber}-${items.length}`,
      pageNumber,
      lineNumber,
      purchaseDateIso: purchaseDate.toISOString(),
      description,
      installmentNumber,
      totalInstallments,
      installmentAmount: amount,
      rawLine: normalized,
    });
  }

  items.sort(
    (a, b) => new Date(a.purchaseDateIso).getTime() - new Date(b.purchaseDateIso).getTime()
  );

  return items;
}

export async function parseInvoicePdfFile(file, invoiceMonthIndex, invoiceYear) {
  if (!file) {
    return { items: [], pages: 0, lines: 0 };
  }

  const bytes = await file.arrayBuffer();
  const loadingTask = getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  const lines = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    });
    const pageLines = buildTextLines(textContent.items);
    pageLines.forEach((line, index) => {
      lines.push({
        pageNumber,
        lineNumber: index + 1,
        line,
      });
    });
  }

  const items = extractInvoiceItemsFromLines(
    lines,
    invoiceMonthIndex,
    invoiceYear,
    "pdf"
  );

  return {
    items,
    pages: pdf.numPages,
    lines: lines.length,
  };
}
