import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const schema = `
-- ============================================
-- SCHEMA COMPLETO - Versão 3.0
-- ============================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tipo customizado para roles
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

-- ============================================
-- TABELAS
-- ============================================

-- Profiles - Informações do usuário
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

-- User credentials - Hash de senhas
CREATE TABLE IF NOT EXISTS public.user_credentials (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User roles - Papéis do usuário
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- User permissions - Permissões granulares
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

-- System config - Configurações do sistema
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Clientes
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

-- Modelos
CREATE TABLE IF NOT EXISTS public.modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tipos de impressão
CREATE TABLE IF NOT EXISTS public.tipos_impressao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Campos
CREATE TABLE IF NOT EXISTS public.campos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Layouts
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

-- Layout campos
CREATE TABLE IF NOT EXISTS public.layout_campos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID NOT NULL REFERENCES public.layouts(id) ON DELETE CASCADE,
  campo_id UUID NOT NULL REFERENCES public.campos(id) ON DELETE RESTRICT,
  ordem INTEGER NOT NULL,
  obrigatorio BOOLEAN DEFAULT false NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(layout_id, campo_id)
);

-- Audit log
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

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_ativo ON public.profiles(ativo);
CREATE INDEX IF NOT EXISTS idx_profiles_nome ON public.profiles(nome);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_resource ON public.user_permissions(resource);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON public.system_config(key);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON public.clientes(nome);
CREATE INDEX IF NOT EXISTS idx_clientes_cnpj ON public.clientes(cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_cidade ON public.clientes(cidade);
CREATE INDEX IF NOT EXISTS idx_clientes_uf ON public.clientes(uf);
CREATE INDEX IF NOT EXISTS idx_modelos_nome ON public.modelos(nome);
CREATE INDEX IF NOT EXISTS idx_tipos_impressao_nome ON public.tipos_impressao(nome);
CREATE INDEX IF NOT EXISTS idx_campos_nome ON public.campos(nome);
CREATE INDEX IF NOT EXISTS idx_layouts_cliente_id ON public.layouts(cliente_id);
CREATE INDEX IF NOT EXISTS idx_layouts_modelo_id ON public.layouts(modelo_id);
CREATE INDEX IF NOT EXISTS idx_layouts_tipo_impressao_id ON public.layouts(tipo_impressao_id);
CREATE INDEX IF NOT EXISTS idx_layouts_nome ON public.layouts(nome);
CREATE INDEX IF NOT EXISTS idx_layout_campos_layout_id ON public.layout_campos(layout_id);
CREATE INDEX IF NOT EXISTS idx_layout_campos_campo_id ON public.layout_campos(campo_id);
CREATE INDEX IF NOT EXISTS idx_layout_campos_ordem ON public.layout_campos(ordem);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON public.audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON public.audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action);

-- ============================================
-- FUNÇÕES
-- ============================================

-- Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Verificar role do usuário
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

-- Verificar permissão do usuário
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

-- Conceder permissões padrão
CREATE OR REPLACE FUNCTION public.grant_default_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  resources TEXT[] := ARRAY['clientes', 'modelos', 'tipos', 'campos', 'layouts', 'historico'];
  res_name TEXT;
BEGIN
  FOREACH res_name IN ARRAY resources
  LOOP
    INSERT INTO public.user_permissions (user_id, resource, can_view, can_create, can_edit, can_delete)
    VALUES (NEW.user_id, res_name, true, false, false, false)
    ON CONFLICT (user_id, resource) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Criar log de auditoria
CREATE OR REPLACE FUNCTION public.create_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), OLD.updated_by);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(NEW), NEW.created_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), NEW.updated_by);
    RETURN NEW;
  END IF;
END;
$$;

-- Clonar layout
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

-- Buscar clientes com campos específicos
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

-- Comparar dois layouts
CREATE OR REPLACE FUNCTION public.comparar_layouts(layout1_id uuid, layout2_id uuid)
RETURNS TABLE(campo_nome text, layout1_possui boolean, layout1_ordem integer, layout1_obrigatorio boolean, layout2_possui boolean, layout2_ordem integer, layout2_obrigatorio boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH campos_layout1 AS (
    SELECT c.nome, lc.ordem, lc.obrigatorio
    FROM public.layout_campos lc
    JOIN public.campos c ON c.id = lc.campo_id
    WHERE lc.layout_id = layout1_id
  ),
  campos_layout2 AS (
    SELECT c.nome, lc.ordem, lc.obrigatorio
    FROM public.layout_campos lc
    JOIN public.campos c ON c.id = lc.campo_id
    WHERE lc.layout_id = layout2_id
  ),
  todos_campos AS (
    SELECT nome FROM campos_layout1
    UNION
    SELECT nome FROM campos_layout2
  )
  SELECT 
    tc.nome,
    (cl1.nome IS NOT NULL) AS layout1_possui,
    cl1.ordem AS layout1_ordem,
    cl1.obrigatorio AS layout1_obrigatorio,
    (cl2.nome IS NOT NULL) AS layout2_possui,
    cl2.ordem AS layout2_ordem,
    cl2.obrigatorio AS layout2_obrigatorio
  FROM todos_campos tc
  LEFT JOIN campos_layout1 cl1 ON tc.nome = cl1.nome
  LEFT JOIN campos_layout2 cl2 ON tc.nome = cl2.nome
  ORDER BY tc.nome;
END;
$$;

-- Comparar múltiplos layouts
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

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_user_credentials_updated_at ON public.user_credentials;
CREATE TRIGGER update_user_credentials_updated_at
  BEFORE UPDATE ON public.user_credentials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON public.user_permissions;
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_system_config_updated_at ON public.system_config;
CREATE TRIGGER update_system_config_updated_at
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_clientes_updated_at ON public.clientes;
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_modelos_updated_at ON public.modelos;
CREATE TRIGGER update_modelos_updated_at
  BEFORE UPDATE ON public.modelos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_tipos_impressao_updated_at ON public.tipos_impressao;
CREATE TRIGGER update_tipos_impressao_updated_at
  BEFORE UPDATE ON public.tipos_impressao
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_campos_updated_at ON public.campos;
CREATE TRIGGER update_campos_updated_at
  BEFORE UPDATE ON public.campos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_layouts_updated_at ON public.layouts;
CREATE TRIGGER update_layouts_updated_at
  BEFORE UPDATE ON public.layouts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_layout_campos_updated_at ON public.layout_campos;
CREATE TRIGGER update_layout_campos_updated_at
  BEFORE UPDATE ON public.layout_campos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS grant_permissions_on_new_user ON public.user_roles;
CREATE TRIGGER grant_permissions_on_new_user
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  WHEN (NEW.role = 'user')
  EXECUTE FUNCTION public.grant_default_permissions();

-- ============================================
-- DADOS INICIAIS
-- ============================================

INSERT INTO public.system_config (key, value) 
VALUES ('setup_completed', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_config (key, value)
VALUES ('proxy_config', '{"enabled": false, "protocol": "http", "host": "", "port": "", "username": "", "password": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_config (key, value)
VALUES ('company_config', '{"nome": "", "razao_social": "", "cnpj": "", "endereco": "", "cidade": "", "uf": "", "cep": "", "telefone": "", "email": "", "logo": "", "logo_dark": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_config (key, value)
VALUES ('system_config', '{"theme": "system"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- VIEWS
-- ============================================

CREATE OR REPLACE VIEW public.v_layouts_completos AS
SELECT 
  l.id,
  l.nome AS layout_nome,
  c.nome AS cliente_nome,
  c.cnpj AS cliente_cnpj,
  m.nome AS modelo_nome,
  t.nome AS tipo_impressao_nome,
  l.created_at,
  l.updated_at,
  (SELECT COUNT(*) FROM public.layout_campos lc WHERE lc.layout_id = l.id) AS total_campos
FROM public.layouts l
JOIN public.clientes c ON c.id = l.cliente_id
JOIN public.modelos m ON m.id = l.modelo_id
JOIN public.tipos_impressao t ON t.id = l.tipo_impressao_id;

CREATE OR REPLACE VIEW public.v_usuarios_roles AS
SELECT 
  p.id,
  p.nome,
  p.email,
  p.telefone,
  p.cargo,
  p.ativo,
  ur.role,
  p.created_at,
  p.updated_at
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id;
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
