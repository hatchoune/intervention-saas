import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';

export type Locale = 'fr' | 'en';

const LOCALES = { fr, en: enGB } as const;

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

function localeOf(locale: Locale = 'en') {
  return LOCALES[locale] ?? fr;
}

/** 1 234,50 € — uses Intl so currencies are formatted per locale. */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency = 'EUR',
  locale = 'en-GB',
): string {
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : (amount ?? 0);

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Plain number formatting without a currency symbol. */
export function formatNumber(value: number | null | undefined, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits }).format(value ?? 0);
}

export function formatDate(value: string | Date | null | undefined, pattern = 'dd/MM/yyyy', locale: Locale = 'en'): string {
  const date = toDate(value);
  return date ? format(date, pattern, { locale: localeOf(locale) }) : '—';
}

export function formatDateTime(value: string | Date | null | undefined, locale: Locale = 'en'): string {
  return formatDate(value, 'dd/MM/yyyy HH:mm', locale);
}

export function formatTime(value: string | Date | null | undefined): string {
  return formatDate(value, 'HH:mm');
}

export function formatDayLabel(value: string | Date | null | undefined, locale: Locale = 'en'): string {
  return formatDate(value, 'EEEE d MMMM yyyy', locale);
}

export function formatMonthLabel(value: string | Date | null | undefined, locale: Locale = 'en'): string {
  return formatDate(value, 'MMM yyyy', locale);
}

/** "il y a 3 heures" / "3 hours ago". */
export function formatRelative(value: string | Date | null | undefined, locale: Locale = 'en'): string {
  const date = toDate(value);
  if (!date) return '—';

  return formatDistanceToNowStrict(date, { addSuffix: true, locale: localeOf(locale) });
}

/** ISO date (yyyy-MM-dd) suitable for `<input type="date">`. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, 'yyyy-MM-dd') : '';
}

/** ISO date-time (yyyy-MM-ddTHH:mm) suitable for `<input type="datetime-local">`. */
export function toDateTimeInputValue(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, "yyyy-MM-dd'T'HH:mm") : '';
}

/** True when the date is strictly before today (local time). */
export function isPastDate(value: string | Date | null | undefined): boolean {
  const date = toDate(value);
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

/** Percentage of a whole, clamped to 0..100 — used by progress bars. */
export function percentOf(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}
