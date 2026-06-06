@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

:: =============================================================================
:: SZDevs — Setup automático (Windows)
:: =============================================================================
:: Uso: Clique duplo em setup.bat  OU  execute no Prompt de Comando / PowerShell
::
:: O script:
::  1. Verifica pré-requisitos (Node, pnpm, Docker Desktop)
::  2. Cria o arquivo .env com segredos gerados automaticamente
::  3. Instala dependências via pnpm
::  4. Sobe a infraestrutura Docker (PostgreSQL + Redis)
::  5. Executa as migrations do Prisma
::  6. Mostra próximos passos
:: =============================================================================

:: Vai para o diretório do script
cd /d "%~dp0"

echo.
echo   ███████╗███████╗██████╗ ███████╗██╗   ██╗███████╗
echo   ██╔════╝╚══███╔╝██╔══██╗██╔════╝██║   ██║██╔════╝
echo   ███████╗  ███╔╝ ██║  ██║█████╗  ██║   ██║███████╗
echo   ╚════██║ ███╔╝  ██║  ██║██╔══╝  ╚██╗ ██╔╝╚════██║
echo   ███████║███████╗██████╔╝███████╗ ╚████╔╝ ███████║
echo   ╚══════╝╚══════╝╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝
echo.
echo   Setup automático — Monorepo v0.5.0 (Windows)
echo   ────────────────────────────────────────────────
echo.

:: ── 1. Pré-requisitos ────────────────────────────────────────────────────────
echo [INFO] Verificando pre-requisitos...
echo.

:: Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js nao encontrado!
    echo        Instale em: https://nodejs.org (versao 18.17 ou superior^)
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node -e "process.stdout.write(process.version)"') do set NODE_VER=%%v
echo [OK]   Node.js %NODE_VER% encontrado

:: Docker
where docker >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Docker nao encontrado!
    echo        Instale Docker Desktop: https://www.docker.com/products/docker-desktop
    pause & exit /b 1
)
echo [OK]   Docker encontrado

:: Docker Compose v2
docker compose version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Docker Compose v2 nao encontrado!
    echo        Certifique-se de usar Docker Desktop atualizado.
    pause & exit /b 1
)
echo [OK]   Docker Compose v2 encontrado

:: pnpm
where pnpm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] pnpm nao encontrado. Instalando via corepack...
    corepack enable
    corepack prepare pnpm@9.0.0 --activate
    if %ERRORLEVEL% NEQ 0 (
        echo [INFO] Tentando instalar pnpm via npm...
        npm install -g pnpm@9
    )
)
for /f "tokens=*" %%v in ('pnpm --version 2^>nul') do set PNPM_VER=%%v
echo [OK]   pnpm %PNPM_VER% encontrado

echo.

:: ── 2. Arquivo .env ──────────────────────────────────────────────────────────
echo [INFO] Configurando arquivo .env...

if exist ".env" (
    echo [WARN] .env ja existe. Pulando criacao.
    echo        Para recriar: apague o arquivo .env e execute novamente.
) else (
    copy .env.example .env >nul
    echo [INFO] Gerando segredos aleatorios via PowerShell...

    :: Gera segredos usando PowerShell
    for /f "tokens=*" %%s in ('powershell -NoProfile -Command "[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48)).Replace('+','').Replace('/','').Replace('=','').Substring(0,64)"') do set JWT_SECRET=%%s
    for /f "tokens=*" %%s in ('powershell -NoProfile -Command "[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48)).Replace('+','').Replace('/','').Replace('=','').Substring(0,64)"') do set JWT_REFRESH=%%s
    for /f "tokens=*" %%s in ('powershell -NoProfile -Command "[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(36)).Replace('+','').Replace('/','').Replace('=','').Substring(0,48)"') do set NEXTAUTH_SEC=%%s
    for /f "tokens=*" %%s in ('powershell -NoProfile -Command "[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(24)).Replace('+','').Replace('/','').Replace('=','').Substring(0,32)"') do set ENC_KEY=%%s
    for /f "tokens=*" %%s in ('powershell -NoProfile -Command "[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(36)).Replace('+','').Replace('/','').Replace('=','').Substring(0,48)"') do set INT_SEC=%%s

    :: Aplica os segredos no .env usando PowerShell (suporta caracteres especiais)
    powershell -NoProfile -Command ^
        "(Get-Content '.env') ^
         -replace 'change-me-to-a-long-random-string', '%JWT_SECRET%' ^
         -replace 'change-me-to-another-long-random-string', '%JWT_REFRESH%' ^
         -replace 'NEXTAUTH_SECRET=.*', 'NEXTAUTH_SECRET=%NEXTAUTH_SEC%' ^
         -replace 'ENCRYPTION_KEY=.*', 'ENCRYPTION_KEY=%ENC_KEY%' ^
         -replace 'AUTH_INTERNAL_SECRET=.*', 'AUTH_INTERNAL_SECRET=%INT_SEC%' ^
         | Set-Content '.env'"

    echo [OK]   .env criado com segredos gerados automaticamente
    echo.
    echo   Segredos gerados (guarde em local seguro^):
    echo   JWT_SECRET           = %JWT_SECRET:~0,32%...
    echo   NEXTAUTH_SECRET      = %NEXTAUTH_SEC:~0,32%...
    echo   ENCRYPTION_KEY       = %ENC_KEY%
    echo   AUTH_INTERNAL_SECRET = %INT_SEC:~0,32%...
)

echo.

:: ── 3. Instalar dependências ─────────────────────────────────────────────────
echo [INFO] Instalando dependencias (pnpm install)...
pnpm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao instalar dependencias!
    pause & exit /b 1
)
echo [OK]   Dependencias instaladas

echo.

:: ── 4. Gerar Prisma Client ───────────────────────────────────────────────────
echo [INFO] Gerando Prisma Client...
pnpm db:generate
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao gerar Prisma Client!
    pause & exit /b 1
)
echo [OK]   Prisma Client gerado

echo.

:: ── 5. Subir infraestrutura Docker ───────────────────────────────────────────
echo [INFO] Subindo PostgreSQL + Redis via Docker...
cd infra
docker compose up -d postgres redis
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao subir Docker!
    echo        Verifique se o Docker Desktop esta rodando.
    cd ..
    pause & exit /b 1
)

echo [INFO] Aguardando PostgreSQL ficar saudavel (60s max)...
set /a TRIES=0
:WAIT_PG
docker compose exec -T postgres pg_isready -q >nul 2>&1
if %ERRORLEVEL% EQU 0 goto PG_READY
set /a TRIES+=1
if %TRIES% GEQ 30 (
    echo [ERRO] PostgreSQL nao ficou healthy em 60s
    cd ..
    pause & exit /b 1
)
timeout /t 2 /nobreak >nul
goto WAIT_PG

:PG_READY
echo [OK]   PostgreSQL pronto
cd ..

echo.

:: ── 6. Migrations ────────────────────────────────────────────────────────────
echo [INFO] Executando migrations do banco de dados...
pnpm db:migrate
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha nas migrations!
    pause & exit /b 1
)
echo [OK]   Migrations aplicadas

echo.

:: ── 7. Seed (opcional) ───────────────────────────────────────────────────────
set /p SEED_ANS="Deseja popular o banco com dados de exemplo (seed)? [s/N]: "
if /i "%SEED_ANS%"=="s" (
    echo [INFO] Executando seed...
    pnpm db:seed
    echo [OK]   Banco populado com dados de exemplo
)

echo.
echo ════════════════════════════════════════════════════════
echo   Setup concluido com sucesso!
echo ════════════════════════════════════════════════════════
echo.
echo   Proximos passos:
echo.
echo   1. Configure as variaveis externas no .env:
echo      - SMTP_HOST / SMTP_USER / SMTP_PASS   (e-mails)
echo      - GITHUB_CLIENT_ID / GOOGLE_CLIENT_ID (OAuth)
echo      - STRIPE_SECRET_KEY                   (pagamentos)
echo      - STORAGE_ENDPOINT / ACCESS_KEY        (storage)
echo.
echo   2. Para iniciar em modo desenvolvimento:
echo      pnpm dev              (todos os servicos)
echo      pnpm dev:web          (so o frontend web)
echo      pnpm dev:services     (so os backends)
echo.
echo   3. Para rodar o stack completo em Docker (modo producao):
echo      cd infra
echo      docker compose --profile prod up -d
echo.
echo   URLs locais:
echo      Web (admin)  -^> http://localhost:4000
echo      Store        -^> http://localhost:4006
echo      Auth API     -^> http://localhost:3001
echo.
echo   Documentacao:
echo      Setup manual -^> docs\SETUP.md
echo      Deploy VPS   -^> infra\DEPLOY.md
echo      Arquitetura  -^> README.md
echo.

pause
endlocal
