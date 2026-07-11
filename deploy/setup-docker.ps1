<#
 .SYNOPSIS
  合同管理系统 - Docker 环境安装脚本（Windows Server）
.DESCRIPTION
  自动检测并安装 Docker 环境，支持：
  - Docker Desktop (Windows 10/11 推荐)
  - Docker EE (Windows Server 2019/2022)
  - WSL 2 配置
#>

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  合同管理系统 - Docker 环境安装脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 检查是否以管理员身份运行
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "`n❌ 请以管理员身份运行此脚本！" -ForegroundColor Red
    Write-Host "   右键点击 PowerShell → 以管理员身份运行" -ForegroundColor Yellow
    exit 1
}

# 检测 Windows 版本
$osInfo = Get-CimInstance -ClassName Win32_OperatingSystem
$osVersion = [Version]$osInfo.Version
$osName = $osInfo.Caption

Write-Host "`n操作系统: $osName" -ForegroundColor White
Write-Host "版本: $($osInfo.Version)" -ForegroundColor Gray

# 检查是否已安装 Docker
$dockerPath = Get-Command "docker" -ErrorAction SilentlyContinue
if ($dockerPath) {
    try {
        $dockerVer = docker --version
        Write-Host "`n✅ Docker 已安装: $dockerVer" -ForegroundColor Green
        docker info 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Docker 引擎运行正常" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Docker 引擎未运行，请启动 Docker Desktop" -ForegroundColor Yellow
        }
        exit 0
    } catch {
        Write-Host "⚠️  Docker 命令存在但引擎有问题，尝试重新安装..." -ForegroundColor Yellow
    }
}

# 判断安装策略
$isWindowsServer = $osVersion.Major -ge 10 -and $osInfo.ProductType -eq 2  # ProductType 2 = Server
$isWin11OrLater = $osVersion -ge [Version]"10.0.22000"

Write-Host "`n检测到: $(if($isWindowsServer){'Windows Server'}elseif($isWin11OrLater){'Windows 11+'}else{'Windows 10'})" -ForegroundColor Cyan

# ============================================
# 安装 Docker
# ============================================
if ($isWindowsServer) {
    # Windows Server: 使用 Docker EE (Moby)
    Write-Host "`n[Windows Server 检测] 使用 Docker EE (企业版)..." -ForegroundColor Yellow

    # 安装 Docker 模块
    Write-Host "`n📦 正在安装 Docker 模块..." -ForegroundColor Yellow
    try {
        Install-Module -Name DockerMsftProvider -Force -SkipPublisherCheck -AllowClobber -ErrorAction Stop
        Write-Host "✅ Docker 模块安装成功" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  无法从 PSGallery 安装，尝试手动安装..." -ForegroundColor Yellow
        Write-Host "   请确保已安装 NuGet 提供程序: Install-PackageProvider -Name NuGet -Force" -ForegroundColor Gray
        exit 1
    }

    # 安装 Docker 包
    Write-Host "`n📦 正在安装 Docker 包..." -ForegroundColor Yellow
    try {
        Install-Package -Name docker -ProviderName DockerMsftProvider -Force -ErrorAction Stop
        Write-Host "✅ Docker 安装成功" -ForegroundColor Green
    } catch {
        Write-Host "❌ Docker 包安装失败: $_" -ForegroundColor Red
        exit 1
    }

    # 启用容器功能
    Write-Host "`n⚙️  启用 Windows 容器功能..." -ForegroundColor Yellow
    Enable-WindowsOptionalFeature -Online -FeatureName Containers -All
    Write-Host "✅ 容器功能已启用" -ForegroundColor Green

    Write-Host "`n⚠️  需要重启服务器以完成安装！" -ForegroundColor Magenta
    $choice = Read-Host "是否立即重启？(y/N)"
    if ($choice -eq 'y') { Restart-Computer -Force }

} else {
    # Windows 10/11: 使用 Docker Desktop
    Write-Host "`n[桌面版 Windows 检测] 使用 Docker Desktop..." -ForegroundColor Yellow

    # 检查是否启用了 WSL 2
    $wslInstalled = $false
    try {
        $wslStatus = wsl --status 2>$null
        if ($LASTEXITCODE -eq 0) {
            $wslInstalled = $true
            Write-Host "✅ WSL 2 已安装" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  WSL 未安装，Docker Desktop 将使用 Hyper-V" -ForegroundColor Yellow
    }

    # 下载 Docker Desktop
    Write-Host "`n📥 正在下载 Docker Desktop Installer..." -ForegroundColor Yellow
    $installer = "$env:TEMP\DockerDesktopInstaller.exe"
    $downloadUrl = "https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe"

    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $installer -UseBasicParsing
        Write-Host "✅ 下载完成" -ForegroundColor Green
    } catch {
        Write-Host "❌ 下载失败: $_" -ForegroundColor Red
        Write-Host "请手动下载: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
        exit 1
    }

    # 静默安装
    Write-Host "`n⚙️  正在安装 Docker Desktop..." -ForegroundColor Yellow
    Write-Host "   安装过程可能需要 5-10 分钟，请耐心等待..." -ForegroundColor Gray

    if ($wslInstalled) {
        $installArgs = "install --quiet --accept-license --wsl-engine"
    } else {
        $installArgs = "install --quiet --accept-license"
    }

    Start-Process -FilePath $installer -ArgumentList $installArgs -Wait -NoNewWindow

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker Desktop 安装完成！" -ForegroundColor Green
    } else {
        Write-Host "⚠️  安装程序返回退出码 $LASTEXITCODE" -ForegroundColor Yellow
        Write-Host "   请手动检查安装状态" -ForegroundColor Yellow
    }
}

# ============================================
# 完成
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($isWindowsServer) {
    Write-Host "  Docker 安装完成！" -ForegroundColor Cyan
    Write-Host "  请重启服务器后继续。" -ForegroundColor Cyan
} else {
    Write-Host "  Docker Desktop 安装完成！" -ForegroundColor Cyan
    Write-Host "  请重启计算机以完成安装。" -ForegroundColor Cyan
    Write-Host "" -ForegroundColor Cyan
    Write-Host "  重启后：" -ForegroundColor White
    Write-Host "  1. 启动 Docker Desktop" -ForegroundColor Gray
    Write-Host "  2. 等待右下角显示 'Docker Desktop is running'" -ForegroundColor Gray
    Write-Host "  3. 在本目录运行 .\deploy.ps1 部署应用" -ForegroundColor Gray
}
Write-Host "========================================" -ForegroundColor Cyan
