$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$appDirectory = 'C:\Users\Administrator\Desktop\live-chat\live-chat'
$startupTask = '\Nemark_AutoStart'

Set-Location -LiteralPath $appDirectory

Write-Host 'Stopping the scheduled runtime before replacing locked Windows build tools...'
& schtasks.exe /End /TN $startupTask 2>$null
# /End returns a non-zero code when the task is already stopped. The listener
# sweep below is authoritative and also catches child processes left behind.

$listenerProcessIds = @(
    foreach ($port in 4001, 3020) {
        Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    }
) | Sort-Object -Unique

foreach ($processId in $listenerProcessIds) {
    Write-Host "Stopping process tree $processId that owns a production listener..."
    & taskkill.exe /PID $processId /T /F
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 128) {
        throw "Could not stop production process tree $processId (exit code $LASTEXITCODE)"
    }
}

Start-Sleep -Seconds 3

Write-Host 'Installing locked production dependencies after listeners released their file handles...'
$dependenciesInstalled = $false
foreach ($attempt in 1..3) {
    & npm.cmd ci --no-audit --fund=false
    if ($LASTEXITCODE -eq 0) {
        $dependenciesInstalled = $true
        break
    }

    if ($attempt -lt 3) {
        Write-Warning "npm ci attempt $attempt failed; retrying after Windows releases file handles..."
        Start-Sleep -Seconds 3
    }
}
if (-not $dependenciesInstalled) { throw 'npm ci failed after 3 attempts; production remains stopped.' }

Write-Host 'Generating Prisma Client...'
& npx.cmd prisma generate
if ($LASTEXITCODE -ne 0) { throw "Prisma generate failed with exit code $LASTEXITCODE" }

Write-Host 'Running the production test gate before starting the new release...'
& npm.cmd run verify:production
if ($LASTEXITCODE -ne 0) { throw "Production test gate failed with exit code $LASTEXITCODE. The failed release was not started." }

Write-Host 'Restarting the existing NemarkChat startup task...'
& schtasks.exe /Run /TN $startupTask
if ($LASTEXITCODE -ne 0) { throw "Scheduled task restart failed with exit code $LASTEXITCODE" }

function Wait-Endpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Url
    )

    foreach ($attempt in 1..30) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                Write-Host "$Name is healthy (HTTP $($response.StatusCode))."
                return
            }
        } catch {
            if ($attempt -eq 30) { throw }
        }
        Start-Sleep -Seconds 2
    }

    throw "$Name did not become healthy: $Url"
}

Wait-Endpoint -Name 'NemarkChat API/web' -Url 'http://127.0.0.1:4001/'
Wait-Endpoint -Name 'Landing page' -Url 'http://127.0.0.1:3020/'

Write-Host 'Windows VPS deployment completed successfully.'
