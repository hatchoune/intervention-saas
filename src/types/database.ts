/**
 * Typed representation of the PostgreSQL schema.
 *
 * This file mirrors `supabase/migrations`. It is written by hand (instead of
 * `supabase gen types`) so the repository stays buildable without a live
 * database connection; keep it in sync when you add a migration.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Uuid = string;

export type OrganizationRole = 'admin' | 'manager' | 'technician';
export type MembershipStatus = 'invited' | 'active' | 'suspended';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type CustomerType = 'individual' | 'company';
export type CustomerStatus = 'active' | 'archived';
export type TechnicianStatus = 'available' | 'busy' | 'on_leave' | 'inactive';
export type InterventionStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type InterventionPriority = 'low' | 'normal' | 'high' | 'urgent';
export type PhotoKind = 'before' | 'after';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type DocumentKind = 'intervention' | 'quote' | 'invoice';
export type DiscountType = 'none' | 'percentage' | 'fixed';
export type ActivityAction = 'created' | 'updated' | 'deleted' | 'status_changed';

/**
 * Helper building a supabase-js table definition from a row interface.
 * `InsertRequired` lists the columns the application must always provide.
 */
type TableDefinition<
  Row extends Record<string, unknown>,
  InsertRequired extends keyof Row = never,
> = {
  Row: Row;
  Insert: Pick<Row, InsertRequired> & Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface OrganizationRow extends Record<string, unknown> {
  id: Uuid;
  name: string;
  slug: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  vat_number: string | null;
  registration_number: string | null;
  logo_url: string | null;
  currency: string;
  default_vat_rate: number;
  payment_terms_days: number;
  timezone: string;
  quote_footer: string | null;
  invoice_footer: string | null;
  owner_id: Uuid | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow extends Record<string, unknown> {
  id: Uuid;
  full_name: string | null;
  phone: string | null;
  job_title: string | null;
  avatar_url: string | null;
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface MembershipRow extends Record<string, unknown> {
  id: Uuid;
  organization_id: Uuid;
  user_id: Uuid;
  role: OrganizationRole;
  status: MembershipStatus;
  created_at: string;
  updated_at: string;
}

export interface OrganizationInvitationRow extends Record<string, unknown> {
  id: Uuid;
  organization_id: Uuid;
  email: string;
  role: OrganizationRole;
  status: InvitationStatus;
  token: string;
  invited_by: Uuid | null;
  accepted_by: Uuid | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentSequenceRow extends Record<string, unknown> {
  organization_id: Uuid;
  kind: DocumentKind;
  prefix: string;
  last_number: number;
  width: number;
  updated_at: string;
}

export interface CustomerRow extends Record<string, unknown> {
  id: Uuid;
  organization_id: Uuid;
  type: CustomerType;
  status: CustomerStatus;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  contact_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;
  vat_number: string | null;
  registration_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  tags: string[];
  created_by: Uuid | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddressRow extends Record<string, unknown> {
  id: Uuid;
  organization_id: Uuid;
  customer_id: Uuid;
  label: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  access_notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TechnicianRow extends Record<string, unknown> {
  id: Uuid;
  organization_id: Uuid;
  user_id: Uuid | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  skills: string[];
  status: TechnicianStatus;
  color: string;
  hourly_rate: number | null;
  notes: string | null;
  is_active: boolean;
  created_by: Uuid | null;
  created_at: string;
  updated_at: string;
}

export interface InterventionRow extends Record<string, unknown> {
  id: Uuid;
  organization_id: Uuid;
  reference: string;
  reference_year: number;
  customer_id: Uuid;
  customer_address_id: Uuid | null;
  technician_id: Uuid | null;
  title: string;
  description: string | null;
  internal_notes: string | null;
  status: InterventionStatus;
  priority: InterventionPriority;
  scheduled_start: string | null;
  scheduled_end: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  completion_notes: string | null;
  created_by: Uuid | null;
  updated_by: Uuid | null;
  created_at: string;
  updated_at: string;
}

export interface InterventionPhotoRow extends Record<string, unknown> {
  id: Uuid;
  organization_id: Uuid;
  intervention_id: Uuid;
  kind: PhotoKind;
  storage_bucket: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  caption: string | null;
  uploaded_by: Uuid | null;
  created_at: string;
}

export interface QuoteRow extends Record<string, unknown> {
  id: Uuid;
  organization_id: Uuid;
  quote_number: string;
  customer_id: Uuid;
  intervention_id: Uuid | null;
  status: QuoteStatus;
  issue_date: string;
  valid_until: string | null;
  currency: string;
  discount_type: DiscountType;
  discount_value: number;
  notes: string | null;
  internal_notes: string | null;
  subtotal: number;
  discount_total: number;
  net_total: number;
  vat_total: number;
  total: number;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  converted_invoice_id: Uuid | null;
  created_by: Uuid | null;
  updated_by: Uuid | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteItemRow extends Record<string, unknown> {
  id: Uuid;
  organization_id: Uuid;
  quote_id: Uuid;
  position: number;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  discount_percent: number;
  line_subtotal: number;
  line_discount: number;
  line_vat: number;
  line_total: number;
  created_at: string;
  updated_at: string;
}


export interface InvoiceRow extends Record<string, unknown> {
  id: Uuid;
  organization_id: Uuid;
  invoice_number: string;
  customer_id: Uuid;
  intervention_id: Uuid | null;
  quote_id: Uuid | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  currency: string;
  discount_type: DiscountType;
  discount_value: number;
  notes: string | null;
  internal_notes: string | null;
  payment_terms: string | null;
  payment_method: string | null;
  subtotal: number;
  discount_total: number;
  net_total: number;
  vat_total: number;
  total: number;
  amount_paid: number;
  sent_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_by: Uuid | null;
  updated_by: Uuid | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItemRow extends Record<string, unknown> {
  id: Uuid;
  organization_id: Uuid;
  invoice_id: Uuid;
  position: number;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  discount_percent: number;
  line_subtotal: number;
  line_discount: number;
  line_vat: number;
  line_total: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogRow extends Record<string, unknown> {
  id: Uuid;
  organization_id: Uuid;
  actor_id: Uuid | null;
  actor_name: string | null;
  action: ActivityAction;
  entity_type: string;
  entity_id: Uuid | null;
  entity_label: string | null;
  summary: string;
  metadata: Json;
  created_at: string;
}

// ---------------------------------------------------------------------------
// RPC result shapes
// ---------------------------------------------------------------------------

export interface CurrentUserOrganization {
  organization_id: Uuid;
  role: OrganizationRole;
  name: string;
  slug: string;
}

export interface DashboardSummary {
  interventions_today: number;
  interventions_upcoming: number;
  interventions_in_progress: number;
  interventions_unassigned: number;
  interventions_to_invoice: number;
  pending_quotes: number;
  pending_quotes_amount: number;
  unpaid_invoices: number;
  unpaid_invoices_amount: number;
  overdue_invoices: number;
  revenue_this_month: number;
  revenue_last_month: number;
  revenue_last_30_days: number;
  active_customers: number;
  active_technicians: number;
}

export interface RevenueByMonth {
  month_start: string;
  invoiced: number;
  paid: number;
}


// ---------------------------------------------------------------------------
// Database (supabase-js generic)
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      organizations: TableDefinition<OrganizationRow, 'name' | 'slug'>;
      profiles: TableDefinition<ProfileRow, 'id'>;
      memberships: TableDefinition<MembershipRow, 'organization_id' | 'user_id'>;
      organization_invitations: TableDefinition<
        OrganizationInvitationRow,
        'organization_id' | 'email'
      >;
      document_sequences: TableDefinition<DocumentSequenceRow, 'organization_id' | 'kind'>;
      customers: TableDefinition<CustomerRow, 'organization_id' | 'type'>;
      customer_addresses: TableDefinition<
        CustomerAddressRow,
        'organization_id' | 'customer_id' | 'address_line1'
      >;
      technicians: TableDefinition<TechnicianRow, 'organization_id' | 'full_name'>;
      interventions: TableDefinition<InterventionRow, 'organization_id' | 'customer_id' | 'title'>;
      intervention_photos: TableDefinition<
        InterventionPhotoRow,
        'organization_id' | 'intervention_id' | 'storage_path'
      >;
      quotes: TableDefinition<QuoteRow, 'organization_id' | 'customer_id'>;
      quote_items: TableDefinition<QuoteItemRow, 'organization_id' | 'quote_id' | 'description'>;
      invoices: TableDefinition<InvoiceRow, 'organization_id' | 'customer_id'>;
      invoice_items: TableDefinition<
        InvoiceItemRow,
        'organization_id' | 'invoice_id' | 'description'
      >;
      activity_log: TableDefinition<
        ActivityLogRow,
        'organization_id' | 'action' | 'entity_type' | 'summary'
      >;
    };
    Views: Record<never, never>;
    Functions: {
      create_organization: {
        Args: { p_name: string; p_country?: string | null; p_currency?: string | null };
        Returns: Uuid;
      };
      accept_invitation: { Args: { p_token: string }; Returns: Uuid };
      current_user_organizations: {
        Args: Record<string, never>;
        Returns: CurrentUserOrganization[];
      };
      dashboard_summary: {
        Args: { p_organization_id: Uuid; p_today?: string };
        Returns: DashboardSummary[];
      };
      revenue_by_month: {
        Args: { p_organization_id: Uuid; p_months?: number };
        Returns: RevenueByMonth[];
      };
      peek_document_number: {
        Args: { p_organization_id: Uuid; p_kind: DocumentKind };
        Returns: string;
      };
      create_invoice_from_quote: {
        Args: { p_quote_id: Uuid; p_issue_date?: string | null; p_due_date?: string | null };
        Returns: Uuid;
      };
      create_invoice_from_intervention: {
        Args: {
          p_intervention_id: Uuid;
          p_issue_date?: string | null;
          p_due_date?: string | null;
        };
        Returns: Uuid;
      };
      mark_overdue_invoices: { Args: Record<string, never>; Returns: number };
      log_activity: {
        Args: {
          p_organization_id: Uuid;
          p_action: ActivityAction;
          p_entity_type: string;
          p_entity_id: Uuid | null;
          p_entity_label: string | null;
          p_summary: string;
          p_metadata?: Json;
        };
        Returns: Uuid;
      };
    };
    Enums: {
      organization_role: OrganizationRole;
      membership_status: MembershipStatus;
      invitation_status: InvitationStatus;
      customer_type: CustomerType;
      customer_status: CustomerStatus;
      technician_status: TechnicianStatus;
      intervention_status: InterventionStatus;
      intervention_priority: InterventionPriority;
      photo_kind: PhotoKind;
      quote_status: QuoteStatus;
      invoice_status: InvoiceStatus;
      document_kind: DocumentKind;
      discount_type: DiscountType;
      activity_action: ActivityAction;
    };
    CompositeTypes: Record<never, never>;
  };
}

/**
 * Convenience aliases used across the application.
 */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

