# 合同管理系统 - Windows 服务器部署脚本
# 在服务器上以管理员身份运行 PowerShell 执行此脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  合同管理系统 - Windows Docker 部署脚本 " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 配置参数
$PROJECT_DIR = "C:\contract-management-system"
$COMPOSE_FILE = "deploy\docker-compose.yml"

# 步骤 1: 检查 Docker 是否安装
Write-Host "`n[1/6] 检查 Docker 环境..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "  ✅ Docker 已安装: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Docker 未安装！请先安装 Docker Desktop for Windows" -ForegroundColor Red
    Write-Host ""
    Write-Host "  下载地址: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    Write-Host "  安装后请重启 PowerShell 并重新运行此脚本。" -ForegroundColor Yellow
    exit 1
}

# 步骤 2: 检查 Docker Compose
Write-Host "`n[2/6] 检查 Docker Compose..." -ForegroundColor Yellow
try {
    $composeVersion = docker compose version
    Write-Host "  ✅ Docker Compose 可用: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Docker Compose 未找到，尝试 docker-compose..." -ForegroundColor Yellow
    try {
        $composeVersion = docker-compose --version
        Write-Host "  ✅ docker-compose 可用: $composeVersion" -ForegroundColor Green
        $COMPOSE_FILE = "deploy/docker-compose.yml"
    } catch {
        Write-Host "  ❌ Docker Compose 不可用！请更新 Docker Desktop" -ForegroundColor Red
        exit 1
    }
}

# 步骤 3: 进入项目目录
Write-Host "`n[3/6] 进入项目目录..." -ForegroundColor Yellow
if (-not (Test-Path $PROJECT_DIR)) {
    Write-Host "  ❌ 项目目录不存在: $PROJECT_DIR" -ForegroundColor Red
    Write-Host "  请先将项目文件复制到该目录，或修改 `$PROJECT_DIR 变量" -ForegroundColor Yellow
    exit 1
}
Set-Location $PROJECT_DIR
Write-Host "  ✅ 当前目录: $(Get-Location)" -ForegroundColor Green

# 步骤 4: 检查端口占用
Write-Host "`n[4/6] 检查端口 80 占用..." -ForegroundColor Yellow
$portCheck = netstat -ano | Select-String ":80 "
if ($portCheck) {
    Write-Host "  ⚠️  端口 80 已被占用！请确保没有其他 Web 服务器在运行。" -ForegroundColor Yellow
    Write-Host "  可使用 'net stop HTTP' 停止 HTTP 服务（谨慎操作）" -ForegroundColor Yellow
} else {
    Write-Host "  ✅ 端口 80 可用" -ForegroundColor Green
}

# 步骤 5: 启动服务
Write-Host "`n[5/6] 启动 Docker 服务..." -ForegroundColor Yellow
Write-Host "  正在构建并启动所有服务..." -ForegroundColor Gray
docker compose -f $COMPOSE_FILE up -d --build 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ 所有服务已启动！" -ForegroundColor Green
} else {
    Write-Host "  ❌ 服务启动失败，请检查上方错误信息" -ForegroundColor Red
    exit 1
}

# 步骤 6: 验证部署
Write-Host "`n[6/6] 验证部署..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 检查容器状态
$runningContainers = docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host "`n  运行中的容器:" -ForegroundColor Cyan
Write-Host $runningContainers

# 测试 HTTP 响应
try {
    $response = Invoke-WebRequest -Uri "http://localhost" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "`n  ✅ 前端页面可访问 (HTTP 200)" -ForegroundColor Green
    } else {
        Write-Host "`n  ⚠️  前端返回状态码: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n  ⚠️  前端页面暂未响应，服务可能仍在启动中..." -ForegroundColor Yellow
    Write-Host "  请稍后使用 'docker ps' 检查容器状态" -ForegroundColor Yellow
}

# 测试 API
try {
    $apiResponse = Invoke-WebRequest -Uri "http://localhost/api" -UseBasicParsing -TimeoutSec 10
    Write-Host "  ✅ API 可访问 (HTTP $($apiResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  API 暂未响应，应用可能仍在启动中..." -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  部署完成！" -ForegroundColor Cyan
Write-Host "  访问地址: http://1.12.36.66" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "常用命令:" -ForegroundColor White
Write-Host "  查看日志: docker compose -f $COMPOSE_FILE logs -f" -ForegroundColor Gray
Write-Host "  重启服务: docker compose -f $COMPOSE_FILE restart" -ForegroundColor Gray
Write-Host "  停止服务: docker compose -f $COMPOSE_FILE down" -ForegroundColor Gray
Write-Host "  重新构建: docker compose -f $COMPOSE_FILE up -d --build" -ForegroundColor Gray
