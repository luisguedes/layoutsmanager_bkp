-- ============================================
-- SCHEMA COMPLETO PARA DEPLOY EXTERNO
-- ============================================
-- Este arquivo contém todas as estruturas necessárias
-- para deploy do sistema em banco PostgreSQL externo
-- Versão: 2.0 - Atualizado em 2025
-- ============================================

-- ============================================
-- EXTENSÕES
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TIPOS CUSTOMIZADOS
-- ============================================
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

-- ============================================
-- TABELAS
-- ============================================

-- ============================================
-- PROFILES - Informações do usuário
-- ============================================
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

-- ============================================
-- USER_CREDENTIALS - Credenciais de autenticação
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_credentials (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- USER_ROLES - Papéis do usuário (admin/user)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- ============================================
-- USER_PERMISSIONS - Permissões granulares
-- ============================================
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

-- ============================================
-- SYSTEM_CONFIG - Configurações do sistema
-- ============================================
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- CLIENTES - Cadastro de clientes
-- ============================================
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

-- ============================================
-- MODELOS - Modelos de layout
-- ============================================
CREATE TABLE IF NOT EXISTS public.modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- TIPOS_IMPRESSAO - Tipos de impressão
-- ============================================
CREATE TABLE IF NOT EXISTS public.tipos_impressao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- CAMPOS - Campos disponíveis para layouts
-- ============================================
CREATE TABLE IF NOT EXISTS public.campos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- LAYOUTS - Layouts de impressão
-- ============================================
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

-- ============================================
-- LAYOUT_CAMPOS - Campos associados aos layouts
-- ============================================
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

-- ============================================
-- AUDIT_LOG - Log de auditoria
-- ============================================
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
-- ÍNDICES PARA PERFORMANCE
-- ============================================

-- Índices para profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_ativo ON public.profiles(ativo);

-- Índices para user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Índices para user_permissions
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_resource ON public.user_permissions(resource);

-- Índices para clientes
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON public.clientes(nome);
CREATE INDEX IF NOT EXISTS idx_clientes_cnpj ON public.clientes(cnpj);

-- Índices para layouts
CREATE INDEX IF NOT EXISTS idx_layouts_cliente_id ON public.layouts(cliente_id);
CREATE INDEX IF NOT EXISTS idx_layouts_modelo_id ON public.layouts(modelo_id);
CREATE INDEX IF NOT EXISTS idx_layouts_tipo_impressao_id ON public.layouts(tipo_impressao_id);

-- Índices para layout_campos
CREATE INDEX IF NOT EXISTS idx_layout_campos_layout_id ON public.layout_campos(layout_id);
CREATE INDEX IF NOT EXISTS idx_layout_campos_campo_id ON public.layout_campos(campo_id);

-- Índices para audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON public.audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.audit_log(changed_at DESC);

-- ============================================
-- FUNÇÕES
-- ============================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Função para criar log de auditoria
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

-- Função para verificar role do usuário
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

-- Função para verificar permissão do usuário
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
  -- Verificar se é admin (admins têm todas as permissões)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  ) INTO is_admin;
  
  IF is_admin THEN
    RETURN true;
  END IF;
  
  -- Verificar permissão específica
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

-- Função para conceder permissões padrão
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

-- Função para clonar layout
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

-- Função para comparar dois layouts
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

-- Função para comparar múltiplos layouts
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

-- Função para buscar clientes por campos específicos
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
-- TRIGGERS
-- ============================================

-- Triggers para atualizar updated_at automaticamente
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

-- Trigger para conceder permissões padrão a novos usuários
DROP TRIGGER IF EXISTS grant_permissions_on_new_user ON public.user_roles;
CREATE TRIGGER grant_permissions_on_new_user
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  WHEN (NEW.role = 'user')
  EXECUTE FUNCTION public.grant_default_permissions();

-- ============================================
-- DADOS INICIAIS
-- ============================================

-- Inserir configuração inicial de setup
INSERT INTO public.system_config (key, value)
VALUES ('setup_completed', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- TABELAS CRIADAS:
-- 1. profiles - Informações do usuário
-- 2. user_credentials - Hash de senhas (separado de profiles por segurança)
-- 3. user_roles - Papéis do usuário (admin/user)
-- 4. user_permissions - Permissões granulares por recurso
-- 5. system_config - Configurações do sistema
-- 6. clientes - Cadastro de clientes
-- 7. modelos - Modelos de layout
-- 8. tipos_impressao - Tipos de impressão
-- 9. campos - Campos disponíveis
-- 10. layouts - Layouts com suporte a imagem BYTEA
-- 11. layout_campos - Associação campos x layouts
-- 12. audit_log - Log de auditoria
--
-- COLUNAS IMPORTANTES:
-- - layouts.imagem_data (BYTEA) - Armazena imagem binária diretamente
-- - layouts.imagem_tipo (TEXT) - MIME type da imagem
-- - user_credentials.password_hash - Hash bcrypt da senha
--
-- FOREIGN KEYS:
-- - Todas as tabelas têm referências para profiles(id) onde aplicável
-- - CASCADE DELETE para user_credentials, user_roles, user_permissions
-- - CASCADE DELETE para layouts quando cliente é deletado
-- - RESTRICT DELETE para campos e modelos usados em layouts
--
-- ============================================