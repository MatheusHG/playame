import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const { paymentId, playerId } = await req.json();

    if (!paymentId || !playerId) {
      throw new Error("Missing required parameters");
    }

    // Fetch payment with company info
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*, company:companies(*)")
      .eq("id", paymentId)
      .eq("player_id", playerId)
      .eq("status", "pending")
      .single();

    if (paymentError || !payment) {
      throw new Error("Pagamento pendente não encontrado");
    }

    if (!payment.stripe_checkout_session_id) {
      throw new Error("Sessão de checkout não encontrada");
    }

    const company = (payment as any).company;
    if (!company?.stripe_secret_key_encrypted) {
      throw new Error("Stripe não configurado para esta empresa");
    }

    const stripeSecretKey = atob(company.stripe_secret_key_encrypted);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

    // Retrieve the checkout session to get its URL and status
    const session = await stripe.checkout.sessions.retrieve(payment.stripe_checkout_session_id);

    if (session.status === "complete") {
      // Payment was actually completed - this shouldn't happen but handle it
      return new Response(
        JSON.stringify({ error: "Este pagamento já foi concluído.", completed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (session.status === "expired") {
      // Session expired, need to create a new one
      // Fetch raffle for metadata
      const { data: raffle } = await supabase
        .from("raffles")
        .select("name, numbers_per_ticket")
        .eq("id", payment.raffle_id)
        .single();

      // Fetch ticket IDs for this payment
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id")
        .eq("raffle_id", payment.raffle_id)
        .eq("player_id", playerId)
        .eq("status", "pending_payment");

      const ticketIds = tickets?.map((t) => t.id) || [];
      const quantity = ticketIds.length || 1;

      const newSession = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: `${quantity} cartela(s) - ${raffle?.name || "Sorteio"}`,
                description: `${quantity} cartela(s) com ${raffle?.numbers_per_ticket || 10} números cada`,
              },
              unit_amount: Math.round(Number(payment.amount) * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.headers.get("origin")}/empresa/${company.slug}/compra-sucesso?payment_id=${payment.id}`,
        cancel_url: `${req.headers.get("origin")}/empresa/${company.slug}?cancelled=true`,
        metadata: {
          payment_id: payment.id,
          company_id: payment.company_id,
          player_id: playerId,
          raffle_id: payment.raffle_id,
          ticket_ids: ticketIds.join(","),
        },
      });

      // Update payment with new session ID
      await supabase
        .from("payments")
        .update({ stripe_checkout_session_id: newSession.id })
        .eq("id", payment.id);

      return new Response(
        JSON.stringify({ checkoutUrl: newSession.url, renewed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Session is still open - return the URL
    if (session.url) {
      return new Response(
        JSON.stringify({ checkoutUrl: session.url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    throw new Error("Não foi possível recuperar o link de pagamento");
  } catch (error) {
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    } else {
      try { errorMessage = JSON.stringify(error); } catch { errorMessage = String(error); }
    }
    console.error("Error in resume-checkout:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
