$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$appDirectory = 'C:\Users\Administrator\Desktop\live-chat\live-chat'
$startupTask = '\Nemark_AutoStart'

Set-Location -LiteralPath $appDirectory

Write-Host 'Installing locked production dependencies...'
& npm.cmd ci --no-audit --fund=false
if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE" }

Write-Host 'Generating Prisma Client...'
& npx.cmd prisma generate
if ($LASTEXITCODE -ne 0) { throw "Prisma generate failed with exit code $LASTEXITCODE" }

Write-Host 'Running the production test gate before touching the live process...'
& npm.cmd run verify:production
if ($LASTEXITCODE -ne 0) { throw "Production test gate failed with exit code $LASTEXITCODE. Existing service was not restarted." }

Write-Host 'Stopping the NemarkChat API process on port 4001 after the gate passed...'
Get-NetTCPConnection -LocalPort 4001 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2

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
