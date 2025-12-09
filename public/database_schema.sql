-- ============================================
-- CONSOLIDATED SCHEMA FOR EXTERNAL DEPLOYMENT
-- ============================================
-- This file contains all necessary database structures
-- for deploying the system to an external PostgreSQL database

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CUSTOM TYPES
-- ============================================
CREATE TYPE app_role AS ENUM ('admin', 'user');

-- ============================================
-- TABLES
-- ============================================

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  nome TEXT,
  email TEXT,
  telefone VARCHAR,
  cargo VARCHAR,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- User Roles Table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- User Permissions Table
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

-- System Config Table
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Clientes Table
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  razao_social TEXT,
  nome_fantasia TEXT,
  atividade_principal TEXT,
  endereco TEXT,
  cidade TEXT,
  uf VARCHAR,
  cep VARCHAR,
  telefone VARCHAR,
  email VARCHAR,
  situacao TEXT,
  observacoes TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Modelos Table
CREATE TABLE IF NOT EXISTS public.modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tipos Impressão Table
CREATE TABLE IF NOT EXISTS public.tipos_impressao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Campos Table
CREATE TABLE IF NOT EXISTS public.campos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Layouts Table
CREATE TABLE IF NOT EXISTS public.layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  modelo_id UUID NOT NULL,
  tipo_impressao_id UUID NOT NULL,
  nome TEXT NOT NULL,
  imagem_url TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Layout Campos Table
CREATE TABLE IF NOT EXISTS public.layout_campos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID NOT NULL,
  campo_id UUID NOT NULL,
  ordem INTEGER NOT NULL,
  obrigatorio BOOLEAN DEFAULT false NOT NULL,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Audit Log Table
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

-- ============================================
-- FUNCTIONS
-- ============================================

-- Handle Updated At Function (adapted for external PostgreSQL)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  -- updated_by should be set by application, not trigger
  RETURN NEW;
END;
$$;

-- Create Audit Log Function (adapted for external PostgreSQL)
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

-- Has Role Function
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

-- Has Permission Function
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

-- Grant Default Permissions Function
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

-- Note: handle_new_user function removed for external PostgreSQL
-- User creation is handled by the application layer through signup API

-- Clone Layout Function
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
  
  INSERT INTO public.layouts (cliente_id, modelo_id, tipo_impressao_id, nome, imagem_url)
  VALUES (destino_cliente_id, origem_layout.modelo_id, origem_layout.tipo_impressao_id, origem_layout.nome || ' (Clonado)', origem_layout.imagem_url)
  RETURNING id INTO novo_layout_id;
  
  INSERT INTO public.layout_campos (layout_id, campo_id, ordem, obrigatorio)
  SELECT novo_layout_id, campo_id, ordem, obrigatorio
  FROM public.layout_campos
  WHERE layout_id = origem_layout_id;
  
  RETURN novo_layout_id;
END;
$$;

-- Comparar Layouts Function
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

-- Comparar Múltiplos Layouts Function
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

-- Clientes com Campo Function
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

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert initial setup status
INSERT INTO public.system_config (key, value)
VALUES ('setup_completed', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- NOTE: RLS POLICIES AND TRIGGERS
-- ============================================
-- RLS policies and triggers should be configured based on your
-- authentication system (Supabase Auth or custom auth)
-- This schema provides the base structure without RLS enabled
-- 
-- For Supabase Auth integration, you'll need to:
-- 1. Enable RLS on all tables
-- 2. Create appropriate policies for each table
-- 3. Set up the auth trigger: CREATE TRIGGER on_auth_user_created
--    AFTER INSERT ON auth.users
--    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
