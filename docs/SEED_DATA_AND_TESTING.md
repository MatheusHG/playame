# Seed Data & Manual Test Checklist

## Seed Data Description

This document describes the test data configuration for validating the complete raffle purchase, webhook, ranking, and settlement flow.

### Test Companies

#### Company 1: "Loteria do Sul"
- **Slug**: `loteria-do-sul`
- **Status**: active
- **Admin Fee**: 10%
- **Payments Enabled**: true (requires Stripe config)

#### Company 2: "Bingo Nacional"
- **Slug**: `bingo-nacional`
- **Status**: active
- **Admin Fee**: 15%
- **Payments Enabled**: true (requires Stripe config)

### Test Raffles

#### Raffle 1 (Loteria do Sul): "Mega Sorteio de Verão"
- **Status**: active
- **Ticket Price**: R$ 25.00
- **Numbers Per Ticket**: 10
- **Range**: 1-80
- **Prize Mode**: PERCENT_ONLY (100% of sales)

**Prize Tiers:**
| Hits | Percentage | Type | RF105 Limit |
|------|------------|------|-------------|
| 10 | 50% | money | null (sempre) |
| 8 | 30% | money | 3 (até 3 rodadas) |
| 6 | 20% | money | 5 (até 5 rodadas) |

#### Raffle 2 (Bingo Nacional): "Bingo de Natal"
- **Status**: active
- **Ticket Price**: R$ 10.00
- **Numbers Per Ticket**: 5
- **Range**: 1-50
- **Prize Mode**: FIXED (R$ 5,000.00)

**Prize Tiers:**
| Hits | Percentage | Type | RF105 Limit |
|------|------------|------|-------------|
| 5 | 100% | money | null |

### Test Players

#### Player 1 (Loteria do Sul): "João Silva"
- **CPF**: 123.456.789-09 (hash stored)
- **City**: São Paulo
- **Status**: active

#### Player 2 (Loteria do Sul): "Maria Santos"
- **CPF**: 987.654.321-00 (hash stored)
- **City**: Rio de Janeiro
- **Status**: active

#### Player 3 (Bingo Nacional): "Pedro Oliveira"
- **CPF**: 111.222.333-96 (hash stored)
- **City**: Curitiba
- **Status**: active

---

## Manual Test Checklist

### Pre-requisites
- [ ] Super Admin account created
- [ ] At least one company with Stripe keys configured
- [ ] Company has `payments_enabled = true`
- [ ] Stripe webhook endpoint configured in Stripe Dashboard

### 1. Player Registration & Login Flow

#### 1.1 Registration
- [ ] Navigate to company landing page: `/empresa/{slug}`
- [ ] Click "Participar" or ticket purchase button
- [ ] Modal opens for player authentication
- [ ] Enter valid CPF (e.g., 123.456.789-09)
- [ ] Fill name, city, phone, password
- [ ] Click "Cadastrar"
- [ ] ✅ Success: Player created, session token received

#### 1.2 Login
- [ ] Log out or clear session
- [ ] Try to purchase ticket again
- [ ] Enter same CPF and password
- [ ] ✅ Success: Login works, session restored

#### 1.3 Rate Limiting
- [ ] Attempt login 6 times with wrong password
- [ ] ✅ Expected: "Muitas tentativas de login" error after 5th attempt

---

### 2. Ticket Purchase Flow (Snapshot & RF105)

#### 2.1 Create Ticket Checkout
- [ ] Log in as player
- [ ] Select raffle with active status
- [ ] Click "Comprar Cartela"
- [ ] Verify redirect to Stripe Checkout
- [ ] Note: Ticket created with status `pending_payment`

#### 2.2 Verify Snapshot Data
After ticket creation (before payment):
```sql
SELECT id, status, snapshot_data, eligible_prize_tiers
FROM tickets
WHERE player_id = '{player_id}'
ORDER BY created_at DESC LIMIT 1;
```
- [ ] ✅ `snapshot_data` contains: raffle_name, ticket_price, prize_mode, rules_version
- [ ] ✅ `eligible_prize_tiers` contains tier IDs respecting RF105

#### 2.3 RF105 Eligibility Verification
- [ ] Create raffle with 2 tiers: Tier A (no limit), Tier B (limit = 2 draws)
- [ ] Complete 3 draw batches
- [ ] Purchase new ticket
- [ ] ✅ Expected: `eligible_prize_tiers` contains only Tier A

---

### 3. Stripe Webhook Flow

#### 3.1 Complete Payment in Stripe
- [ ] Complete checkout in Stripe test mode
- [ ] Use test card: 4242 4242 4242 4242

#### 3.2 Webhook Processing
- [ ] Check Stripe Dashboard → Developers → Webhooks
- [ ] Verify `checkout.session.completed` event received
- [ ] Verify event status = "Succeeded"

#### 3.3 Ticket Activation
```sql
SELECT id, status, purchased_at FROM tickets WHERE id = '{ticket_id}';
```
- [ ] ✅ `status` changed from `pending_payment` to `active`
- [ ] ✅ `purchased_at` timestamp is set

#### 3.4 Payment Record Updated
```sql
SELECT status, stripe_payment_intent_id, processed_at FROM payments WHERE ticket_id = '{ticket_id}';
```
- [ ] ✅ `status` = `succeeded`
- [ ] ✅ `stripe_payment_intent_id` is populated
- [ ] ✅ `processed_at` timestamp is set

#### 3.5 Financial Logs Created
```sql
SELECT type, amount, description FROM financial_logs WHERE company_id = '{company_id}' ORDER BY created_at DESC;
```
- [ ] ✅ `TICKET_SALE` log with positive amount
- [ ] ✅ `ADMIN_FEE` log with negative amount

#### 3.6 Audit Log Created
```sql
SELECT action, entity_type, changes_json FROM audit_logs WHERE entity_type = 'ticket' ORDER BY created_at DESC;
```
- [ ] ✅ `TICKET_PURCHASED` action logged
- [ ] ✅ `changes_json` contains payment_id, ticket_count

---

### 4. Ranking System

#### 4.1 Initial Ranking Calculation
After ticket is activated:
```sql
SELECT * FROM ticket_ranking WHERE ticket_id = '{ticket_id}';
```
- [ ] ✅ Ranking entry exists
- [ ] ✅ `hits` = 0 (no numbers drawn yet)
- [ ] ✅ `missing` = numbers_per_ticket

#### 4.2 Draw Number and Recalculate
1. [ ] Go to Admin → Sorteios → View raffle
2. [ ] Create new draw batch
3. [ ] Add numbers that match some ticket numbers
4. [ ] Click "Finalizar Rodada"

#### 4.3 Verify Ranking Update
```sql
SELECT hits, missing, rank_position FROM ticket_ranking WHERE raffle_id = '{raffle_id}' ORDER BY rank_position;
```
- [ ] ✅ `hits` updated correctly
- [ ] ✅ `missing` = numbers_per_ticket - hits
- [ ] ✅ `rank_position` ordered: lowest missing → highest hits → oldest purchase

#### 4.4 Ranking UI Verification
- [ ] Navigate to raffle view → "Ranking" tab
- [ ] ✅ Ranking table shows correct positions
- [ ] ✅ Progress bar shows completion percentage
- [ ] ✅ Top 3 have special icons (trophy, medal, award)

---

### 5. Raffle Settlement (Apuração)

#### 5.1 Pause Raffle
- [ ] Navigate to raffle view
- [ ] Click "Pausar" to pause raffle
- [ ] ✅ Status changes to "Pausado"

#### 5.2 Open Settlement Dialog
- [ ] Click "Encerrar e Apurar Sorteio"
- [ ] ✅ Warning dialog appears with explanation

#### 5.3 Execute Settlement
- [ ] Click "Confirmar Encerramento"
- [ ] ✅ Settlement function executes
- [ ] ✅ Results displayed: total_sales, prize_pool, winners

#### 5.4 Verify Winners
```sql
SELECT t.id, t.status, tr.hits, p.name
FROM tickets t
JOIN ticket_ranking tr ON tr.ticket_id = t.id
JOIN players p ON p.id = t.player_id
WHERE t.raffle_id = '{raffle_id}' AND t.status = 'winner';
```
- [ ] ✅ Winner tickets have status = 'winner'
- [ ] ✅ Winners meet tier requirements (hits >= hits_required)

#### 5.5 RF105 Eligibility Respected
```sql
SELECT t.id, t.eligible_prize_tiers, pt.id as tier_id, pt.hits_required
FROM tickets t
CROSS JOIN prize_tiers pt
WHERE t.raffle_id = '{raffle_id}'
  AND t.status = 'winner';
```
- [ ] ✅ Winners only received prizes for tiers in their `eligible_prize_tiers`

#### 5.6 Financial Logs for Prizes
```sql
SELECT type, amount, description FROM financial_logs WHERE type = 'PRIZE_PAYOUT';
```
- [ ] ✅ `PRIZE_PAYOUT` entries for each winner
- [ ] ✅ Amounts match tier percentages

---

### 6. Security Tests

#### 6.1 Rate Limiting - Login
- [ ] Attempt 6 failed logins
- [ ] ✅ Blocked after 5 attempts

#### 6.2 Rate Limiting - Checkout
- [ ] Attempt 11 checkouts in 10 minutes
- [ ] ✅ Blocked after 10 attempts

#### 6.3 Sensitive Data Protection
```sql
-- Should NOT contain raw CPF values
SELECT * FROM players LIMIT 5;
SELECT * FROM audit_logs WHERE action = 'PLAYER_REGISTERED';
```
- [ ] ✅ No raw CPF in players table
- [ ] ✅ No CPF in audit_logs.changes_json

#### 6.4 Stripe Keys Protected
```sql
SELECT stripe_secret_key_encrypted FROM companies LIMIT 1;
```
- [ ] ✅ Keys are base64 encoded (starts with encoded chars)
- [ ] ✅ No plain text keys in logs

---

### 7. UI Component Tests

#### 7.1 Tickets List Tab
- [ ] Navigate to raffle view → "Cartelas" tab
- [ ] ✅ Table shows all non-cancelled tickets
- [ ] ✅ Player name and masked CPF visible
- [ ] ✅ Ticket numbers displayed
- [ ] ✅ Status badges correct

#### 7.2 Ranking Tab
- [ ] Navigate to raffle view → "Ranking" tab
- [ ] ✅ Real-time refresh every 30 seconds
- [ ] ✅ Correct position ordering
- [ ] ✅ Missing column highlighted for low values

#### 7.3 Settlement Dialog
- [ ] Open settlement dialog
- [ ] ✅ Warning message clear
- [ ] ✅ Results show after settlement
- [ ] ✅ Winners table formatted correctly

---

## SQL Seed Script

```sql
-- IMPORTANT: Run this after Stripe is configured for each company

-- Insert test companies (replace with actual company IDs after creation)
-- Companies should be created via Super Admin UI with Stripe keys

-- Verify companies exist
SELECT id, name, slug, payments_enabled FROM companies;

-- Insert test raffle for existing company
INSERT INTO raffles (company_id, name, description, ticket_price, number_range_start, number_range_end, numbers_per_ticket, status, prize_mode, prize_percent_of_sales)
SELECT id, 'Mega Sorteio de Verão', 'Sorteio especial com prêmios incríveis', 25.00, 1, 80, 10, 'active', 'PERCENT_ONLY', 100
FROM companies WHERE slug = 'loteria-do-sul'
ON CONFLICT DO NOTHING;

-- Insert prize tiers
INSERT INTO prize_tiers (raffle_id, hits_required, prize_percentage, prize_type, purchase_allowed_until_draw_count)
SELECT r.id, 10, 50, 'money', NULL
FROM raffles r JOIN companies c ON c.id = r.company_id
WHERE c.slug = 'loteria-do-sul' AND r.name = 'Mega Sorteio de Verão'
ON CONFLICT DO NOTHING;

INSERT INTO prize_tiers (raffle_id, hits_required, prize_percentage, prize_type, purchase_allowed_until_draw_count)
SELECT r.id, 8, 30, 'money', 3
FROM raffles r JOIN companies c ON c.id = r.company_id
WHERE c.slug = 'loteria-do-sul' AND r.name = 'Mega Sorteio de Verão'
ON CONFLICT DO NOTHING;

INSERT INTO prize_tiers (raffle_id, hits_required, prize_percentage, prize_type, purchase_allowed_until_draw_count)
SELECT r.id, 6, 20, 'money', 5
FROM raffles r JOIN companies c ON c.id = r.company_id
WHERE c.slug = 'loteria-do-sul' AND r.name = 'Mega Sorteio de Verão'
ON CONFLICT DO NOTHING;
```

---

## Expected Results Summary

| Flow | Expected Outcome |
|------|------------------|
| Player Registration | Player created, audit logged, session returned |
| Ticket Purchase | Ticket pending, snapshot frozen, RF105 calculated |
| Stripe Webhook | Ticket activated, payment updated, financial logs |
| Draw Finalization | Ranking recalculated for all tickets |
| Settlement | Winners determined, status updated, prizes logged |
| Rate Limiting | Blocked after threshold, unblocked after timeout |
