import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CommissionCalculation {
  saleAmount: number;
  superAdminPercent: number;
  superAdminAmount: number;
  companyNetAmount: number;
  managerId?: string;
  managerPercent?: number;
  managerGrossAmount?: number;
  cambistaId?: string;
  cambistaPercentOfManager?: number;
  cambistaAmount?: number;
  managerNetAmount?: number;
  ratesSnapshot: Record<string, unknown>;
}

function calculateCommissions(
  saleAmount: number,
  superAdminPercent: number,
  manager?: { id: string; name: string; commission_percent: number },
  cambista?: { id: string; name: string; commission_percent: number }
): CommissionCalculation {
  // Super-Admin taxa (sempre primeiro)
  const superAdminAmount = saleAmount * (superAdminPercent / 100);
  let companyNetAmount = saleAmount - superAdminAmount;

  const result: CommissionCalculation = {
    saleAmount,
    superAdminPercent,
    superAdminAmount: Math.round(superAdminAmount * 100) / 100,
    companyNetAmount,
    ratesSnapshot: {
      super_admin_percent: superAdminPercent,
    },
  };

  // Gerente taxa (se existir)
  if (manager && manager.commission_percent > 0) {
    const managerGrossAmount = saleAmount * (manager.commission_percent / 100);
    companyNetAmount -= managerGrossAmount;
    result.managerId = manager.id;
    result.managerPercent = manager.commission_percent;
    result.managerGrossAmount = Math.round(managerGrossAmount * 100) / 100;
    result.managerNetAmount = result.managerGrossAmount;
    result.ratesSnapshot.manager_percent = manager.commission_percent;
    result.ratesSnapshot.manager_name = manager.name;

    // Cambista taxa (se existir, baseado no valor do gerente)
    if (cambista && cambista.commission_percent > 0) {
      const cambistaAmount = managerGrossAmount * (cambista.commission_percent / 100);
      result.cambistaId = cambista.id;
      result.cambistaPercentOfManager = cambista.commission_percent;
      result.cambistaAmount = Math.round(cambistaAmount * 100) / 100;
      result.managerNetAmount = Math.round((managerGrossAmount - cambistaAmount) * 100) / 100;
      result.ratesSnapshot.cambista_percent_of_manager = cambista.commission_percent;
      result.ratesSnapshot.cambista_name = cambista.name;
    }
  }

  result.companyNetAmount = Math.round(companyNetAmount * 100) / 100;
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { companyId, playerId, raffleId, quantity = 1, ticketNumbers, affiliateId } = await req.json();

    if (!companyId || !playerId || !raffleId) {
      throw new Error("Missing required parameters");
    }
    
    // Validate ticketNumbers if provided
    const hasCustomNumbers = ticketNumbers && Array.isArray(ticketNumbers) && ticketNumbers.length > 0;
    if (hasCustomNumbers && ticketNumbers.length !== quantity) {
      throw new Error("Number of ticket number sets must match quantity");
    }

    // Rate limiting for checkout (10 attempts per 10 minutes per player)
    const checkoutIdentifier = `checkout:${playerId}`;
    const { data: checkoutAllowed } = await supabase.rpc("check_rate_limit", {
      p_identifier: checkoutIdentifier,
      p_action: "checkout",
      p_max_attempts: 10,
      p_window_seconds: 600,
      p_block_seconds: 900,
    });

    if (!checkoutAllowed) {
      throw new Error("Muitas tentativas de compra. Tente novamente em 15 minutos.");
    }

    // Fetch company with Stripe keys
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      throw new Error("Company not found");
    }

    if (!company.payments_enabled) {
      throw new Error("Pagamentos não habilitados para esta empresa");
    }

    if (!company.stripe_secret_key_encrypted) {
      throw new Error("Stripe não configurado para esta empresa");
    }

    // Decode Stripe key
    const stripeSecretKey = atob(company.stripe_secret_key_encrypted);

    // Fetch raffle
    const { data: raffle, error: raffleError } = await supabase
      .from("raffles")
      .select("*")
      .eq("id", raffleId)
      .eq("company_id", companyId)
      .eq("status", "active")
      .single();

    if (raffleError || !raffle) {
      throw new Error("Sorteio não encontrado ou não está ativo");
    }

    // Fetch player
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("id", playerId)
      .eq("company_id", companyId)
      .single();

    if (playerError || !player) {
      throw new Error("Jogador não encontrado");
    }

    // Fetch Super-Admin fee
    const { data: platformSettings } = await supabase
      .from("platform_settings")
      .select("*")
      .eq("key", "super_admin_fee_percent")
      .single();

    const superAdminFeePercent = platformSettings?.value?.value ?? 10;

    // Fetch affiliate chain if provided
    let manager: { id: string; name: string; commission_percent: number } | undefined;
    let cambista: { id: string; name: string; commission_percent: number } | undefined;

    if (affiliateId) {
      const { data: affiliate } = await supabase
        .from("affiliates")
        .select("*")
        .eq("id", affiliateId)
        .eq("company_id", companyId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .single();

      if (affiliate) {
        if (affiliate.type === "cambista" && affiliate.parent_affiliate_id) {
          // Fetch parent manager
          const { data: parentManager } = await supabase
            .from("affiliates")
            .select("*")
            .eq("id", affiliate.parent_affiliate_id)
            .eq("is_active", true)
            .single();

          if (parentManager) {
            manager = {
              id: parentManager.id,
              name: parentManager.name,
              commission_percent: Number(parentManager.commission_percent),
            };
            cambista = {
              id: affiliate.id,
              name: affiliate.name,
              commission_percent: Number(affiliate.commission_percent),
            };
          }
        } else if (affiliate.type === "manager") {
          manager = {
            id: affiliate.id,
            name: affiliate.name,
            commission_percent: Number(affiliate.commission_percent),
          };
        }
      }
    }

    // Calculate amounts with commissions
    const ticketPrice = Number(raffle.ticket_price);
    const totalAmount = ticketPrice * quantity;
    const commissionCalc = calculateCommissions(totalAmount, superAdminFeePercent, manager, cambista);

    // Create ticket(s)
    const tickets = [];
    for (let i = 0; i < quantity; i++) {
      // Use provided numbers or generate random ones
      let numbers: number[];
      if (hasCustomNumbers && ticketNumbers[i]) {
        numbers = ticketNumbers[i].sort((a: number, b: number) => a - b);
        // Validate the numbers are within range
        const validNumbers = numbers.every(
          (n: number) => n >= raffle.number_range_start && n <= raffle.number_range_end
        );
        if (!validNumbers || numbers.length !== raffle.numbers_per_ticket) {
          throw new Error(`Invalid numbers for ticket ${i + 1}`);
        }
      } else {
        numbers = generateRandomNumbers(
          raffle.number_range_start,
          raffle.number_range_end,
          raffle.numbers_per_ticket
        );
      }

      // Get eligible prize tiers based on current draw count
      const { data: eligibleTiers } = await supabase
        .from("prize_tiers")
        .select("id")
        .eq("raffle_id", raffleId)
        .or(`purchase_allowed_until_draw_count.is.null,purchase_allowed_until_draw_count.gte.${raffle.current_draw_count || 0}`);

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          raffle_id: raffleId,
          player_id: playerId,
          company_id: companyId,
          status: "pending_payment",
          affiliate_id: affiliateId || null,
          eligible_prize_tiers: eligibleTiers?.map(t => t.id) || [],
          snapshot_data: {
            raffle_name: raffle.name,
            ticket_price: ticketPrice,
            prize_mode: raffle.prize_mode,
            fixed_prize_value: raffle.fixed_prize_value,
            prize_percent_of_sales: raffle.prize_percent_of_sales,
            rules_version: raffle.rules_version,
            draw_count_at_purchase: raffle.current_draw_count || 0,
          },
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Insert ticket numbers
      const { error: numbersError } = await supabase
        .from("ticket_numbers")
        .insert(numbers.map(n => ({ ticket_id: ticket.id, number: n })));

      if (numbersError) throw numbersError;

      tickets.push(ticket);
    }

    // Create payment record (using old admin_fee for backward compatibility)
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        ticket_id: tickets[0].id,
        company_id: companyId,
        player_id: playerId,
        raffle_id: raffleId,
        amount: totalAmount,
        admin_fee: commissionCalc.superAdminAmount,
        net_amount: commissionCalc.companyNetAmount,
        status: "pending",
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Create affiliate_commissions record for detailed split tracking
    const { error: commissionError } = await supabase
      .from("affiliate_commissions")
      .insert({
        payment_id: payment.id,
        ticket_id: tickets[0].id,
        company_id: companyId,
        raffle_id: raffleId,
        sale_amount: commissionCalc.saleAmount,
        super_admin_percent: commissionCalc.superAdminPercent,
        super_admin_amount: commissionCalc.superAdminAmount,
        company_net_amount: commissionCalc.companyNetAmount,
        manager_id: commissionCalc.managerId || null,
        manager_percent: commissionCalc.managerPercent || null,
        manager_gross_amount: commissionCalc.managerGrossAmount || null,
        cambista_id: commissionCalc.cambistaId || null,
        cambista_percent_of_manager: commissionCalc.cambistaPercentOfManager || null,
        cambista_amount: commissionCalc.cambistaAmount || null,
        manager_net_amount: commissionCalc.managerNetAmount || null,
        rates_snapshot: commissionCalc.ratesSnapshot,
      });

    if (commissionError) {
      console.error("Error creating commission record:", commissionError);
    }

    // Create Stripe checkout session
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: `Cartela - ${raffle.name}`,
              description: `${quantity} cartela(s) com ${raffle.numbers_per_ticket} números cada`,
            },
            unit_amount: Math.round(ticketPrice * 100), // Convert to cents
          },
          quantity,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/empresa/${company.slug}/compra-sucesso?payment_id=${payment.id}`,
      cancel_url: `${req.headers.get("origin")}/empresa/${company.slug}?cancelled=true`,
      metadata: {
        payment_id: payment.id,
        company_id: companyId,
        player_id: playerId,
        raffle_id: raffleId,
        ticket_ids: tickets.map(t => t.id).join(","),
        affiliate_id: affiliateId || "",
      },
    });

    // Update payment with Stripe session ID
    await supabase
      .from("payments")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", payment.id);

    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl: session.url,
        paymentId: payment.id,
        ticketIds: tickets.map(t => t.id),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in create-ticket-checkout:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});

function generateRandomNumbers(start: number, end: number, count: number): number[] {
  const available = [];
  for (let i = start; i <= end; i++) {
    available.push(i);
  }

  const selected: number[] = [];
  for (let i = 0; i < count && available.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * available.length);
    selected.push(available.splice(randomIndex, 1)[0]);
  }

  return selected.sort((a, b) => a - b);
}
