import { z } from 'zod';

/**
 * Shared Zod building blocks.
 *
 * Rules of the house:
 *  - every input coming from the browser goes through one of these schemas;
 *  - empty strings from HTML forms are normalised to `null` (never `''`) so the
 *    database stores clean data;
 *  - numbers accept both `,` and `.` decimal separators (French keyboards).
 */

const WHITESPACE = /\s/g;

/** Text that may be absent: '' -> null. */
export function nullableText(max = 2000, label = 'text') {
  return z
    .preprocess(
      (value) => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
      },
      z.string().max(max, `${label} must be at most ${max} characters`).nullable(),
    )
    .transform((value) => value ?? null);
}

/** Required, trimmed text within length bounds. */
export function requiredText(min: number, max: number, label = 'This field') {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z
      .string({ error: `${label} is required` })
      .min(min, `${label} must be at least ${min} characters`)
      .max(max, `${label} must be at most ${max} characters`),
  );
}

/** Optional e-mail, validated when present and normalised to lower case. */
export function nullableEmail(label = 'E-mail') {
  return z
    .preprocess(
      (value) => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim().toLowerCase();
        return trimmed === '' ? null : trimmed;
      },
      z.email(`${label} is not valid`).max(254).nullable(),
    )
    .transform((value) => value ?? null);
}

export const requiredEmail = z
  .string({ error: 'E-mail is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid e-mail address').max(254));

/** Optional phone number: digits, spaces, +, -, (), ., / */
export function nullablePhone(label = 'Phone') {
  return z
    .preprocess(
      (value) => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
      },
      z
        .string()
        .max(32, `${label} is too long`)
        .regex(/^[+0-9 ().\-/]{4,32}$/, `${label} contains invalid characters`)
        .nullable(),
    )
    .transform((value) => value ?? null);
}

/** Decimal number coming from a form input or JSON. */
export function decimalNumber(
  options: { label?: string; min?: number; max?: number; defaultValue?: number } = {},
) {
  const { label = 'Value', min, max, defaultValue } = options;

  return z.preprocess(
    (value) => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'number') return value;
      if (typeof value !== 'string') return value;

      const normalised = value.replace(WHITESPACE, '').replace(',', '.');
      if (normalised === '') return defaultValue;

      const parsed = Number.parseFloat(normalised);
      return Number.isNaN(parsed) ? value : parsed;
    },
    z
      .number({ error: `${label} must be a number` })
      .finite(`${label} must be a number`)
      .refine((value) => min === undefined || value >= min, {
        message: `${label} must be at least ${min}`,
      })
      .refine((value) => max === undefined || value <= max, {
        message: `${label} must be at most ${max}`,
      }),
  );
}

/** Optional uuid ('' -> null). */
export const nullableUuid = z
  .preprocess(
    (value) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    },
    z.uuid('Invalid identifier').nullable(),
  )
  .transform((value) => value ?? null);

export const requiredUuid = z.uuid('Invalid identifier');

/** Checkbox value ('on' | 'true' | true | '1') -> boolean. */
export const checkbox = z.preprocess(
  (value) => value === 'on' || value === 'true' || value === true || value === '1',
  z.boolean(),
);

/** `yyyy-MM-dd` date input, optional. */
export const nullableDate = z
  .preprocess(
    (value) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    },
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker')
      .nullable(),
  )
  .transform((value) => value ?? null);

export const requiredDate = z
  .string({ error: 'Date is required' })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker');

/**
 * `datetime-local` input -> ISO 8601 string in UTC, ready for `timestamptz`.
 * The browser submits local wall-clock time; `new Date()` resolves it against
 * the runtime timezone (set `TZ` in production if the server is not local).
 */
export const nullableDateTime = z
  .preprocess(
    (value) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    },
    z.string().max(40).nullable(),
  )
  .transform((value, ctx) => {
    if (!value) return null;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Invalid date and time' });
      return z.NEVER;
    }

    return parsed.toISOString();
  });

/** Comma separated text -> trimmed, de-duplicated array. */
export const commaSeparatedList = z
  .preprocess(
    (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value !== 'string') return [];
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    },
    z.array(z.string().min(1).max(60)).max(30),
  )
  .transform((values) => [...new Set(values)]);

/** Hex colour used for technician calendars. */
export const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #2563eb');

/** ISO 3166-1 alpha-2 country code. */
export const countryCode = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return 'FR';
    const trimmed = value.trim().toUpperCase();
    return trimmed === '' ? 'FR' : trimmed;
  },
  z.string().length(2, 'Use a 2-letter country code'),
);

/** ISO 4217 currency code. */
export const currencyCode = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return 'EUR';
    const trimmed = value.trim().toUpperCase();
    return trimmed === '' ? 'EUR' : trimmed;
  },
  z.string().length(3, 'Use a 3-letter currency code'),
);

/**
 * Converts a `FormData` instance into a plain object. Repeated keys become
 * arrays, which is what multi-select and checkbox groups need.
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (key in result) {
      const existing = result[key];
      result[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing as FormDataEntryValue, value];
    } else {
      result[key] = value;
    }
  }

  return result;
}

