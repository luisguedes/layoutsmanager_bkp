# 🐳 Guia Completo de Docker

Este documento explica em detalhes como usar o Layout Manager com Docker.

---

## 📋 Índice

1. [O que é Docker?](#o-que-é-docker)
2. [Instalando o Docker](#instalando-o-docker)
3. [Arquivos de configuração](#arquivos-de-configuração)
4. [Opções de deploy](#opções-de-deploy)
5. [Comandos úteis](#comandos-úteis)
6. [Monitoramento](#monitoramento)
7. [Backup e restauração](#backup-e-restauração)
8. [Atualizações](#atualizações)

---

## 🤔 O que é Docker?

Docker é uma ferramenta que "empacota" aplicações para rodar em qualquer computador de forma isolada, sem precisar instalar todas as dependências manualmente.

**Vantagens:**
- ✅ Funciona igual em qualquer computador
- ✅ Não precisa instalar Node.js, PostgreSQL, etc.
- ✅ Fácil de atualizar e fazer backup
- ✅ Isola o sistema do resto do computador

---

## 💻 Instalando o Docker

### Windows

1. Baixe o [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Execute o instalador
3. Reinicie o computador quando solicitado
4. Abra o Docker Desktop e aguarde iniciar

### Linux (Ubuntu/Debian)

```bash
# Atualizar pacotes
sudo apt update

# Instalar Docker
sudo apt install docker.io docker-compose

# Adicionar seu usuário ao grupo docker
sudo usermod -aG docker $USER

# Reiniciar para aplicar mudanças
sudo reboot
```

### Mac

1. Baixe o [Docker Desktop para Mac](https://www.docker.com/products/docker-desktop/)
2. Arraste para a pasta Aplicações
3. Abra o Docker e aguarde iniciar

---

## 📁 Arquivos de configuração

O projeto tem dois arquivos Docker Compose:

| Arquivo | Quando usar |
|---------|-------------|
| `docker-compose.yml` | Quando você já tem PostgreSQL instalado no servidor |
| `docker-compose.with-db.yml` | Quando quer que o Docker crie o PostgreSQL também |

### Estrutura dos serviços

```
┌─────────────────────────────────────────────────┐
│                    NGINX (porta 80)             │
│              (Servidor web / Proxy)             │
└─────────────────┬───────────────────────────────┘
                  │
      ┌───────────┴───────────┐
      │                       │
      ▼                       ▼
┌──────────────┐      ┌──────────────┐
│   Frontend   │      │   Backend    │
│  (React/Vite)│      │  (Express)   │
│   porta 8080 │      │   porta 3001 │
└──────────────┘      └──────┬───────┘
                             │
                             ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │   porta 5432 │
                    └──────────────┘
```

---

## 🚀 Opções de deploy

### Opção 1: Tudo no Docker (recomendado para iniciantes)

Usa o PostgreSQL dentro de um container Docker.

```bash
docker-compose -f docker-compose.with-db.yml up -d
```

**Vantagens:** 
- Não precisa instalar nada além do Docker
- Backup simples com scripts incluídos

**Desvantagens:**
- Se remover os volumes, perde os dados

### Opção 2: PostgreSQL externo

Usa um PostgreSQL já instalado no servidor.

1. Configure o `.env`:
   ```env
   DB_HOST=host.docker.internal   # PostgreSQL no mesmo servidor
   # ou
   DB_HOST=192.168.1.100          # PostgreSQL em outro servidor
   ```

2. Inicie sem o banco:
   ```bash
   docker-compose up -d
   ```

**Vantagens:**
- Mais controle sobre o banco de dados
- Pode usar serviços gerenciados (RDS, Cloud SQL, etc.)

---

## 🔧 Comandos úteis

### Iniciando e parando

```bash
# Iniciar todos os serviços
docker-compose -f docker-compose.with-db.yml up -d

# Parar todos os serviços
docker-compose down

# Reiniciar todos os serviços
docker-compose restart

# Reiniciar apenas o backend
docker-compose restart backend
```

### Verificando status

```bash
# Ver serviços em execução
docker-compose ps

# Ver uso de recursos (CPU, memória)
docker stats
```

### Visualizando logs

```bash
# Todos os logs
docker-compose logs

# Logs em tempo real
docker-compose logs -f

# Últimas 100 linhas do backend
docker-compose logs --tail=100 backend

# Apenas erros
docker-compose logs 2>&1 | grep -i error
```

### Acessando containers

```bash
# Entrar no container do backend
docker-compose exec backend sh

# Entrar no PostgreSQL
docker-compose exec postgres psql -U postgres -d layout_app
```

---

## 📊 Monitoramento

### Health Checks

Todos os serviços possuem verificação de saúde:

| Serviço | Endpoint | Intervalo |
|---------|----------|-----------|
| Frontend | GET /health | 30s |
| Backend | GET /api/health | 30s |
| PostgreSQL | pg_isready | 30s |

### Verificando saúde manualmente

```bash
# Frontend
curl http://localhost/health

# Backend
curl http://localhost/api/health

# PostgreSQL
docker-compose exec postgres pg_isready
```

---

## 💾 Backup e restauração

### Fazer backup

```bash
# Usando script incluído
./scripts/docker-backup-db.sh

# Manualmente
docker-compose exec postgres pg_dump -U postgres layout_app > backup.sql
```

Os backups são salvos em `./backups/` com data e hora no nome.

### Restaurar backup

```bash
# Usando script incluído
./scripts/docker-restore-db.sh backups/layout_db_20240101_120000.sql.gz

# Manualmente
cat backup.sql | docker-compose exec -T postgres psql -U postgres -d layout_app
```

---

## 🔄 Atualizações

### Processo padrão

```bash
# 1. Baixar últimas mudanças do código
git pull

# 2. Usar script de atualização (cria backup automático)
./scripts/docker-update.sh
```

### Atualização manual

```bash
# 1. Parar serviços
docker-compose down

# 2. Baixar mudanças
git pull

# 3. Reconstruir imagens
docker-compose build --no-cache

# 4. Iniciar novamente
docker-compose -f docker-compose.with-db.yml up -d
```

### Rollback (voltar versão anterior)

Se algo der errado:

```bash
./scripts/docker-rollback.sh
```

---

## 🔒 Configurando HTTPS

### Opção 1: Certbot (Let's Encrypt)

```bash
# Instalar certbot
sudo apt install certbot

# Gerar certificado (pare os containers primeiro)
sudo certbot certonly --standalone -d seu-dominio.com

# Configure os paths no .env:
SSL_CERT_PATH=/etc/letsencrypt/live/seu-dominio.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/seu-dominio.com/privkey.pem
USE_HTTPS=true
```

### Opção 2: Proxy reverso (Traefik, Caddy)

Recomendado para gerenciamento automático de certificados. Veja [DOCKER_DEPLOY.md](../DOCKER_DEPLOY.md) para configuração detalhada.

---

## ❓ Problemas comuns

### Container reiniciando em loop

```bash
# Veja os logs para identificar o erro
docker-compose logs backend
```

Causas comuns:
- Banco de dados não está acessível
- Variáveis de ambiente faltando
- Porta já em uso

### Erro de permissão

```bash
# Linux: adicione seu usuário ao grupo docker
sudo usermod -aG docker $USER
sudo reboot
```

### Espaço em disco cheio

```bash
# Limpar containers e imagens não utilizados
docker system prune -a

# Limpar volumes órfãos
docker volume prune
```

---

## 📚 Mais informações

- [README principal](../README.md)
- [Configuração avançada](../DOCKER_DEPLOY.md)
- [Solução de problemas](TROUBLESHOOTING.md)
