param([Parameter(Mandatory=$true)][string]$Mailbox)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
function Unprotect-Json([string]$Path) {
  $encrypted = Get-Content -Raw -LiteralPath $Path
  $secure = ConvertTo-SecureString $encrypted
  return ([System.Net.NetworkCredential]::new('', $secure).Password | ConvertFrom-Json -AsHashtable)
}
function New-Secret {
  return [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).TrimEnd('=').Replace('+','-').Replace('/','_')
}
if (Test-Path -LiteralPath '.secrets/worker-secrets.dpapi') {
  $bundle = Unprotect-Json '.secrets/worker-secrets.dpapi'
} else { $bundle = @{} }
$client = Unprotect-Json '.secrets/client-pending.dpapi'
$bundle.GOOGLE_CLIENT_ID = $client.GOOGLE_CLIENT_ID
$bundle.GOOGLE_CLIENT_SECRET = $client.GOOGLE_CLIENT_SECRET
$bundle.MAILBOX = $Mailbox
$bundle.ADMIN_EMAIL = $Mailbox
if (-not $bundle.RATE_SECRET) { $bundle.RATE_SECRET = New-Secret }
if (-not $bundle.TOKEN_ENCRYPTION_KEY) { $bundle.TOKEN_ENCRYPTION_KEY = New-Secret }
$bundleJson = $bundle | ConvertTo-Json -Compress
$bundleJson | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath '.secrets/worker-secrets.dpapi' -NoNewline
$env:WRANGLER_LOG_PATH = Join-Path (Get-Location) '.wrangler/logs'
$env:XDG_CONFIG_HOME = Join-Path (Get-Location) '.wrangler/config'
$env:WRANGLER_SEND_METRICS = 'false'
$bundleJson | & npx.cmd wrangler secret bulk
if ($LASTEXITCODE -ne 0) { throw 'Secret upload failed. Encrypted recovery file retained.' }
Write-Output 'SLOT secrets uploaded; local recovery copy is protected by Windows DPAPI.'
$bundleJson = $null
$bundle = $null
$client = $null
