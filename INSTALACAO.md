# 🚀 Guia de Instalação e Execução

## 📋 Pré-requisitos

- Node.js 18+
- PostgreSQL 12+ (instalado e em execução)
- npm ou yarn

## 🔧 Instalação

### 1. Clone e Instale as Dependências

```bash
# Clone o repositório
git clone <URL_DO_REPOSITORIO>

# Entre no diretório
cd <NOME_DO_PROJETO>

# Instale as dependências
npm install
```

### 2. Configure o Banco de Dados PostgreSQL

Certifique-se que o PostgreSQL está instalado e em execução:

**Windows:**
```bash
# Verifique se o serviço está rodando
services.msc
# Procure por "postgresql-x64-XX" e verifique se está "Em execução"
```

**Linux:**
```bash
sudo systemctl status postgresql
# Se não estiver rodando:
sudo systemctl start postgresql
```

**macOS:**
```bash
brew services list
# Se não estiver rodando:
brew services start postgresql
```

### 3. Crie o Banco de Dados

```bash
# Acesse o PostgreSQL
psql -U postgres

# Crie o banco de dados
CREATE DATABASE sgdb_layout_imp;

# Saia do psql
\q
```

## ▶️ Executando o Sistema

### Opção 1: Iniciar Frontend e Backend Juntos (Recomendado)

```bash
npm run dev
```

Este comando inicia:
- **Frontend** (Vite): http://localhost:5173
- **Backend** (Express): http://localhost:3001

### Opção 2: Iniciar Separadamente

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

## 🎯 Primeiro Acesso

1. Abra o navegador em `http://localhost:5173`
2. Você será redirecionado para a página de **Setup**
3. Siga o assistente de instalação:

### Etapa 1: Administrador
Configure o usuário administrador:
- Nome completo
- Email (será usado para login)
- Telefone (opcional)
- Senha (mínimo 8 caracteres)

### Etapa 2: Banco de Dados
Configure a conexão com PostgreSQL:
- **Host**: `localhost` (ou IP do servidor)
- **Porta**: `5432` (padrão do PostgreSQL)
- **Nome do Banco**: `sgdb_layout_imp` (ou o nome que você criou)
- **Usuário**: `postgres` (ou seu usuário do PostgreSQL)
- **Senha**: senha do usuário PostgreSQL

Clique em **Testar Conexão** para verificar.

Se a conexão for bem-sucedida, clique em **Instalar Schema** para criar todas as tabelas.

### Etapa 3: Empresa
Configure as informações da empresa:
- Nome da empresa (obrigatório)
- CNPJ (opcional)
- Email (opcional)
- Telefone (opcional)

### Conclusão
Após finalizar o setup, você será redirecionado para a tela de login.

Use as credenciais do administrador criadas na Etapa 1.

## 🔍 Verificação de Erros Comuns

### ❌ Erro: `net::ERR_CONNECTION_REFUSED`

**Causa**: O servidor backend não está rodando.

**Solução**:
```bash
# Verifique se o backend está rodando
npm run server

# Ou inicie tudo junto
npm run dev
```

### ❌ Erro: "Não foi possível conectar ao banco de dados"

**Causa**: PostgreSQL não está rodando ou credenciais incorretas.

**Soluções**:
1. Verifique se o PostgreSQL está rodando:
   ```bash
   # Linux
   sudo systemctl status postgresql
   
   # macOS
   brew services list
   
   # Windows - verifique no services.msc
   ```

2. Teste a conexão manual:
   ```bash
   psql -U postgres -d sgdb_layout_imp -h localhost
   ```

3. Verifique as credenciais no arquivo de configuração.

### ❌ Erro: "Permission denied" ao criar tabelas

**Causa**: Usuário do PostgreSQL sem permissões adequadas.

**Solução**:
```sql
-- Conecte como superusuário
psql -U postgres

-- Conceda permissões ao usuário
GRANT ALL PRIVILEGES ON DATABASE sgdb_layout_imp TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;
```

## 📦 Variáveis de Ambiente

O arquivo `.env.local` é criado automaticamente durante o setup.

Exemplo de configuração:

```env
# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sgdb_layout_imp
DB_USER=postgres
DB_PASSWORD=sua_senha_aqui
DB_SSL=false

# API Configuration
VITE_API_URL=http://localhost:3001/api

# JWT Secret
VITE_JWT_SECRET=seu-secret-jwt-aqui
```

## 🌐 Portas Utilizadas

| Serviço | Porta | URL |
|---------|-------|-----|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend (Express) | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | localhost:5432 |

## 📊 Estrutura de Diretórios

```
projeto/
├── server/              # Backend Express
│   └── index.ts        # Servidor principal
├── src/                # Frontend React
│   ├── pages/         # Páginas da aplicação
│   ├── components/    # Componentes reutilizáveis
│   └── lib/           # Utilitários
├── public/            # Arquivos estáticos
└── .env.local         # Configurações locais (criado no setup)
```

## 🐳 Docker (Opcional)

Se preferir usar Docker:

```bash
# Criar e iniciar os containers
docker-compose up -d

# Verificar logs
docker-compose logs -f

# Parar os containers
docker-compose down
```

## 🔒 Segurança

- **Nunca commit** o arquivo `.env.local` para o repositório
- Use senhas fortes para o banco de dados
- Em produção, use SSL/TLS para conexões
- Mantenha o PostgreSQL atualizado

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do backend no terminal
2. Verifique o console do navegador (F12)
3. Consulte a documentação do PostgreSQL
4. Verifique se todas as portas estão disponíveis

## 🎉 Pronto!

Agora você pode começar a usar o sistema de gerenciamento de layouts!
