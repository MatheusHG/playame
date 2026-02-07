import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "approve" | "reject";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("User not authenticated");

    const { action, paymentId, reason } = (await req.json()) as {
      action: Action;
      paymentId: string;
      reason?: string;
    };

    if (!action || (action !== "approve" && action !== "reject")) {
      throw new Error("Invalid action");
    }
    if (!paymentId) throw new Error("paymentId is required");

    const { data: payment, error: paymentFetchError } = await supabase
      .from("payments")
      .select("id, company_id, ticket_id, amount, admin_fee, net_amount, player_id, raffle_id, status")
      .eq("id", paymentId)
      .single();

    if (paymentFetchError || !payment) throw new Error("Pagamento não encontrado");

    // Authorization: SUPER_ADMIN ou ADMIN_EMPRESA na empresa do pagamento
    const { data: isSuperAdminRow } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("role", "SUPER_ADMIN")
      .maybeSingle();

    const isSuperAdmin = !!isSuperAdminRow;

    let isCompanyAdmin = false;
    if (!isSuperAdmin) {
      const { data: isAdminRow } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("role", "ADMIN_EMPRESA")
        .eq("company_id", payment.company_id)
        .maybeSingle();
      isCompanyAdmin = !!isAdminRow;
    }

    if (!isSuperAdmin && !isCompanyAdmin) {
      throw new Error("Unauthorized");
    }

    if (payment.status !== "pending" && payment.status !== "processing") {
      throw new Error("Pagamento já foi processado");
    }

    const nowIso = new Date().toISOString();

    if (action === "approve") {
      const { data: updatedPayment, error: payUpdateError } = await supabase
        .from("payments")
        .update({ status: "succeeded", processed_at: nowIso })
        .eq("id", paymentId)
        .select("id, status")
        .single();
      if (payUpdateError || !updatedPayment) throw new Error("Falha ao atualizar pagamento");

      const { data: updatedTicket, error: ticketUpdateError } = await supabase
        .from("tickets")
        .update({ status: "active", purchased_at: nowIso })
        .eq("id", payment.ticket_id)
        .select("id")
        .single();
      if (ticketUpdateError || !updatedTicket) throw new Error("Falha ao ativar cartela");

      // ranking inicial
      await supabase.rpc("calculate_ticket_ranking", { p_ticket_id: payment.ticket_id });

      // logs financeiros (mesma ideia do webhook)
      await supabase.rpc("log_financial", {
        p_company_id: payment.company_id,
        p_type: "TICKET_SALE",
        p_amount: payment.amount,
        p_reference_id: paymentId,
        p_reference_type: "payment",
        p_description: "Venda manual aprovada (1 cartela)",
      });

      if (payment.admin_fee && Number(payment.admin_fee) > 0) {
        await supabase.rpc("log_financial", {
          p_company_id: payment.company_id,
          p_type: "ADMIN_FEE",
          p_amount: -Number(payment.admin_fee),
          p_reference_id: paymentId,
          p_reference_type: "payment",
          p_description: "Taxa administrativa da plataforma (venda manual)",
        });
      }

      await supabase.rpc("log_audit", {
        p_company_id: payment.company_id,
        p_user_id: userData.user.id,
        p_player_id: payment.player_id,
        p_action: "MANUAL_PAYMENT_APPROVED",
        p_entity_type: "payment",
        p_entity_id: paymentId,
        p_changes: { reason: reason || null },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // reject
    const { data: updatedPayment, error: payUpdateError } = await supabase
      .from("payments")
      .update({ status: "failed", processed_at: nowIso })
      .eq("id", paymentId)
      .select("id, status")
      .single();
    if (payUpdateError || !updatedPayment) throw new Error("Falha ao atualizar pagamento");

    const { data: updatedTicket, error: ticketUpdateError } = await supabase
      .from("tickets")
      .update({ status: "cancelled" })
      .eq("id", payment.ticket_id)
      .select("id")
      .single();
    if (ticketUpdateError || !updatedTicket) throw new Error("Falha ao cancelar cartela");

    await supabase.rpc("log_audit", {
      p_company_id: payment.company_id,
      p_user_id: userData.user.id,
      p_player_id: payment.player_id,
      p_action: "MANUAL_PAYMENT_REJECTED",
      p_entity_type: "payment",
      p_entity_id: paymentId,
      p_changes: { reason: reason || null },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in manual-payment-action:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

