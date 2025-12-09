# 🐳 Docker Deployment Guide

## Visão Geral

Esta aplicação está totalmente containerizada com Docker, incluindo:
- **Frontend**: React + Vite servido via Nginx
- **Backend**: Node.js + Express API
- **Database**: PostgreSQL 16 (opcional - pode usar externo)
- **Proxy**: Nginx como reverse proxy com rate limiting

---

## 📋 Pré-requisitos

- Docker 24.0+ e Docker Compose 2.0+
- Git (para clonar o repositório)
- Mínimo 2GB RAM, 10GB disco

```bash
# Verificar versões
docker --version
docker-compose --version
```

---

## 🚀 Opções de Deploy

### Opção 1: Tudo no Docker (PostgreSQL no container)

Use quando quiser uma instalação completa e isolada:

```bash
# Usar docker-compose com banco incluído
docker-compose -f docker-compose.with-db.yml up -d
```

### Opção 2: PostgreSQL Externo (recomendado para produção)

Use quando já tiver um PostgreSQL como serviço no servidor:

```bash
# Configurar .env com DB_HOST correto
DB_HOST=host.docker.internal  # Para PostgreSQL no mesmo servidor
# ou
DB_HOST=192.168.1.100         # Para PostgreSQL em outro servidor

# Subir apenas frontend e backend
docker-compose up -d
```

---

## 🔧 Configuração

### 1. Clonar o Repositório
```bash
git clone https://github.com/seu-usuario/layout-manager.git
cd layout-manager
```

### 2. Configurar Variáveis de Ambiente
```bash
cp .env.docker.example .env
nano .env
```

**Valores obrigatórios:**
```env
DB_PASSWORD=sua_senha_segura_aqui
VITE_JWT_SECRET=seu_jwt_secret_aqui
```

**Configuração do Host do Banco:**
```env
# PostgreSQL no container Docker:
DB_HOST=postgres

# PostgreSQL como serviço no servidor host:
DB_HOST=host.docker.internal

# PostgreSQL em outro servidor:
DB_HOST=192.168.1.100
```

Gerar JWT Secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Iniciar a Aplicação

**Com PostgreSQL no Docker:**
```bash
chmod +x scripts/*.sh
docker-compose -f docker-compose.with-db.yml up -d
```

**Com PostgreSQL externo:**
```bash
docker-compose up -d
```

### 4. Verificar Status
```bash
docker-compose ps
docker-compose logs -f
```

Acesse: `http://seu-servidor:80`

---

## 📁 Estrutura de Arquivos

```
├── docker/
│   ├── backend/
│   │   └── Dockerfile       # Build do backend
│   ├── frontend/
│   │   └── Dockerfile       # Build do frontend
│   ├── nginx/
│   │   └── nginx.conf       # Configuração do proxy
│   └── postgres/
│       └── init.sql         # Script de inicialização
├── scripts/
│   ├── docker-start.sh      # Iniciar serviços
│   ├── docker-stop.sh       # Parar serviços
│   └── ...                  # Outros scripts
├── docker-compose.yml       # Sem PostgreSQL (para DB externo)
├── docker-compose.with-db.yml # Com PostgreSQL incluso
└── .env.docker.example      # Template de configuração
```

---

## 🔧 Comandos Úteis

### Gerenciamento de Containers

```bash
# Iniciar todos os serviços
docker-compose up -d

# Parar todos os serviços
docker-compose down

# Reiniciar um serviço específico
docker-compose restart backend

# Ver logs em tempo real
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f backend

# Status dos serviços
docker-compose ps
```

### Manutenção

```bash
# Reconstruir após mudanças
docker-compose build --no-cache
docker-compose up -d

# Limpar containers e volumes não utilizados
docker system prune -a
docker volume prune
```

### Banco de Dados

```bash
# Acessar PostgreSQL
docker-compose exec postgres psql -U postgres -d layout_app

# Backup
./scripts/docker-backup-db.sh

# Restaurar
./scripts/docker-restore-db.sh backups/layout_db_YYYYMMDD_HHMMSS.sql.gz
```

---

## 🔄 Atualização da Aplicação

### Processo Padrão

```bash
# 1. Baixar últimas mudanças
git pull

# 2. Executar script de update (cria backup automático)
./scripts/docker-update.sh
```

### Atualização Manual

```bash
# 1. Parar serviços
docker-compose down

# 2. Baixar mudanças
git pull

# 3. Reconstruir imagens
docker-compose build --no-cache

# 4. Iniciar novamente
docker-compose up -d
```

---

## ⏪ Rollback

Se algo der errado após uma atualização:

```bash
./scripts/docker-rollback.sh
```

Este comando restaura as imagens da versão anterior que foram salvas durante o update.

---

## 🔒 Configuração SSL/HTTPS

### Opção 1: Certbot (Let's Encrypt)

```bash
# Instalar certbot na VPS
apt-get install certbot

# Gerar certificado
certbot certonly --standalone -d seu-dominio.com

# Os certificados estarão em:
# /etc/letsencrypt/live/seu-dominio.com/
```

### Opção 2: Traefik (Recomendado)

Crie um arquivo `docker-compose.traefik.yml`:

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=seu@email.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt

volumes:
  letsencrypt:
```

---

## 🔍 Troubleshooting

### Container não inicia

```bash
# Ver logs detalhados
docker-compose logs backend

# Verificar variáveis de ambiente
docker-compose config
```

### Erro de conexão com banco

```bash
# Verificar se postgres está rodando
docker-compose ps postgres

# Testar conexão
docker-compose exec postgres pg_isready
```

### Frontend não carrega

```bash
# Verificar nginx
docker-compose logs frontend

# Testar backend diretamente
curl http://localhost:3001/api/health
```

### Problemas de permissão

```bash
# Nos scripts
chmod +x scripts/*.sh

# Nos volumes
sudo chown -R $USER:$USER ./
```

---

## 📊 Monitoramento

### Health Checks

Todos os serviços possuem health checks configurados:
- **Postgres**: `pg_isready`
- **Backend**: `GET /api/health`
- **Frontend**: `GET /health`

### Logs Centralizados

```bash
# Todos os logs
docker-compose logs -f --tail=100

# Apenas erros
docker-compose logs -f 2>&1 | grep -i error
```

---

## 🚀 Melhorias Futuras

### CI/CD com GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_KEY }}
          script: |
            cd /opt/layout-manager
            git pull
            ./scripts/docker-update.sh
```

### Caddy (HTTPS Automático)

Substitui Nginx com HTTPS automático:

```Caddyfile
seu-dominio.com {
    reverse_proxy /api/* backend:3001
    reverse_proxy /* frontend:80
}
```

---

## 📞 Suporte

Em caso de problemas:
1. Verifique os logs: `docker-compose logs -f`
2. Consulte o troubleshooting acima
3. Abra uma issue no repositório
