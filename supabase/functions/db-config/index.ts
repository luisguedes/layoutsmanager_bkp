import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action } = await req.json();

    if (action === 'get_db_config') {
      // Buscar configuração do banco
      const { data: configs, error } = await supabase
        .from('system_config')
        .select('key, value')
        .in('key', ['db_type', 'db_host', 'db_port', 'db_name', 'db_user', 'db_password']);

      if (error) {
        console.error('Error fetching config:', error);
        throw error;
      }

      const config: Record<string, any> = {};
      configs?.forEach((item) => {
        config[item.key] = item.value;
      });

      return new Response(
        JSON.stringify({ success: true, config }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in db-config:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});