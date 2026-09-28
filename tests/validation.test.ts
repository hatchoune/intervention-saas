import { describe, expect, it } from 'vitest';

import { signInSchema, signUpSchema, resetPasswordSchema } from '@/lib/validation/auth';
import { customerSchema } from '@/lib/validation/customer';
import { interventionSchema } from '@/lib/validation/intervention';
import { quoteSchema } from '@/lib/validation/document';
import { technicianSchema } from '@/lib/validation/technician';
import {
  checkbox,
  commaSeparatedList,
  decimalNumber,
  formDataToObject,
  nullableDateTime,
  nullableEmail,
  nullablePhone,
  nullableText,
} from '@/lib/validation/common';

describe('common field helpers', () => {
  it('normalises empty text to null', () => {
    expect(nullableText(50).parse('   ')).toBeNull();
    expect(nullableText(50).parse('hello')).toBe('hello');
    expect(nullableText(5).safeParse('too long').success).toBe(false);
  });

  it('validates and lower-cases e-mails', () => {
    expect(nullableEmail().parse(' User@Example.COM ')).toBe('user@example.com');
    expect(nullableEmail().parse('')).toBeNull();
    expect(nullableEmail().safeParse('not-an-email').success).toBe(false);
  });

  it('accepts realistic phone formats and rejects junk', () => {
    expect(nullablePhone().parse('+33 6 12 34 56 78')).toBe('+33 6 12 34 56 78');
    expect(nullablePhone().parse('01.23.45.67.89')).toBe('01.23.45.67.89');
    expect(nullablePhone().parse('')).toBeNull();
    expect(nullablePhone().safeParse('call me maybe').success).toBe(false);
  });

  it('accepts both decimal separators for numbers', () => {
    expect(decimalNumber().parse('12,50')).toBe(12.5);
    expect(decimalNumber().parse('1 234.5')).toBe(1234.5);
    expect(decimalNumber({ min: 0, max: 10 }).safeParse(-1).success).toBe(false);
    expect(decimalNumber({ min: 0, max: 10 }).safeParse(11).success).toBe(false);
    expect(decimalNumber({ defaultValue: 20 }).parse('')).toBe(20);
  });

  it('converts datetime-local input into an ISO string', () => {
    const parsed = nullableDateTime.parse('2030-06-01T09:30');
    expect(parsed).toMatch(/^2030-06-01T/);
    expect(nullableDateTime.parse('')).toBeNull();
    expect(nullableDateTime.safeParse('not a date').success).toBe(false);
  });

  it('parses checkbox values', () => {
    expect(checkbox.parse('on')).toBe(true);
    expect(checkbox.parse(undefined)).toBe(false);
    expect(checkbox.parse('false')).toBe(false);
  });

  it('splits, trims and de-duplicates comma separated lists', () => {
    expect(commaSeparatedList.parse('plumbing, heating , plumbing')).toEqual([
      'plumbing',
      'heating',
    ]);
    expect(commaSeparatedList.parse('')).toEqual([]);
  });

  it('builds a plain object from FormData, keeping repeated keys', () => {
    const formData = new FormData();
    formData.set('name', 'Ada');
    formData.append('lines[0][description]', 'Pipe');
    formData.append('lines[1][description]', 'Valve');

    const object = formDataToObject(formData);
    expect(object.name).toBe('Ada');
    expect(object['lines[0][description]']).toBe('Pipe');
    expect(object['lines[1][description]']).toBe('Valve');
  });
});

describe('auth schemas', () => {
  it('rejects weak passwords', () => {
    expect(signInSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
    expect(
      signUpSchema.safeParse({
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'short',
        organizationName: 'Analytical Engines',
        acceptTerms: true,
      }).success,
    ).toBe(false);
  });

  it('rejects a password without a digit', () => {
    expect(
      signUpSchema.safeParse({
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'onlyletters',
        organizationName: 'Analytical Engines',
        acceptTerms: true,
      }).success,
    ).toBe(false);
  });

  it('accepts a valid sign-up payload', () => {
    const result = signUpSchema.safeParse({
      fullName: 'Ada Lovelace',
      email: 'Ada@Example.com',
      password: 'engines1842',
      organizationName: 'Analytical Engines',
      country: 'gb',
      acceptTerms: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('ada@example.com');
      expect(result.data.country).toBe('GB');
    }
  });

  it('requires the terms checkbox', () => {
    expect(
      signUpSchema.safeParse({
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'engines1842',
        organizationName: 'Analytical Engines',
      }).success,
    ).toBe(false);
  });

  it('checks password confirmation', () => {
    expect(
      resetPasswordSchema.safeParse({ password: 'engines1842', confirmPassword: 'engines1842' })
        .success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({ password: 'engines1842', confirmPassword: 'other1234' })
        .success,
    ).toBe(false);
  });
});

describe('customer schema', () => {
  it('requires a company name for company customers', () => {
    const result = customerSchema.safeParse({ type: 'company', companyName: '', tags: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'companyName')).toBe(true);
    }
  });

  it('requires at least a name for individuals', () => {
    expect(customerSchema.safeParse({ type: 'individual', tags: '' }).success).toBe(false);
    expect(
      customerSchema.safeParse({ type: 'individual', lastName: 'Lovelace', tags: '' }).success,
    ).toBe(true);
  });

  it('defaults country, status and tags', () => {
    const result = customerSchema.parse({
      type: 'company',
      companyName: 'Analytical Engines',
      tags: 'vip, heating',
    });

    expect(result.country).toBe('FR');
    expect(result.status).toBe('active');
    expect(result.tags).toEqual(['vip', 'heating']);
  });
});

describe('technician schema', () => {
  it('validates the hex colour and splits skills', () => {
    expect(technicianSchema.safeParse({ fullName: 'Ada', color: 'blue' }).success).toBe(false);

    const result = technicianSchema.parse({ fullName: 'Ada', color: '#2563eb', skills: 'a, b' });
    expect(result.color).toBe('#2563eb');
    expect(result.skills).toEqual(['a', 'b']);
    expect(result.isActive).toBe(true);
  });

  it('accepts an empty hourly rate as null', () => {
    expect(technicianSchema.parse({ fullName: 'Ada', hourlyRate: '' }).hourlyRate).toBeNull();
    expect(technicianSchema.safeParse({ fullName: 'Ada', hourlyRate: '-5' }).success).toBe(false);
  });
});

describe('intervention schema', () => {
  const base = {
    customerId: '11111111-1111-4111-8111-111111111111',
    title: 'Leaking radiator',
  };

  it('requires a valid customer uuid', () => {
    expect(interventionSchema.safeParse({ ...base, customerId: 'nope' }).success).toBe(false);
  });

  it('rejects a schedule that ends before it starts', () => {
    const result = interventionSchema.safeParse({
      ...base,
      scheduledStart: '2030-01-01T10:00',
      scheduledEnd: '2030-01-01T09:00',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'scheduledEnd')).toBe(true);
    }
  });

  it('accepts a coherent schedule and normalises defaults', () => {
    const result = interventionSchema.parse({
      ...base,
      scheduledStart: '2030-01-01T09:00',
      scheduledEnd: '2030-01-01T11:00',
    });

    expect(result.status).toBe('draft');
    expect(result.priority).toBe('normal');
    expect(result.country).toBe('FR');
    expect(result.scheduledStart).toMatch(/^2030-01-01T/);
  });
});

describe('quote schema', () => {
  const line = { description: 'Labour', quantity: '2', unitPrice: '45', vatRate: '20' };

  it('requires at least one line', () => {
    expect(
      quoteSchema.safeParse({
        customerId: '11111111-1111-4111-8111-111111111111',
        issueDate: '2030-01-01',
        lines: [],
      }).success,
    ).toBe(false);
  });

  it('accepts a realistic quote and coerces numeric strings', () => {
    const result = quoteSchema.parse({
      customerId: '11111111-1111-4111-8111-111111111111',
      issueDate: '2030-01-01',
      validUntil: '2030-01-31',
      lines: [line],
    });

    expect(result.lines[0]?.quantity).toBe(2);
    expect(result.lines[0]?.unitPrice).toBe(45);
    expect(result.lines[0]?.unit).toBe('unit');
  });

  it('refuses a validity date before the issue date', () => {
    expect(
      quoteSchema.safeParse({
        customerId: '11111111-1111-4111-8111-111111111111',
        issueDate: '2030-02-01',
        validUntil: '2030-01-01',
        lines: [line],
      }).success,
    ).toBe(false);
  });

  it('refuses a percentage discount above 100', () => {
    expect(
      quoteSchema.safeParse({
        customerId: '11111111-1111-4111-8111-111111111111',
        issueDate: '2030-01-01',
        discountType: 'percentage',
        discountValue: '150',
        lines: [line],
      }).success,
    ).toBe(false);
  });
});

