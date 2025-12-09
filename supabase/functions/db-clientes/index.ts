import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getDbConfig(supabase: any) {
  const { data: configs } = await supabase
    .from('system_config')
    .select('key, value')
    .in('key', ['db_type', 'db_host', 'db_port', 'db_name', 'db_user', 'db_password']);

  const config: Record<string, any> = {};
  configs?.forEach((item: any) => {
    config[item.key] = item.value;
  });
  return config;
}

async function executePostgres(config: any, operation: string, data?: any) {
  const client = new Client({
    user: config.db_user,
    password: config.db_password,
    database: config.db_name,
    hostname: config.db_host,
    port: parseInt(config.db_port || '5432'),
  });

  try {
    await client.connect();

    switch (operation) {
      case 'select':
        const selectResult = await client.queryObject(
          'SELECT * FROM clientes ORDER BY nome'
        );
        return { data: selectResult.rows, error: null };

      case 'insert':
        const insertResult = await client.queryObject(
          `INSERT INTO clientes (nome, cnpj, email, telefone, cep, endereco, cidade, uf, 
           nome_fantasia, razao_social, atividade_principal, situacao, observacoes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING *`,
          [
            data.nome, data.cnpj, data.email, data.telefone, data.cep, data.endereco,
            data.cidade, data.uf, data.nome_fantasia, data.razao_social,
            data.atividade_principal, data.situacao, data.observacoes, data.user_id
          ]
        );
        return { data: insertResult.rows[0], error: null };

      case 'update':
        const updateResult = await client.queryObject(
          `UPDATE clientes SET 
           nome = $1, cnpj = $2, email = $3, telefone = $4, cep = $5, endereco = $6,
           cidade = $7, uf = $8, nome_fantasia = $9, razao_social = $10,
           atividade_principal = $11, situacao = $12, observacoes = $13, 
           updated_by = $14, updated_at = NOW()
           WHERE id = $15
           RETURNING *`,
          [
            data.nome, data.cnpj, data.email, data.telefone, data.cep, data.endereco,
            data.cidade, data.uf, data.nome_fantasia, data.razao_social,
            data.atividade_principal, data.situacao, data.observacoes, data.user_id,
            data.id
          ]
        );
        return { data: updateResult.rows[0], error: null };

      case 'delete':
        await client.queryObject('DELETE FROM clientes WHERE id = $1', [data.id]);
        return { data: null, error: null };

      default:
        return { data: null, error: { message: 'Invalid operation' } };
    }
  } catch (error: any) {
    console.error('PostgreSQL error:', error);
    return { data: null, error: { message: error.message } };
  } finally {
    await client.end();
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { operation, data } = await req.json();
    const config = await getDbConfig(supabase);
    const dbType = config.db_type || 'supabase';

    console.log(`Executing ${operation} on ${dbType}`);

    let result;

    if (dbType === 'postgresql') {
      result = await executePostgres(config, operation, data);
    } else {
      // Usar Supabase
      switch (operation) {
        case 'select':
          result = await supabase.from('clientes').select('*').order('nome');
          break;
        case 'insert':
          result = await supabase.from('clientes').insert(data).select().single();
          break;
        case 'update':
          result = await supabase.from('clientes').update(data).eq('id', data.id).select().single();
          break;
        case 'delete':
          result = await supabase.from('clientes').delete().eq('id', data.id);
          break;
        default:
          result = { data: null, error: { message: 'Invalid operation' } };
      }
    }

    if (result.error) {
      throw result.error;
    }

    return new Response(
      JSON.stringify({ success: true, data: result.data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in db-clientes:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});