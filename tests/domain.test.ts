import { describe, expect, it } from 'vitest';

import {
  canTransitionIntervention,
  effectiveInvoiceStatus,
  INTERVENTION_STATUSES,
  INTERVENTION_STATUS_META,
  INTERVENTION_STATUS_TRANSITIONS,
  isInvoiceOverdue,
  isQuoteInvoicable,
  PRIORITY_WEIGHT,
} from '@/lib/domain/status';
import { can, canEditIntervention, defaultRouteFor } from '@/lib/domain/permissions';

describe('intervention status machine', () => {
  it('exposes metadata for every status', () => {
    for (const status of INTERVENTION_STATUSES) {
      expect(INTERVENTION_STATUS_META[status].label.length).toBeGreaterThan(0);
      expect(INTERVENTION_STATUS_TRANSITIONS[status]).toContain(status);
    }
  });

  it('allows the expected transitions', () => {
    expect(canTransitionIntervention('draft', 'scheduled')).toBe(true);
    expect(canTransitionIntervention('scheduled', 'in_progress')).toBe(true);
    expect(canTransitionIntervention('in_progress', 'completed')).toBe(true);
    expect(canTransitionIntervention('cancelled', 'scheduled')).toBe(true);
  });

  it('refuses to resurrect a completed intervention', () => {
    expect(canTransitionIntervention('completed', 'draft')).toBe(false);
    expect(canTransitionIntervention('completed', 'cancelled')).toBe(false);
  });

  it('orders priorities from most to least urgent', () => {
    expect(PRIORITY_WEIGHT.urgent).toBeLessThan(PRIORITY_WEIGHT.high);
    expect(PRIORITY_WEIGHT.high).toBeLessThan(PRIORITY_WEIGHT.normal);
    expect(PRIORITY_WEIGHT.normal).toBeLessThan(PRIORITY_WEIGHT.low);
  });
});

describe('invoice status derivation', () => {
  const base = { status: 'sent' as const, due_date: '2999-01-01', total: 100, amount_paid: 0 };

  it('keeps drafts and cancelled invoices untouched', () => {
    expect(effectiveInvoiceStatus({ ...base, status: 'draft' })).toBe('draft');
    expect(effectiveInvoiceStatus({ ...base, status: 'cancelled' })).toBe('cancelled');
  });

  it('reports paid once the balance is settled', () => {
    expect(effectiveInvoiceStatus({ ...base, amount_paid: 100 })).toBe('paid');
    expect(effectiveInvoiceStatus({ ...base, amount_paid: 120 })).toBe('paid');
  });

  it('reports partial when a payment was recorded', () => {
    expect(effectiveInvoiceStatus({ ...base, amount_paid: 40 })).toBe('partial');
  });

  it('reports overdue when the due date has passed with a balance left', () => {
    expect(
      effectiveInvoiceStatus({ ...base, due_date: '2020-01-01', amount_paid: 10 }, new Date('2024-05-05')),
    ).toBe('overdue');
    expect(isInvoiceOverdue({ ...base, due_date: '2020-01-01' }, new Date('2024-05-05'))).toBe(true);
  });

  it('does not flag a settled invoice as overdue', () => {
    expect(
      effectiveInvoiceStatus(
        { ...base, due_date: '2020-01-01', amount_paid: 100 },
        new Date('2024-05-05'),
      ),
    ).toBe('paid');
  });

  it('tolerates a null due date', () => {
    expect(effectiveInvoiceStatus({ ...base, due_date: null })).toBe('sent');
  });
});

describe('quote invoicing rule', () => {
  it('only allows accepted, unconverted quotes', () => {
    expect(isQuoteInvoicable({ status: 'accepted', converted_invoice_id: null })).toBe(true);
    expect(isQuoteInvoicable({ status: 'accepted', converted_invoice_id: 'x' })).toBe(false);
    expect(isQuoteInvoicable({ status: 'sent', converted_invoice_id: null })).toBe(false);
  });
});

describe('capability matrix', () => {
  it('gives administrators full access', () => {
    expect(can('team.manage', 'admin')).toBe(true);
    expect(can('organization.edit', 'admin')).toBe(true);
    expect(can('invoices.manage', 'admin')).toBe(true);
  });

  it('keeps team and settings away from managers', () => {
    expect(can('invoices.manage', 'manager')).toBe(true);
    expect(can('team.manage', 'manager')).toBe(false);
    expect(can('organization.edit', 'manager')).toBe(false);
  });

  it('limits technicians to read-only work management', () => {
    expect(can('interventions.manage', 'technician')).toBe(false);
    expect(can('customers.manage', 'technician')).toBe(false);
    expect(can('quotes.manage', 'technician')).toBe(false);
    expect(can('interventions.update_assigned', 'technician')).toBe(true);
  });

  it('denies everything without a role', () => {
    expect(can('interventions.update_assigned', null)).toBe(false);
    expect(can('reports.view', undefined)).toBe(false);
  });
});

describe('canEditIntervention', () => {
  it('lets managers edit anything', () => {
    expect(
      canEditIntervention('manager', { assignedTechnicianUserId: 'someone-else', userId: 'me' }),
    ).toBe(true);
  });

  it('lets a technician edit only their own assignment', () => {
    expect(canEditIntervention('technician', { assignedTechnicianUserId: 'me', userId: 'me' })).toBe(
      true,
    );
    expect(
      canEditIntervention('technician', { assignedTechnicianUserId: 'other', userId: 'me' }),
    ).toBe(false);
    expect(canEditIntervention('technician', { assignedTechnicianUserId: null, userId: 'me' })).toBe(
      false,
    );
  });
});

describe('defaultRouteFor', () => {
  it('sends technicians to the planning board', () => {
    expect(defaultRouteFor('technician')).toBe('/planning/my-day');
    expect(defaultRouteFor('admin')).toBe('/dashboard');
    expect(defaultRouteFor(null)).toBe('/dashboard');
  });
});
