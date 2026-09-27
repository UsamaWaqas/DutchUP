/**
 * Pure text parsing — no I/O. Takes the raw text an OCR engine read off a receipt photo
 * and guesses the total amount, checking the most specific line labels first.
 */

const NUMBER_RE = /\d[\d,]*(?:\.\d{1,2})?/g;
const TOTAL_LINE_PATTERNS = [/grand\s*total/i, /amount\s*due/i, /balance\s*due/i, /^total\b/i, /\btotal\b/i];

function amountsOnLine(line: string): number[] {
  return Array.from(line.matchAll(NUMBER_RE)).map((m) => Number(m[0].replace(/,/g, '')));
}

/** Best-guess total from a receipt's OCR text, or `null` if no number could be found at all. */
export function parseReceiptTotal(text: string): number | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const pattern of TOTAL_LINE_PATTERNS) {
    for (const line of lines) {
      if (!pattern.test(line) || /sub\s*total/i.test(line)) continue;
      const amounts = amountsOnLine(line);
      if (amounts.length > 0) return Math.round(amounts[amounts.length - 1]);
    }
  }

  // No labeled total line found — fall back to the largest number anywhere on the receipt.
  const all = lines.flatMap(amountsOnLine);
  return all.length > 0 ? Math.round(Math.max(...all)) : null;
}
