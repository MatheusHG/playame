import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple hash function for CPF (in production, use proper hashing like bcrypt)
async function hashCPF(cpf: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(cpf + Deno.env.get("CPF_SALT") || "default_salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;

  return true;
}

function getClientIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
    || req.headers.get("x-real-ip") 
    || "unknown";
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
    const { action, companyId, cpf, password, name, city, phone } = await req.json();
    const clientIP = getClientIP(req);

    if (!companyId) {
      throw new Error("Company ID is required");
    }

    if (!cpf || !validateCPF(cpf)) {
      throw new Error("CPF inválido");
    }

    const cleanedCPF = cpf.replace(/\D/g, "");
    const cpfHash = await hashCPF(cleanedCPF);
    const cpfLast4 = cleanedCPF.slice(-4);

    // Rate limiting for login attempts (5 attempts per 5 minutes, block for 15 minutes)
    if (action === "login") {
      const rateLimitIdentifier = `${companyId}:${cpfHash.substring(0, 16)}`;
      const { data: allowed } = await supabase.rpc("check_rate_limit", {
        p_identifier: rateLimitIdentifier,
        p_action: "player_login",
        p_max_attempts: 5,
        p_window_seconds: 300,
        p_block_seconds: 900,
      });

      if (!allowed) {
        throw new Error("Muitas tentativas de login. Tente novamente em 15 minutos.");
      }
    }

    // Rate limiting for CPF lookup (10 attempts per 5 minutes)
    const cpfLookupIdentifier = `${companyId}:cpf_lookup:${clientIP}`;
    const { data: cpfLookupAllowed } = await supabase.rpc("check_rate_limit", {
      p_identifier: cpfLookupIdentifier,
      p_action: "cpf_lookup",
      p_max_attempts: 10,
      p_window_seconds: 300,
      p_block_seconds: 600,
    });

    if (!cpfLookupAllowed) {
      throw new Error("Muitas consultas de CPF. Tente novamente mais tarde.");
    }

    if (action === "register") {
      if (!password || password.length < 6) {
        throw new Error("Senha deve ter pelo menos 6 caracteres");
      }

      if (!name || name.trim().length < 3) {
        throw new Error("Nome deve ter pelo menos 3 caracteres");
      }

      // Rate limiting for registration (3 per hour per IP)
      const registerIdentifier = `register:${clientIP}`;
      const { data: registerAllowed } = await supabase.rpc("check_rate_limit", {
        p_identifier: registerIdentifier,
        p_action: "player_register",
        p_max_attempts: 3,
        p_window_seconds: 3600,
        p_block_seconds: 3600,
      });

      if (!registerAllowed) {
        throw new Error("Muitos cadastros deste IP. Tente novamente mais tarde.");
      }

      // Check if player already exists
      const { data: existing } = await supabase
        .from("players")
        .select("id, status")
        .eq("company_id", companyId)
        .eq("cpf_hash", cpfHash)
        .maybeSingle();

      if (existing) {
        if (existing.status === "blocked") {
          throw new Error("Conta bloqueada. Entre em contato com o suporte.");
        }
        throw new Error("CPF já cadastrado. Faça login.");
      }

      const passwordHash = await hashPassword(password);

      const { data: player, error } = await supabase
        .from("players")
        .insert({
          company_id: companyId,
          cpf_hash: cpfHash,
          cpf_last4: cpfLast4,
          name: name.trim(),
          city: city?.trim() || null,
          phone: phone?.trim() || null,
          password_hash: passwordHash,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      // Log audit (without sensitive data)
      await supabase.rpc("log_audit", {
        p_company_id: companyId,
        p_user_id: null,
        p_player_id: player.id,
        p_action: "PLAYER_REGISTERED",
        p_entity_type: "player",
        p_entity_id: player.id,
        p_changes: { city: player.city },
      });

      // Generate session token
      const sessionToken = crypto.randomUUID();

      return new Response(
        JSON.stringify({
          success: true,
          player: {
            id: player.id,
            name: player.name,
            cpf_last4: player.cpf_last4,
            city: player.city,
          },
          sessionToken,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (action === "login") {
      if (!password) {
        throw new Error("Senha é obrigatória");
      }

      const { data: player, error } = await supabase
        .from("players")
        .select("*")
        .eq("company_id", companyId)
        .eq("cpf_hash", cpfHash)
        .maybeSingle();

      if (error) throw error;

      if (!player) {
        throw new Error("CPF não encontrado. Cadastre-se primeiro.");
      }

      if (player.status === "blocked") {
        throw new Error("Conta bloqueada. Entre em contato com o suporte.");
      }

      if (player.status === "deleted") {
        throw new Error("Conta desativada.");
      }

      const passwordHash = await hashPassword(password);
      if (player.password_hash !== passwordHash) {
        // Log failed attempt (without password)
        await supabase.rpc("log_audit", {
          p_company_id: companyId,
          p_user_id: null,
          p_player_id: player.id,
          p_action: "LOGIN_FAILED",
          p_entity_type: "player",
          p_entity_id: player.id,
          p_changes: { reason: "invalid_password" },
        });
        throw new Error("Senha incorreta");
      }

      // Log successful login
      await supabase.rpc("log_audit", {
        p_company_id: companyId,
        p_user_id: null,
        p_player_id: player.id,
        p_action: "PLAYER_LOGIN",
        p_entity_type: "player",
        p_entity_id: player.id,
        p_changes: null,
      });

      // Generate session token
      const sessionToken = crypto.randomUUID();

      return new Response(
        JSON.stringify({
          success: true,
          player: {
            id: player.id,
            name: player.name,
            cpf_last4: player.cpf_last4,
            city: player.city,
          },
          sessionToken,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    throw new Error("Invalid action");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in player-auth:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
