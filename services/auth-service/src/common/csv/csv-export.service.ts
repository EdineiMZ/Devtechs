import { Injectable } from '@nestjs/common';

/**
 * Generic CSV export — small, dependency-free, RFC 4180 compliant.
 *
 * Why we have it: every module that exports tabular data (audit logs,
 * invoices, employees, license activations…) needs the same escaping
 * rules. Putting it in one service keeps the rules consistent and
 * stops every controller from re-rolling its own buggy "join with
 * commas" loop.
 *
 * RFC 4180 rules implemented:
 *   - Fields containing comma, double-quote, CR, or LF are wrapped
 *     in double quotes.
 *   - Embedded double quotes inside a quoted field are doubled.
 *   - Line terminator is CRLF (some Windows tools refuse LF-only).
 *   - The first row is the header row when `headers` is provided.
 *
 * The service deliberately accepts a `Pick`-style header map so the
 * caller controls both the column order AND the human-friendly column
 * label, independently of the object key. That avoids leaking internal
 * field names like `userId` to a CSV opened by an end user.
 *
 * Encoding: UTF-8 with a BOM. Excel-without-BOM mangles non-ASCII
 * (e.g. accented Portuguese characters). Linux tools ignore the BOM
 * so this is safe across platforms.
 */

export type CsvHeaders<T> = ReadonlyArray<{
  /** Property key on the row object. */
  key: keyof T;
  /** Column label written to the header row. */
  label: string;
  /**
   * Optional formatter — receives the raw value and returns a string.
   * Used for things like `Date → ISO`, `Json → JSON.stringify`, etc.
   */
  format?: (value: T[keyof T]) => string;
}>;

@Injectable()
export class CsvExportService {
  /**
   * Build a CSV Buffer from a list of rows.
   *
   * @example
   *   const buf = csv.toBuffer(items, [
   *     { key: 'id',        label: 'ID' },
   *     { key: 'createdAt', label: 'Criado em', format: (v) => (v as Date).toISOString() },
   *   ]);
   *   res.setHeader('Content-Type', 'text/csv; charset=utf-8');
   *   res.send(buf);
   */
  toBuffer<T extends object>(
    rows: ReadonlyArray<T>,
    headers: CsvHeaders<T>,
  ): Buffer {
    const lines: string[] = [];
    lines.push(headers.map((h) => this.escape(h.label)).join(','));
    for (const row of rows) {
      const cells = headers.map((h) => {
        const raw = row[h.key];
        const value =
          h.format !== undefined ? h.format(raw as T[keyof T]) : this.toCell(raw);
        return this.escape(value);
      });
      lines.push(cells.join(','));
    }
    // BOM + CRLF — see header comment for rationale.
    return Buffer.concat([Buffer.from('﻿', 'utf8'), Buffer.from(lines.join('\r\n'), 'utf8')]);
  }

  /**
   * Stringify any cell value to a stable text form. Custom formatters
   * are preferred — this is just the safe default when the caller
   * doesn't pass one.
   */
  private toCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  }

  private escape(value: string): string {
    // RFC 4180: wrap if comma, quote, CR or LF is present; double the
    // quote inside.
    if (/[",\r\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
