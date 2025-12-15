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
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,
  email TEXT UNIQUE,
  telefone VARCHAR(20),
  cargo VARCHAR(100),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- User credentials table (password storage)
CREATE TABLE IF NOT EXISTS public.user_credentials (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- User permissions table
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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
  atividade_principal TEXT,
  endereco TEXT,
  cidade TEXT,
  uf VARCHAR(2),
  cep VARCHAR(10),
  telefone VARCHAR(20),
  email VARCHAR(255),
  situacao TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Modelos table
CREATE TABLE IF NOT EXISTS public.modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tipos impressao table
CREATE TABLE IF NOT EXISTS public.tipos_impressao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Campos table
CREATE TABLE IF NOT EXISTS public.campos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Layouts table
CREATE TABLE IF NOT EXISTS public.layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  modelo_id UUID NOT NULL REFERENCES public.modelos(id) ON DELETE RESTRICT,
  tipo_impressao_id UUID NOT NULL REFERENCES public.tipos_impressao(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL,
  imagem_url TEXT,
  imagem_data BYTEA,
  imagem_tipo TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Layout campos table
CREATE TABLE IF NOT EXISTS public.layout_campos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID NOT NULL REFERENCES public.layouts(id) ON DELETE CASCADE,
  campo_id UUID NOT NULL REFERENCES public.campos(id) ON DELETE RESTRICT,
  ordem INTEGER NOT NULL,
  obrigatorio BOOLEAN DEFAULT false NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES public.profiles(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_layouts_cliente_id ON public.layouts(cliente_id);
CREATE INDEX IF NOT EXISTS idx_layout_campos_layout_id ON public.layout_campos(layout_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.audit_log(changed_at DESC);

-- Functions
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
STABLE SECURITY DEFINER
SET search_path TO 'public'
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

-- Clone layout function
CREATE OR REPLACE FUNCTION public.clone_layout(origem_layout_id uuid, destino_cliente_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  novo_layout_id UUID;
  origem_layout RECORD;
BEGIN
  SELECT * INTO origem_layout FROM public.layouts WHERE id = origem_layout_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Layout de origem não encontrado';
  END IF;
  
  INSERT INTO public.layouts (cliente_id, modelo_id, tipo_impressao_id, nome, imagem_url, imagem_data, imagem_tipo)
  VALUES (destino_cliente_id, origem_layout.modelo_id, origem_layout.tipo_impressao_id, 
          origem_layout.nome || ' (Clonado)', origem_layout.imagem_url, origem_layout.imagem_data, origem_layout.imagem_tipo)
  RETURNING id INTO novo_layout_id;
  
  INSERT INTO public.layout_campos (layout_id, campo_id, ordem, obrigatorio)
  SELECT novo_layout_id, campo_id, ordem, obrigatorio
  FROM public.layout_campos
  WHERE layout_id = origem_layout_id;
  
  RETURN novo_layout_id;
END;
$$;

-- Clientes com campo function
CREATE OR REPLACE FUNCTION public.clientes_com_campo(nomes_campos text[])
RETURNS TABLE(cliente_id uuid, cliente_nome text, cliente_cnpj text, layout_id uuid, layout_nome text, modelo_nome text, tipo_nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    c.id,
    c.nome,
    c.cnpj,
    l.id,
    l.nome,
    m.nome,
    t.nome
  FROM public.clientes c
  JOIN public.layouts l ON l.cliente_id = c.id
  JOIN public.modelos m ON m.id = l.modelo_id
  JOIN public.tipos_impressao t ON t.id = l.tipo_impressao_id
  WHERE l.id IN (
    SELECT lc.layout_id
    FROM public.layout_campos lc
    JOIN public.campos ca ON ca.id = lc.campo_id
    WHERE ca.nome = ANY(nomes_campos)
    GROUP BY lc.layout_id
    HAVING COUNT(DISTINCT ca.nome) = array_length(nomes_campos, 1)
  )
  ORDER BY c.nome, l.nome;
END;
$$;

-- Comparar multiplos layouts function
CREATE OR REPLACE FUNCTION public.comparar_multiplos_layouts(layout_ids uuid[])
RETURNS TABLE(campo_id uuid, campo_nome text, layout_data jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH all_campos AS (
    SELECT DISTINCT c.id, c.nome
    FROM public.campos c
    WHERE EXISTS (
      SELECT 1 
      FROM public.layout_campos lc
      WHERE lc.campo_id = c.id 
      AND lc.layout_id = ANY(layout_ids)
    )
    ORDER BY c.nome
  ),
  layout_info AS (
    SELECT 
      l.id as layout_id,
      l.nome as layout_nome,
      cl.nome as cliente_nome,
      lc.campo_id,
      lc.ordem,
      lc.obrigatorio
    FROM public.layouts l
    JOIN public.clientes cl ON cl.id = l.cliente_id
    LEFT JOIN public.layout_campos lc ON lc.layout_id = l.id
    WHERE l.id = ANY(layout_ids)
  )
  SELECT 
    ac.id,
    ac.nome,
    jsonb_agg(
      jsonb_build_object(
        'layout_id', li.layout_id,
        'layout_nome', li.layout_nome,
        'cliente_nome', li.cliente_nome,
        'possui', CASE WHEN li.campo_id IS NOT NULL THEN true ELSE false END,
        'ordem', li.ordem,
        'obrigatorio', li.obrigatorio
      )
      ORDER BY array_position(layout_ids, li.layout_id)
    ) as layout_data
  FROM all_campos ac
  CROSS JOIN (SELECT DISTINCT layout_id, layout_nome, cliente_nome FROM layout_info) layouts_distinct
  LEFT JOIN layout_info li ON li.campo_id = ac.id AND li.layout_id = layouts_distinct.layout_id
  GROUP BY ac.id, ac.nome
  ORDER BY ac.nome;
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
