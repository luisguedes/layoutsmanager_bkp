@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: =============================================================================
:: Script de Instalação Automatizada - Sistema de Gerenciamento de Layouts
:: Versão Windows (CMD)
:: =============================================================================

title Sistema de Gerenciamento de Layouts - Instalação

cls

echo.
echo   ╔═══════════════════════════════════════════════════════════════╗
echo   ║                                                               ║
echo   ║   Sistema de Gerenciamento de Layouts                         ║
echo   ║                                                               ║
echo   ║   Script de Instalação Automatizada                          ║
echo   ║                                                               ║
echo   ╚═══════════════════════════════════════════════════════════════╝
echo.
echo   Bem-vindo! Este script irá guiá-lo pelo processo de instalação.
echo.
pause

:: =============================================================================
:: VERIFICAÇÃO DE PRÉ-REQUISITOS
:: =============================================================================

cls
echo.
echo   ═══════════════════════════════════════════════════════════════
echo   ETAPA 1/5 - Verificando Pré-requisitos
echo   ═══════════════════════════════════════════════════════════════
echo.

:: Verificar Docker
echo   [*] Verificando Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [X] Docker não encontrado!
    echo.
    echo   Por favor, instale o Docker Desktop:
    echo   https://docs.docker.com/desktop/install/windows-install/
    echo.
    pause
    exit /b 1
)
for /f "tokens=3" %%v in ('docker --version') do set DOCKER_VERSION=%%v
echo   [OK] Docker instalado (versão %DOCKER_VERSION%)

:: Verificar Docker Compose
echo   [*] Verificando Docker Compose...
docker compose version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [X] Docker Compose não encontrado!
    pause
    exit /b 1
)
echo   [OK] Docker Compose instalado

:: Verificar se Docker está rodando
echo   [*] Verificando se Docker está em execução...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo   [X] Docker não está em execução!
    echo.
    echo   Inicie o Docker Desktop e execute este script novamente.
    echo.
    pause
    exit /b 1
)
echo   [OK] Docker está em execução

echo.
echo   [OK] Todos os pré-requisitos estão instalados!
echo.
pause

:: =============================================================================
:: ESCOLHA DO TIPO DE INSTALAÇÃO
:: =============================================================================

cls
echo.
echo   ═══════════════════════════════════════════════════════════════
echo   ETAPA 2/5 - Tipo de Instalação
echo   ═══════════════════════════════════════════════════════════════
echo.
echo   Escolha como deseja configurar o banco de dados:
echo.
echo   1) PostgreSQL no Docker (Recomendado para iniciantes)
echo      O banco de dados será criado automaticamente no Docker.
echo.
echo   2) PostgreSQL Externo
echo      Use um banco de dados PostgreSQL já existente.
echo.

:choice_db
set /p DB_CHOICE="   Digite sua escolha (1 ou 2): "
if "%DB_CHOICE%"=="1" (
    set USE_DOCKER_DB=true
    echo.
    echo   [OK] Você escolheu: PostgreSQL no Docker
) else if "%DB_CHOICE%"=="2" (
    set USE_DOCKER_DB=false
    echo.
    echo   [OK] Você escolheu: PostgreSQL Externo
) else (
    echo   [!] Por favor, digite 1 ou 2
    goto choice_db
)

echo.
pause

:: =============================================================================
:: CONFIGURAÇÃO DO AMBIENTE
:: =============================================================================

cls
echo.
echo   ═══════════════════════════════════════════════════════════════
echo   ETAPA 3/5 - Configuração do Ambiente
echo   ═══════════════════════════════════════════════════════════════
echo.
echo   Vamos configurar as variáveis de ambiente.
echo   Pressione ENTER para usar o valor padrão sugerido.
echo.

:: Gerar senha e JWT
for /f %%a in ('powershell -command "[System.Guid]::NewGuid().ToString('N').Substring(0,24)"') do set DEFAULT_DB_PASSWORD=%%a
for /f %%a in ('powershell -command "[System.Guid]::NewGuid().ToString('N') + [System.Guid]::NewGuid().ToString('N') + [System.Guid]::NewGuid().ToString('N') + [System.Guid]::NewGuid().ToString('N')"') do set DEFAULT_JWT_SECRET=%%a

if "%USE_DOCKER_DB%"=="true" (
    echo   [*] Configurando banco de dados Docker...
    echo.
    
    set DB_HOST=postgres
    set DB_PORT=5432
    set DB_NAME=layout_manager
    set DB_USER=postgres
    
    echo   Senha do banco de dados (deixe em branco para gerar automaticamente):
    set /p DB_PASSWORD="   > "
    if "!DB_PASSWORD!"=="" set DB_PASSWORD=%DEFAULT_DB_PASSWORD%
    
) else (
    echo   [*] Configurando conexão com banco externo...
    echo.
    
    set /p DB_HOST="   Host do banco de dados (ex: localhost): "
    if "!DB_HOST!"=="" set DB_HOST=localhost
    
    set /p DB_PORT="   Porta do banco de dados (ex: 5432): "
    if "!DB_PORT!"=="" set DB_PORT=5432
    
    set /p DB_NAME="   Nome do banco de dados (ex: layout_manager): "
    if "!DB_NAME!"=="" set DB_NAME=layout_manager
    
    set /p DB_USER="   Usuário do banco de dados (ex: postgres): "
    if "!DB_USER!"=="" set DB_USER=postgres
    
    set /p DB_PASSWORD="   Senha do banco de dados: "
    
    if "!DB_PASSWORD!"=="" (
        echo   [X] A senha do banco é obrigatória para conexões externas.
        pause
        exit /b 1
    )
)

echo.
echo   [*] Configurando segurança...
echo.
echo   Chave secreta JWT (deixe em branco para gerar automaticamente):
set /p JWT_SECRET="   > "
if "!JWT_SECRET!"=="" set JWT_SECRET=%DEFAULT_JWT_SECRET%

echo.
echo   [*] Configurando portas...
echo.

set /p FRONTEND_PORT="   Porta do frontend (padrão: 8080): "
if "!FRONTEND_PORT!"=="" set FRONTEND_PORT=8080

set /p BACKEND_PORT="   Porta do backend (padrão: 3001): "
if "!BACKEND_PORT!"=="" set BACKEND_PORT=3001

echo.
pause

:: =============================================================================
:: CRIAÇÃO DO ARQUIVO .env
:: =============================================================================

cls
echo.
echo   ═══════════════════════════════════════════════════════════════
echo   ETAPA 4/5 - Criando Arquivos de Configuração
echo   ═══════════════════════════════════════════════════════════════
echo.

echo   [*] Criando arquivo .env...

:: Backup do .env existente
if exist .env (
    for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set datetime=%%a
    set BACKUP_NAME=.env.backup.%datetime:~0,8%_%datetime:~8,6%
    copy .env "!BACKUP_NAME!" >nul
    echo   [i] Backup do .env anterior salvo como: !BACKUP_NAME!
)

:: Criar arquivo .env
(
echo # =============================================================================
echo # Configuração do Sistema de Gerenciamento de Layouts
echo # =============================================================================
echo.
echo # Banco de Dados PostgreSQL
echo DB_HOST=!DB_HOST!
echo DB_PORT=!DB_PORT!
echo DB_NAME=!DB_NAME!
echo DB_USER=!DB_USER!
echo DB_PASSWORD=!DB_PASSWORD!
echo.
echo # Segurança
echo VITE_JWT_SECRET=!JWT_SECRET!
echo.
echo # Servidor
echo API_PORT=!BACKEND_PORT!
echo NODE_ENV=production
echo.
echo # URLs da Aplicação
echo VITE_API_URL=http://localhost:!BACKEND_PORT!/api
echo VITE_PUBLIC_HOST=localhost
) > .env

echo   [OK] Arquivo .env criado com sucesso!
echo.
pause

:: =============================================================================
:: INICIALIZAÇÃO DO SISTEMA
:: =============================================================================

cls
echo.
echo   ═══════════════════════════════════════════════════════════════
echo   ETAPA 5/5 - Iniciando o Sistema
echo   ═══════════════════════════════════════════════════════════════
echo.

:: Escolher arquivo docker-compose
if "%USE_DOCKER_DB%"=="true" (
    set COMPOSE_FILE=docker-compose.with-db.yml
    echo   [i] Usando docker-compose com PostgreSQL integrado
) else (
    set COMPOSE_FILE=docker-compose.yml
    echo   [i] Usando docker-compose com banco externo
)

:: Verificar se arquivo existe
if not exist "!COMPOSE_FILE!" (
    echo   [X] Arquivo !COMPOSE_FILE! não encontrado!
    pause
    exit /b 1
)

echo.
echo   [*] Construindo as imagens Docker...
echo   (Isso pode levar alguns minutos na primeira vez)
echo.

docker compose -f "!COMPOSE_FILE!" build
if %errorlevel% neq 0 (
    echo.
    echo   [X] Erro ao construir imagens
    echo   Verifique as mensagens de erro acima e tente novamente.
    pause
    exit /b 1
)

echo.
echo   [OK] Imagens construídas com sucesso!
echo.
echo   [*] Iniciando os containers...
echo.

docker compose -f "!COMPOSE_FILE!" up -d
if %errorlevel% neq 0 (
    echo.
    echo   [X] Erro ao iniciar containers
    pause
    exit /b 1
)

echo.
echo   [OK] Containers iniciados com sucesso!
echo.
echo   [*] Aguardando serviços ficarem prontos...

:: Aguardar serviços
set ATTEMPT=0
:wait_loop
set /a ATTEMPT+=1
if %ATTEMPT% gtr 30 goto wait_timeout

curl -s "http://localhost:!BACKEND_PORT!/health" >nul 2>&1
if %errorlevel% equ 0 goto wait_success

echo   Aguardando... (%ATTEMPT%/30)
timeout /t 2 /nobreak >nul
goto wait_loop

:wait_timeout
echo.
echo   [!] Timeout aguardando o sistema iniciar.
echo   O sistema pode ainda estar iniciando.
goto show_result

:wait_success
echo.
echo   [OK] Sistema pronto!

:show_result

:: =============================================================================
:: CONCLUSÃO
:: =============================================================================

echo.
echo.
echo   ╔═══════════════════════════════════════════════════════════════╗
echo   ║                                                               ║
echo   ║   INSTALAÇÃO CONCLUÍDA COM SUCESSO!                           ║
echo   ║                                                               ║
echo   ╚═══════════════════════════════════════════════════════════════╝
echo.
echo   Próximos passos:
echo.
echo   1. Acesse o sistema no navegador:
echo      http://localhost:!FRONTEND_PORT!
echo.
echo   2. Na primeira vez, você será direcionado para a
echo      página de configuração inicial (Setup).
echo.
echo   3. Complete o setup criando o usuário administrador.
echo.
echo.
echo   Comandos úteis:
echo.
echo   Ver logs:        docker compose -f !COMPOSE_FILE! logs -f
echo   Parar sistema:   docker compose -f !COMPOSE_FILE! down
echo   Reiniciar:       docker compose -f !COMPOSE_FILE! restart
echo.
echo.
echo   Obrigado por usar o Sistema de Gerenciamento de Layouts!
echo.
pause
