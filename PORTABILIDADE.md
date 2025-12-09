# ✅ Guia de Portabilidade - Sistema 100% PostgreSQL

## 📋 Resumo da Arquitetura

Este sistema foi **completamente refatorado** para ser 100% portável e independente de infraestrutura cloud proprietária.

### 🎯 Stack Tecnológica
- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Backend**: Node.js + Express + PostgreSQL
- **Autenticação**: JWT (JSON Web Tokens)
- **Banco de Dados**: PostgreSQL (local ou remoto)
- **Upload de Imagens**: Armazenamento em bytea no PostgreSQL

---

## 🚀 Instalação em Qualquer Servidor

### 1. Pré-requisitos
```bash
- Node.js 18+ 
- PostgreSQL 12+
- npm ou yarn
```

### 2. Configuração do Banco de Dados

#### 2.1. Criar o banco
```sql
CREATE DATABASE seu_banco;
```

#### 2.2. Instalar o schema
O arquivo `public/database_schema.sql` contém toda a estrutura do banco. Execute:
```bash
psql -U seu_usuario -d seu_banco -f public/database_schema.sql
```

### 3. Configuração das Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# API Backend URL
VITE_API_URL=http://localhost:3001/api

# Database Configuration (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=seu_banco
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_SSL=false
```

### 4. Instalação e Execução

```bash
# Instalar dependências
npm install

# Desenvolvimento (frontend + backend)
npm run dev

# Ou executar separadamente:
# Backend
npm run server

# Frontend
npm run dev:frontend
```

### 5. Build para Produção

```bash
# Build do frontend
npm run build

# O backend pode ser executado com:
npm run server
```

---

## 🔐 Sistema de Autenticação

### Estrutura
- **JWT Tokens** armazenados no localStorage
- **Senhas hasheadas** com bcrypt
- **Sessões stateless** para escalabilidade

### Tabelas de Autenticação
```sql
- users: Credenciais de login
- profiles: Dados do perfil do usuário
- user_roles: Perfis (admin/user)
- user_permissions: Permissões granulares por recurso
```

---

## 📊 Estrutura do Banco de Dados

### Tabelas Principais
| Tabela | Descrição |
|--------|-----------|
| `users` | Credenciais de autenticação |
| `profiles` | Perfis de usuários |
| `clientes` | Cadastro de clientes |
| `modelos` | Modelos de etiquetas |
| `tipos_impressao` | Tipos de impressão |
| `campos` | Campos personalizáveis |
| `layouts` | Layouts de etiquetas (com imagem em bytea) |
| `layout_campos` | Relacionamento layouts ↔ campos |
| `audit_log` | Histórico de alterações |

### Armazenamento de Imagens
As imagens dos layouts são armazenadas diretamente no PostgreSQL como `bytea`:
```sql
ALTER TABLE layouts ADD COLUMN imagem_data bytea;
ALTER TABLE layouts ADD COLUMN imagem_tipo text;
```

**Endpoints:**
- `POST /api/layouts/upload-image` - Upload de imagem
- `GET /api/layouts/:id/image` - Servir imagem

---

## 🔧 API Backend (Express)

### Endpoints Disponíveis

#### Autenticação
- `POST /api/auth/signup` - Criar conta
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Usuário atual
- `GET /api/auth/is-admin` - Verificar se é admin

#### Usuários
- `GET /api/usuarios` - Listar usuários
- `GET /api/usuarios/:id` - Buscar usuário
- `PUT /api/usuarios/:id` - Atualizar usuário
- `PUT /api/usuarios/:id/ativo` - Ativar/desativar usuário
- `POST /api/usuarios/:id/reset-password` - Resetar senha
- `PUT /api/usuarios/:id/role` - Alterar perfil (admin/user)

#### Permissões
- `GET /api/permissions/:userId` - Buscar permissões
- `PUT /api/permissions/:userId` - Atualizar permissões

#### CRUD Completo
- `/api/clientes` (GET, POST, PUT, DELETE)
- `/api/modelos` (GET, POST, PUT, DELETE)
- `/api/tipos` (GET, POST, PUT, DELETE)
- `/api/campos` (GET, POST, PUT, DELETE)
- `/api/layouts` (GET, POST, PUT, DELETE)

#### Funcionalidades Especiais
- `POST /api/rpc/clone-layout` - Clonar layout
- `POST /api/rpc/comparar-multiplos-layouts` - Comparar layouts
- `POST /api/rpc/clientes-com-campo` - Buscar clientes por campo
- `POST /api/consultar-cnpj` - Consultar CNPJ (ReceitaWS)

#### Dashboard
- `GET /api/dashboard/stats` - Estatísticas do sistema

#### Histórico
- `GET /api/historico` - Logs de auditoria

#### Setup
- `POST /api/test-connection` - Testar conexão com banco
- `POST /api/save-db-config` - Salvar config do banco
- `POST /api/install-schema` - Instalar schema do banco

---

## 🌐 Deploy em Produção

### Opção 1: Servidor Próprio (VPS/Dedicado)

1. **Instalar dependências no servidor**
```bash
ssh usuario@seu-servidor.com
cd /var/www/seu-app
npm install --production
```

2. **Configurar o banco de dados**
```bash
# Criar banco e usuário PostgreSQL
sudo -u postgres psql
CREATE DATABASE producao_db;
CREATE USER app_user WITH PASSWORD 'senha_forte';
GRANT ALL PRIVILEGES ON DATABASE producao_db TO app_user;
```

3. **Configurar variáveis de ambiente**
```bash
nano .env.local
# Configurar com dados de produção
```

4. **Build do frontend**
```bash
npm run build
```

5. **Configurar Nginx**
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    # Frontend (arquivos estáticos)
    location / {
        root /var/www/seu-app/dist;
        try_files $uri /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

6. **Executar com PM2**
```bash
npm install -g pm2
pm2 start server/index.ts --name "seu-app-backend"
pm2 startup
pm2 save
```

### Opção 2: Docker

Criar `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "server"]
```

Criar `docker-compose.yml`:
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=producao_db
      - DB_USER=app_user
      - DB_PASSWORD=senha_forte
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=producao_db
      - POSTGRES_USER=app_user
      - POSTGRES_PASSWORD=senha_forte
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./public/database_schema.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  postgres_data:
```

Executar:
```bash
docker-compose up -d
```

---

## 🔒 Segurança

### Checklist de Segurança
- ✅ Senhas hasheadas com bcrypt
- ✅ JWT tokens com expiração
- ✅ Validação de entrada em todos os endpoints
- ✅ SQL parametrizado (proteção contra SQL injection)
- ✅ CORS configurável
- ✅ Rate limiting recomendado em produção
- ✅ HTTPS obrigatório em produção

### Recomendações Adicionais
```bash
# Adicionar rate limiting
npm install express-rate-limit

# Adicionar helmet para segurança
npm install helmet

# Adicionar validação de entrada
npm install joi
```

---

## 📦 Venda/Distribuição do Sistema

### Cenários Suportados

#### 1. Instalação On-Premise (Cliente gerencia tudo)
- Cliente instala em seu próprio servidor
- Banco PostgreSQL local
- Total controle sobre os dados

#### 2. Instalação SaaS (Você gerencia)
- Múltiplos clientes no mesmo servidor
- Bancos separados por cliente (ou multi-tenant)
- Você mantém a infraestrutura

#### 3. Instalação Híbrida
- Frontend em Cloud (Vercel, Netlify)
- Backend em servidor próprio do cliente
- Banco PostgreSQL gerenciado (AWS RDS, etc.)

### Personalização por Cliente
O arquivo `.env.local` permite personalizar TUDO:
- URL da API
- Credenciais do banco
- Configurações de SSL
- Porta do servidor

---

## 🛠️ Manutenção e Upgrades

### Backup do Banco
```bash
pg_dump -U seu_usuario -d seu_banco > backup_$(date +%Y%m%d).sql
```

### Restore do Banco
```bash
psql -U seu_usuario -d seu_banco < backup_20250116.sql
```

### Atualização do Sistema
```bash
git pull origin main
npm install
npm run build
pm2 restart seu-app-backend
```

---

## ✅ Checklist de Portabilidade

- [x] Backend 100% Express (sem dependência de Supabase Edge Functions)
- [x] Autenticação JWT (sem Supabase Auth)
- [x] Upload de imagens em bytea (sem Supabase Storage)
- [x] Todas as queries usando PostgreSQL direto
- [x] Configuração via `.env.local`
- [x] Schema SQL completo disponível
- [x] Documentação de instalação
- [x] Exemplos de deploy

---

## 📞 Suporte

Para dúvidas sobre instalação ou customização, consulte:
- `README.md` - Instruções gerais
- `public/database_schema.sql` - Estrutura do banco
- `server/index.ts` - API completa
- `.env.local.example` - Exemplo de configuração
