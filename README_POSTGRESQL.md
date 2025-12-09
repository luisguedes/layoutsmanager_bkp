# Migração para PostgreSQL Puro

Este projeto foi migrado para usar PostgreSQL diretamente, sem Supabase Cloud.

## 🚀 Como Rodar Localmente

### 1. Configurar PostgreSQL

Certifique-se que o PostgreSQL está rodando:

```bash
psql -U postgres
CREATE DATABASE layout_app;
\q
```

### 2. Executar o Schema

Execute o schema SQL no seu banco:

```bash
psql -U postgres -d layout_app -f public/database_schema.sql
```

### 3. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo e edite com suas credenciais:

```bash
cp .env.local.example .env.local
```

Edite `.env.local`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=layout_app
DB_USER=postgres
DB_PASSWORD=sua_senha_aqui
DB_SSL=false

VITE_API_URL=http://localhost:3001/api
VITE_JWT_SECRET=mude-isso-em-producao
```

### 4. Instalar Dependências

```bash
npm install
```

### 5. Rodar o Projeto

**Opção 1 - Rodar tudo junto (recomendado):**

```bash
npm run dev:all
```

**Opção 2 - Rodar separadamente:**

Terminal 1 (Backend):
```bash
npm run dev:server
```

Terminal 2 (Frontend):
```bash
npm run dev
```

### 6. Acessar

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001

## 📋 Estrutura

```
├── server/
│   └── index.ts          # Servidor Express (API)
├── src/
│   ├── lib/
│   │   ├── db.ts         # Cliente PostgreSQL
│   │   └── auth.ts       # Sistema de autenticação (bcrypt + JWT)
│   ├── contexts/
│   │   └── DbAuthContext.tsx  # Context de autenticação
│   └── ...
```

## 🔒 Segurança

- Senhas são hasheadas com bcrypt (10 rounds)
- Autenticação usa JWT com expiração de 7 dias
- **IMPORTANTE:** Mude `VITE_JWT_SECRET` em produção!

## ⚠️ Limitações

- ❌ Não funciona mais na nuvem do Lovable
- ✅ Funciona perfeitamente em ambiente local
- 🔧 Você precisa gerenciar o servidor backend
- 🔧 Você precisa gerenciar backups do banco

## 📝 Próximos Passos

1. ✅ Infraestrutura base criada
2. ⏳ Atualizar Setup.tsx para usar novo sistema
3. ⏳ Converter todas as páginas para usar a API REST
4. ⏳ Implementar storage local para arquivos
5. ⏳ Criar scripts de migração de dados (se necessário)

## 🆘 Troubleshooting

**Erro: "Database not initialized"**
- Certifique-se que o servidor backend está rodando
- Verifique as credenciais no `.env.local`

**Erro: "ECONNREFUSED"**
- PostgreSQL não está rodando
- Porta 5432 está bloqueada

**Erro: "relation does not exist"**
- Execute o schema SQL primeiro
