import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting store (in-memory, resets on function restart)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 10; // 10 requests per minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header for rate limiting
    const authHeader = req.headers.get('authorization');
    const identifier = authHeader || req.headers.get('x-forwarded-for') || 'anonymous';

    // Check rate limit
    if (!checkRateLimit(identifier)) {
      return new Response(
        JSON.stringify({ error: 'Taxa de requisições excedida. Tente novamente em alguns instantes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { cnpj } = await req.json();
    
    if (!cnpj) {
      return new Response(
        JSON.stringify({ error: 'CNPJ é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remove caracteres não numéricos do CNPJ
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    
    if (cnpjLimpo.length !== 14) {
      return new Response(
        JSON.stringify({ error: 'CNPJ deve ter 14 dígitos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Consulta na API ReceitaWS (gratuita)
    const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpjLimpo}`);
    
    if (!response.ok) {
      throw new Error('Erro ao consultar CNPJ');
    }

    const data = await response.json();
    
    if (data.status === 'ERROR') {
      return new Response(
        JSON.stringify({ error: data.message || 'CNPJ não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formata os dados retornados
    const resultado = {
      cnpj: data.cnpj,
      razao_social: data.nome || '',
      nome_fantasia: data.fantasia || '',
      endereco: `${data.logradouro || ''}, ${data.numero || ''} ${data.complemento || ''}`.trim(),
      cidade: data.municipio || '',
      uf: data.uf || '',
      cep: data.cep || '',
      telefone: data.telefone || '',
      email: data.email || '',
      situacao: data.situacao || '',
      atividade_principal: data.atividade_principal?.[0]?.text || '',
    };

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
