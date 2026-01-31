import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { companyId, playerId, raffleId, quantity = 1 } = await req.json();

    if (!companyId || !playerId || !raffleId) {
      throw new Error("Missing required parameters");
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

    // Calculate amounts
    const ticketPrice = Number(raffle.ticket_price);
    const totalAmount = ticketPrice * quantity;
    const adminFee = totalAmount * (Number(company.admin_fee_percentage) / 100);
    const netAmount = totalAmount - adminFee;

    // Create ticket(s)
    const tickets = [];
    for (let i = 0; i < quantity; i++) {
      // Generate random numbers for the ticket
      const numbers = generateRandomNumbers(
        raffle.number_range_start,
        raffle.number_range_end,
        raffle.numbers_per_ticket
      );

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

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        ticket_id: tickets[0].id,
        company_id: companyId,
        player_id: playerId,
        raffle_id: raffleId,
        amount: totalAmount,
        admin_fee: adminFee,
        net_amount: netAmount,
        status: "pending",
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

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
