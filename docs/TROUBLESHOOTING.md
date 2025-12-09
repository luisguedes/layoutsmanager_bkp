# 🔧 Solução de Problemas

Este guia ajuda a resolver os problemas mais comuns do Layout Manager.

---

## 📋 Índice

1. [Problemas de instalação](#problemas-de-instalação)
2. [Problemas de conexão](#problemas-de-conexão)
3. [Problemas de login](#problemas-de-login)
4. [Problemas de Docker](#problemas-de-docker)
5. [Problemas de banco de dados](#problemas-de-banco-de-dados)
6. [Problemas de interface](#problemas-de-interface)

---

## 🔧 Problemas de instalação

### ❌ "Comando git não encontrado"

**Problema:** Git não está instalado.

**Solução:**
- Windows: Baixe em [git-scm.com](https://git-scm.com/downloads)
- Linux: `sudo apt install git`
- Mac: `xcode-select --install`

### ❌ "npm: command not found"

**Problema:** Node.js não está instalado.

**Solução:**
- Baixe em [nodejs.org](https://nodejs.org/) (versão LTS)
- Após instalar, feche e abra o terminal novamente

### ❌ "EACCES: permission denied"

**Problema:** Sem permissão para instalar pacotes globais.

**Solução (Linux/Mac):**
```bash
# Corrigir permissões do npm
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

---

## 🌐 Problemas de conexão

### ❌ "Backend Offline" na tela de Setup

**Possíveis causas e soluções:**

1. **Backend não está rodando:**
   ```bash
   # Verificar se o backend está ativo
   docker-compose ps
   
   # Ver logs do backend
   docker-compose logs backend
   ```

2. **IP do backend está errado:**
   - Verifique se o IP configurado está correto
   - Use `localhost` se tudo estiver no mesmo computador

3. **Firewall bloqueando:**
   - Windows: Permita o Node.js no Windows Defender
   - Linux: `sudo ufw allow 3001`

### ❌ "Erro de CORS"

**Problema:** O navegador bloqueia requisições entre origens diferentes.

**Solução:**
1. Abra o arquivo `.env`
2. Configure `CORS_ORIGIN=*` (para desenvolvimento)
3. Reinicie o backend

### ❌ "Failed to fetch" / "Network Error"

**Soluções:**

1. **Verifique se a API está acessível:**
   ```bash
   curl http://localhost:3001/api/health
   ```

2. **Verifique as portas:**
   - Frontend: 80 (ou 8080 em desenvolvimento)
   - Backend: 3001
   - PostgreSQL: 5432

3. **Verifique o .env:**
   - `VITE_API_URL` deve apontar para o backend correto

---

## 🔐 Problemas de login

### ❌ "Credenciais inválidas"

**Soluções:**

1. **Verifique o email e senha:**
   - A senha é case-sensitive (diferencia maiúsculas/minúsculas)

2. **Esqueceu a senha do admin?**
   - Acesse o banco de dados e redefina:
   ```bash
   docker-compose exec postgres psql -U postgres -d layout_app
   ```
   ```sql
   -- Ver usuários existentes
   SELECT email FROM profiles;
   ```

### ❌ "Conta inativa. Aguarde aprovação de um administrador"

**Problema:** Sua conta existe, mas não foi ativada.

**Solução:**
1. Peça a um administrador para ativar sua conta
2. Ou, se você é o administrador, ative via banco:
   ```sql
   UPDATE profiles SET ativo = true WHERE email = 'seu@email.com';
   ```

### ❌ "Token inválido" ou "Sessão expirada"

**Solução:**
1. Faça logout e login novamente
2. Limpe os cookies do navegador
3. Se persistir, verifique se `VITE_JWT_SECRET` está configurado corretamente

---

## 🐳 Problemas de Docker

### ❌ "Cannot connect to Docker daemon"

**Problema:** Docker não está rodando.

**Soluções:**
- Windows/Mac: Abra o Docker Desktop
- Linux: `sudo systemctl start docker`

### ❌ "Port is already allocated"

**Problema:** Outra aplicação está usando a porta.

**Solução:**
1. Descubra o que está usando a porta:
   ```bash
   # Windows
   netstat -ano | findstr :80
   
   # Linux/Mac
   lsof -i :80
   ```

2. Pare a aplicação que está usando, ou mude a porta no `.env`

### ❌ "Container exited with code 1"

**Solução:**
1. Veja os logs para entender o erro:
   ```bash
   docker-compose logs backend
   ```

2. Erros comuns:
   - Variáveis de ambiente faltando → Configure o `.env`
   - Banco não acessível → Verifique `DB_HOST` e `DB_PASSWORD`

### ❌ "No space left on device"

**Problema:** Disco cheio.

**Solução:**
```bash
# Limpar recursos Docker não utilizados
docker system prune -a

# Limpar volumes órfãos
docker volume prune
```

### ❌ "Image build failed"

**Solução:**
```bash
# Reconstruir sem cache
docker-compose build --no-cache

# Se ainda falhar, limpe tudo e reconstrua
docker-compose down -v
docker system prune -a
docker-compose build
```

---

## 🗄️ Problemas de banco de dados

### ❌ "Connection refused" ao PostgreSQL

**Soluções:**

1. **Verifique se o PostgreSQL está rodando:**
   ```bash
   docker-compose ps postgres
   ```

2. **Verifique as credenciais:**
   - `DB_USER` deve ser `postgres` (ou seu usuário)
   - `DB_PASSWORD` deve corresponder à senha configurada

3. **Verifique o host:**
   - Docker com banco incluso: `DB_HOST=postgres`
   - PostgreSQL local: `DB_HOST=localhost` ou `DB_HOST=host.docker.internal`

### ❌ "Database does not exist"

**Solução:**
```bash
# Criar o banco de dados manualmente
docker-compose exec postgres createdb -U postgres layout_app
```

### ❌ "Schema installation failed"

**Soluções:**

1. **Execute o schema manualmente:**
   ```bash
   docker-compose exec postgres psql -U postgres -d layout_app -f /docker-entrypoint-initdb.d/init.sql
   ```

2. **Verifique se as extensões existem:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   ```

### ❌ Dados não aparecem / "No data"

**Soluções:**

1. **Verifique se há dados no banco:**
   ```bash
   docker-compose exec postgres psql -U postgres -d layout_app
   ```
   ```sql
   SELECT COUNT(*) FROM clientes;
   ```

2. **Verifique as permissões do usuário:**
   - Usuários comuns precisam de permissões para ver dados
   - Peça ao admin para configurar suas permissões

---

## 🖥️ Problemas de interface

### ❌ Tela branca / Não carrega

**Soluções:**

1. **Limpe o cache do navegador:**
   - Chrome: Ctrl+Shift+Delete → Limpar dados

2. **Verifique o console do navegador:**
   - Pressione F12 → Aba "Console"
   - Procure por erros em vermelho

3. **Verifique se os serviços estão rodando:**
   ```bash
   docker-compose ps
   ```

### ❌ "Setup aparece novamente" após configurar

**Problema:** O sistema não detectou que a configuração foi concluída.

**Soluções:**

1. **Verifique se o backend está conectado ao banco correto:**
   ```bash
   docker-compose logs backend | grep "Conectado"
   ```

2. **Verifique a configuração no banco:**
   ```sql
   SELECT * FROM system_config WHERE key = 'setup_completed';
   ```

### ❌ Imagens não carregam

**Soluções:**

1. **Verifique se o upload foi bem-sucedido:**
   - Tente fazer upload novamente
   - Verifique o limite de tamanho (máx. 50MB)

2. **Limpe o cache do navegador:**
   - Ctrl+Shift+R (hard refresh)

---

## 🆘 Ainda com problemas?

Se nenhuma das soluções acima funcionou:

1. **Colete informações:**
   ```bash
   # Versão do Docker
   docker --version
   
   # Status dos containers
   docker-compose ps
   
   # Logs completos
   docker-compose logs > logs.txt
   ```

2. **Abra uma issue** no GitHub com:
   - Descrição do problema
   - Passos para reproduzir
   - Logs relevantes
   - Sistema operacional

---

## 📚 Mais informações

- [README principal](../README.md)
- [Guia de Docker](DOCKER.md)
- [Guia rápido](GUIA_RAPIDO.md)
