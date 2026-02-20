import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function generateRandomNumbers(start: number, end: number, count: number): number[] {
  const available: number[] = [];
  for (let i = start; i <= end; i++) available.push(i);
  const selected: number[] = [];
  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    selected.push(available.splice(idx, 1)[0]);
  }
  return selected.sort((a, b) => a - b);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Validate caller is ADMIN_EMPRESA
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData.user) throw new Error("Não autorizado");

    const {
      companyId,
      raffleId,
      customerName,
      customerPhone,
      quantity = 1,
      ticketNumbers,
    } = await req.json();

    if (!companyId || !raffleId || !customerName || !customerPhone) {
      throw new Error("Campos obrigatórios: companyId, raffleId, customerName, customerPhone");
    }

    // Check caller has ADMIN_EMPRESA role for this company
    const { data: hasRole } = await supabaseAdmin.rpc("has_role_in_company", {
      _user_id: userData.user.id,
      _role: "ADMIN_EMPRESA",
      _company_id: companyId,
    });

    if (!hasRole) {
      // Also check super admin
      const { data: isSA } = await supabaseAdmin.rpc("is_super_admin", {
        _user_id: userData.user.id,
      });
      if (!isSA) throw new Error("Sem permissão para realizar vendas de rua");
    }

    // Fetch company
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();
    if (companyError || !company) throw new Error("Empresa não encontrada");

    // Fetch raffle
    const { data: raffle, error: raffleError } = await supabaseAdmin
      .from("raffles")
      .select("*")
      .eq("id", raffleId)
      .eq("company_id", companyId)
      .eq("status", "active")
      .single();
    if (raffleError || !raffle) throw new Error("Sorteio não encontrado ou não está ativo");

    // Find or create player by phone + company
    const phoneClean = customerPhone.replace(/\D/g, "");
    // Use phone as a pseudo CPF hash for street customers
    const streetCpfHash = `street_${phoneClean}_${companyId}`;

    let player: any;
    const { data: existingPlayer } = await supabaseAdmin
      .from("players")
      .select("*")
      .eq("company_id", companyId)
      .eq("cpf_hash", streetCpfHash)
      .maybeSingle();

    if (existingPlayer) {
      player = existingPlayer;
      // Update name if changed
      if (existingPlayer.name !== customerName) {
        await supabaseAdmin
          .from("players")
          .update({ name: customerName, phone: customerPhone })
          .eq("id", existingPlayer.id);
      }
    } else {
      const { data: newPlayer, error: playerError } = await supabaseAdmin
        .from("players")
        .insert({
          company_id: companyId,
          name: customerName,
          phone: customerPhone,
          cpf_hash: streetCpfHash,
          cpf_last4: phoneClean.slice(-4),
          password_hash: "street_sale_no_login",
          status: "active",
        })
        .select()
        .single();
      if (playerError) throw new Error("Erro ao criar jogador: " + playerError.message);
      player = newPlayer;
    }

    // Validate ticket numbers
    const hasCustomNumbers =
      ticketNumbers && Array.isArray(ticketNumbers) && ticketNumbers.length > 0;
    if (hasCustomNumbers && ticketNumbers.length !== quantity) {
      throw new Error("Número de conjuntos de números deve corresponder à quantidade");
    }

    // Fetch Super-Admin fee
    const { data: platformSettings } = await supabaseAdmin
      .from("platform_settings")
      .select("*")
      .eq("key", "super_admin_fee_percent")
      .single();
    const superAdminFeePercent = platformSettings?.value?.value ?? 10;

    const ticketPrice = Number(raffle.ticket_price);
    const totalAmount = round2(ticketPrice * quantity);

    // Commission calculation (no affiliate for street sales)
    const superAdminAmount = round2(totalAmount * (superAdminFeePercent / 100));
    const companyNetAmount = round2(totalAmount - superAdminAmount);

    // Create tickets
    const tickets: any[] = [];
    for (let i = 0; i < quantity; i++) {
      let numbers: number[];
      if (hasCustomNumbers && ticketNumbers[i]) {
        numbers = ticketNumbers[i].sort((a: number, b: number) => a - b);
        const valid = numbers.every(
          (n: number) => n >= raffle.number_range_start && n <= raffle.number_range_end
        );
        if (!valid || numbers.length !== raffle.numbers_per_ticket) {
          throw new Error(`Números inválidos para cartela ${i + 1}`);
        }
      } else {
        numbers = generateRandomNumbers(
          raffle.number_range_start,
          raffle.number_range_end,
          raffle.numbers_per_ticket
        );
      }

      // Get eligible prize tiers
      const { data: eligibleTiers } = await supabaseAdmin
        .from("prize_tiers")
        .select("id")
        .eq("raffle_id", raffleId)
        .or(
          `purchase_allowed_until_draw_count.is.null,purchase_allowed_until_draw_count.gte.${raffle.current_draw_count || 0}`
        );

      const { data: ticket, error: ticketError } = await supabaseAdmin
        .from("tickets")
        .insert({
          raffle_id: raffleId,
          player_id: player.id,
          company_id: companyId,
          status: "active", // Auto-approved for street sales
          purchased_at: new Date().toISOString(),
          eligible_prize_tiers: eligibleTiers?.map((t: any) => t.id) || [],
          snapshot_data: {
            raffle_name: raffle.name,
            ticket_price: ticketPrice,
            prize_mode: raffle.prize_mode,
            fixed_prize_value: raffle.fixed_prize_value,
            prize_percent_of_sales: raffle.prize_percent_of_sales,
            rules_version: raffle.rules_version,
            draw_count_at_purchase: raffle.current_draw_count || 0,
            street_sale: true,
            sold_by: userData.user.id,
          },
        })
        .select()
        .single();

      if (ticketError) throw new Error("Erro ao criar cartela: " + ticketError.message);

      // Insert ticket numbers
      const { error: numbersError } = await supabaseAdmin
        .from("ticket_numbers")
        .insert(numbers.map((n) => ({ ticket_id: ticket.id, number: n })));
      if (numbersError) throw new Error("Erro ao inserir números: " + numbersError.message);

      tickets.push(ticket);
    }

    // Create payment as succeeded
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        ticket_id: tickets[0].id,
        company_id: companyId,
        player_id: player.id,
        raffle_id: raffleId,
        amount: totalAmount,
        admin_fee: superAdminAmount,
        net_amount: companyNetAmount,
        status: "succeeded",
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (paymentError) throw new Error("Erro ao criar pagamento: " + paymentError.message);

    // Create commission record
    await supabaseAdmin.from("affiliate_commissions").insert({
      payment_id: payment.id,
      ticket_id: tickets[0].id,
      company_id: companyId,
      raffle_id: raffleId,
      sale_amount: totalAmount,
      super_admin_percent: superAdminFeePercent,
      super_admin_amount: superAdminAmount,
      company_net_amount: companyNetAmount,
      rates_snapshot: {
        super_admin_percent: superAdminFeePercent,
        street_sale: true,
        sold_by_user_id: userData.user.id,
      },
    });

    // Log financial
    await supabaseAdmin.rpc("log_financial", {
      p_company_id: companyId,
      p_type: "STREET_SALE",
      p_amount: totalAmount,
      p_reference_id: payment.id,
      p_reference_type: "payment",
      p_description: `Venda de rua: ${quantity} cartela(s) - ${raffle.name} - Cliente: ${customerName}`,
    });

    // Log audit
    await supabaseAdmin.rpc("log_audit", {
      p_company_id: companyId,
      p_user_id: userData.user.id,
      p_player_id: player.id,
      p_action: "STREET_SALE_CREATED",
      p_entity_type: "payment",
      p_entity_id: payment.id,
      p_changes: {
        quantity,
        total_amount: totalAmount,
        customer_name: customerName,
        customer_phone: customerPhone,
        ticket_ids: tickets.map((t: any) => t.id),
      },
    });

    // Recalculate ranking for each ticket
    for (const ticket of tickets) {
      await supabaseAdmin.rpc("calculate_ticket_ranking", { p_ticket_id: ticket.id });
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentId: payment.id,
        playerId: player.id,
        ticketIds: tickets.map((t: any) => t.id),
        message: `${quantity} cartela(s) criada(s) com sucesso para ${customerName}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in create-street-sale:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
