import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Received test-db-connection request');
    
    const body = await req.json();
    console.log('Request body received:', { ...body, password: '***' });
    
    const { host, port, database, user, password, ssl } = body;

    // Validate required fields
    if (!host || !port || !database || !user || !password) {
      console.error('Missing required fields:', { 
        host: !!host, 
        port: !!port, 
        database: !!database, 
        user: !!user, 
        password: !!password 
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Campos obrigatórios ausentes. Verifique: host, porta, banco de dados, usuário e senha.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('Attempting to connect to PostgreSQL:', { host, port, database, user, ssl: !!ssl });

    // Check if trying to connect to private network
    const isPrivateIP = host.match(/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.)/);
    if (isPrivateIP) {
      console.warn('Warning: Attempting to connect to private IP from edge function');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Não é possível conectar a IPs privados (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x) de dentro da edge function.',
          details: 'Edge functions rodam nos servidores da Lovable Cloud e não têm acesso à sua rede local. Para testar conexões locais, você precisa rodar sua aplicação localmente ou expor o PostgreSQL para a internet (não recomendado por segurança).'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Configure client with optional SSL
    const clientConfig: any = {
      hostname: host,
      port: parseInt(port),
      database,
      user,
      password,
    };

    // Add SSL configuration if provided
    if (ssl) {
      clientConfig.tls = {
        enabled: true,
        enforce: false,
        caCertificates: [],
      };
    }

    const client = new Client(clientConfig);

    // Create connection promise with timeout
    const connectPromise = client.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('ETIMEDOUT')), 15000)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    console.log('Connected to PostgreSQL successfully');
    
    // Test with a simple query
    const result = await client.queryObject<{ version: string }>`SELECT version() as version`;
    console.log('Test query executed successfully, version:', result.rows[0]);
    
    await client.end();
    console.log('Connection closed');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Conexão estabelecida com sucesso!',
        version: result.rows[0]?.version || 'Unknown'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    let errorMessage = 'Erro desconhecido ao conectar';
    let errorDetails = '';

    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Provide more helpful error messages
      if (errorMessage.includes('ECONNREFUSED')) {
        errorDetails = 'Conexão recusada. Verifique se o PostgreSQL está rodando e acessível no host/porta especificados. Lembre-se que edge functions rodam nos servidores da Lovable Cloud e precisam de acesso público ao banco.';
      } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timed out')) {
        errorDetails = 'Conexão expirou. O servidor PostgreSQL não está acessível pela internet. Edge functions rodam nos servidores da Lovable Cloud e não conseguem acessar redes privadas/locais.';
      } else if (errorMessage.includes('ENOTFOUND')) {
        errorDetails = 'Host não encontrado. Verifique o endereço do servidor.';
      } else if (errorMessage.includes('password authentication failed')) {
        errorDetails = 'Falha na autenticação. Verifique usuário e senha.';
      } else if (errorMessage.includes('does not exist')) {
        errorDetails = 'Banco de dados não encontrado. Verifique o nome do banco.';
      }
    }

    console.error('Error in test-db-connection:', errorMessage, error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: errorDetails 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 422,
      }
    );
  }
});
