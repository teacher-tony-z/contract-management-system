# Docker Desktop 自动安装脚本（Windows Server）
# 以管理员身份运行

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Docker Desktop for Windows 安装脚本   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 检查是否已安装
$dockerPath = Get-Command "docker" -ErrorAction SilentlyContinue
if ($dockerPath) {
    Write-Host "✅ Docker 已安装: $(docker --version)" -ForegroundColor Green
    exit 0
}

Write-Host "`n📥 正在下载 Docker Desktop Installer..." -ForegroundColor Yellow
$installerPath = "$env:TEMP\DockerDesktopInstaller.exe"
$downloadUrl = "https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe"

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "✅ 下载完成" -ForegroundColor Green
} catch {
    Write-Host "❌ 下载失败: $_" -ForegroundColor Red
    Write-Host "请手动下载: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n⚙️  正在安装 Docker Desktop..." -ForegroundColor Yellow
Write-Host "   这将需要几分钟时间，请耐心等待..." -ForegroundColor Gray

# 静默安装
Start-Process -FilePath $installerPath -ArgumentList "install --quiet --accept-license" -Wait -NoNewWindow

Write-Host "✅ 安装完成！" -ForegroundColor Green
Write-Host "`n⚠️  重要: 请重启计算机以完成 Docker 安装！" -ForegroundColor Magenta
Write-Host "   重启后 Docker Desktop 将自动启动。" -ForegroundColor Yellow
Write-Host "   然后以管理员身份运行 deploy.ps1 部署应用。" -ForegroundColor Yellow

# 清理安装包
Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
