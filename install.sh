#!/bin/bash

# =============================================================================
# Script de Instalação Automatizada - Sistema de Gerenciamento de Layouts
# =============================================================================
# Este script guia você pelo processo de instalação do sistema.
# Funciona em Linux, macOS e Windows (via Git Bash ou WSL).
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Funções de utilidade
print_header() {
    echo ""
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${CYAN}➤ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Função para pausar e aguardar Enter
pause() {
    echo ""
    read -p "Pressione ENTER para continuar..."
    echo ""
}

# Função para confirmar ação
confirm() {
    local prompt="$1"
    local response
    echo -e "${YELLOW}$prompt (s/n): ${NC}"
    read -r response
    case "$response" in
        [sS][iI][mM]|[sS]|[yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Verificar se comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Gerar senha segura
generate_password() {
    if command_exists openssl; then
        openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24
    else
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 24
    fi
}

# Gerar JWT secret
generate_jwt_secret() {
    if command_exists openssl; then
        openssl rand -hex 64
    elif command_exists node; then
        node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
    else
        cat /dev/urandom | tr -dc 'a-f0-9' | head -c 128
    fi
}

# =============================================================================
# INÍCIO DO SCRIPT
# =============================================================================

clear

echo -e "${GREEN}"
cat << "EOF"
  ╔═══════════════════════════════════════════════════════════════╗
  ║                                                               ║
  ║   🖨️  Sistema de Gerenciamento de Layouts                     ║
  ║                                                               ║
  ║   Script de Instalação Automatizada                          ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo ""
echo -e "${BLUE}Bem-vindo! Este script irá guiá-lo pelo processo de instalação.${NC}"
echo -e "${BLUE}Vamos verificar os pré-requisitos e configurar o sistema.${NC}"
echo ""

pause

# =============================================================================
# VERIFICAÇÃO DE PRÉ-REQUISITOS
# =============================================================================

print_header "ETAPA 1/5 - Verificando Pré-requisitos"

MISSING_DEPS=()

# Verificar Docker
print_step "Verificando Docker..."
if command_exists docker; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
    print_success "Docker instalado (versão $DOCKER_VERSION)"
else
    print_error "Docker não encontrado"
    MISSING_DEPS+=("docker")
fi

# Verificar Docker Compose
print_step "Verificando Docker Compose..."
if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "v2+")
    else
        COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f4 | tr -d ',')
    fi
    print_success "Docker Compose instalado (versão $COMPOSE_VERSION)"
else
    print_error "Docker Compose não encontrado"
    MISSING_DEPS+=("docker-compose")
fi

# Verificar Git
print_step "Verificando Git..."
if command_exists git; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    print_success "Git instalado (versão $GIT_VERSION)"
else
    print_warning "Git não encontrado (opcional, mas recomendado)"
fi

# Verificar se Docker está rodando
print_step "Verificando se Docker está em execução..."
if docker info >/dev/null 2>&1; then
    print_success "Docker está em execução"
else
    print_error "Docker não está em execução"
    echo ""
    print_info "Inicie o Docker Desktop ou o serviço Docker e execute este script novamente."
    exit 1
fi

# Verificar dependências faltantes
if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo ""
    print_error "Dependências faltando: ${MISSING_DEPS[*]}"
    echo ""
    print_info "Por favor, instale as dependências acima antes de continuar."
    echo ""
    echo "Links para download:"
    echo "  - Docker: https://docs.docker.com/get-docker/"
    echo ""
    exit 1
fi

print_success "Todos os pré-requisitos estão instalados!"
pause

# =============================================================================
# ESCOLHA DO TIPO DE INSTALAÇÃO
# =============================================================================

print_header "ETAPA 2/5 - Tipo de Instalação"

echo "Escolha como deseja configurar o banco de dados:"
echo ""
echo -e "  ${CYAN}1)${NC} PostgreSQL no Docker (Recomendado para iniciantes)"
echo "     O banco de dados será criado automaticamente no Docker."
echo ""
echo -e "  ${CYAN}2)${NC} PostgreSQL Externo"
echo "     Use um banco de dados PostgreSQL já existente."
echo ""

while true; do
    read -p "Digite sua escolha (1 ou 2): " DB_CHOICE
    case $DB_CHOICE in
        1) 
            USE_DOCKER_DB=true
            print_success "Você escolheu: PostgreSQL no Docker"
            break
            ;;
        2) 
            USE_DOCKER_DB=false
            print_success "Você escolheu: PostgreSQL Externo"
            break
            ;;
        *) 
            print_warning "Por favor, digite 1 ou 2"
            ;;
    esac
done

pause

# =============================================================================
# CONFIGURAÇÃO DO AMBIENTE
# =============================================================================

print_header "ETAPA 3/5 - Configuração do Ambiente"

# Gerar valores padrão
DEFAULT_DB_PASSWORD=$(generate_password)
DEFAULT_JWT_SECRET=$(generate_jwt_secret)

echo "Vamos configurar as variáveis de ambiente."
echo "Pressione ENTER para usar o valor padrão sugerido."
echo ""

# Configuração do banco de dados
if [ "$USE_DOCKER_DB" = true ]; then
    print_step "Configurando banco de dados Docker..."
    
    DB_HOST="postgres"
    DB_PORT="5432"
    DB_NAME="layout_manager"
    DB_USER="postgres"
    
    echo ""
    echo -e "Senha do banco de dados (deixe em branco para gerar automaticamente):"
    echo -e "${BLUE}Sugestão: $DEFAULT_DB_PASSWORD${NC}"
    read -p "> " DB_PASSWORD
    DB_PASSWORD=${DB_PASSWORD:-$DEFAULT_DB_PASSWORD}
    
else
    print_step "Configurando conexão com banco externo..."
    echo ""
    
    read -p "Host do banco de dados (ex: localhost): " DB_HOST
    DB_HOST=${DB_HOST:-localhost}
    
    read -p "Porta do banco de dados (ex: 5432): " DB_PORT
    DB_PORT=${DB_PORT:-5432}
    
    read -p "Nome do banco de dados (ex: layout_manager): " DB_NAME
    DB_NAME=${DB_NAME:-layout_manager}
    
    read -p "Usuário do banco de dados (ex: postgres): " DB_USER
    DB_USER=${DB_USER:-postgres}
    
    read -p "Senha do banco de dados: " DB_PASSWORD
    
    if [ -z "$DB_PASSWORD" ]; then
        print_error "A senha do banco é obrigatória para conexões externas."
        exit 1
    fi
fi

# Configuração JWT
echo ""
print_step "Configurando segurança..."
echo ""
echo -e "Chave secreta JWT (deixe em branco para gerar automaticamente):"
echo -e "${BLUE}(Esta chave é usada para criptografar os tokens de autenticação)${NC}"
read -p "> " JWT_SECRET
JWT_SECRET=${JWT_SECRET:-$DEFAULT_JWT_SECRET}

# Configuração de portas
echo ""
print_step "Configurando portas..."
echo ""

read -p "Porta do frontend (padrão: 8080): " FRONTEND_PORT
FRONTEND_PORT=${FRONTEND_PORT:-8080}

read -p "Porta do backend (padrão: 3001): " BACKEND_PORT
BACKEND_PORT=${BACKEND_PORT:-3001}

# Resumo das configurações
echo ""
print_header "Resumo das Configurações"

echo -e "  Banco de dados:"
echo -e "    Host: ${CYAN}$DB_HOST${NC}"
echo -e "    Porta: ${CYAN}$DB_PORT${NC}"
echo -e "    Nome: ${CYAN}$DB_NAME${NC}"
echo -e "    Usuário: ${CYAN}$DB_USER${NC}"
echo -e "    Senha: ${CYAN}********${NC}"
echo ""
echo -e "  Aplicação:"
echo -e "    Frontend: ${CYAN}http://localhost:$FRONTEND_PORT${NC}"
echo -e "    Backend: ${CYAN}http://localhost:$BACKEND_PORT${NC}"
echo ""

if ! confirm "As configurações estão corretas?"; then
    print_warning "Instalação cancelada. Execute o script novamente."
    exit 0
fi

pause

# =============================================================================
# CRIAÇÃO DO ARQUIVO .env
# =============================================================================

print_header "ETAPA 4/5 - Criando Arquivos de Configuração"

print_step "Criando arquivo .env..."

# Backup do .env existente
if [ -f .env ]; then
    BACKUP_NAME=".env.backup.$(date +%Y%m%d_%H%M%S)"
    cp .env "$BACKUP_NAME"
    print_info "Backup do .env anterior salvo como: $BACKUP_NAME"
fi

# Criar arquivo .env
cat > .env << EOF
# =============================================================================
# Configuração do Sistema de Gerenciamento de Layouts
# Gerado automaticamente em $(date)
# =============================================================================

# -----------------------------------------------------------------------------
# Banco de Dados PostgreSQL
# -----------------------------------------------------------------------------
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# -----------------------------------------------------------------------------
# Segurança
# -----------------------------------------------------------------------------
VITE_JWT_SECRET=$JWT_SECRET

# -----------------------------------------------------------------------------
# Servidor
# -----------------------------------------------------------------------------
API_PORT=$BACKEND_PORT
NODE_ENV=production

# -----------------------------------------------------------------------------
# URLs da Aplicação
# -----------------------------------------------------------------------------
VITE_API_URL=http://localhost:$BACKEND_PORT/api
VITE_PUBLIC_HOST=localhost
EOF

print_success "Arquivo .env criado com sucesso!"

# Configurar permissões
chmod 600 .env
print_success "Permissões do .env configuradas (somente leitura pelo proprietário)"

pause

# =============================================================================
# INICIALIZAÇÃO DO SISTEMA
# =============================================================================

print_header "ETAPA 5/5 - Iniciando o Sistema"

# Escolher arquivo docker-compose
if [ "$USE_DOCKER_DB" = true ]; then
    COMPOSE_FILE="docker-compose.with-db.yml"
    print_info "Usando docker-compose com PostgreSQL integrado"
else
    COMPOSE_FILE="docker-compose.yml"
    print_info "Usando docker-compose com banco externo"
fi

# Verificar se arquivo existe
if [ ! -f "$COMPOSE_FILE" ]; then
    print_error "Arquivo $COMPOSE_FILE não encontrado!"
    exit 1
fi

print_step "Construindo as imagens Docker..."
echo ""

if docker compose -f "$COMPOSE_FILE" build; then
    print_success "Imagens construídas com sucesso!"
else
    print_error "Erro ao construir imagens"
    echo ""
    print_info "Verifique as mensagens de erro acima e tente novamente."
    exit 1
fi

echo ""
print_step "Iniciando os containers..."
echo ""

if docker compose -f "$COMPOSE_FILE" up -d; then
    print_success "Containers iniciados com sucesso!"
else
    print_error "Erro ao iniciar containers"
    exit 1
fi

# Aguardar serviços ficarem prontos
echo ""
print_step "Aguardando serviços ficarem prontos..."

MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    
    # Tentar conectar ao backend
    if curl -s "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
        echo ""
        print_success "Sistema pronto!"
        break
    fi
    
    echo -ne "\r  Aguardando... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo ""
    print_warning "Timeout aguardando o sistema iniciar."
    print_info "O sistema pode ainda estar iniciando. Verifique os logs com:"
    echo "  docker compose -f $COMPOSE_FILE logs -f"
fi

# =============================================================================
# CONCLUSÃO
# =============================================================================

echo ""
echo ""
echo -e "${GREEN}"
cat << "EOF"
  ╔═══════════════════════════════════════════════════════════════╗
  ║                                                               ║
  ║   ✅  INSTALAÇÃO CONCLUÍDA COM SUCESSO!                       ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo ""
echo -e "  ${CYAN}Próximos passos:${NC}"
echo ""
echo -e "  1. Acesse o sistema no navegador:"
echo -e "     ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
echo ""
echo -e "  2. Na primeira vez, você será direcionado para a"
echo -e "     página de configuração inicial (Setup)."
echo ""
echo -e "  3. Complete o setup criando o usuário administrador."
echo ""
echo ""
echo -e "  ${CYAN}Comandos úteis:${NC}"
echo ""
echo -e "  Ver logs:            ${YELLOW}docker compose -f $COMPOSE_FILE logs -f${NC}"
echo -e "  Parar sistema:       ${YELLOW}docker compose -f $COMPOSE_FILE down${NC}"
echo -e "  Reiniciar:           ${YELLOW}docker compose -f $COMPOSE_FILE restart${NC}"
echo ""
echo -e "  ${CYAN}Arquivos de configuração:${NC}"
echo ""
echo -e "  Configuração:        ${YELLOW}.env${NC}"
echo -e "  Docker Compose:      ${YELLOW}$COMPOSE_FILE${NC}"
echo ""
echo ""
echo -e "${BLUE}Obrigado por usar o Sistema de Gerenciamento de Layouts!${NC}"
echo ""
