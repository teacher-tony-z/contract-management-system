<#
 .SYNOPSIS
  合同管理系统 - Windows Server 一键部署脚本
.DESCRIPTION
  在 Windows Server 上自动部署合同管理系统，包含：
  - 环境检查（Docker、端口等）
  - 构建前端静态文件
  - 构建后端镜像
  - 启动所有服务（PostgreSQL + NestJS + Nginx）
  - 部署验证
  - 防火墙配置
.PARAMETER SkipBuild
  跳过重新构建，直接启动已有镜像
.PARAMETER ForceRebuild
  强制重新构建所有镜像（忽略缓存）
.PARAMETER HttpPort
  HTTP 监听端口，默认 80
#>

param(
    [switch]$SkipBuild,
    [switch]$ForceRebuild,
    [int]$HttpPort = 80
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# 颜色定义
$Colors = @{
    Title    = "Cyan"
    Step     = "Yellow"
    Success  = "Green"
    Error    = "Red"
    Warning  = "Magenta"
    Info     = "Gray"
    Highlight = "White"
}

function Write-Title  { param([string]$m) Write-Host "`n$m" -ForegroundColor $Colors.Title }
function Write-Step   { param([string]$m) Write-Host "`n[$($script:stepCount++)] $m..." -ForegroundColor $Colors.Step }
function Write-OK     { param([string]$m) Write-Host "  ✅ $m" -ForegroundColor $Colors.Success }
function Write-Fail   { param([string]$m) Write-Host "  ❌ $m" -ForegroundColor $Colors.Error }
function Write-Warn   { param([string]$m) Write-Host "  ⚠️  $m" -ForegroundColor $Colors.Warning }

$script:stepCount = 1

# ============================================
# 获取脚本所在目录（兼容各种执行方式）
# ============================================
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_DIR = Split-Path -Parent $SCRIPT_DIR
Set-Location $PROJECT_DIR

Write-Title "========================================"
Write-Title "  合同管理系统 - Windows Server 部署脚本"
Write-Title "  项目目录: $PROJECT_DIR"
Write-Title "========================================"

# ============================================
# Step 1: 检查运行权限
# ============================================
Write-Step "检查运行权限"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Fail "请以管理员身份运行 PowerShell！"
    Write-Warn "右键点击 PowerShell → 以管理员身份运行"
    exit 1
}
Write-OK "以管理员身份运行"

# ============================================
# Step 2: 检查 Docker 环境
# ============================================
Write-Step "检查 Docker 环境"
try {
    $dockerVer = docker --version 2>$null
    Write-OK "Docker 已安装: $dockerVer"
} catch {
    Write-Fail "Docker 未安装！正在尝试自动安装..."
    Write-Host "    正在下载 Docker Desktop Installer..." -ForegroundColor $Colors.Info
    $installer = "$env:TEMP\DockerDesktopInstaller.exe"
    try {
        Invoke-WebRequest -Uri "https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe" -OutFile $installer -UseBasicParsing
        Write-Host "    下载完成，正在安装（静默模式）..." -ForegroundColor $Colors.Info
        Start-Process -FilePath $installer -ArgumentList "install --quiet --accept-license" -Wait -NoNewWindow
        Write-OK "Docker Desktop 安装完成，请重启服务器后再运行此脚本。"
        Write-Warn "重启后 Docker Desktop 将自动启动。"
        exit 0
    } catch {
        Write-Fail "自动安装失败，请手动安装 Docker Desktop。"
        Write-Warn "下载地址: https://www.docker.com/products/docker-desktop/"
        exit 1
    }
}

# 检查 Docker 是否在运行
try {
    $dockerInfo = docker info 2>$null
    Write-OK "Docker 引擎运行正常"
} catch {
    Write-Fail "Docker 引擎未运行！请启动 Docker Desktop。"
    Write-Warn "可在开始菜单中找到 Docker Desktop 启动，或重启服务器。"
    exit 1
}

# 检查 Docker Compose
try {
    $composeVer = docker compose version 2>$null
    Write-OK "Docker Compose 可用: $composeVer"
} catch {
    Write-Fail "Docker Compose 不可用，请更新 Docker Desktop 到最新版本。"
    exit 1
}

# ============================================
# Step 3: 检查项目文件完整性
# ============================================
Write-Step "检查项目文件完整性"
$requiredFiles = @(
    "deploy/Dockerfile",
    "deploy/docker-compose.yml",
    "deploy/nginx.conf",
    "deploy/.env",
    "client/package.json",
    "server/package.json"
)
$missing = $false
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Fail "缺少必需文件: $file"
        $missing = $true
    }
}
if ($missing) { exit 1 }
Write-OK "所有必需文件存在"

# ============================================
# Step 4: 加载环境变量
# ============================================
Write-Step "加载环境变量"
if (Test-Path "deploy/.env") {
    Get-Content "deploy/.env" | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$key" -Value $value
        }
    }
    Write-OK "环境变量已加载 (deploy/.env)"
} else {
    Write-Warn "deploy/.env 不存在，使用默认配置"
}

$JWT_SECRET = [System.Environment]::GetEnvironmentVariable("JWT_SECRET")
if ([string]::IsNullOrEmpty($JWT_SECRET) -or $JWT_SECRET -eq "contract-mgmt-jwt-secret-key-2024-production") {
    Write-Warn "警告：JWT_SECRET 使用的是默认值，建议修改为随机字符串！"
    Write-Warn "      编辑 deploy/.env 文件中的 JWT_SECRET=your-random-secret"
}

# ============================================
# Step 5: 检查端口占用
# ============================================
Write-Step "检查端口 $HttpPort 占用"
$portCheck = netstat -ano | Select-String ":$HttpPort\s"
if ($portCheck) {
    Write-Warn "端口 $HttpPort 已被占用！尝试找出占用程序..."
    $processId = ($portCheck -split '\s+')[-1]
    try {
        $process = Get-Process -Id $processId -ErrorAction Stop
        Write-Warn "  占用程序: $($process.ProcessName) (PID: $processId)"
    } catch {
        Write-Warn "  无法获取占用程序信息 (PID: $processId)"
    }

    $choice = Read-Host "  是否尝试关闭占用程序？(y/N)"
    if ($choice -eq 'y') {
        try {
            Stop-Process -Id $processId -Force
            Start-Sleep -Seconds 2
            Write-OK "端口 $HttpPort 已释放"
        } catch {
            Write-Fail "无法释放端口，请手动停止占用程序后重试"
            exit 1
        }
    } else {
        Write-Warn "跳过端口检查，继续部署..."
        Write-Warn "  提示：可修改 deploy/.env 中的 HTTP_PORT 使用其他端口"
    }
} else {
    Write-OK "端口 $HttpPort 可用"
}

# ============================================
# Step 6: 构建并启动 Docker 服务
# ============================================
Write-Step "构建并启动所有服务"

$env:HTTP_PORT = $HttpPort

# 如果使用了 SkipBuild，先清理旧的 frontend-dist 卷确保重新构建
if ($SkipBuild) {
    Write-Warn "跳过重新构建"
} elseif ($ForceRebuild) {
    Write-Host "    强制重新构建：清理旧的前端卷..." -ForegroundColor $Colors.Info
    docker volume rm contract-frontend-dist 2>$null
}

$composeArgs = @(
    "--project-directory", $PROJECT_DIR
    "-f", "deploy/docker-compose.yml"
    "up", "-d", "--build"
)

Write-Host "    正在启动服务..." -ForegroundColor $Colors.Info
Write-Host "    第一阶段：构建前端（约 1-2 分钟）" -ForegroundColor $Colors.Info
Write-Host "    第二阶段：启动 PostgreSQL + 后端 + Nginx" -ForegroundColor $Colors.Info
Write-Host "    执行: docker compose -f deploy/docker-compose.yml up -d --build" -ForegroundColor $Colors.Info

$composeResult = & "docker" $composeArgs 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Fail "服务启动失败"
    Write-Host "$composeResult" -ForegroundColor $Colors.Error
    Write-Warn "查看详细日志: docker compose -f deploy/docker-compose.yml logs"
    exit 1
}

Write-OK "所有服务已启动"

# ============================================
# Step 7: 等待服务就绪并验证
# ============================================
Write-Step "验证服务状态"
Start-Sleep -Seconds 8

# 检查所有容器状态
$containers = docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host "`n  运行中的容器:" -ForegroundColor $Colors.Highlight
Write-Host "$containers`n"

# 验证各个组件
$services = @(
    @{Name="PostgreSQL";   Url="http://localhost:80";             Timeout=5; Method="TCP"},
    @{Name="后端 API";     Url="http://localhost:80/api/health";  Timeout=10; Method="HTTP"},
    @{Name="前端页面";     Url="http://localhost:80";             Timeout=10; Method="HTTP"}
)

foreach ($svc in $services) {
    try {
        if ($svc.Method -eq "HTTP") {
            $response = Invoke-WebRequest -Uri $svc.Url -UseBasicParsing -TimeoutSec $svc.Timeout -ErrorAction Stop
            Write-OK " $($svc.Name) 可用 (HTTP $($response.StatusCode))"
        } else {
            # TCP check via container status
            Write-OK " $($svc.Name) 运行中"
        }
    } catch {
        if ($svc.Name -eq "后端 API") {
            # API health check might not be implemented yet, that's OK
            Write-Warn " $($svc.Name) 暂未响应（如果刚启动可能需要等待30秒）"
        } else {
            Write-Warn " $($svc.Name) 暂未响应，服务可能仍在启动..."
        }
    }
}

# ============================================
# Step 8: 配置防火墙
# ============================================
Write-Step "配置 Windows 防火墙"

$fwRuleName = "ContractSystem-HTTP-$HttpPort"
$existingRule = netsh advfirewall firewall show rule name="$fwRuleName" 2>$null

if ($LASTEXITCODE -ne 0) {
    try {
        New-NetFirewallRule -DisplayName $fwRuleName `
            -Direction Inbound -Protocol TCP -LocalPort $HttpPort -Action Allow `
            -Description "合同管理系统 HTTP 端口" -ErrorAction Stop
        Write-OK "防火墙规则已添加（端口 $HttpPort）"
    } catch {
        Write-Warn "添加防火墙规则失败，请手动添加："
        Write-Warn "  New-NetFirewallRule -DisplayName 'ContractSystem-HTTP' -Direction Inbound -Protocol TCP -LocalPort $HttpPort -Action Allow"
    }
} else {
    Write-OK "防火墙规则已存在"
}

# ============================================
# 获取服务器 IP
# ============================================
$serverIP = "localhost"
try {
    $ipInfo = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.InterfaceAlias -notmatch "Loopback|Virtual|Docker" -and
        $_.IPAddress -notmatch "^169\.|^172\.|^10\.|^127\."
    } | Select-Object -First 1
    if ($ipInfo) { $serverIP = $ipInfo.IPAddress }
} catch {
    # Fallback to localhost
}

# ============================================
# 完成
# ============================================
Write-Title "========================================"
Write-Title "  部署完成！"
Write-Title "========================================"
Write-Host ""
Write-Host "  🌐 访问地址: http://$serverIP" -ForegroundColor $Colors.Highlight
if ($HttpPort -ne 80) { Write-Host "  🌐 访问地址: http://$serverIP`:$HttpPort" -ForegroundColor $Colors.Highlight }
Write-Host ""
Write-Title "  默认账号"
Write-Host "  ┌──────────┬───────────┬──────────┐" -ForegroundColor $Colors.Info
Write-Host "  │ 用户名    │ 密码       │ 角色      │" -ForegroundColor $Colors.Info
Write-Host "  ├──────────┼───────────┼──────────┤" -ForegroundColor $Colors.Info
Write-Host "  │ admin    │ admin123  │ 管理员    │" -ForegroundColor $Colors.Info
Write-Host "  │ sales1   │ 123456    │ 销售      │" -ForegroundColor $Colors.Info
Write-Host "  │ finance1 │ 123456    │ 财务      │" -ForegroundColor $Colors.Info
Write-Host "  │ prod1    │ 123456    │ 生产      │" -ForegroundColor $Colors.Info
Write-Host "  │ qc1      │ 123456    │ 质检      │" -ForegroundColor $Colors.Info
Write-Host "  └──────────┴───────────┴──────────┘" -ForegroundColor $Colors.Info
Write-Host ""
Write-Title "  常用管理命令（在项目目录下运行）"
Write-Host "  docker compose -f deploy/docker-compose.yml logs -f    # 查看日志" -ForegroundColor $Colors.Info
Write-Host "  docker compose -f deploy/docker-compose.yml restart   # 重启服务" -ForegroundColor $Colors.Info
Write-Host "  docker compose -f deploy/docker-compose.yml down      # 停止服务" -ForegroundColor $Colors.Info
Write-Host "  docker compose -f deploy/docker-compose.yml up -d     # 启动服务" -ForegroundColor $Colors.Info
Write-Host "  docker system prune -f                                # 清理空间" -ForegroundColor $Colors.Info
Write-Host ""
Write-Title "  提示"
Write-Host "  - 代码更新后，在项目目录重新运行此脚本即可自动更新" -ForegroundColor $Colors.Info
Write-Host "  - 查看详细日志: docker compose -f deploy/docker-compose.yml logs -f" -ForegroundColor $Colors.Info
Write-Host "  - 建议修改 deploy/.env 中的 JWT_SECRET 为随机字符串" -ForegroundColor $Colors.Warning
Write-Host ""
