// Tipos customizados para a aplicação
// Complementam os tipos gerados automaticamente pelo Supabase

export type CompanyStatus = 'active' | 'suspended' | 'deleted';
export type AppRole = 'SUPER_ADMIN' | 'ADMIN_EMPRESA' | 'COLABORADOR';
export type PlayerStatus = 'active' | 'blocked' | 'deleted';
export type RaffleStatus = 'draft' | 'active' | 'paused' | 'finished';
export type PrizeMode = 'FIXED' | 'FIXED_PLUS_PERCENT' | 'PERCENT_ONLY';
export type PrizeType = 'money' | 'object';
export type TicketStatus = 'pending_payment' | 'active' | 'winner' | 'cancelled';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

export type PaymentMethod = 'manual' | 'online';

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  stripe_secret_key_encrypted: string | null;
  stripe_webhook_secret_encrypted: string | null;
  payments_enabled: boolean;
  payment_method: PaymentMethod;
  admin_fee_percentage: number;
  status: CompanyStatus;
  footer_social_links?: any;
  footer_menus?: any;
  community_url?: string | null;
  community_name?: string | null;
  general_regulations?: string | null;
  about_us?: string | null;
  contact_info?: {
    whatsapp?: string;
    phone?: string;
    email?: string;
    address?: string;
    instagram?: string;
    facebook?: string;
  } | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  company_id: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  company_id: string;
  cpf_hash: string;
  cpf_last4: string;
  name: string;
  city: string | null;
  phone: string | null;
  password_hash: string;
  status: PlayerStatus;
  blocked_at: string | null;
  blocked_reason: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Raffle {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  ticket_price: number;
  number_range_start: number;
  number_range_end: number;
  numbers_per_ticket: number;
  status: RaffleStatus;
  prize_mode: PrizeMode;
  fixed_prize_value: number;
  prize_percent_of_sales: number;
  company_profit_percent: number;
  current_draw_count: number;
  rules_version: number;
  image_url: string | null;
  scheduled_at: string | null;
  finished_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrizeTier {
  id: string;
  raffle_id: string;
  hits_required: number;
  prize_percentage: number;
  prize_type: PrizeType;
  purchase_allowed_until_draw_count: number | null;
  object_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface DrawBatch {
  id: string;
  raffle_id: string;
  name: string | null;
  draw_order: number;
  finalized_at: string | null;
  created_at: string;
}

export interface DrawNumber {
  id: string;
  draw_batch_id: string;
  raffle_id: string;
  number: number;
  created_at: string;
}

export interface Ticket {
  id: string;
  raffle_id: string;
  player_id: string;
  company_id: string;
  status: TicketStatus;
  purchased_at: string | null;
  snapshot_data: Record<string, unknown> | null;
  eligible_prize_tiers: string[];
  created_at: string;
  updated_at: string;
}

export interface TicketNumber {
  id: string;
  ticket_id: string;
  number: number;
  created_at: string;
}

export interface TicketRanking {
  id: string;
  ticket_id: string;
  raffle_id: string;
  player_id: string;
  company_id: string;
  hits: number;
  missing: number;
  rank_position: number | null;
  last_calculated_at: string;
}

export interface Payment {
  id: string;
  ticket_id: string;
  company_id: string;
  player_id: string;
  raffle_id: string;
  amount: number;
  original_amount?: number | null;
  discount_percent?: number | null;
  discount_amount?: number | null;
  discount_rule_id?: string | null;
  admin_fee: number;
  net_amount: number;
  company_retention?: number | null;
  prize_pool_contribution?: number | null;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  status: PaymentStatus;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateCommission {
  id: string;
  payment_id: string;
  company_id: string;
  raffle_id: string;
  ticket_id: string;
  sale_amount: number;
  super_admin_percent: number;
  super_admin_amount: number;
  manager_id: string | null;
  manager_percent: number | null;
  manager_gross_amount: number | null;
  manager_net_amount: number | null;
  cambista_id: string | null;
  cambista_percent_of_manager: number | null;
  cambista_percent: number | null;
  cambista_amount: number | null;
  company_net_amount: number;
  company_profit_percent?: number | null;
  company_retention_amount?: number | null;
  prize_pool_contribution?: number | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  company_id: string | null;
  user_id: string | null;
  player_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes_json: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface FinancialLog {
  id: string;
  company_id: string;
  type: string;
  amount: number;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  created_at: string;
}

// Tipos de contexto
export interface AffiliateInfo {
  id: string;
  companySlug: string;
  type: 'manager' | 'cambista';
}

export interface AuthContextType {
  user: { id: string; email: string } | null;
  session: { token: string | null } | null;
  roles: UserRole[];
  affiliateInfo: AffiliateInfo | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isSuperAdmin: boolean;
  isAdminEmpresa: (companyId?: string) => boolean;
  isColaborador: (companyId?: string) => boolean;
}

export interface TenantContextType {
  company: Company | null;
  loading: boolean;
  error: string | null;
  setCompanySlug: (slug: string) => void;
  refetchCompany: () => Promise<void>;
}

// Tipos de ranking público (dados mascarados)
export interface PublicRankingEntry {
  rank_position: number;
  hits: number;
  missing: number;
  player_name_masked: string; // Ex: "Jo*** Si***"
  player_city_masked: string; // Ex: "São P***"
  player_cpf_last4: string; // Ex: "1234"
  purchased_at: string;
}
