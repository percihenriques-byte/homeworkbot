# Lançador do DEMO — prepara tudo (Node + banco + build) na 1a vez e abre o app
# no modo demonstração (sem login). Nas próximas, só abre. Chamado pelo
# INICIAR-DEMO.bat. Tudo fica na pasta demo\.runtime (não sobe pro Git).

# Avisos de programas externos (mariadb/npm/node escrevem no stderr) NAO devem
# abortar o script — por isso "Continue". Os passos criticos (downloads) usam
# -ErrorAction Stop + try/catch individualmente.
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$demoDir = $PSScriptRoot
$repo = Split-Path -Parent $demoDir
$rt = Join-Path $demoDir ".runtime"
New-Item -ItemType Directory -Force -Path $rt | Out-Null

$NODE_VER = "v22.12.0"
$MARIA_VER = "11.4.4"
$DB_PORT = 3307
$AI_PORT = 5005
$APP_PORT = 3900

function Say($m) { Write-Host "  $m" -ForegroundColor Cyan }

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "   Homework Assistant - DEMO (sem login)"          -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

# 1) Node portatil ------------------------------------------------------------
$nodeDir = Join-Path $rt "node-$NODE_VER-win-x64"
if (-not (Test-Path (Join-Path $nodeDir "node.exe"))) {
  Say "Baixando o Node (so na 1a vez, ~33MB)..."
  $z = Join-Path $rt "node.zip"
  try {
    Invoke-WebRequest "https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-win-x64.zip" -OutFile $z -TimeoutSec 300 -ErrorAction Stop
    Expand-Archive $z $rt -Force -ErrorAction Stop; Remove-Item $z -ErrorAction SilentlyContinue
  } catch {
    Write-Host "  ERRO ao baixar o Node. Verifique sua internet e rode de novo." -ForegroundColor Red
    Read-Host "  Pressione Enter para sair"; exit 1
  }
}
$env:Path = "$nodeDir;$env:Path"
$node = Join-Path $nodeDir "node.exe"
$npm = Join-Path $nodeDir "npm.cmd"

# 2) Dependencias + build -----------------------------------------------------
Set-Location $repo
if (-not (Test-Path (Join-Path $repo "node_modules\.bin"))) {
  Say "Instalando dependencias (so na 1a vez, ~1-2 min)..."
  & $npm install --legacy-peer-deps --no-audit --no-fund --loglevel=error
}
if (-not (Test-Path (Join-Path $repo "dist\index.js"))) {
  Say "Compilando o app (so na 1a vez)..."
  & $npm run build | Out-Null
}

# 3) Banco (MariaDB portatil) -------------------------------------------------
$mDir = Join-Path $rt "mariadb-$MARIA_VER-winx64"
$mbin = Join-Path $mDir "bin"
if (-not (Test-Path (Join-Path $mbin "mariadbd.exe"))) {
  Say "Baixando o banco de dados (so na 1a vez, ~86MB)..."
  $z = Join-Path $rt "mariadb.zip"
  try {
    Invoke-WebRequest "https://archive.mariadb.org/mariadb-$MARIA_VER/winx64-packages/mariadb-$MARIA_VER-winx64.zip" -OutFile $z -TimeoutSec 600 -ErrorAction Stop
    Expand-Archive $z $rt -Force -ErrorAction Stop; Remove-Item $z -ErrorAction SilentlyContinue
  } catch {
    Write-Host "  ERRO ao baixar o banco de dados. Verifique sua internet e rode de novo." -ForegroundColor Red
    Read-Host "  Pressione Enter para sair"; exit 1
  }
}
$data = Join-Path $rt "db-data"
if (-not (Test-Path (Join-Path $data "mysql"))) {
  Say "Preparando o banco..."
  & "$mbin\mariadb-install-db.exe" --datadir="$data" | Out-Null
}
if (-not (Get-NetTCPConnection -LocalPort $DB_PORT -State Listen -ErrorAction SilentlyContinue)) {
  Say "Ligando o banco..."
  Start-Process -FilePath "$mbin\mariadbd.exe" -ArgumentList "--datadir=`"$data`"","--port=$DB_PORT","--bind-address=127.0.0.1" -WindowStyle Hidden
  Start-Sleep 5
}
& "$mbin\mariadb.exe" --host=127.0.0.1 --port=$DB_PORT --user=root -e "CREATE DATABASE IF NOT EXISTS homeworkbot CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;" 2>$null | Out-Null

# 4) Migracoes + dados de exemplo --------------------------------------------
$env:DATABASE_URL = "mysql://root@127.0.0.1:$DB_PORT/homeworkbot"
Say "Atualizando as tabelas..."
& $node "node_modules\drizzle-kit\bin.cjs" migrate 2>$null | Out-Null
# Semeia dados so se ainda nao houver o usuario demo
$hasDemo = & "$mbin\mariadb.exe" --host=127.0.0.1 --port=$DB_PORT --user=root --skip-column-names -e "SELECT COUNT(*) FROM homeworkbot.users WHERE openId='demo-visitante';" 2>$null
if (("$hasDemo".Trim()) -eq "0") {
  Say "Criando dados de exemplo..."
  & "$mbin\mariadb.exe" --host=127.0.0.1 --port=$DB_PORT --user=root --default-character-set=utf8mb4 homeworkbot -e "source $demoDir\seed.sql" 2>$null | Out-Null
}

# 5) IA de demonstracao (pra o Jarvis responder) ------------------------------
if (-not (Get-NetTCPConnection -LocalPort $AI_PORT -State Listen -ErrorAction SilentlyContinue)) {
  $env:DEMO_AI_PORT = "$AI_PORT"
  Start-Process -FilePath $node -ArgumentList "`"$demoDir\mock-ai.mjs`"" -WindowStyle Hidden
}

# 6) Sobe o app em modo DEMO e abre o navegador -------------------------------
Get-NetTCPConnection -LocalPort $APP_PORT -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
$env:NODE_ENV = "production"
$env:PORT = "$APP_PORT"
$env:DEMO_MODE = "true"
$env:JWT_SECRET = "demo-local-secret"
$env:GEMINI_API_KEY = "demo"
$env:GEMINI_BASE = "http://127.0.0.1:$AI_PORT/v1beta/models"

# Abre o navegador alguns segundos depois (quando o app ja subiu)
Start-Job -ScriptBlock { Start-Sleep 5; Start-Process "http://localhost:$using:APP_PORT/painel" } | Out-Null

Write-Host ""
Write-Host "  Tudo pronto! O app vai abrir no navegador em instantes." -ForegroundColor Green
Write-Host "  Endereco: http://localhost:$APP_PORT/painel" -ForegroundColor Yellow
Write-Host "  >> Deixe esta janela ABERTA enquanto usa. Feche-a para desligar. <<" -ForegroundColor Yellow
Write-Host ""

# App em primeiro plano: fechar a janela para o app.
& $node "dist\index.js"
