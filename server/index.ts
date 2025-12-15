import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { initializeDatabase, query, getDatabase } from '../src/lib/db';
import { login, signup, getCurrentUser } from '../src/lib/auth';
import { apiConfig, validateConfig, logConfig } from './config';

// Carregar variáveis de ambiente
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tentar carregar .env.local primeiro, depois .env
const envLocalPath = path.join(__dirname, '../.env.local');
const envPath = path.join(__dirname, '../.env');

if (fs.existsSync(envLocalPath)) {
  console.log('📄 Carregando .env.local de:', envLocalPath);
  config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  console.log('📄 Carregando .env de:', envPath);
  config({ path: envPath });
} else {
  console.warn('⚠️ Nenhum arquivo de configuração encontrado (.env.local ou .env)');
}

// Validar configuração
validateConfig();
logConfig();

const app = express();
const PORT = apiConfig.port;

// Configurar CORS dinamicamente
const corsOrigins = apiConfig.corsOrigin === '*' 
  ? '*' 
  : apiConfig.corsOrigin.split(',').map(o => o.trim());

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// Aumentar limite para permitir upload de imagens (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: apiConfig.nodeEnv
  });
});

// Função helper para criar log de auditoria
const createAuditLog = async (
  tableName: string,
  recordId: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  userId: string,
  oldData?: any,
  newData?: any
) => {
  try {
    await query(
      `INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tableName, recordId, action, oldData ? JSON.stringify(oldData) : null, newData ? JSON.stringify(newData) : null, userId]
    );
  } catch (error) {
    console.error('Erro ao criar log de auditoria:', error);
  }
};

// Middleware de autenticação
const authenticate = async (req: any, res: any, next: any) => {
  console.log(`🔐 [AUTH] ${req.method} ${req.path} - Verificando autenticação...`);
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    console.log('❌ [AUTH] Token não fornecido');
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const user = await getCurrentUser(token);
    if (!user) {
      console.log('❌ [AUTH] Token inválido ou usuário não encontrado');
      return res.status(401).json({ error: 'Token inválido' });
    }

    console.log(`✅ [AUTH] Usuário autenticado: ${user.email}`);
    req.user = user;
    next();
  } catch (error: any) {
    console.error('❌ [AUTH] Erro ao validar token:', error);
    return res.status(500).json({ error: 'Erro ao validar token' });
  }
};

// Middleware para verificar se usuário é admin
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const result = await query(
      'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
      [req.user.id, 'admin']
    );
    
    if (result.rows.length === 0) {
      console.log(`❌ [ADMIN] Usuário ${req.user.email} tentou acessar rota admin sem permissão`);
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
    }
    
    console.log(`✅ [ADMIN] Usuário admin verificado: ${req.user.email}`);
    next();
  } catch (error: any) {
    console.error('❌ [ADMIN] Erro ao verificar admin:', error);
    return res.status(500).json({ error: 'Erro ao verificar permissões de administrador' });
  }
};

// Middleware para verificar permissões de recurso
const checkPermission = (resource: string, action: 'view' | 'create' | 'edit' | 'delete') => {
  return async (req: any, res: any, next: any) => {
    try {
      // Admins bypass permission checks
      const adminResult = await query(
        'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
        [req.user.id, 'admin']
      );
      
      if (adminResult.rows.length > 0) {
        return next();
      }

      // Check specific permission
      const actionColumn = `can_${action}`;
      const result = await query(
        `SELECT ${actionColumn} FROM user_permissions WHERE user_id = $1 AND resource = $2`,
        [req.user.id, resource]
      );
      
      if (result.rows.length === 0 || !result.rows[0][actionColumn]) {
        console.log(`❌ [PERMISSION] Usuário ${req.user.email} sem permissão: ${action} em ${resource}`);
        return res.status(403).json({ 
          error: `Acesso negado. Você não tem permissão para ${action === 'view' ? 'visualizar' : action === 'create' ? 'criar' : action === 'edit' ? 'editar' : 'excluir'} ${resource}.` 
        });
      }
      
      next();
    } catch (error: any) {
      console.error('❌ [PERMISSION] Erro ao verificar permissão:', error);
      return res.status(500).json({ error: 'Erro ao verificar permissões' });
    }
  };
};

// Rotas de autenticação
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 [LOGIN] Tentativa de login para:', req.body.email);
    const result = await login(req.body);
    if (!result) {
      console.log('❌ [LOGIN] Falha na autenticação para:', req.body.email);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    console.log('✅ [LOGIN] Login bem-sucedido para:', req.body.email);
    res.json(result);
  } catch (error: any) {
    console.error('❌ [LOGIN] Erro no login:', error.message);
    // Retorna o erro específico (como "Conta inativa. Aguarde aprovação...")
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const result = await signup(req.body);
    if (!result) {
      return res.status(400).json({ error: 'Erro ao criar usuário' });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticate, (req: any, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

// ==================== CLIENTES ====================
app.get('/api/clientes', authenticate, checkPermission('clientes', 'view'), async (req: any, res) => {
  try {
    const result = await query('SELECT * FROM clientes ORDER BY nome');
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clientes', authenticate, checkPermission('clientes', 'create'), async (req: any, res) => {
  try {
    const { nome, cnpj, ...rest } = req.body;
    const result = await query(
      `INSERT INTO clientes (nome, cnpj, razao_social, nome_fantasia, email, telefone, 
        endereco, cep, cidade, uf, atividade_principal, situacao, observacoes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        nome, cnpj, rest.razao_social, rest.nome_fantasia, rest.email, rest.telefone,
        rest.endereco, rest.cep, rest.cidade, rest.uf, rest.atividade_principal,
        rest.situacao, rest.observacoes, req.user.id
      ]
    );
    await createAuditLog('clientes', result.rows[0].id, 'INSERT', req.user.id, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clientes/:id', authenticate, checkPermission('clientes', 'edit'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { nome, cnpj, ...rest } = req.body;
    const oldData = await query('SELECT * FROM clientes WHERE id = $1', [id]);
    const result = await query(
      `UPDATE clientes SET nome = $1, cnpj = $2, razao_social = $3, nome_fantasia = $4, 
       email = $5, telefone = $6, endereco = $7, cep = $8, cidade = $9, uf = $10, 
       atividade_principal = $11, situacao = $12, observacoes = $13, updated_by = $14, updated_at = NOW()
       WHERE id = $15 RETURNING *`,
      [
        nome, cnpj, rest.razao_social, rest.nome_fantasia, rest.email, rest.telefone,
        rest.endereco, rest.cep, rest.cidade, rest.uf, rest.atividade_principal,
        rest.situacao, rest.observacoes, req.user.id, id
      ]
    );
    await createAuditLog('clientes', id, 'UPDATE', req.user.id, oldData.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clientes/:id', authenticate, checkPermission('clientes', 'delete'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const oldData = await query('SELECT * FROM clientes WHERE id = $1', [id]);
    await query('DELETE FROM clientes WHERE id = $1', [id]);
    await createAuditLog('clientes', id, 'DELETE', req.user.id, oldData.rows[0], null);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== MODELOS ====================
app.get('/api/modelos', authenticate, checkPermission('modelos', 'view'), async (req: any, res) => {
  try {
    const result = await query(`
      SELECT m.*,
        cp_created.nome as created_profile_nome,
        cp_updated.nome as updated_profile_nome
      FROM modelos m
      LEFT JOIN profiles cp_created ON m.created_by = cp_created.id
      LEFT JOIN profiles cp_updated ON m.updated_by = cp_updated.id
      ORDER BY m.nome
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/modelos', authenticate, checkPermission('modelos', 'create'), async (req: any, res) => {
  try {
    const { nome, descricao } = req.body;
    const result = await query(
      `INSERT INTO modelos (nome, descricao, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [nome, descricao, req.user.id]
    );
    await createAuditLog('modelos', result.rows[0].id, 'INSERT', req.user.id, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/modelos/:id', authenticate, checkPermission('modelos', 'edit'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao } = req.body;
    const oldData = await query('SELECT * FROM modelos WHERE id = $1', [id]);
    const result = await query(
      `UPDATE modelos SET nome = $1, descricao = $2, updated_by = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [nome, descricao, req.user.id, id]
    );
    await createAuditLog('modelos', id, 'UPDATE', req.user.id, oldData.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/modelos/:id', authenticate, checkPermission('modelos', 'delete'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const oldData = await query('SELECT * FROM modelos WHERE id = $1', [id]);
    await query('DELETE FROM modelos WHERE id = $1', [id]);
    await createAuditLog('modelos', id, 'DELETE', req.user.id, oldData.rows[0], null);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TIPOS DE IMPRESSÃO ====================
app.get('/api/tipos', authenticate, checkPermission('tipos', 'view'), async (req: any, res) => {
  try {
    const result = await query(`
      SELECT t.*,
        cp_created.nome as created_profile_nome,
        cp_updated.nome as updated_profile_nome
      FROM tipos_impressao t
      LEFT JOIN profiles cp_created ON t.created_by = cp_created.id
      LEFT JOIN profiles cp_updated ON t.updated_by = cp_updated.id
      ORDER BY t.nome
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tipos', authenticate, checkPermission('tipos', 'create'), async (req: any, res) => {
  try {
    const { nome, descricao } = req.body;
    const result = await query(
      `INSERT INTO tipos_impressao (nome, descricao, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [nome, descricao, req.user.id]
    );
    await createAuditLog('tipos_impressao', result.rows[0].id, 'INSERT', req.user.id, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tipos/:id', authenticate, checkPermission('tipos', 'edit'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao } = req.body;
    const oldData = await query('SELECT * FROM tipos_impressao WHERE id = $1', [id]);
    const result = await query(
      `UPDATE tipos_impressao SET nome = $1, descricao = $2, updated_by = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [nome, descricao, req.user.id, id]
    );
    await createAuditLog('tipos_impressao', id, 'UPDATE', req.user.id, oldData.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tipos/:id', authenticate, checkPermission('tipos', 'delete'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const oldData = await query('SELECT * FROM tipos_impressao WHERE id = $1', [id]);
    await query('DELETE FROM tipos_impressao WHERE id = $1', [id]);
    await createAuditLog('tipos_impressao', id, 'DELETE', req.user.id, oldData.rows[0], null);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== UPLOAD DE IMAGEM ====================
app.post('/api/layouts/upload-image', authenticate, checkPermission('layouts', 'edit'), async (req: any, res) => {
  console.log('📤 [UPLOAD-IMAGE] Iniciando upload...');
  try {
    const { layoutId, imageData, imageType } = req.body;
    
    if (!imageData || !imageType) {
      console.log('❌ [UPLOAD-IMAGE] Dados da imagem não fornecidos');
      return res.status(400).json({ error: 'Dados da imagem são obrigatórios' });
    }

    // Converter base64 para buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    console.log(`📊 [UPLOAD-IMAGE] Tamanho da imagem: ${buffer.length} bytes`);

    if (layoutId) {
      console.log(`🔄 [UPLOAD-IMAGE] Atualizando imagem do layout ${layoutId}`);
      // Atualizar imagem de layout existente
      await query(
        'UPDATE layouts SET imagem_data = $1, imagem_tipo = $2, updated_at = NOW(), updated_by = $3 WHERE id = $4',
        [buffer, imageType, req.user.id, layoutId]
      );
      console.log(`✅ [UPLOAD-IMAGE] Imagem atualizada com sucesso para layout ${layoutId}`);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ [UPLOAD-IMAGE] Erro ao fazer upload de imagem:', error);
    res.status(500).json({ error: 'Erro ao fazer upload de imagem' });
  }
});

// Servir imagem do layout
app.get('/api/layouts/:id/image', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'SELECT imagem_data, imagem_tipo FROM layouts WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0 || !result.rows[0].imagem_data) {
      return res.status(404).json({ error: 'Imagem não encontrada' });
    }

    const { imagem_data, imagem_tipo } = result.rows[0];
    
    res.set('Content-Type', imagem_tipo || 'image/png');
    // Cache de 1 hora para permitir atualizações
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(imagem_data);
  } catch (error: any) {
    console.error('Erro ao buscar imagem:', error);
    res.status(500).json({ error: 'Erro ao buscar imagem' });
  }
});

// ==================== CAMPOS ====================
app.get('/api/campos', authenticate, checkPermission('campos', 'view'), async (req: any, res) => {
  try {
    const result = await query(`
      SELECT c.*,
        cp_created.nome as created_profile_nome,
        cp_updated.nome as updated_profile_nome
      FROM campos c
      LEFT JOIN profiles cp_created ON c.created_by = cp_created.id
      LEFT JOIN profiles cp_updated ON c.updated_by = cp_updated.id
      ORDER BY c.nome
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campos', authenticate, checkPermission('campos', 'create'), async (req: any, res) => {
  try {
    const { nome, descricao } = req.body;
    const result = await query(
      `INSERT INTO campos (nome, descricao, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [nome, descricao, req.user.id]
    );
    await createAuditLog('campos', result.rows[0].id, 'INSERT', req.user.id, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/campos/:id', authenticate, checkPermission('campos', 'edit'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao } = req.body;
    const oldData = await query('SELECT * FROM campos WHERE id = $1', [id]);
    const result = await query(
      `UPDATE campos SET nome = $1, descricao = $2, updated_by = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [nome, descricao, req.user.id, id]
    );
    await createAuditLog('campos', id, 'UPDATE', req.user.id, oldData.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/campos/:id', authenticate, checkPermission('campos', 'delete'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const oldData = await query('SELECT * FROM campos WHERE id = $1', [id]);
    await query('DELETE FROM campos WHERE id = $1', [id]);
    await createAuditLog('campos', id, 'DELETE', req.user.id, oldData.rows[0], null);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar clientes por campos (RPC)
app.post('/api/campos/buscar-clientes', authenticate, async (req: any, res) => {
  try {
    const { nomes_campos } = req.body;
    const result = await query(
      'SELECT * FROM clientes_com_campo($1)',
      [nomes_campos]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== LAYOUTS ====================
app.get('/api/layouts', authenticate, checkPermission('layouts', 'view'), async (req: any, res) => {
  console.log('📋 [GET /api/layouts] Requisição recebida');
  try {
    console.log('🔍 [GET /api/layouts] Executando query...');
    const result = await query(`
      SELECT 
        l.id,
        l.nome,
        l.cliente_id,
        l.modelo_id,
        l.tipo_impressao_id,
        l.imagem_url,
        CASE WHEN l.imagem_data IS NOT NULL THEN true ELSE false END as imagem_data,
        l.created_at,
        l.updated_at,
        l.created_by,
        l.updated_by,
        c.nome as cliente_nome, 
        c.cnpj as cliente_cnpj,
        m.nome as modelo_nome,
        t.nome as tipo_nome,
        cp_created.nome as created_profile_nome,
        cp_updated.nome as updated_profile_nome,
        COALESCE(
          json_agg(
            json_build_object(
              'id', lc.id,
              'ordem', lc.ordem,
              'obrigatorio', lc.obrigatorio,
              'campos', json_build_object('id', ca.id, 'nome', ca.nome)
            ) ORDER BY lc.ordem
          ) FILTER (WHERE lc.id IS NOT NULL),
          '[]'::json
        ) as layout_campos
      FROM layouts l
      LEFT JOIN clientes c ON l.cliente_id = c.id
      LEFT JOIN modelos m ON l.modelo_id = m.id
      LEFT JOIN tipos_impressao t ON l.tipo_impressao_id = t.id
      LEFT JOIN profiles cp_created ON l.created_by = cp_created.id
      LEFT JOIN profiles cp_updated ON l.updated_by = cp_updated.id
      LEFT JOIN layout_campos lc ON l.id = lc.layout_id
      LEFT JOIN campos ca ON lc.campo_id = ca.id
      GROUP BY 
        l.id, 
        l.nome,
        l.cliente_id,
        l.modelo_id,
        l.tipo_impressao_id,
        l.imagem_url,
        l.imagem_data,
        l.created_at,
        l.updated_at,
        l.created_by,
        l.updated_by,
        c.nome, 
        c.cnpj, 
        m.nome, 
        t.nome, 
        cp_created.nome, 
        cp_updated.nome
      ORDER BY l.created_at DESC
    `);
    
    // Transformar para formato esperado pelo frontend
    const layouts = result.rows.map(row => ({
      ...row,
      clientes: { nome: row.cliente_nome },
      modelos: { nome: row.modelo_nome },
      tipos_impressao: { nome: row.tipo_nome }
    }));
    
    console.log(`✅ [GET /api/layouts] Retornando ${layouts.length} layouts`);
    res.json(layouts);
  } catch (error: any) {
    console.error('❌ [GET /api/layouts] Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/layouts', authenticate, checkPermission('layouts', 'create'), async (req: any, res) => {
  try {
    const { nome, cliente_id, modelo_id, tipo_impressao_id, imagem_url, campos } = req.body;
    
    // Inserir layout
    const layoutResult = await query(
      `INSERT INTO layouts (nome, cliente_id, modelo_id, tipo_impressao_id, imagem_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nome, cliente_id, modelo_id, tipo_impressao_id, imagem_url, req.user.id]
    );
    
    const layout = layoutResult.rows[0];
    
    // Inserir campos do layout
    if (campos && campos.length > 0) {
      for (const campo of campos) {
        await query(
          `INSERT INTO layout_campos (layout_id, campo_id, ordem, obrigatorio, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [layout.id, campo.campoId, campo.ordem, campo.obrigatorio, req.user.id]
        );
      }
    }
    
    await createAuditLog('layouts', layout.id, 'INSERT', req.user.id, null, layout);
    res.json(layout);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/layouts/:id', authenticate, checkPermission('layouts', 'edit'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { nome, cliente_id, modelo_id, tipo_impressao_id, imagem_url, campos } = req.body;
    
    const oldData = await query('SELECT * FROM layouts WHERE id = $1', [id]);
    
    // Atualizar layout
    const result = await query(
      `UPDATE layouts SET nome = $1, cliente_id = $2, modelo_id = $3, 
       tipo_impressao_id = $4, imagem_url = $5, updated_by = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [nome, cliente_id, modelo_id, tipo_impressao_id, imagem_url, req.user.id, id]
    );
    
    // Deletar campos antigos
    await query('DELETE FROM layout_campos WHERE layout_id = $1', [id]);
    
    // Inserir novos campos
    if (campos && campos.length > 0) {
      for (const campo of campos) {
        await query(
          `INSERT INTO layout_campos (layout_id, campo_id, ordem, obrigatorio, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, campo.campoId, campo.ordem, campo.obrigatorio, req.user.id]
        );
      }
    }
    
    await createAuditLog('layouts', id, 'UPDATE', req.user.id, oldData.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/layouts/:id', authenticate, checkPermission('layouts', 'delete'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const oldData = await query('SELECT * FROM layouts WHERE id = $1', [id]);
    await query('DELETE FROM layouts WHERE id = $1', [id]);
    await createAuditLog('layouts', id, 'DELETE', req.user.id, oldData.rows[0], null);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Clonar layout (RPC)
app.post('/api/layouts/clone', authenticate, checkPermission('layouts', 'create'), async (req: any, res) => {
  try {
    const { origem_layout_id, destino_cliente_id } = req.body;
    const result = await query(
      'SELECT clone_layout($1, $2) as novo_layout_id',
      [origem_layout_id, destino_cliente_id]
    );
    res.json({ novo_layout_id: result.rows[0].novo_layout_id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Comparar layouts (RPC)
app.post('/api/layouts/comparar', authenticate, checkPermission('layouts', 'view'), async (req: any, res) => {
  try {
    const { layout_ids } = req.body;
    const result = await query(
      'SELECT * FROM comparar_multiplos_layouts($1)',
      [layout_ids]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== DASHBOARD ====================
app.get('/api/dashboard/stats', authenticate, async (req: any, res) => {
  try {
    const [clientes, modelos, tipos, campos, layouts] = await Promise.all([
      query('SELECT COUNT(*) as count FROM clientes'),
      query('SELECT COUNT(*) as count FROM modelos'),
      query('SELECT COUNT(*) as count FROM tipos_impressao'),
      query('SELECT COUNT(*) as count FROM campos'),
      query('SELECT COUNT(*) as count FROM layouts'),
    ]);
    
    res.json({
      clientes: parseInt(clientes.rows[0].count),
      modelos: parseInt(modelos.rows[0].count),
      tipos: parseInt(tipos.rows[0].count),
      campos: parseInt(campos.rows[0].count),
      layouts: parseInt(layouts.rows[0].count),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== HISTÓRICO (AUDIT LOG) ====================
app.get('/api/historico', authenticate, checkPermission('historico', 'view'), async (req: any, res) => {
  try {
    const { table_name, action } = req.query;
    
    let sql = `
      SELECT a.*,
        p.nome as user_profile_nome
      FROM audit_log a
      LEFT JOIN profiles p ON a.changed_by = p.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (table_name && table_name !== 'all') {
      sql += ` AND a.table_name = $${paramIndex}`;
      params.push(table_name);
      paramIndex++;
    }
    
    if (action && action !== 'all') {
      sql += ` AND a.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }
    
    sql += ' ORDER BY a.changed_at DESC LIMIT 100';
    
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== USUÁRIOS ====================
app.get('/api/usuarios', authenticate, requireAdmin, async (req: any, res) => {
  try {
    const result = await query(`
      SELECT 
        p.*,
        json_agg(json_build_object('role', ur.role)) FILTER (WHERE ur.role IS NOT NULL) as user_roles
      FROM profiles p
      LEFT JOIN user_roles ur ON p.id = ur.user_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/usuarios/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT * FROM profiles WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/usuarios/:id', authenticate, requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { nome, email, telefone, cargo } = req.body;
    const result = await query(
      `UPDATE profiles SET nome = $1, email = $2, telefone = $3, cargo = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [nome, email, telefone, cargo, id]
    );
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Resetar senha de usuário
app.post('/api/usuarios/:id/reset-password', authenticate, requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await query(
      `UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2`,
      [hashedPassword, id]
    );
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Alterar status ativo/inativo do usuário
app.put('/api/usuarios/:id/toggle-active', authenticate, requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { ativo } = req.body;
    
    await query(
      'UPDATE profiles SET ativo = $1, updated_at = NOW() WHERE id = $2',
      [ativo, id]
    );
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Alterar role do usuário
app.put('/api/usuarios/:id/role', authenticate, requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    // Delete existing roles
    await query('DELETE FROM user_roles WHERE user_id = $1', [id]);
    
    // Insert new role
    await query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
      [id, role]
    );
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar permissões de um usuário
app.get('/api/permissions/:userId', authenticate, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const result = await query(
      `SELECT * FROM user_permissions WHERE user_id = $1`,
      [userId]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar permissões de um usuário
app.put('/api/permissions/:userId', authenticate, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;
    
    const db = getDatabase();
    
    for (const perm of permissions) {
      await db.query(`
        INSERT INTO user_permissions (user_id, resource, can_view, can_create, can_edit, can_delete)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, resource)
        DO UPDATE SET
          can_view = EXCLUDED.can_view,
          can_create = EXCLUDED.can_create,
          can_edit = EXCLUDED.can_edit,
          can_delete = EXCLUDED.can_delete,
          updated_at = NOW()
      `, [userId, perm.resource, perm.can_view, perm.can_create, perm.can_edit, perm.can_delete]);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/usuarios/:id/ativo', authenticate, requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { ativo } = req.body;
    const result = await query(
      'UPDATE profiles SET ativo = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [ativo, id]
    );
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PERMISSÕES ====================
app.get('/api/permissions/:userId', authenticate, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const result = await query(
      'SELECT * FROM user_permissions WHERE user_id = $1',
      [userId]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/permissions/:userId', authenticate, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;
    
    // Deletar permissões antigas
    await query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);
    
    // Inserir novas permissões
    for (const perm of permissions) {
      await query(
        `INSERT INTO user_permissions (user_id, resource, can_view, can_create, can_edit, can_delete)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, resource) DO UPDATE
         SET can_view = $3, can_create = $4, can_edit = $5, can_delete = $6, updated_at = NOW()`,
        [userId, perm.resource, perm.can_view, perm.can_create, perm.can_edit, perm.can_delete]
      );
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verificar se usuário é admin
app.get('/api/auth/is-admin', authenticate, async (req: any, res) => {
  try {
    const result = await query(
      'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
      [req.user.id, 'admin']
    );
    res.json({ isAdmin: result.rows.length > 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Rota de teste de conexão
app.post('/api/test-connection', async (req, res) => {
  console.log('\n🔍 [TEST-CONNECTION] Requisição recebida');
  console.log('📊 Dados recebidos:', {
    host: req.body.host,
    port: req.body.port,
    database: req.body.database,
    user: req.body.user,
    ssl: req.body.ssl,
    hasPassword: !!req.body.password
  });
  
  let tempPool = null;
  
  try {
    const { host, port, database, user, password, ssl } = req.body;
    
    console.log('🔌 Tentando conectar ao PostgreSQL...');
    
    // Importar Pool diretamente para criar conexão temporária
    const { Pool } = await import('pg');
    tempPool = new Pool({
      host,
      port: parseInt(port),
      database,
      user,
      password,
      max: 1,
      ssl: ssl ? { rejectUnauthorized: false } : false,
    });

    console.log('📡 Executando query de teste...');
    const result = await tempPool.query('SELECT version() as version');

    console.log('✅ Conexão bem-sucedida!');
    console.log('📦 Versão do PostgreSQL:', result.rows[0].version);

    res.json({
      success: true,
      message: 'Conexão estabelecida com sucesso!',
      version: result.rows[0].version,
    });
  } catch (error: any) {
    console.error('❌ Erro ao testar conexão:', error.message);
    console.error('📋 Detalhes do erro:', error);
    
    res.status(400).json({
      success: false,
      error: error.message,
      details: 'Verifique as credenciais e se o PostgreSQL está acessível.',
    });
  } finally {
    // Fechar pool temporário
    if (tempPool) {
      await tempPool.end();
      console.log('🔌 Pool temporário encerrado');
    }
  }
});

// Rota para salvar configuração do banco em .env.local
app.post('/api/save-db-config', async (req, res) => {
  console.log('\n💾 [SAVE-CONFIG] Salvando configurações do banco...');
  
  try {
    const { host, port, database, user, password, ssl, serverIp } = req.body;
    
    // Usar o IP do servidor fornecido ou default para localhost
    const apiUrl = `http://${serverIp || 'localhost'}:3001/api`;
    
    // Criar conteúdo do .env.local
    const envContent = `# PostgreSQL Configuration
DB_HOST=${host}
DB_PORT=${port}
DB_NAME=${database}
DB_USER=${user}
DB_PASSWORD=${password}
DB_SSL=${ssl || false}

# API Configuration
# Change ${serverIp || 'localhost'} to your server IP if accessing from another machine
VITE_API_URL=${apiUrl}

# JWT Secret (change in production)
VITE_JWT_SECRET=${crypto.randomBytes(32).toString('hex')}
`;
    
    // Salvar arquivo .env.local na raiz do projeto
    const envPath = path.join(__dirname, '../.env.local');
    console.log('📁 Caminho do arquivo:', envPath);
    console.log('🌐 API_URL configurada:', apiUrl);
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Arquivo .env.local criado com sucesso!');
    
    res.json({
      success: true,
      message: 'Arquivo .env.local criado com sucesso!',
    });
  } catch (error: any) {
    console.error('Erro ao salvar configuração:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Erro ao criar arquivo .env.local.',
    });
  }
});

// ==================== CONSULTAR CNPJ ====================
app.post('/api/consultar-cnpj', authenticate, async (req: any, res) => {
  try {
    const { cnpj } = req.body;
    
    if (!cnpj) {
      return res.status(400).json({ error: 'CNPJ é obrigatório' });
    }

    // Remove caracteres não numéricos do CNPJ
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    
    if (cnpjLimpo.length !== 14) {
      return res.status(400).json({ error: 'CNPJ deve ter 14 dígitos' });
    }

    // Consulta na API ReceitaWS (gratuita)
    const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpjLimpo}`);
    
    if (!response.ok) {
      throw new Error('Erro ao consultar CNPJ');
    }

    const data = await response.json();
    
    if (data.status === 'ERROR') {
      return res.status(404).json({ error: data.message || 'CNPJ não encontrado' });
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

    res.json(resultado);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== RPC FUNCTIONS ====================
app.post('/api/rpc/clientes-com-campo', authenticate, async (req: any, res) => {
  try {
    const { nomes_campos } = req.body;
    
    if (!nomes_campos || !Array.isArray(nomes_campos)) {
      return res.status(400).json({ error: 'nomes_campos deve ser um array' });
    }

    const result = await query(
      `SELECT * FROM clientes_com_campo($1)`,
      [nomes_campos]
    );
    
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rpc/clone-layout', authenticate, async (req: any, res) => {
  try {
    const { origem_layout_id, destino_cliente_id } = req.body;
    
    if (!origem_layout_id || !destino_cliente_id) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }

    const result = await query(
      `SELECT clone_layout($1, $2) as new_layout_id`,
      [origem_layout_id, destino_cliente_id]
    );
    
    res.json({ success: true, new_layout_id: result.rows[0].new_layout_id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rpc/comparar-multiplos-layouts', authenticate, async (req: any, res) => {
  try {
    const { layout_ids } = req.body;
    
    if (!layout_ids || !Array.isArray(layout_ids)) {
      return res.status(400).json({ error: 'layout_ids deve ser um array' });
    }

    const result = await query(
      `SELECT * FROM comparar_multiplos_layouts($1)`,
      [layout_ids]
    );
    
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para verificar se o schema está instalado (sem autenticação)
app.get('/api/check-schema', async (req, res) => {
  try {
    const db = getDatabase();
    
    // Verificar se as tabelas principais existem (12 tabelas no total)
    const tablesResult = await db.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'profiles', 'user_credentials', 'user_roles', 'user_permissions',
        'clientes', 'modelos', 'tipos_impressao', 'campos', 
        'layouts', 'layout_campos', 'audit_log', 'system_config'
      )
    `);
    
    const tablesCount = parseInt(tablesResult.rows[0].count);
    const schemaInstalled = tablesCount >= 10; // Mínimo de 10 tabelas principais devem existir
    
    // Verificar se existem usuários no banco
    let usersCount = 0;
    let hasAdmin = false;
    
    if (schemaInstalled) {
      try {
        const usersResult = await db.query('SELECT COUNT(*) as count FROM profiles');
        usersCount = parseInt(usersResult.rows[0].count);
        
        // Verificar se existe pelo menos um admin
        const adminResult = await db.query(`
          SELECT COUNT(*) as count FROM user_roles WHERE role = 'admin'
        `);
        hasAdmin = parseInt(adminResult.rows[0].count) > 0;
      } catch (e) {
        // Tabelas podem existir mas ainda não ter dados
        console.log('⚠️ [CHECK-SCHEMA] Erro ao verificar usuários:', e);
      }
    }
    
    // Sistema está instalado se: schema existe E há pelo menos um admin
    const isFullyInstalled = schemaInstalled && hasAdmin;
    
    res.json({
      installed: isFullyInstalled,
      schemaInstalled,
      tablesFound: tablesCount,
      usersCount,
      hasAdmin
    });
  } catch (error: any) {
    // Se der erro de conexão ou banco não existe, schema não está instalado
    res.json({
      installed: false,
      schemaInstalled: false,
      tablesFound: 0,
      usersCount: 0,
      hasAdmin: false,
      error: error.message
    });
  }
});

// Rota para instalar o schema do banco (sem autenticação para setup inicial)
app.post('/api/install-schema', async (req, res) => {
  console.log('\n🛠️ [INSTALL-SCHEMA] Instalando schema do banco...');
  
  try {
    const { host, port, database, user, password, ssl } = req.body;
    
    if (!host || !port || !database || !user || !password) {
      return res.status(400).json({
        success: false,
        error: 'Dados de conexão incompletos'
      });
    }

    console.log(`📊 Conectando ao banco: ${database} em ${host}:${port}`);
    
    // Criar nova conexão com os dados fornecidos
    const dbConfig = {
      host,
      port: parseInt(port),
      database,
      user,
      password,
      ssl: ssl === true,
    };
    
    const db = initializeDatabase(dbConfig);
    console.log('✓ Conexão estabelecida para instalação');
    
    // Ler o arquivo SQL do schema
    const schemaPath = path.join(__dirname, '../public/database_schema.sql');
    console.log('📁 Lendo schema de:', schemaPath);
    
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('📄 Schema carregado, tamanho:', schemaSql.length, 'bytes');
    
    // Dividir o SQL em statements individuais e executar um por um
    console.log('🔄 Executando schema SQL...');
    
    // Executar todo o SQL de uma vez
    try {
      await db.query(schemaSql);
      console.log('✅ Schema principal executado');
    } catch (sqlError: any) {
      console.error('❌ Erro ao executar SQL:', sqlError.message);
      console.error('📋 Detalhes:', sqlError);
      throw new Error(`Erro SQL: ${sqlError.message}`);
    }
    
    // Tabela user_credentials já está incluída no schema principal
    
    // Verificar se as tabelas foram criadas
    console.log('🔍 Verificando tabelas criadas...');
    const tablesResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log('📊 Tabelas encontradas:', tablesResult.rows.map(r => r.table_name).join(', '));
    
    console.log('🎉 Schema instalado com sucesso!\n');
    
    res.json({
      success: true,
      message: 'Schema instalado com sucesso!',
      tables: tablesResult.rows.map(r => r.table_name)
    });
  } catch (error: any) {
    console.error('❌ Erro ao instalar schema:', error);
    console.error('📋 Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack,
    });
  }
});

// Inicializar servidor
const start = async () => {
  // Ler configuração do banco do localStorage ou variáveis de ambiente
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
  };

  console.log('🔌 [DB-CONFIG] Conectando ao banco:', {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    ssl: dbConfig.ssl
  });

  try {
    initializeDatabase(dbConfig);
    console.log('✅ Conectado ao PostgreSQL');
    console.log('📊 Banco de dados:', dbConfig.database);
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
      console.log(`🌐 Acessível também em http://192.168.70.90:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco:', error);
    process.exit(1);
  }
};

start();