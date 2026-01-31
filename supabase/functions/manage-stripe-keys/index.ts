import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    // Verify user is SUPER_ADMIN
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "SUPER_ADMIN")
      .maybeSingle();

    if (roleError || !roleData) {
      throw new Error("Unauthorized: Only Super Admins can manage Stripe keys");
    }

    const { action, companyId, stripeSecretKey, stripeWebhookSecret } = await req.json();

    if (action === "save") {
      // Simple encryption using base64 (in production, use proper encryption with vault)
      // For now, we'll store the keys with a simple obfuscation
      const encryptedSecretKey = stripeSecretKey ? btoa(stripeSecretKey) : null;
      const encryptedWebhookSecret = stripeWebhookSecret ? btoa(stripeWebhookSecret) : null;

      const updateData: Record<string, unknown> = {};
      
      if (stripeSecretKey !== undefined) {
        updateData.stripe_secret_key_encrypted = encryptedSecretKey;
      }
      
      if (stripeWebhookSecret !== undefined) {
        updateData.stripe_webhook_secret_encrypted = encryptedWebhookSecret;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabaseClient
          .from("companies")
          .update(updateData)
          .eq("id", companyId);

        if (updateError) {
          throw new Error(`Failed to update company: ${updateError.message}`);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "Stripe keys saved successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (action === "validate") {
      // Validate Stripe key by attempting to list customers
      if (!stripeSecretKey) {
        throw new Error("Stripe secret key is required for validation");
      }

      const Stripe = (await import("https://esm.sh/stripe@18.5.0")).default;
      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

      try {
        await stripe.customers.list({ limit: 1 });
        return new Response(
          JSON.stringify({ valid: true, message: "Stripe key is valid" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      } catch (stripeError) {
        return new Response(
          JSON.stringify({ valid: false, message: "Invalid Stripe key" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    if (action === "clear") {
      const { error: updateError } = await supabaseClient
        .from("companies")
        .update({
          stripe_secret_key_encrypted: null,
          stripe_webhook_secret_encrypted: null,
          payments_enabled: false,
        })
        .eq("id", companyId);

      if (updateError) {
        throw new Error(`Failed to clear Stripe keys: ${updateError.message}`);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Stripe keys cleared successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    throw new Error("Invalid action");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in manage-stripe-keys:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
