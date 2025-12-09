import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db';

// SECURITY: JWT secret must be explicitly configured - no fallback allowed
const JWT_SECRET = process.env.VITE_JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ CRITICAL: VITE_JWT_SECRET environment variable is not set!');
  console.error('   Generate a strong secret: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
}

const SALT_ROUNDS = 10;

export interface User {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  cargo?: string;
  ativo: boolean;
  created_at: Date;
}

export interface AuthUser extends User {
  role: 'admin' | 'user';
  permissions?: {
    resource: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  }[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData extends LoginCredentials {
  nome: string;
  telefone?: string;
}

// Hash de senha
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

// Verificar senha
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Gerar JWT token
export const generateToken = (userId: string, email: string): string => {
  if (!JWT_SECRET) {
    throw new Error('JWT secret not configured. Set VITE_JWT_SECRET environment variable.');
  }
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Verificar JWT token
export const verifyToken = (token: string): { userId: string; email: string } | null => {
  if (!JWT_SECRET) {
    console.error('JWT secret not configured');
    return null;
  }
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
  } catch (error) {
    return null;
  }
};

// Login
export const login = async ({ email, password }: LoginCredentials): Promise<{ user: AuthUser; token: string } | null> => {
  try {
    console.log('📧 [AUTH] Buscando usuário:', email);
    
    // Primeiro buscar usuário sem filtrar por ativo para verificar se existe
    const checkResult = await query(
      `SELECT p.*, 
              uc.password_hash,
              ur.role
       FROM profiles p
       JOIN user_credentials uc ON uc.user_id = p.id
       LEFT JOIN user_roles ur ON ur.user_id = p.id
       WHERE p.email = $1
       LIMIT 1`,
      [email]
    );

    console.log('🔍 [AUTH] Usuários encontrados:', checkResult.rows.length);

    if (checkResult.rows.length === 0) {
      console.log('❌ [AUTH] Usuário não encontrado');
      return null;
    }

    const userData = checkResult.rows[0];
    console.log('👤 [AUTH] Usuário encontrado:', userData.nome, '| Ativo:', userData.ativo);

    // Verificar senha primeiro
    const isValid = await verifyPassword(password, userData.password_hash);
    console.log('🔑 [AUTH] Senha válida:', isValid);
    
    if (!isValid) {
      console.log('❌ [AUTH] Senha incorreta');
      return null;
    }

    // Se senha estiver correta, verificar se usuário está ativo
    if (!userData.ativo) {
      console.log('⚠️ [AUTH] Usuário inativo');
      throw new Error('Conta inativa. Aguarde aprovação de um administrador.');
    }

    // Buscar permissões
    const permissionsResult = await query(
      `SELECT resource, can_view, can_create, can_edit, can_delete
       FROM user_permissions
       WHERE user_id = $1`,
      [userData.id]
    );

    const user: AuthUser = {
      id: userData.id,
      nome: userData.nome,
      email: userData.email,
      telefone: userData.telefone,
      cargo: userData.cargo,
      ativo: userData.ativo,
      created_at: userData.created_at,
      role: userData.role || 'user',
      permissions: permissionsResult.rows,
    };

    const token = generateToken(user.id, user.email);

    console.log('✅ [AUTH] Login completo para:', user.email);
    return { user, token };
  } catch (error) {
    console.error('❌ [AUTH] Erro no login:', error);
    throw error;
  }
};

// Signup
export const signup = async ({ email, password, nome, telefone }: SignupData): Promise<{ user: AuthUser; token: string } | null> => {
  try {
    console.log('📝 [SIGNUP] Iniciando cadastro para:', email);
    const passwordHash = await hashPassword(password);
    console.log('🔐 [SIGNUP] Senha hasheada com sucesso');

    // Verificar se é o primeiro usuário
    const countResult = await query('SELECT COUNT(*) as count FROM profiles');
    const isFirstUser = parseInt(countResult.rows[0].count) === 0;
    console.log('👥 [SIGNUP] É primeiro usuário?', isFirstUser);

    // Verificar se email já existe
    const existingUser = await query('SELECT id FROM profiles WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      console.log('❌ [SIGNUP] Email já cadastrado:', email);
      throw new Error('Email já cadastrado');
    }

    // Criar usuário
    console.log('👤 [SIGNUP] Criando profile...');
    const userResult = await query(
      `INSERT INTO profiles (id, nome, email, telefone, ativo)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       RETURNING *`,
      [nome, email, telefone || null, isFirstUser]
    );

    const newUser = userResult.rows[0];
    console.log('✅ [SIGNUP] Profile criado, ID:', newUser.id);

    // Criar tabela de credenciais se não existir
    console.log('📋 [SIGNUP] Verificando tabela user_credentials...');
    await query(`
      CREATE TABLE IF NOT EXISTS user_credentials (
        user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Armazenar hash da senha
    console.log('🔑 [SIGNUP] Salvando credenciais...');
    await query(
      `INSERT INTO user_credentials (user_id, password_hash)
       VALUES ($1, $2)`,
      [newUser.id, passwordHash]
    );
    console.log('✅ [SIGNUP] Credenciais salvas');

    // Definir role
    const role = isFirstUser ? 'admin' : 'user';
    console.log('🎭 [SIGNUP] Definindo role:', role);
    await query(
      `INSERT INTO user_roles (user_id, role)
       VALUES ($1, $2)`,
      [newUser.id, role]
    );
    console.log('✅ [SIGNUP] Role definida');

    // Se não for admin, dar permissões padrão de visualização
    if (!isFirstUser) {
      console.log('🔐 [SIGNUP] Definindo permissões padrão...');
      const resources = ['clientes', 'modelos', 'tipos', 'campos', 'layouts', 'historico'];
      for (const resource of resources) {
        await query(
          `INSERT INTO user_permissions (user_id, resource, can_view)
           VALUES ($1, $2, true)
           ON CONFLICT (user_id, resource) DO NOTHING`,
          [newUser.id, resource]
        );
      }
      console.log('✅ [SIGNUP] Permissões definidas');
    }

    const user: AuthUser = {
      ...newUser,
      role,
      permissions: [],
    };

    const token = generateToken(user.id, user.email);

    console.log('✅ [SIGNUP] Cadastro completo para:', email);
    return { user, token };
  } catch (error) {
    console.error('❌ [SIGNUP] Erro no cadastro:', error);
    throw error;
  }
};

// Verificar se usuário está autenticado
export const getCurrentUser = async (token: string): Promise<AuthUser | null> => {
  const decoded = verifyToken(token);
  if (!decoded) {
    return null;
  }

  try {
    const result = await query(
      `SELECT p.*, ur.role
       FROM profiles p
       LEFT JOIN user_roles ur ON ur.user_id = p.id
       WHERE p.id = $1 AND p.ativo = true
       LIMIT 1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const userData = result.rows[0];

    const permissionsResult = await query(
      `SELECT resource, can_view, can_create, can_edit, can_delete
       FROM user_permissions
       WHERE user_id = $1`,
      [userData.id]
    );

    return {
      ...userData,
      role: userData.role || 'user',
      permissions: permissionsResult.rows,
    };
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
};
