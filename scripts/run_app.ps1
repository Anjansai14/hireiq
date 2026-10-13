$ErrorActionPreference = "Stop"

Write-Host "=== Hire IQ: Checking Docker Status ==="
$dockerPath = "C:\Users\lenovo\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"

$isReady = $false
try {
    $info = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $isReady = $true
        Write-Host "Docker daemon is already running."
    }
} catch {
    $isReady = $false
}

if (-not $isReady) {
    Write-Host "Starting Docker Desktop..."
    if (Test-Path $dockerPath) {
        Start-Process -FilePath $dockerPath
    } else {
        Write-Error "Docker Desktop executable not found at $dockerPath"
        exit 1
    }

    Write-Host "Waiting for Docker daemon to become responsive..."
    $maxAttempts = 35
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        Start-Sleep -Seconds 2
        $res = & docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            $isReady = $true
            Write-Host "`nDocker daemon is ready!"
            break
        }
        Write-Host "." -NoNewline
    }
    Write-Host ""
}

if (-not $isReady) {
    Write-Error "Timed out waiting for Docker daemon to become responsive."
    exit 1
}

if (-not (Test-Path ".env")) {
    Write-Host "Creating .env from .env.example..."
    Copy-Item ".env.example" ".env"
}

Write-Host "=== Building and Starting Hire IQ Containers ==="
docker compose up --build
