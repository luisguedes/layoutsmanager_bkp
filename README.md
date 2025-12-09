# 📋 Layout Manager

Sistema web para gerenciamento de layouts de impressão. Permite cadastrar clientes, modelos, tipos de impressão e campos, criando layouts personalizados que podem ser clonados e comparados.

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)
![Licença](https://img.shields.io/badge/licença-MIT-blue)

---

## 📖 O que é este projeto?

O **Layout Manager** é uma ferramenta para empresas que trabalham com impressão e precisam gerenciar diferentes configurações de layout para seus clientes. 

**Problema que resolve:**
- Organiza informações de clientes e seus layouts de impressão
- Evita retrabalho ao permitir clonar layouts entre clientes
- Facilita a comparação entre layouts diferentes
- Mantém histórico de todas as alterações (auditoria)

**Principais funcionalidades:**
- ✅ Cadastro de clientes com consulta automática de CNPJ
- ✅ Gestão de modelos, tipos de impressão e campos
- ✅ Criação de layouts personalizados por cliente
- ✅ Clonagem de layouts entre clientes
- ✅ Comparação lado a lado de múltiplos layouts
- ✅ Busca de clientes por campos utilizados
- ✅ Sistema de permissões por usuário
- ✅ Histórico completo de alterações

---

## 🖥️ Pré-requisitos

Antes de começar, você precisa ter instalado no seu computador:

### Para rodar com Docker (recomendado)

| Programa | O que é | Como instalar |
|----------|---------|---------------|
| **Docker** | Plataforma que "empacota" o sistema para rodar em qualquer computador | [Baixar Docker](https://www.docker.com/products/docker-desktop/) |
| **Docker Compose** | Ferramenta para rodar vários serviços juntos | Já vem incluído no Docker Desktop |
| **Git** | Programa para baixar o código do GitHub | [Baixar Git](https://git-scm.com/downloads) |

### Para rodar localmente (desenvolvedores)

| Programa | O que é | Versão mínima |
|----------|---------|---------------|
| **Node.js** | Ambiente para rodar JavaScript no servidor | 18.0 ou superior |
| **PostgreSQL** | Banco de dados | 14.0 ou superior |
| **Git** | Programa para baixar o código | Qualquer versão |

> 💡 **Dica:** Se você não sabe qual opção escolher, use Docker. É mais fácil!

---

## 📥 Como baixar o projeto

1. **Abra o terminal** (no Windows, procure por "Prompt de Comando" ou "PowerShell")

2. **Navegue até a pasta** onde quer salvar o projeto:
   ```bash
   cd C:\Projetos
   ```
   > 💡 Substitua `C:\Projetos` pela pasta de sua preferência

3. **Baixe o projeto** digitando:
   ```bash
   git clone https://github.com/seu-usuario/layout-manager.git
   ```

4. **Entre na pasta do projeto:**
   ```bash
   cd layout-manager
   ```

---

## 🚀 Instalação Rápida (Recomendado)

O projeto inclui um **script de instalação automatizada** que guia você por todo o processo.

### No Linux/Mac:

```bash
# Dar permissão de execução
chmod +x install.sh

# Executar o instalador
./install.sh
```

### No Windows:

```bash
# Executar o instalador
install.bat
```

O script irá:
- ✅ Verificar se Docker está instalado e rodando
- ✅ Perguntar se deseja usar PostgreSQL no Docker ou externo
- ✅ Configurar todas as variáveis de ambiente automaticamente
- ✅ Gerar senhas seguras automaticamente
- ✅ Criar o arquivo `.env` com todas as configurações
- ✅ Construir e iniciar os containers Docker
- ✅ Mostrar as URLs de acesso ao final

> 💡 **Dica:** O instalador é interativo e explica cada passo. Ideal para quem está começando!

---

## ⚙️ Configuração Manual (Alternativa)

Se preferir configurar manualmente em vez de usar o instalador:

### Criando o arquivo de configuração

1. **Copie o arquivo de exemplo:**
   
   No Windows:
   ```bash
   copy .env.docker.example .env
   ```
   
   No Linux/Mac:
   ```bash
   cp .env.docker.example .env
   ```

2. **Abra o arquivo `.env`** com um editor de texto (Bloco de Notas, VSCode, etc.)

3. **Configure as variáveis obrigatórias:**

| Variável | O que é | Exemplo |
|----------|---------|---------|
| `DB_PASSWORD` | Senha do banco de dados | `MinhaSenh@Forte123` |
| `VITE_JWT_SECRET` | Chave secreta para segurança | Ver comando abaixo |

4. **Gere uma chave secreta** (JWT Secret):
   
   Abra o terminal e digite:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   Copie o resultado e cole no `VITE_JWT_SECRET`

### Exemplo de arquivo .env configurado

```env
# Banco de dados
DB_NAME=layout_app
DB_USER=postgres
DB_PASSWORD=MinhaSenh@Forte123
DB_PORT=5432
DB_HOST=postgres

# API
NODE_ENV=production
API_PORT=3001
VITE_JWT_SECRET=a1b2c3d4e5f6...sua_chave_aqui...

# Frontend
FRONTEND_PORT=80
VITE_API_URL=/api
VITE_DOCKER=true
```

---

## 🚀 Como rodar o projeto

### Opção 1: Usando Docker (mais fácil)

1. **Certifique-se** de que o Docker está rodando (ícone aparece na barra de tarefas)

2. **Inicie o sistema** digitando no terminal:
   ```bash
   docker-compose -f docker-compose.with-db.yml up -d
   ```
   > ⏳ Na primeira vez, pode demorar alguns minutos para baixar as imagens

3. **Aguarde** até aparecer a mensagem de sucesso

4. **Acesse o sistema** no navegador:
   ```
   http://localhost
   ```

### Opção 2: Usando o script de inicialização

1. **Dê permissão ao script** (apenas Linux/Mac):
   ```bash
   chmod +x scripts/docker-start.sh
   ```

2. **Execute o script:**
   ```bash
   ./scripts/docker-start.sh
   ```

### Opção 3: Rodando localmente (para desenvolvedores)

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Configure o banco de dados** PostgreSQL com as credenciais do `.env`

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

4. **Acesse:**
   ```
   http://localhost:8080
   ```

---

## 🖱️ Como usar o sistema

### Primeiro acesso (Configuração Inicial)

Ao acessar pela primeira vez, você verá a **tela de Setup**:

1. **Escolha o ambiente:** Docker ou Standalone
2. **Configure o administrador:** Nome, email e senha
3. **Configure o banco de dados:** Preencha os dados de conexão
4. **Teste a conexão:** Clique em "Testar Conexão" e aguarde
5. **Instale o esquema:** Clique em "Instalar Esquema"
6. **Preencha dados da empresa:** Nome e informações opcionais
7. **Finalize:** Clique em "Finalizar Configuração"

### Tela de Login

Após a configuração, você será redirecionado para o login:

1. Digite o **email** do administrador configurado
2. Digite a **senha** criada
3. Clique em **Entrar**

### Navegando pelo sistema

O menu lateral dá acesso a todas as funcionalidades:

| Menu | O que faz |
|------|-----------|
| **Dashboard** | Visão geral com estatísticas do sistema |
| **Clientes** | Cadastrar e gerenciar clientes (com consulta CNPJ) |
| **Modelos** | Cadastrar modelos de impressão |
| **Tipos** | Cadastrar tipos de impressão |
| **Campos** | Cadastrar campos disponíveis para layouts |
| **Layouts** | Criar layouts combinando cliente + modelo + tipo |
| **Histórico** | Ver todas as alterações feitas no sistema |
| **Usuários** | Gerenciar usuários e permissões (apenas admin) |

### Criando seu primeiro layout

1. Primeiro, cadastre um **cliente** em "Clientes"
2. Cadastre pelo menos um **modelo** em "Modelos"
3. Cadastre pelo menos um **tipo de impressão** em "Tipos"
4. Cadastre os **campos** necessários em "Campos"
5. Vá em **Layouts** e clique em "Novo Layout"
6. Selecione o cliente, modelo e tipo
7. Adicione os campos desejados e defina a ordem
8. Salve o layout

---

## 📚 Documentação adicional

Para informações mais detalhadas, consulte a pasta `docs/`:

| Documento | Descrição |
|-----------|-----------|
| [Guia Rápido](docs/GUIA_RAPIDO.md) | Instalação em menos de 10 minutos |
| [Guia de Docker](docs/DOCKER.md) | Configuração detalhada do Docker |
| [Manual de Uso](docs/USO_SISTEMA.md) | Como usar todas as funcionalidades |
| [Solução de Problemas](docs/TROUBLESHOOTING.md) | Erros comuns e como resolver |

---

## ❓ Resolução de problemas (FAQ)

### ❌ "Porta já está em uso"

**Problema:** Outro programa está usando a porta 80 ou 3001.

**Solução:**
1. Abra o arquivo `.env`
2. Mude `FRONTEND_PORT=80` para `FRONTEND_PORT=8080`
3. Reinicie os containers:
   ```bash
   docker-compose down
   docker-compose -f docker-compose.with-db.yml up -d
   ```

### ❌ "Não consigo conectar ao banco de dados"

**Soluções possíveis:**

1. **Verifique se o PostgreSQL está rodando:**
   ```bash
   docker-compose ps
   ```
   O serviço `postgres` deve estar "Up"

2. **Verifique a senha no .env:** A senha deve ser a mesma configurada no PostgreSQL

3. **Se estiver usando PostgreSQL externo:** Verifique se `DB_HOST` está correto

### ❌ "Docker não sobe" / "Container reiniciando"

**Soluções:**

1. **Veja os logs para entender o erro:**
   ```bash
   docker-compose logs -f
   ```

2. **Reconstrua os containers:**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose -f docker-compose.with-db.yml up -d
   ```

### ❌ "Tela de setup aparece novamente após configurar"

**Problema:** O navegador perdeu o estado de configuração.

**Solução:**
1. Verifique se o backend está online
2. Limpe o cache do navegador
3. Acesse novamente

### ❌ "Usuário inativo" ao fazer login

**Problema:** Sua conta ainda não foi aprovada.

**Solução:** Peça a um administrador para ativar sua conta em "Usuários".

> 📖 Para mais problemas e soluções, veja [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## 📁 Estrutura do projeto

```
layout-manager/
├── 📂 docker/              # Arquivos de configuração Docker
│   ├── backend/           # Dockerfile do backend
│   ├── frontend/          # Dockerfile do frontend
│   ├── nginx/             # Configuração do servidor web
│   └── postgres/          # Scripts de inicialização do banco
├── 📂 docs/                # Documentação detalhada
│   ├── GUIA_RAPIDO.md     # Instalação rápida
│   ├── DOCKER.md          # Guia completo de Docker
│   ├── USO_SISTEMA.md     # Manual de uso
│   └── TROUBLESHOOTING.md # Solução de problemas
├── 📂 public/              # Arquivos públicos
│   └── database_schema.sql # Esquema completo do banco
├── 📂 scripts/             # Scripts úteis
│   ├── docker-start.sh    # Iniciar o sistema
│   ├── docker-stop.sh     # Parar o sistema
│   └── docker-backup-db.sh # Fazer backup do banco
├── 📂 server/              # Código do backend (API)
│   ├── index.ts           # Servidor principal
│   └── config.ts          # Configurações
├── 📂 src/                 # Código do frontend
│   ├── components/        # Componentes reutilizáveis
│   ├── pages/             # Páginas da aplicação
│   ├── contexts/          # Contextos React (auth, etc.)
│   ├── hooks/             # Hooks personalizados
│   └── lib/               # Utilitários e configurações
├── 📄 .env.docker.example  # Exemplo de configuração
├── 📄 docker-compose.yml   # Docker sem banco (usa externo)
├── 📄 docker-compose.with-db.yml # Docker com banco incluso
└── 📄 README.md            # Este arquivo
```

---

## 🔧 Comandos úteis

### Docker

```bash
# Ver status dos serviços
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f backend

# Reiniciar todos os serviços
docker-compose restart

# Parar todos os serviços
docker-compose down

# Parar e remover volumes (apaga dados!)
docker-compose down -v
```

### Backup e Restauração

```bash
# Fazer backup do banco
./scripts/docker-backup-db.sh

# Restaurar backup
./scripts/docker-restore-db.sh backups/layout_db_20240101_120000.sql.gz
```

### Desenvolvimento local

```bash
# Instalar dependências
npm install

# Iniciar frontend + backend
npm run dev

# Apenas frontend
npm run dev:frontend

# Apenas backend
npm run server

# Build de produção
npm run build
```

---

## 🔒 Segurança

O sistema implementa várias camadas de segurança:

- **Autenticação JWT:** Tokens seguros para login
- **Senhas criptografadas:** bcrypt para armazenamento seguro
- **Controle de permissões:** Cada usuário tem permissões específicas
- **Auditoria completa:** Todas as ações são registradas
- **Proteção de rotas:** Backend valida todas as requisições

---

## 🛠️ Tecnologias utilizadas

### Frontend
- **React 18** + **TypeScript** - Interface do usuário
- **Vite** - Build tool rápido
- **Tailwind CSS** - Estilização
- **shadcn/ui** - Componentes de interface
- **React Query** - Gerenciamento de estado servidor
- **React Hook Form** + **Zod** - Formulários e validação

### Backend
- **Node.js** + **Express** - API REST
- **PostgreSQL** - Banco de dados
- **JWT** - Autenticação
- **bcrypt** - Criptografia de senhas

### Infraestrutura
- **Docker** + **Docker Compose** - Containerização
- **Nginx** - Servidor web / Proxy reverso

---

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

---

## 📞 Suporte

Encontrou um problema? Abra uma [issue](https://github.com/seu-usuario/layout-manager/issues) no GitHub.
