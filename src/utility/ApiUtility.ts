import { Response, Request } from 'express';
import { nanoid } from 'nanoid';
import EnvConfig from './AppEnv.js';
import { Logger } from './Logger.js';

import dayjs from 'dayjs';
import utc from 'dayjs';

export class ApiUtility {
  static logInfo(req: Request, message: string, ...otherProps: any[]) {
    if (otherProps?.length) {
      message = message + ` (Attached in jsonPayload: ${otherProps?.length})`;
    }
    const entry = Object.assign({
      severity: 'INFO',
      message,
      otherProps: otherProps?.length ? otherProps : null,
    });
    // Serialize to a JSON string and output.
    Logger.info(JSON.stringify(entry));
  }

  static logError(req: Request, message: string, err?: Error | null, ...otherProps: any[]) {
    if (otherProps?.length) {
      message =
        message + ` (Attached in jsonPayload: ${otherProps?.length}, error: ${err ? 'Yes' : 'No'})`;
    }
    const entry = Object.assign({
      severity: 'ERROR',
      message,
      error: err?.stack ?? null,
      otherProps: otherProps?.length ? otherProps : null,
    });
    // Serialize to a JSON string and output.
    Logger.error(JSON.stringify(entry));
  }

  static getIsTestMode(): boolean {
    return EnvConfig.env;
  }

  static generateNanoId(length?: number): string {
    return nanoid(length || 20);
  }

  static dateFormat(date?: string | Date, formatString: string = 'YYYY-MM-DD'): string {
    // If date is not provided, use current date
    if (!date) {
      return dayjs().format(formatString);
    }

    // Attempt to parse the date
    const parsedDate = dayjs(date, formatString, true);

    // If the date is invalid, return a fallback or log an error
    if (!parsedDate.isValid()) {
      console.error(`Invalid date format: ${date}`);
      return dayjs().format(formatString); // Return current date as fallback
    }

    return parsedDate.format(formatString);
  }

  static normalizeInvoiceNo(value: string): string {
    return value.replace(/[\s\W_]+/g, '').toLowerCase();
  }

  static normalizeGSTin(value: string): string {
    return value.replace(/\s+/g, '').toUpperCase();
  }

  /* -------------------- Date Parsers (Using DayJS) -------------------- */

  static parseISODate(value: string): Date {
    // Expected format: YYYY-MM-DD
    const parsed = utc(value, 'YYYY-MM-DD', true);

    if (!parsed.isValid()) {
      throw new Error(`Invalid ISO date format: ${value}`);
    }

    return parsed.toDate();
  }

  static parseQRDate(value: string): Date {
    // Expected format: DD/MM/YYYY
    const parsed = utc(value, 'DD/MM/YYYY', true);

    if (!parsed.isValid()) {
      throw new Error(`Invalid QR date format: ${value}`);
    }

    return parsed.toDate();
  }

  static isSameDate(date1: Date, date2: Date): boolean {
    return dayjs(date1).isSame(dayjs(date2), 'day');
  }

  /* -------------------- Async Helpers -------------------- */

  static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* -------------------- JSON Helpers -------------------- */

  static sanitizeJson(raw: string): string {
    return raw
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
  }

  /* -------------------- Error Helpers -------------------- */

  static isTransientRateLimitError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes('429') || normalized.includes('rate limit');
  }

  static isHardQuotaError(message: string): boolean {
    const normalized = message.toLowerCase();

    return (
      (normalized.includes('429') || normalized.includes('quota')) &&
      (normalized.includes('billing') || normalized.includes('plan'))
    );
  }

  /* -------------------- Type Helpers -------------------- */

  static ensureArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }

  static attachIds<T extends object>(items: T[]): (T & { id: string })[] {
    return items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    }));
  }

  /* -------------------- Business Helpers -------------------- */

  static cleanRemarks(remarks: string | undefined, disallowedRemarks: string[]): string {
    if (!remarks) return '';

    const normalized = remarks.trim().toLowerCase();

    const blocked = disallowedRemarks.some((text) => normalized.includes(text.toLowerCase()));

    return blocked ? '' : remarks.trim();
  }
}
