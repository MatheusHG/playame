import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateAffiliateUserRequest {
  email: string;
  password: string;
  affiliate_id: string;
  name: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the calling user is authenticated and has permission
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !callingUser) {
      throw new Error("Unauthorized");
    }

    // Check if user has admin role for the company
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", callingUser.id);

    const isAdmin = userRoles?.some(
      (r) => r.role === "SUPER_ADMIN" || r.role === "ADMIN_EMPRESA"
    );

    if (!isAdmin) {
      throw new Error("Insufficient permissions");
    }

    const { email, password, affiliate_id, name }: CreateAffiliateUserRequest = await req.json();

    if (!email || !password || !affiliate_id) {
      throw new Error("Missing required fields: email, password, affiliate_id");
    }

    // Check if affiliate exists and belongs to the user's company
    const { data: affiliate, error: affError } = await supabaseAdmin
      .from("affiliates")
      .select("id, company_id, user_id")
      .eq("id", affiliate_id)
      .single();

    if (affError || !affiliate) {
      throw new Error("Affiliate not found");
    }

    if (affiliate.user_id) {
      throw new Error("Affiliate already has a user account");
    }

    // Check company access
    const hasCompanyAccess = userRoles?.some(
      (r) => r.role === "SUPER_ADMIN" || r.company_id === affiliate.company_id
    );

    if (!hasCompanyAccess) {
      throw new Error("No access to this company's affiliates");
    }

    // Create the user in Supabase Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name,
        affiliate_id,
      },
    });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    // Update affiliate with user_id
    const { error: updateError } = await supabaseAdmin
      .from("affiliates")
      .update({ 
        user_id: newUser.user.id,
        email: email,
      })
      .eq("id", affiliate_id);

    if (updateError) {
      // Rollback: delete the created user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw new Error(`Failed to link user to affiliate: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: newUser.user.id,
        message: "User account created and linked to affiliate" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error creating affiliate user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
