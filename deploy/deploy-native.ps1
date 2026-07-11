<#
.SYNOPSIS
  Contract Management System - Native Deployment Script (Windows Server)
.DESCRIPTION
  Installs Git, Node.js, PostgreSQL, clones repo, builds, starts the app.
  Optimized for 2GB RAM servers without Docker.
#>
param([string]$RepoUrl = "https://github.com/teacher-tony-z/contract-management-system.git", [int]$HttpPort = 80)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$step = 1
$PROJECT_DIR = "C:\contract-management-system"

function Title   { param([string]$m) Write-Host "`n$m" -ForegroundColor Cyan }
function Step    { Write-Host "`n[$($step++)] $($args[0])..." -ForegroundColor Yellow }
function OK      { Write-Host "  [OK] $($args[0])" -ForegroundColor Green }
function Fail    { Write-Host "  [FAIL] $($args[0])" -ForegroundColor Red; exit 1 }

# ============================================
# Step 1: Admin check
# ============================================
Title "=== Contract Management System - Windows Server Deployment ==="
Title "Project: $PROJECT_DIR"
Step "Checking admin rights"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Fail "Please run as Administrator" }
OK "Running as Administrator"

# ============================================
# Step 2: Install Git
# ============================================
Step "Installing Git"
try { git --version | Out-Null; OK "Git already installed: $(git --version)" }
catch {
    Write-Host "  Downloading Git..." -ForegroundColor Gray
    $url = "https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/Git-2.45.2-64-bit.exe"
    $exe = "$env:TEMP\Git-64-bit.exe"
    Invoke-WebRequest -Uri $url -OutFile $exe -UseBasicParsing
    Start-Process $exe -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP-" -Wait -NoNewWindow
    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
    OK "Git installed: $(git --version)"
}

# ============================================
# Step 3: Install Node.js 20
# ============================================
Step "Installing Node.js 20"
try { $nv = node --version; if ($nv -match "v20") { OK "Node.js already installed: $nv"; throw "skip" } else { throw "wrong version" } }
catch {
    if ($_.Exception.Message -eq "skip") { goto > $null }  # continue
    Write-Host "  Downloading Node.js 20..." -ForegroundColor Gray
    $url = "https://nodejs.org/dist/v20.18.3/node-v20.18.3-x64.msi"
    $msi = "$env:TEMP\node-v20-x64.msi"
    Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn ADDLOCAL=ALL" -Wait -NoNewWindow
    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
    OK "Node.js installed: $(node --version)"
}

# ============================================
# Step 4: Install PostgreSQL
# ============================================
Step "Installing PostgreSQL 15"
$pgBin = "C:\Program Files\PostgreSQL\15\bin"
$pgCtl = "$pgBin\pg_ctl.exe"
$pgData = "C:\Program Files\PostgreSQL\15\data"
$svc = Get-Service "postgresql*" -ErrorAction SilentlyContinue

if (-not $svc) {
    if (-not (Test-Path $pgCtl)) {
        Write-Host "  Downloading PostgreSQL 15..." -ForegroundColor Gray
        $url = "https://get.enterprisedb.com/postgresql/postgresql-15.11-1-windows-x64.exe"
        $exe = "$env:TEMP\postgresql-15-x64.exe"
        Invoke-WebRequest -Uri $url -OutFile $exe -UseBasicParsing
        Write-Host "  Installing PostgreSQL (silent, ~2 min)..." -ForegroundColor Gray
        Start-Process $exe -ArgumentList "--mode unattended --unattendedmodeui none --superpassword postgres --serviceaccount postgres --disable-components pgAdmin4,stackbuilder" -Wait -NoNewWindow
    }
    if (-not (Test-Path "$pgData\PG_VERSION")) {
        Write-Host "  Initializing database..." -ForegroundColor Gray
        & $pgCtl initdb -D "$pgData" --username=postgres --pwfile=<(Write-Output "postgres") 2>&1
    }
    OK "PostgreSQL installed"
} else {
    OK "PostgreSQL already installed ($($svc.Status))"
    if ($svc.Status -ne "Running") { Start-Service $svc.Name }
}

$env:Path = "$pgBin;$env:Path"
$env:PGPASSWORD = "postgres"

# Wait for PG to be ready
Step "Waiting for PostgreSQL"
$ready = $false
for ($i=0; $i -lt 15; $i++) {
    try { $s = & pg_isready -h localhost -U postgres 2>&1; if ($s -match "accepting") { $ready=$true; break } } catch {}
    Start-Sleep -Seconds 2
}
if (-not $ready) { Fail "PostgreSQL failed to start" }
OK "PostgreSQL is ready"

# Create database
& psql -U postgres -h localhost -c "SELECT 1 FROM pg_database WHERE datname='contract_db'" 2>$null | findstr "1" >$null
if ($LASTEXITCODE -ne 0) {
    & psql -U postgres -h localhost -c "CREATE DATABASE contract_db ENCODING 'UTF8'" 2>&1 | Out-Null
    OK "Database contract_db created"
} else { OK "Database contract_db already exists" }

# Configure PG for low memory
$pgConf = "$pgData\postgresql.conf"
if (Test-Path $pgConf) {
    $cfg = Get-Content $pgConf -Raw
    if ($cfg -notmatch "low-memory-optimization") {
        Add-Content $pgConf @"

# low-memory-optimization (2GB server)
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
# Step 5: Clone/update repository
# ============================================
Step "Getting project code"
if (Test-Path "$PROJECT_DIR\.git") {
    Write-Host "  Pulling latest code..." -ForegroundColor Gray
    Set-Location $PROJECT_DIR
    git pull 2>&1 | Out-Null
    OK "Code updated"
} else {
    Write-Host "  Cloning repository..." -ForegroundColor Gray
    if (Test-Path $PROJECT_DIR) { Remove-Item "$PROJECT_DIR\*" -Recurse -Force -ErrorAction SilentlyContinue }
    git clone $RepoUrl $PROJECT_DIR 2>&1
    if ($LASTEXITCODE -ne 0) { Fail "Git clone failed - check repository URL and access" }
    OK "Repository cloned"
}

Set-Location $PROJECT_DIR

# ============================================
# Step 6: Environment config
# ============================================
Step "Configuring environment"
$envContent = @"
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=contract_db
JWT_SECRET=contract-mgmt-jwt-secret-$(Get-Random)
NODE_ENV=production
PORT=3000
"@
if (-not (Test-Path "server\.env")) {
    Set-Content -Path "server\.env" -Value $envContent -Encoding ASCII
    OK "Environment file created"
} else { OK "Environment file exists" }

# Set npm registry to taobao mirror for faster downloads in China
npm config set registry https://registry.npmmirror.com/ 2>$null

# ============================================
# Step 7: Build frontend
# ============================================
Step "Building frontend"
Set-Location "$PROJECT_DIR\client"
Write-Host "  Installing frontend dependencies..." -ForegroundColor Gray
npm ci 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { npm install 2>&1 | Out-Null }
Write-Host "  Running frontend build..." -ForegroundColor Gray
npm run build 2>&1
if ($LASTEXITCODE -ne 0) { Fail "Frontend build failed" }
if (-not (Test-Path "dist\index.html")) { Fail "Frontend dist not found" }
OK "Frontend built successfully"

# ============================================
# Step 8: Build backend
# ============================================
Step "Building backend"
Set-Location "$PROJECT_DIR\server"
Write-Host "  Installing backend dependencies..." -ForegroundColor Gray
npm ci 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { npm install 2>&1 | Out-Null }
Write-Host "  Compiling backend..." -ForegroundColor Gray
npm run build 2>&1
if ($LASTEXITCODE -ne 0) { Fail "Backend build failed" }
if (-not (Test-Path "dist\main.js")) { Fail "Backend dist not found" }
OK "Backend built successfully"

# ============================================
# Step 9: Install PM2 and start app
# ============================================
Step "Setting up PM2 process manager"
try { pm2 --version | Out-Null; OK "PM2 already installed" } catch {
    npm install -g pm2@latest 2>&1 | Out-Null
    OK "PM2 installed"
}

Set-Location $PROJECT_DIR
pm2 delete contract-system 2>$null

$env:NODE_ENV = "production"
$env:PORT = "3000"
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_USER = "postgres"
$env:DB_PASSWORD = "postgres"
$env:DB_NAME = "contract_db"

pm2 start server/dist/main.js --name "contract-system" --max-memory-restart 500M 2>&1
if ($LASTEXITCODE -ne 0) { Fail "Application failed to start" }
OK "Application started (PM2: contract-system)"

pm2 save 2>&1 | Out-Null
pm2 startup 2>&1 | Out-Null
OK "PM2 auto-start configured"

Start-Sleep -Seconds 5

# ============================================
# Step 10: Verify
# ============================================
Step "Verifying deployment"
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 10
    OK "API available (HTTP $($r.StatusCode))"
} catch { Write-Host "  [WARN] API not yet responding, check later: pm2 logs contract-system" -ForegroundColor Magenta }

try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 10
    OK "Frontend available (HTTP $($r.StatusCode))"
} catch { Write-Host "  [WARN] Frontend not yet responding" -ForegroundColor Magenta }

# ============================================
# Step 11: Port forwarding (80 -> 3000)
# ============================================
Step "Configuring port forwarding ($HttpPort -> 3000)"
netsh interface portproxy delete v4tov4 listenport=$HttpPort listenaddress=0.0.0.0 2>$null
netsh interface portproxy add v4tov4 listenport=$HttpPort listenaddress=0.0.0.0 connectport=3000 connectaddress=localhost 2>$null
if ($LASTEXITCODE -eq 0) { OK "Port forwarding: 0.0.0.0:$HttpPort -> localhost:3000" }
else { Write-Host "  [WARN] Port forwarding failed, access via http://localhost:3000" -ForegroundColor Magenta }

# Firewall
$fwRule = "ContractSystem-HTTP-$HttpPort"
netsh advfirewall firewall show rule name="$fwRule" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    netsh advfirewall firewall add rule name="$fwRule" dir=in action=allow protocol=TCP localport=$HttpPort 2>$null
    OK "Firewall rule added (port $HttpPort)"
} else { OK "Firewall rule exists" }

# ============================================
# Get public IP
# ============================================
$serverIP = "localhost"
try { $resp = Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 5 -ErrorAction SilentlyContinue; if ($resp) { $serverIP = $resp.Trim() } } catch {}

# ============================================
# Done
# ============================================
Title "========================================"
Title "  DEPLOYMENT COMPLETE!"
Title "========================================"
Write-Host ""
if ($HttpPort -eq 80) { Write-Host "  Access: http://$serverIP" -ForegroundColor Cyan }
else { Write-Host "  Access: http://$serverIP`:$HttpPort" -ForegroundColor Cyan }
Write-Host ""
Write-Host "  Accounts:" -ForegroundColor White
Write-Host "  admin / admin123 (Admin)"
Write-Host "  sales1 / 123456 (Sales)"
Write-Host "  finance1 / 123456 (Finance)"
Write-Host "  prod1 / 123456 (Production)"
Write-Host "  qc1 / 123456 (QC)"
Write-Host ""
Write-Host "  Commands:" -ForegroundColor White
Write-Host "  pm2 status                   # Check process" -ForegroundColor Gray
Write-Host "  pm2 logs contract-system     # View logs" -ForegroundColor Gray
Write-Host "  pm2 restart contract-system  # Restart" -ForegroundColor Gray
Write-Host "  cd $PROJECT_DIR && git pull && cd client && npm run build && cd ..\server && npm run build && pm2 restart contract-system   # Update" -ForegroundColor Gray
Write-Host ""
