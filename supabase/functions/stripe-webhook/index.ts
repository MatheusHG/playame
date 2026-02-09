import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
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
    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("Missing stripe-signature header");
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Parse the event to get metadata (we need company_id first)
    let rawEvent: { data?: { object?: { metadata?: { company_id?: string } } } };
    try {
      rawEvent = JSON.parse(body);
    } catch {
      console.error("Invalid JSON payload");
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Extract company_id from metadata
    const companyId = rawEvent.data?.object?.metadata?.company_id;
    
    if (!companyId) {
      console.error("Missing company_id in webhook metadata");
      return new Response(
        JSON.stringify({ error: "Missing company_id in metadata" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Fetch company with webhook secret
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, stripe_secret_key_encrypted, stripe_webhook_secret_encrypted, admin_fee_percentage")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      console.error("Company not found:", companyId);
      return new Response(
        JSON.stringify({ error: "Company not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    if (!company.stripe_webhook_secret_encrypted) {
      console.error("Webhook secret not configured for company:", companyId);
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Decode the webhook secret
    const webhookSecret = atob(company.stripe_webhook_secret_encrypted);
    const stripeSecretKey = company.stripe_secret_key_encrypted 
      ? atob(company.stripe_secret_key_encrypted) 
      : "";

    // Initialize Stripe and verify signature
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });
    
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Webhook signature verification failed:", errorMessage);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`Processing webhook event: ${event.type} for company: ${companyId}`);

    const startTime = Date.now();
    let logStatus = "processed";
    let logError: string | null = null;

    try {
    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = session.metadata?.payment_id;
        const ticketIds = session.metadata?.ticket_ids?.split(",") || [];
        const playerId = session.metadata?.player_id;
        const raffleId = session.metadata?.raffle_id;

        if (!paymentId) {
          console.error("Missing payment_id in session metadata");
          break;
        }

        console.log(`Processing checkout completion for payment: ${paymentId}`);

        // Update payment status
        await supabase
          .from("payments")
          .update({
            status: "succeeded",
            stripe_payment_intent_id: session.payment_intent as string,
            processed_at: new Date().toISOString(),
          })
          .eq("id", paymentId);

        // Activate all tickets
        for (const ticketId of ticketIds) {
          if (!ticketId) continue;

          await supabase
            .from("tickets")
            .update({
              status: "active",
              purchased_at: new Date().toISOString(),
            })
            .eq("id", ticketId);

          // Calculate initial ranking for this ticket
          await supabase.rpc("calculate_ticket_ranking", { p_ticket_id: ticketId });
        }

        // Get payment amount for logging
        const { data: paymentData } = await supabase
          .from("payments")
          .select("amount, admin_fee, net_amount")
          .eq("id", paymentId)
          .single();

        if (paymentData) {
          // Log financial transaction - ticket sale
          await supabase.rpc("log_financial", {
            p_company_id: companyId,
            p_type: "TICKET_SALE",
            p_amount: paymentData.amount,
            p_reference_id: paymentId,
            p_reference_type: "payment",
            p_description: `Venda de ${ticketIds.length} cartela(s)`,
          });

          // Log admin fee
          if (paymentData.admin_fee && paymentData.admin_fee > 0) {
            await supabase.rpc("log_financial", {
              p_company_id: companyId,
              p_type: "ADMIN_FEE",
              p_amount: -paymentData.admin_fee,
              p_reference_id: paymentId,
              p_reference_type: "payment",
              p_description: "Taxa administrativa da plataforma",
            });
          }
        }

        // Log audit
        await supabase.rpc("log_audit", {
          p_company_id: companyId,
          p_user_id: null,
          p_player_id: playerId,
          p_action: "TICKET_PURCHASED",
          p_entity_type: "ticket",
          p_entity_id: ticketIds[0],
          p_changes: { payment_id: paymentId, ticket_count: ticketIds.length, raffle_id: raffleId },
        });

        console.log(`Successfully processed checkout for ${ticketIds.length} ticket(s)`);
        break;
      }
      
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Payment intent succeeded: ${paymentIntent.id}`);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const paymentId = paymentIntent.metadata?.payment_id;

        if (!paymentId) {
          console.log("No payment_id in failed payment intent metadata");
          break;
        }

        // Update payment status to failed
        await supabase
          .from("payments")
          .update({
            status: "failed",
            stripe_payment_intent_id: paymentIntent.id,
          })
          .eq("id", paymentId);

        // Cancel the associated tickets
        const { data: paymentRecord } = await supabase
          .from("payments")
          .select("ticket_id")
          .eq("id", paymentId)
          .single();

        if (paymentRecord?.ticket_id) {
          await supabase
            .from("tickets")
            .update({ status: "cancelled" })
            .eq("id", paymentRecord.ticket_id);
        }

        console.log(`Payment failed for payment_id: ${paymentId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    } catch (processingError) {
      logStatus = "error";
      logError = processingError instanceof Error ? processingError.message : String(processingError);
      console.error("Event processing error:", logError);
    }

    // Log the webhook event
    const processingTime = Date.now() - startTime;
    await supabase.from("webhook_logs").insert({
      company_id: companyId,
      event_type: event.type,
      event_id: event.id,
      payload: rawEvent as Record<string, unknown>,
      status: logStatus,
      error_message: logError,
      processing_time_ms: processingTime,
    });

    if (logStatus === "error") {
      return new Response(
        JSON.stringify({ error: logError }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Webhook error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
