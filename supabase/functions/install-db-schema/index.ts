import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const schema = `
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom Types
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  nome TEXT,
  email TEXT,
  telefone VARCHAR(20),
  cargo VARCHAR(100),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- User permissions table
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  resource TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, resource)
);

-- System config table
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Clientes table
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  razao_social TEXT,
  nome_fantasia TEXT,
  email VARCHAR(255),
  telefone VARCHAR(20),
  endereco TEXT,
  cep VARCHAR(10),
  cidade TEXT,
  uf VARCHAR(2),
  atividade_principal TEXT,
  situacao TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Modelos table
CREATE TABLE IF NOT EXISTS public.modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Tipos impressao table
CREATE TABLE IF NOT EXISTS public.tipos_impressao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Campos table
CREATE TABLE IF NOT EXISTS public.campos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Layouts table
CREATE TABLE IF NOT EXISTS public.layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  modelo_id UUID NOT NULL,
  tipo_impressao_id UUID NOT NULL,
  nome TEXT NOT NULL,
  imagem_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Layout campos table
CREATE TABLE IF NOT EXISTS public.layout_campos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID NOT NULL,
  campo_id UUID NOT NULL,
  ordem INTEGER NOT NULL,
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Functions
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _resource text, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  is_admin BOOLEAN;
  has_perm BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  ) INTO is_admin;
  
  IF is_admin THEN
    RETURN true;
  END IF;
  
  IF _action = 'view' THEN
    SELECT COALESCE(can_view, false) INTO has_perm
    FROM public.user_permissions
    WHERE user_id = _user_id AND resource = _resource;
  ELSIF _action = 'create' THEN
    SELECT COALESCE(can_create, false) INTO has_perm
    FROM public.user_permissions
    WHERE user_id = _user_id AND resource = _resource;
  ELSIF _action = 'edit' THEN
    SELECT COALESCE(can_edit, false) INTO has_perm
    FROM public.user_permissions
    WHERE user_id = _user_id AND resource = _resource;
  ELSIF _action = 'delete' THEN
    SELECT COALESCE(can_delete, false) INTO has_perm
    FROM public.user_permissions
    WHERE user_id = _user_id AND resource = _resource;
  ELSE
    RETURN false;
  END IF;
  
  RETURN COALESCE(has_perm, false);
END;
$$;

-- Initial data
INSERT INTO public.system_config (key, value) 
VALUES ('setup_completed', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { host, port, database, user, password } = await req.json();

    const client = new Client({
      hostname: host,
      port: parseInt(port),
      database,
      user,
      password,
    });

    await client.connect();

    await client.queryArray(schema);
    
    await client.end();

    return new Response(
      JSON.stringify({ success: true, message: 'Schema installed successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Schema installation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
