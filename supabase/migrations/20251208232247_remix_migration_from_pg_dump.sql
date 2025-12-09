CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: clientes_com_campo(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clientes_com_campo(nomes_campos text[]) RETURNS TABLE(cliente_id uuid, cliente_nome text, cliente_cnpj text, layout_id uuid, layout_nome text, modelo_nome text, tipo_nome text)
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: clone_layout(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clone_layout(origem_layout_id uuid, destino_cliente_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: comparar_layouts(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.comparar_layouts(layout1_id uuid, layout2_id uuid) RETURNS TABLE(campo_nome text, layout1_possui boolean, layout1_ordem integer, layout1_obrigatorio boolean, layout2_possui boolean, layout2_ordem integer, layout2_obrigatorio boolean)
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: comparar_multiplos_layouts(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.comparar_multiplos_layouts(layout_ids uuid[]) RETURNS TABLE(campo_id uuid, campo_nome text, layout_data jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: create_audit_log(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_audit_log() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
END;
$$;


--
-- Name: grant_default_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_default_permissions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  resources TEXT[] := ARRAY['clientes', 'modelos', 'tipos', 'campos', 'layouts', 'historico'];
  res_name TEXT;
BEGIN
  -- Grant view-only permissions to all resources for new non-admin users
  FOREACH res_name IN ARRAY resources
  LOOP
    INSERT INTO public.user_permissions (user_id, resource, can_view, can_create, can_edit, can_delete)
    VALUES (NEW.user_id, res_name, true, false, false, false)
    ON CONFLICT (user_id, resource) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Insert profile with ativo = false by default
  INSERT INTO public.profiles (id, nome, email, telefone, ativo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'telefone',
    false  -- New users are inactive by default
  );
  
  -- Check if this is the first user
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  -- If first user, make them admin and activate them
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    
    -- Activate the first user (admin)
    UPDATE public.profiles SET ativo = true WHERE id = NEW.id;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;


--
-- Name: has_permission(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_permission(_user_id uuid, _resource text, _action text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  is_admin BOOLEAN;
  has_perm BOOLEAN;
BEGIN
  -- Check if user is admin (admins have all permissions)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  ) INTO is_admin;
  
  IF is_admin THEN
    RETURN true;
  END IF;
  
  -- Check specific permission
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


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;


SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: campos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    cnpj text NOT NULL,
    observacoes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    razao_social text,
    nome_fantasia text,
    endereco text,
    cidade text,
    uf character varying(5),
    cep character varying(15),
    telefone character varying(50),
    email character varying(100),
    situacao text,
    atividade_principal text,
    created_by uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: layout_campos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.layout_campos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    layout_id uuid NOT NULL,
    campo_id uuid NOT NULL,
    ordem integer NOT NULL,
    obrigatorio boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: layouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.layouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    modelo_id uuid NOT NULL,
    tipo_impressao_id uuid NOT NULL,
    nome text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    imagem_url text,
    created_by uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    imagem_data bytea,
    imagem_tipo text
);


--
-- Name: modelos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modelos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    nome text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    telefone character varying(20),
    cargo character varying(100),
    ativo boolean DEFAULT true
);


--
-- Name: system_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tipos_impressao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_impressao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    resource text NOT NULL,
    can_view boolean DEFAULT false,
    can_create boolean DEFAULT false,
    can_edit boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: campos campos_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campos
    ADD CONSTRAINT campos_nome_key UNIQUE (nome);


--
-- Name: campos campos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campos
    ADD CONSTRAINT campos_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_cnpj_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_cnpj_key UNIQUE (cnpj);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: layout_campos layout_campos_layout_id_campo_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_campos
    ADD CONSTRAINT layout_campos_layout_id_campo_id_key UNIQUE (layout_id, campo_id);


--
-- Name: layout_campos layout_campos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_campos
    ADD CONSTRAINT layout_campos_pkey PRIMARY KEY (id);


--
-- Name: layouts layouts_cliente_id_modelo_id_tipo_impressao_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_cliente_id_modelo_id_tipo_impressao_id_key UNIQUE (cliente_id, modelo_id, tipo_impressao_id);


--
-- Name: layouts layouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_pkey PRIMARY KEY (id);


--
-- Name: modelos modelos_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modelos
    ADD CONSTRAINT modelos_nome_key UNIQUE (nome);


--
-- Name: modelos modelos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modelos
    ADD CONSTRAINT modelos_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: system_config system_config_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_key_key UNIQUE (key);


--
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (id);


--
-- Name: tipos_impressao tipos_impressao_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_impressao
    ADD CONSTRAINT tipos_impressao_nome_key UNIQUE (nome);


--
-- Name: tipos_impressao tipos_impressao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_impressao
    ADD CONSTRAINT tipos_impressao_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_user_id_resource_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_resource_key UNIQUE (user_id, resource);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_layouts_imagem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_layouts_imagem ON public.layouts USING btree (id) WHERE (imagem_data IS NOT NULL);


--
-- Name: campos audit_campos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_campos AFTER INSERT OR DELETE OR UPDATE ON public.campos FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();


--
-- Name: clientes audit_clientes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_clientes AFTER INSERT OR DELETE OR UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();


--
-- Name: layout_campos audit_layout_campos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_layout_campos AFTER INSERT OR DELETE OR UPDATE ON public.layout_campos FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();


--
-- Name: layouts audit_layouts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_layouts AFTER INSERT OR DELETE OR UPDATE ON public.layouts FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();


--
-- Name: modelos audit_modelos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_modelos AFTER INSERT OR DELETE OR UPDATE ON public.modelos FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();


--
-- Name: tipos_impressao audit_tipos_impressao; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_tipos_impressao AFTER INSERT OR DELETE OR UPDATE ON public.tipos_impressao FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();


--
-- Name: user_roles grant_permissions_on_user_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER grant_permissions_on_user_role AFTER INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.grant_default_permissions();


--
-- Name: campos set_updated_at_campos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_campos BEFORE UPDATE ON public.campos FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: clientes set_updated_at_clientes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_clientes BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: layout_campos set_updated_at_layout_campos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_layout_campos BEFORE UPDATE ON public.layout_campos FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: layouts set_updated_at_layouts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_layouts BEFORE UPDATE ON public.layouts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: modelos set_updated_at_modelos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_modelos BEFORE UPDATE ON public.modelos FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: tipos_impressao set_updated_at_tipos_impressao; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_tipos_impressao BEFORE UPDATE ON public.tipos_impressao FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: system_config update_system_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON public.system_config FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: audit_log audit_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campos campos_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campos
    ADD CONSTRAINT campos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: campos campos_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campos
    ADD CONSTRAINT campos_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: clientes clientes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: clientes clientes_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: layout_campos layout_campos_campo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_campos
    ADD CONSTRAINT layout_campos_campo_id_fkey FOREIGN KEY (campo_id) REFERENCES public.campos(id) ON DELETE CASCADE;


--
-- Name: layout_campos layout_campos_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_campos
    ADD CONSTRAINT layout_campos_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: layout_campos layout_campos_layout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_campos
    ADD CONSTRAINT layout_campos_layout_id_fkey FOREIGN KEY (layout_id) REFERENCES public.layouts(id) ON DELETE CASCADE;


--
-- Name: layout_campos layout_campos_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_campos
    ADD CONSTRAINT layout_campos_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: layouts layouts_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- Name: layouts layouts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: layouts layouts_modelo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES public.modelos(id) ON DELETE CASCADE;


--
-- Name: layouts layouts_tipo_impressao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_tipo_impressao_id_fkey FOREIGN KEY (tipo_impressao_id) REFERENCES public.tipos_impressao(id) ON DELETE CASCADE;


--
-- Name: layouts layouts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layouts
    ADD CONSTRAINT layouts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: modelos modelos_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modelos
    ADD CONSTRAINT modelos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: modelos modelos_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modelos
    ADD CONSTRAINT modelos_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tipos_impressao tipos_impressao_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_impressao
    ADD CONSTRAINT tipos_impressao_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: tipos_impressao tipos_impressao_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_impressao
    ADD CONSTRAINT tipos_impressao_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_permissions Admins can manage all permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all permissions" ON public.user_permissions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: system_config Admins can manage system config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage system config" ON public.system_config TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_permissions Admins can view all permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all permissions" ON public.user_permissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (auth.uid() = id)));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: system_config Allow initial setup configuration; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow initial setup configuration" ON public.system_config FOR INSERT WITH CHECK ((NOT (EXISTS ( SELECT 1
   FROM public.system_config system_config_1
  WHERE ((system_config_1.key = 'setup_completed'::text) AND (system_config_1.value = 'true'::jsonb))))));


--
-- Name: system_config Anyone can read setup_completed status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read setup_completed status" ON public.system_config FOR SELECT USING ((key = 'setup_completed'::text));


--
-- Name: campos Authenticated users can delete campos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete campos" ON public.campos FOR DELETE TO authenticated USING (true);


--
-- Name: clientes Authenticated users can delete clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete clientes" ON public.clientes FOR DELETE TO authenticated USING (true);


--
-- Name: layout_campos Authenticated users can delete layout_campos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete layout_campos" ON public.layout_campos FOR DELETE TO authenticated USING (true);


--
-- Name: layouts Authenticated users can delete layouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete layouts" ON public.layouts FOR DELETE TO authenticated USING (true);


--
-- Name: modelos Authenticated users can delete modelos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete modelos" ON public.modelos FOR DELETE TO authenticated USING (true);


--
-- Name: tipos_impressao Authenticated users can delete tipos_impressao; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete tipos_impressao" ON public.tipos_impressao FOR DELETE TO authenticated USING (true);


--
-- Name: campos Authenticated users can insert campos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert campos" ON public.campos FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: clientes Authenticated users can insert clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: layout_campos Authenticated users can insert layout_campos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert layout_campos" ON public.layout_campos FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: layouts Authenticated users can insert layouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert layouts" ON public.layouts FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: modelos Authenticated users can insert modelos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert modelos" ON public.modelos FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: tipos_impressao Authenticated users can insert tipos_impressao; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert tipos_impressao" ON public.tipos_impressao FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: campos Authenticated users can update campos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update campos" ON public.campos FOR UPDATE TO authenticated USING (true);


--
-- Name: clientes Authenticated users can update clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update clientes" ON public.clientes FOR UPDATE TO authenticated USING (true);


--
-- Name: layout_campos Authenticated users can update layout_campos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update layout_campos" ON public.layout_campos FOR UPDATE TO authenticated USING (true);


--
-- Name: layouts Authenticated users can update layouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update layouts" ON public.layouts FOR UPDATE TO authenticated USING (true);


--
-- Name: modelos Authenticated users can update modelos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update modelos" ON public.modelos FOR UPDATE TO authenticated USING (true);


--
-- Name: tipos_impressao Authenticated users can update tipos_impressao; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update tipos_impressao" ON public.tipos_impressao FOR UPDATE TO authenticated USING (true);


--
-- Name: audit_log Authenticated users can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view audit logs" ON public.audit_log FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: campos Authenticated users can view campos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view campos" ON public.campos FOR SELECT TO authenticated USING (true);


--
-- Name: clientes Authenticated users can view clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view clientes" ON public.clientes FOR SELECT TO authenticated USING (true);


--
-- Name: layout_campos Authenticated users can view layout_campos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view layout_campos" ON public.layout_campos FOR SELECT TO authenticated USING (true);


--
-- Name: layouts Authenticated users can view layouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view layouts" ON public.layouts FOR SELECT TO authenticated USING (true);


--
-- Name: modelos Authenticated users can view modelos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view modelos" ON public.modelos FOR SELECT TO authenticated USING (true);


--
-- Name: user_roles Authenticated users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: tipos_impressao Authenticated users can view tipos_impressao; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view tipos_impressao" ON public.tipos_impressao FOR SELECT TO authenticated USING (true);


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: profiles Users can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: user_permissions Users can view their own permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own permissions" ON public.user_permissions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: campos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campos ENABLE ROW LEVEL SECURITY;

--
-- Name: clientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

--
-- Name: layout_campos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.layout_campos ENABLE ROW LEVEL SECURITY;

--
-- Name: layouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.layouts ENABLE ROW LEVEL SECURITY;

--
-- Name: modelos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.modelos ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: system_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

--
-- Name: tipos_impressao; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tipos_impressao ENABLE ROW LEVEL SECURITY;

--
-- Name: user_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


