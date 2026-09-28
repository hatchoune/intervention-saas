import type {
  CustomerStatus,
  CustomerType,
  DiscountType,
  InterventionPriority,
  InterventionStatus,
  InvoiceStatus,
  InvoiceRow,
  OrganizationRole,
  QuoteStatus,
  TechnicianStatus,
} from '@/types/database';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

export interface StatusMeta<T extends string> {
  value: T;
  label: string;
  tone: BadgeTone;
  description: string;
}

function meta<T extends string>(
  value: T,
  label: string,
  tone: BadgeTone,
  description: string,
): StatusMeta<T> {
  return { value, label, tone, description };
}

// ---------------------------------------------------------------------------
// Interventions
// ---------------------------------------------------------------------------

export const INTERVENTION_STATUS_META: Record<InterventionStatus, StatusMeta<InterventionStatus>> = {
  draft: meta('draft', 'Draft', 'neutral', 'Not yet confirmed with the customer'),
  scheduled: meta('scheduled', 'Scheduled', 'info', 'Planned and awaiting execution'),
  in_progress: meta('in_progress', 'In progress', 'accent', 'Technician is on site'),
  completed: meta('completed', 'Completed', 'success', 'Work delivered'),
  cancelled: meta('cancelled', 'Cancelled', 'danger', 'Cancelled by the customer or the office'),
};

export const INTERVENTION_STATUSES = Object.keys(
  INTERVENTION_STATUS_META,
) as InterventionStatus[];

/** Legal status transitions — enforced in the server actions. */
export const INTERVENTION_STATUS_TRANSITIONS: Record<InterventionStatus, InterventionStatus[]> = {
  draft: ['draft', 'scheduled', 'cancelled'],
  scheduled: ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'],
  in_progress: ['scheduled', 'in_progress', 'completed', 'cancelled'],
  completed: ['in_progress', 'completed'],
  cancelled: ['draft', 'scheduled', 'cancelled'],
};

export function canTransitionIntervention(
  from: InterventionStatus,
  to: InterventionStatus,
): boolean {
  return INTERVENTION_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const INTERVENTION_PRIORITY_META: Record<
  InterventionPriority,
  StatusMeta<InterventionPriority>
> = {
  low: meta('low', 'Low', 'neutral', 'No urgency'),
  normal: meta('normal', 'Normal', 'info', 'Standard priority'),
  high: meta('high', 'High', 'warning', 'Should be handled quickly'),
  urgent: meta('urgent', 'Urgent', 'danger', 'Emergency call-out'),
};

export const INTERVENTION_PRIORITIES = Object.keys(
  INTERVENTION_PRIORITY_META,
) as InterventionPriority[];

/** Priority ordering used for sorting lists. */
export const PRIORITY_WEIGHT: Record<InterventionPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export const QUOTE_STATUS_META: Record<QuoteStatus, StatusMeta<QuoteStatus>> = {
  draft: meta('draft', 'Draft', 'neutral', 'Still being prepared'),
  sent: meta('sent', 'Sent', 'info', 'Waiting for the customer'),
  accepted: meta('accepted', 'Accepted', 'success', 'Signed by the customer'),
  rejected: meta('rejected', 'Rejected', 'danger', 'Declined by the customer'),
  expired: meta('expired', 'Expired', 'warning', 'Validity date passed'),
};

export const QUOTE_STATUSES = Object.keys(QUOTE_STATUS_META) as QuoteStatus[];

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export const INVOICE_STATUS_META: Record<InvoiceStatus, StatusMeta<InvoiceStatus>> = {
  draft: meta('draft', 'Draft', 'neutral', 'Not sent to the customer yet'),
  sent: meta('sent', 'Sent', 'info', 'Awaiting payment'),
  partial: meta('partial', 'Partially paid', 'accent', 'A payment was recorded'),
  paid: meta('paid', 'Paid', 'success', 'Settled in full'),
  overdue: meta('overdue', 'Overdue', 'danger', 'Past the due date'),
  cancelled: meta('cancelled', 'Cancelled', 'neutral', 'Voided invoice'),
};

export const INVOICE_STATUSES = Object.keys(INVOICE_STATUS_META) as InvoiceStatus[];

/** Open (unpaid) statuses used by the dashboard and filters. */
export const OPEN_INVOICE_STATUSES: InvoiceStatus[] = ['sent', 'partial', 'overdue'];

/**
 * Derived status for display: an invoice whose due date has passed while a
 * balance remains is shown as overdue even before the nightly sweep runs.
 */
export function effectiveInvoiceStatus(
  invoice: Pick<InvoiceRow, 'status' | 'due_date' | 'total' | 'amount_paid'>,
  today: Date = new Date(),
): InvoiceStatus {
  if (invoice.status === 'cancelled' || invoice.status === 'draft') return invoice.status;

  const balance = Number(invoice.total) - Number(invoice.amount_paid);
  if (balance <= 0.005) return 'paid';

  if (invoice.due_date) {
    const due = new Date(`${invoice.due_date}T23:59:59`);
    if (!Number.isNaN(due.getTime()) && due.getTime() < today.getTime()) return 'overdue';
  }

  return invoice.status === 'partial' ? 'partial' : 'sent';
}

export function isInvoiceOverdue(
  invoice: Pick<InvoiceRow, 'status' | 'due_date' | 'total' | 'amount_paid'>,
  today: Date = new Date(),
): boolean {
  return effectiveInvoiceStatus(invoice, today) === 'overdue';
}

/** Quotes may only be invoiced once accepted and not yet converted. */
export function isQuoteInvoicable(quote: {
  status: QuoteStatus;
  converted_invoice_id: string | null;
}): boolean {
  return quote.status === 'accepted' && !quote.converted_invoice_id;
}

// ---------------------------------------------------------------------------
// People & customers
// ---------------------------------------------------------------------------

export const TECHNICIAN_STATUS_META: Record<TechnicianStatus, StatusMeta<TechnicianStatus>> = {
  available: meta('available', 'Available', 'success', 'Can be assigned new work'),
  busy: meta('busy', 'Busy', 'warning', 'Currently on a job'),
  on_leave: meta('on_leave', 'On leave', 'info', 'Away from work'),
  inactive: meta('inactive', 'Inactive', 'neutral', 'No longer scheduled'),
};

export const TECHNICIAN_STATUSES = Object.keys(TECHNICIAN_STATUS_META) as TechnicianStatus[];

export const ORGANIZATION_ROLE_META: Record<OrganizationRole, StatusMeta<OrganizationRole>> = {
  admin: meta('admin', 'Administrator', 'accent', 'Full access: team, settings and billing'),
  manager: meta('manager', 'Manager', 'info', 'Manages customers, planning, quotes and invoices'),
  technician: meta('technician', 'Technician', 'neutral', 'Sees the schedule and updates own jobs'),
};

export const ORGANIZATION_ROLES = Object.keys(ORGANIZATION_ROLE_META) as OrganizationRole[];

export const CUSTOMER_TYPE_META: Record<CustomerType, StatusMeta<CustomerType>> = {
  individual: meta('individual', 'Individual', 'info', 'Private customer'),
  company: meta('company', 'Company', 'accent', 'Business customer'),
};

export const CUSTOMER_STATUS_META: Record<CustomerStatus, StatusMeta<CustomerStatus>> = {
  active: meta('active', 'Active', 'success', 'Can receive new work'),
  archived: meta('archived', 'Archived', 'neutral', 'Kept for history only'),
};

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  none: 'No global discount',
  percentage: 'Percentage',
  fixed: 'Fixed amount',
};

/** Common VAT rates for the SME markets we target (FR/DE/NL/UK/BE). */
export const COMMON_VAT_RATES = [0, 5.5, 6, 10, 20, 21] as const;

/** Units of measure offered in the line item editor. */
export const LINE_UNITS = [
  'unit',
  'hour',
  'half-day',
  'day',
  'm2',
  'm',
  'kg',
  'litre',
  'flat rate',
] as const;

