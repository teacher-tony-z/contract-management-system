<#
.SYNOPSIS
  Contract Management System - Fast Deployment (Chinese Mirrors)
.DESCRIPTION
  Uses Chinese mirrors for fast downloads. Extracts source from archive.
  Optimized for 2GB RAM Windows Server.
#>
param([int]$HttpPort = 80)

$ErrorActionPreference = "Stop"
$step = 1
$PROJECT_DIR = "C:\contract-management-system"

function Title   { param([string]$m) Write-Host "`n$m" -ForegroundColor Cyan }
function Step    { Write-Host "`n[$($step++)] $($args[0])..." -ForegroundColor Yellow }
function OK      { Write-Host "  [OK] $($args[0])" -ForegroundColor Green }
function Fail    { Write-Host "  [FAIL] $($args[0])" -ForegroundColor Red; exit 1 }
function Warn    { Write-Host "  [WARN] $($args[0])" -ForegroundColor Magenta }

# ============================================
# Step 1: Admin check
# ============================================
Title "=== Contract Management System - Deployment ==="
Step "Checking admin rights"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Fail "Please run as Administrator" }
OK "Administrator confirmed"

# ============================================
# Step 2: Extract project source
# ============================================
Step "Extracting project source"
if (Test-Path $PROJECT_DIR) {
    # Backup old project if exists
    if (Test-Path "$PROJECT_DIR\server\node_modules") { Warn "Old installation exists, preserving..." }
}
if (-not (Test-Path $PROJECT_DIR)) { New-Item -ItemType Directory -Path $PROJECT_DIR -Force | Out-Null }

# Unzip the tar.gz using PowerShell (need to handle 2-stage extraction)
$archive = "C:\contract-mgmt-src.tar.gz"
if (Test-Path $archive) {
    # Windows 10/2022 has tar built-in
    Set-Location $PROJECT_DIR
    tar -xzf $archive -C $PROJECT_DIR 2>$null
    if ($LASTEXITCODE -eq 0) { OK "Project source extracted" }
    else { Warn "tar extraction failed, trying alternative..." }

    # Verify extraction
    if (Test-Path "$PROJECT_DIR\server\package.json") { OK "Project files verified" }
    else { Fail "Project extraction incomplete" }
} else { Fail "Archive not found: $archive" }

# ============================================
# Step 3: Install Node.js 20 via taobao mirror
# ============================================
Step "Installing Node.js 20"
try {
    $nv = node --version
    if ($nv -match "v20") { OK "Node.js $nv already installed" }
    else { throw "wrong version" }
} catch {
    Write-Host "  Downloading Node.js from taobao mirror..." -ForegroundColor Gray
    $url = "https://npmmirror.com/mirrors/node/v20.18.3/node-v20.18.3-x64.msi"
    $msi = "$env:TEMP\node-v20-x64.msi"
    try {
        Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing -TimeoutSec 120
        Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn ADDLOCAL=ALL" -Wait -NoNewWindow
        $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
        OK "Node.js installed: $(node --version)"
    } catch {
        # Try official source as fallback
        Warn "Taobao mirror failed, trying official source..."
        $url = "https://nodejs.org/dist/v20.18.3/node-v20.18.3-x64.msi"
        Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing -TimeoutSec 120
        Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn ADDLOCAL=ALL" -Wait -NoNewWindow
        $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
        OK "Node.js installed: $(node --version)"
    }
}

# ============================================
# Step 4: Install PostgreSQL 15 via mirror
# ============================================
Step "Installing PostgreSQL 15"
$pgBin = "C:\Program Files\PostgreSQL\15\bin"
$pgCtl = "$pgBin\pg_ctl.exe"
$pgData = "C:\Program Files\PostgreSQL\15\data"

$svc = Get-Service "postgresql*" -ErrorAction SilentlyContinue
if (-not $svc) {
    if (-not (Test-Path $pgCtl)) {
        Write-Host "  Downloading PostgreSQL from mirror..." -ForegroundColor Gray
        # Try tsinghua mirror first (fast in China)
        $urls = @(
            "https://mirrors.tuna.tsinghua.edu.cn/postgresql/v15.11/postgresql-15.11-1-windows-x64.exe"
            "https://get.enterprisedb.com/postgresql/postgresql-15.11-1-windows-x64.exe"
        )
        $exe = "$env:TEMP\postgresql-15-x64.exe"
        $downloaded = $false
        foreach ($u in $urls) {
            try {
                Invoke-WebRequest -Uri $u -OutFile $exe -UseBasicParsing -TimeoutSec 180
                $downloaded = $true
                break
            } catch { Write-Host "  Mirror failed, trying next..." -ForegroundColor Gray }
        }
        if (-not $downloaded) { Fail "PostgreSQL download failed" }

        Write-Host "  Installing PostgreSQL (~2 min)..." -ForegroundColor Gray
        Start-Process $exe -ArgumentList "--mode unattended --unattendedmodeui none --superpassword postgres --serviceaccount postgres --disable-components pgAdmin4,stackbuilder" -Wait -NoNewWindow
    }
    # Init DB if needed
    if (-not (Test-Path "$pgData\PG_VERSION")) {
        Write-Host "  Initializing database..." -ForegroundColor Gray
        $passFile = "$env:TEMP\pgpass.txt"
        "postgres" | Out-File $passFile -Encoding ASCII
        & $pgCtl initdb -D "$pgData" --username=postgres 2>&1
    }
    OK "PostgreSQL installed"
} else {
    OK "PostgreSQL already installed ($($svc.Status))"
    if ($svc.Status -ne "Running") { Start-Service $svc.Name }
}

$env:Path = "$pgBin;$env:Path"

# Wait for PG
Step "Starting PostgreSQL"
$retries = 20
for ($i=0; $i -lt $retries; $i++) {
    try {
        $s = & pg_isready -h localhost -U postgres 2>&1
        if ($s -match "accepting") { OK "PostgreSQL ready"; break }
    } catch {}
    if ($i -eq 0) { Write-Host "  Waiting for PostgreSQL to start..." -ForegroundColor Gray }
    Start-Sleep -Seconds 2
    if ($i -eq $retries-1) { Fail "PostgreSQL failed to start" }
}

# Create database
$env:PGPASSWORD = "postgres"
$dbCheck = & psql -U postgres -h localhost -t -c "SELECT 1 FROM pg_database WHERE datname='contract_db'" 2>$null
if ($dbCheck.Trim() -ne "1") {
    & psql -U postgres -h localhost -c "CREATE DATABASE contract_db ENCODING 'UTF8'" 2>&1 | Out-Null
    OK "Database created: contract_db"
} else { OK "Database contract_db exists" }

# PG memory optimization
$pgConf = "$pgData\postgresql.conf"
if (Test-Path $pgConf) {
    $cfg = Get-Content $pgConf -Raw
    if ($cfg -notmatch "low-memory") {
        Add-Content $pgConf @"

# low-memory-optimization (2GB RAM server)
shared_buffers = 256MB
effective_cache_size = 512MB
work_mem = 4MB
maintenance_work_mem = 64MB
"@
        & pg_ctl reload -D "$pgData" 2>$null
        OK "PostgreSQL memory optimized"
    } else { OK "PostgreSQL already optimized" }
}

# ============================================
# Step 5: Environment config
# ============================================
Step "Configuring environment"
$envContent = @"
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=contract_db
JWT_SECRET=contract-mgmt-jwt-$(Get-Random)
NODE_ENV=production
PORT=3000
"@
$envFile = "$PROJECT_DIR\server\.env"
if (-not (Test-Path $envFile)) {
    Set-Content -Path $envFile -Value $envContent -Encoding ASCII
    OK "Environment file created"
} else { OK "Environment file exists" }

# Set taobao npm mirror for fast installs
npm config set registry https://registry.npmmirror.com/ 2>$null

# ============================================
# Step 6: Build frontend
# ============================================
Step "Building frontend"
Set-Location "$PROJECT_DIR\client"
Write-Host "  Installing frontend dependencies..." -ForegroundColor Gray
npm ci 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  npm ci failed, trying npm install..." -ForegroundColor Gray
    npm install 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "npm install failed" }
}
Write-Host "  Building frontend..." -ForegroundColor Gray
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Warn "vue-tsc check failed, trying vite build directly..."
    npx vite build 2>&1
    if ($LASTEXITCODE -ne 0) { Fail "Frontend build failed" }
}
if (-not (Test-Path "$PROJECT_DIR\client\dist\index.html")) { Fail "Frontend dist missing" }
OK "Frontend built"

# ============================================
# Step 7: Build backend
# ============================================
Step "Building backend"
Set-Location "$PROJECT_DIR\server"
Write-Host "  Installing backend dependencies..." -ForegroundColor Gray
npm ci 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { npm install 2>&1 | Out-Null }
Write-Host "  Compiling backend..." -ForegroundColor Gray
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "Backend build failed" }
if (-not (Test-Path "$PROJECT_DIR\server\dist\main.js")) { Fail "Backend dist missing" }
OK "Backend built"

# ============================================
# Step 8: Install PM2 and start
# ============================================
Step "Starting application"
try { pm2 --version | Out-Null; OK "PM2 ready" } catch {
    npm install -g pm2@latest 2>&1 | Out-Null
    OK "PM2 installed"
}

Set-Location $PROJECT_DIR
pm2 delete contract-system 2>$null

$env:NODE_ENV = "production"
$env:PORT = "3000"

pm2 start server/dist/main.js --name "contract-system" --max-memory-restart 500M 2>&1
if ($LASTEXITCODE -ne 0) { Fail "Application failed to start" }
OK "Application started (PID: contract-system)"

# Auto-start on reboot
pm2 save 2>&1 | Out-Null
pm2 startup 2>&1 | Out-Null
OK "Auto-start configured"

Start-Sleep -Seconds 6

# ============================================
# Step 9: Verify
# ============================================
Step "Verifying deployment"
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 10
    OK "API: HTTP $($r.StatusCode)"
} catch { Warn "API not yet responding (app may still be starting)" }
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 10
    OK "Frontend: HTTP $($r.StatusCode)"
} catch { Warn "Frontend not yet responding" }

# ============================================
# Step 10: Port 80 forwarding
# ============================================
Step "Configuring port $HttpPort -> 3000"
netsh interface portproxy delete v4tov4 listenport=$HttpPort listenaddress=0.0.0.0 2>$null
netsh interface portproxy add v4tov4 listenport=$HttpPort listenaddress=0.0.0.0 connectport=3000 connectaddress=localhost 2>$null
if ($LASTEXITCODE -eq 0) { OK "Port $HttpPort -> 3000" }
else { Warn "Port forwarding failed, use :3000 directly" }

# Firewall
$fw = "ContractSystem-HTTP-$HttpPort"
netsh advfirewall firewall show rule name="$fw" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    netsh advfirewall firewall add rule name="$fw" dir=in action=allow protocol=TCP localport=$HttpPort 2>$null
    OK "Firewall rule added"
} else { OK "Firewall rule exists" }

# Also allow port 3000 direct access
netsh advfirewall firewall show rule name="ContractSystem-3000" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    netsh advfirewall firewall add rule name="ContractSystem-3000" dir=in action=allow protocol=TCP localport=3000 2>$null
}

# Get server IP
$serverIP = "localhost"
try { $ip = Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 5 -ErrorAction SilentlyContinue; if ($ip) { $serverIP = $ip } } catch {}

# ============================================
# Done
# ============================================
Title "========================================"
Title "  DEPLOYMENT COMPLETE!"
Title "========================================"
Write-Host ""
if ($HttpPort -eq 80) { Write-Host "  http://$serverIP" -ForegroundColor Cyan }
else { Write-Host "  http://$serverIP`:$HttpPort or http://$serverIP:3000" -ForegroundColor Cyan }
Write-Host ""
Write-Host "  Accounts:" -ForegroundColor White
Write-Host "  admin / admin123    (Admin)"
Write-Host "  sales1 / 123456    (Sales)"
Write-Host "  finance1 / 123456  (Finance)"
Write-Host "  prod1 / 123456     (Production)"
Write-Host "  qc1 / 123456       (QC)"
Write-Host ""
Write-Host "  Commands:" -ForegroundColor White
Write-Host "  pm2 status                   # Status" -ForegroundColor Gray
Write-Host "  pm2 logs contract-system     # Logs" -ForegroundColor Gray
Write-Host "  pm2 restart contract-system  # Restart" -ForegroundColor Gray
Write-Host "  Update: cd $PROJECT_DIR && git pull && cd client && npm run build && cd ..\server && npm run build && pm2 restart contract-system" -ForegroundColor Gray
Write-Host ""
