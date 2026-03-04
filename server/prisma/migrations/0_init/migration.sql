-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "company_status" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "app_role" AS ENUM ('SUPER_ADMIN', 'ADMIN_EMPRESA', 'COLABORADOR');

-- CreateEnum
CREATE TYPE "affiliate_type" AS ENUM ('manager', 'cambista');

-- CreateEnum
CREATE TYPE "player_status" AS ENUM ('active', 'blocked', 'deleted');

-- CreateEnum
CREATE TYPE "raffle_status" AS ENUM ('draft', 'active', 'paused', 'finished');

-- CreateEnum
CREATE TYPE "prize_mode" AS ENUM ('FIXED', 'FIXED_PLUS_PERCENT', 'PERCENT_ONLY');

-- CreateEnum
CREATE TYPE "prize_type" AS ENUM ('money', 'object');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('pending_payment', 'active', 'winner', 'cancelled');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('manual', 'online');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "custom_domain" TEXT,
    "logo_url" TEXT,
    "primary_color" TEXT DEFAULT '#3B82F6',
    "secondary_color" TEXT DEFAULT '#1E40AF',
    "stripe_secret_key_encrypted" TEXT,
    "stripe_webhook_secret_encrypted" TEXT,
    "payments_enabled" BOOLEAN DEFAULT false,
    "payment_method" "payment_method" NOT NULL DEFAULT 'manual',
    "admin_fee_percentage" DECIMAL(5,2) DEFAULT 10.00,
    "status" "company_status" DEFAULT 'active',
    "footer_social_links" JSONB DEFAULT '[]',
    "footer_menus" JSONB DEFAULT '[]',
    "community_url" TEXT,
    "community_name" TEXT,
    "general_regulations" TEXT,
    "about_us" TEXT,
    "contact_info" JSONB DEFAULT '{}',
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role" "app_role" NOT NULL,
    "company_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "cpf_hash" TEXT NOT NULL,
    "cpf_last4" TEXT NOT NULL,
    "cpf_encrypted" TEXT,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "status" "player_status" DEFAULT 'active',
    "blocked_at" TIMESTAMPTZ,
    "blocked_reason" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raffles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "ticket_price" DECIMAL(10,2) NOT NULL,
    "number_range_start" INTEGER NOT NULL DEFAULT 0,
    "number_range_end" INTEGER NOT NULL DEFAULT 99,
    "numbers_per_ticket" INTEGER NOT NULL DEFAULT 10,
    "status" "raffle_status" DEFAULT 'draft',
    "prize_mode" "prize_mode" DEFAULT 'PERCENT_ONLY',
    "fixed_prize_value" DECIMAL(12,2) DEFAULT 0,
    "prize_percent_of_sales" DECIMAL(5,2) DEFAULT 100,
    "company_profit_percent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "current_draw_count" INTEGER DEFAULT 0,
    "rules_version" INTEGER DEFAULT 1,
    "regulations" TEXT,
    "scheduled_at" TIMESTAMPTZ,
    "finished_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raffles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prize_tiers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "raffle_id" UUID NOT NULL,
    "hits_required" INTEGER NOT NULL,
    "prize_percentage" DECIMAL(5,2) NOT NULL,
    "prize_type" "prize_type" DEFAULT 'money',
    "purchase_allowed_until_draw_count" INTEGER,
    "object_description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prize_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draw_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "raffle_id" UUID NOT NULL,
    "name" TEXT,
    "draw_order" INTEGER NOT NULL,
    "finalized_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draw_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draw_numbers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "draw_batch_id" UUID NOT NULL,
    "raffle_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draw_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "raffle_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "affiliate_id" UUID,
    "status" "ticket_status" DEFAULT 'pending_payment',
    "purchased_at" TIMESTAMPTZ,
    "snapshot_data" JSONB,
    "eligible_prize_tiers" UUID[] DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_numbers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_ranking" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "raffle_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "hits" INTEGER DEFAULT 0,
    "missing" INTEGER NOT NULL,
    "rank_position" INTEGER,
    "last_calculated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_ranking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "raffle_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "admin_fee" DECIMAL(12,2) DEFAULT 0,
    "net_amount" DECIMAL(12,2) NOT NULL,
    "original_amount" DECIMAL(12,2),
    "discount_percent" DECIMAL(5,2) DEFAULT 0,
    "discount_amount" DECIMAL(12,2) DEFAULT 0,
    "discount_rule_id" UUID,
    "company_retention" DECIMAL(12,2) DEFAULT 0,
    "prize_pool_contribution" DECIMAL(12,2) DEFAULT 0,
    "stripe_payment_intent_id" TEXT,
    "stripe_checkout_session_id" TEXT,
    "status" "payment_status" DEFAULT 'pending',
    "processed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID,
    "user_id" UUID,
    "player_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "changes_json" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference_id" UUID,
    "reference_type" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID,
    "event_type" TEXT NOT NULL,
    "event_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'received',
    "error_message" TEXT,
    "processing_time_ms" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "parent_affiliate_id" UUID,
    "user_id" UUID,
    "type" "affiliate_type" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "link_code" TEXT NOT NULL,
    "is_sales_paused" BOOLEAN NOT NULL DEFAULT false,
    "paused_at" TIMESTAMPTZ,
    "paused_by" UUID,
    "commission_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "permission_profile_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_commissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "raffle_id" UUID NOT NULL,
    "sale_amount" DECIMAL(12,2) NOT NULL,
    "super_admin_percent" DECIMAL(5,2) NOT NULL,
    "super_admin_amount" DECIMAL(12,2) NOT NULL,
    "company_net_amount" DECIMAL(12,2) NOT NULL,
    "manager_id" UUID,
    "manager_percent" DECIMAL(5,2),
    "manager_gross_amount" DECIMAL(12,2),
    "cambista_id" UUID,
    "cambista_percent_of_manager" DECIMAL(5,2),
    "cambista_amount" DECIMAL(12,2),
    "manager_net_amount" DECIMAL(12,2),
    "company_profit_percent" DECIMAL(5,2),
    "company_retention_amount" DECIMAL(12,2) DEFAULT 0,
    "prize_pool_contribution" DECIMAL(12,2) DEFAULT 0,
    "rates_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rate_changes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "field_changed" TEXT NOT NULL,
    "old_value" DECIMAL(5,2),
    "new_value" DECIMAL(5,2),
    "changed_by" UUID,
    "company_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_rate_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "affiliate_type" "affiliate_type" NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "changed_by" UUID,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "attempts" INTEGER DEFAULT 1,
    "first_attempt_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "last_attempt_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "blocked_until" TIMESTAMPTZ,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_banners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "redirect_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raffle_discounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "raffle_id" UUID NOT NULL,
    "min_quantity" INTEGER NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raffle_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "companies_custom_domain_key" ON "companies"("custom_domain");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_company_id_idx" ON "user_roles"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_company_id_key" ON "user_roles"("user_id", "role", "company_id");

-- CreateIndex
CREATE INDEX "players_company_id_idx" ON "players"("company_id");

-- CreateIndex
CREATE INDEX "players_cpf_hash_idx" ON "players"("cpf_hash");

-- CreateIndex
CREATE UNIQUE INDEX "players_company_id_cpf_hash_key" ON "players"("company_id", "cpf_hash");

-- CreateIndex
CREATE INDEX "raffles_company_id_idx" ON "raffles"("company_id");

-- CreateIndex
CREATE INDEX "raffles_status_idx" ON "raffles"("status");

-- CreateIndex
CREATE INDEX "prize_tiers_raffle_id_idx" ON "prize_tiers"("raffle_id");

-- CreateIndex
CREATE UNIQUE INDEX "prize_tiers_raffle_id_hits_required_key" ON "prize_tiers"("raffle_id", "hits_required");

-- CreateIndex
CREATE INDEX "draw_batches_raffle_id_idx" ON "draw_batches"("raffle_id");

-- CreateIndex
CREATE UNIQUE INDEX "draw_batches_raffle_id_draw_order_key" ON "draw_batches"("raffle_id", "draw_order");

-- CreateIndex
CREATE INDEX "draw_numbers_raffle_id_idx" ON "draw_numbers"("raffle_id");

-- CreateIndex
CREATE INDEX "draw_numbers_draw_batch_id_idx" ON "draw_numbers"("draw_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "draw_numbers_raffle_id_number_key" ON "draw_numbers"("raffle_id", "number");

-- CreateIndex
CREATE INDEX "tickets_raffle_id_idx" ON "tickets"("raffle_id");

-- CreateIndex
CREATE INDEX "tickets_player_id_idx" ON "tickets"("player_id");

-- CreateIndex
CREATE INDEX "tickets_company_id_idx" ON "tickets"("company_id");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_raffle_id_status_idx" ON "tickets"("raffle_id", "status");

-- CreateIndex
CREATE INDEX "tickets_affiliate_id_idx" ON "tickets"("affiliate_id");

-- CreateIndex
CREATE INDEX "ticket_numbers_ticket_id_idx" ON "ticket_numbers"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_numbers_ticket_id_number_key" ON "ticket_numbers"("ticket_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_ranking_ticket_id_key" ON "ticket_ranking"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_ranking_raffle_id_idx" ON "ticket_ranking"("raffle_id");

-- CreateIndex
CREATE INDEX "ticket_ranking_company_id_idx" ON "ticket_ranking"("company_id");

-- CreateIndex
CREATE INDEX "ticket_ranking_raffle_id_rank_position_idx" ON "ticket_ranking"("raffle_id", "rank_position");

-- CreateIndex
CREATE INDEX "ticket_ranking_raffle_id_hits_missing_idx" ON "ticket_ranking"("raffle_id", "hits" DESC, "missing" ASC);

-- CreateIndex
CREATE INDEX "payments_company_id_idx" ON "payments"("company_id");

-- CreateIndex
CREATE INDEX "payments_player_id_idx" ON "payments"("player_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_idx" ON "audit_logs"("company_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "financial_logs_company_id_idx" ON "financial_logs"("company_id");

-- CreateIndex
CREATE INDEX "financial_logs_created_at_idx" ON "financial_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "financial_logs_user_id_idx" ON "financial_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_link_code_key" ON "affiliates"("link_code");

-- CreateIndex
CREATE INDEX "affiliates_company_id_idx" ON "affiliates"("company_id");

-- CreateIndex
CREATE INDEX "affiliates_parent_affiliate_id_idx" ON "affiliates"("parent_affiliate_id");

-- CreateIndex
CREATE INDEX "affiliates_type_idx" ON "affiliates"("type");

-- CreateIndex
CREATE INDEX "affiliate_commissions_payment_id_idx" ON "affiliate_commissions"("payment_id");

-- CreateIndex
CREATE INDEX "affiliate_commissions_company_id_idx" ON "affiliate_commissions"("company_id");

-- CreateIndex
CREATE INDEX "affiliate_commissions_manager_id_idx" ON "affiliate_commissions"("manager_id");

-- CreateIndex
CREATE INDEX "affiliate_commissions_cambista_id_idx" ON "affiliate_commissions"("cambista_id");

-- CreateIndex
CREATE INDEX "commission_rate_changes_entity_type_entity_id_idx" ON "commission_rate_changes"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "permission_profiles_company_id_name_key" ON "permission_profiles"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");

-- CreateIndex
CREATE INDEX "rate_limits_last_attempt_at_idx" ON "rate_limits"("last_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_identifier_action_key" ON "rate_limits"("identifier", "action");

-- CreateIndex
CREATE INDEX "raffle_discounts_raffle_id_idx" ON "raffle_discounts"("raffle_id");

-- CreateIndex
CREATE INDEX "raffle_discounts_is_active_idx" ON "raffle_discounts"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "raffle_discounts_raffle_id_min_quantity_key" ON "raffle_discounts"("raffle_id", "min_quantity");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffles" ADD CONSTRAINT "raffles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prize_tiers" ADD CONSTRAINT "prize_tiers_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_batches" ADD CONSTRAINT "draw_batches_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_numbers" ADD CONSTRAINT "draw_numbers_draw_batch_id_fkey" FOREIGN KEY ("draw_batch_id") REFERENCES "draw_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_numbers" ADD CONSTRAINT "draw_numbers_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_numbers" ADD CONSTRAINT "ticket_numbers_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_ranking" ADD CONSTRAINT "ticket_ranking_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_ranking" ADD CONSTRAINT "ticket_ranking_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_ranking" ADD CONSTRAINT "ticket_ranking_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_ranking" ADD CONSTRAINT "ticket_ranking_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_discount_rule_id_fkey" FOREIGN KEY ("discount_rule_id") REFERENCES "raffle_discounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_logs" ADD CONSTRAINT "financial_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_logs" ADD CONSTRAINT "financial_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_parent_affiliate_id_fkey" FOREIGN KEY ("parent_affiliate_id") REFERENCES "affiliates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_permission_profile_id_fkey" FOREIGN KEY ("permission_profile_id") REFERENCES "permission_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "affiliates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_cambista_id_fkey" FOREIGN KEY ("cambista_id") REFERENCES "affiliates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rate_changes" ADD CONSTRAINT "commission_rate_changes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_profiles" ADD CONSTRAINT "permission_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_audit_logs" ADD CONSTRAINT "permission_audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_banners" ADD CONSTRAINT "company_banners_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffle_discounts" ADD CONSTRAINT "raffle_discounts_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

