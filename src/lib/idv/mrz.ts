// Minimal MRZ helpers (client-safe). No persistence.

export function computeMRZCheckDigit(data: string): number {
  const weights = [7, 3, 1];
  const mapChar = (ch: string) => {
    if (ch === '<') return 0;
    if (/[0-9]/.test(ch)) return parseInt(ch, 10);
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) return code - 55; // A=10 ... Z=35
    return 0;
  };
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += mapChar(data[i]) * weights[i % 3];
  }
  return sum % 10;
}

export function verifyMrzField(data: string, checkDigitChar: string): boolean {
  const expected = computeMRZCheckDigit(data);
  const actual = parseInt(checkDigitChar, 10);
  return actual === expected;
}

export function parseMrz(lines: string[]): { ok: boolean; reason?: string } {
  // Stub parser: ensure we have 2 or 3 lines and check some digits if present
  if (!lines || lines.length < 2) return { ok: false, reason: 'mrz_lines_insufficient' };
  // Attempt simple TD3 passport (two lines length 44)
  const l1 = lines[0]?.trim().toUpperCase() || '';
  const l2 = lines[1]?.trim().toUpperCase() || '';
  if (l1.length >= 30 && l2.length >= 30) {
    // Example: check last char of l2 as composite check if digit
    const digit = l2[l2.length - 1];
    if (/[0-9]/.test(digit)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: 'mrz_unparsed' };
}

