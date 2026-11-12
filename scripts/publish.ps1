# Creates the GitHub repo, uploads the project, sets the two signing secrets, and starts the build.
# Run once from the project folder:
#   powershell -ExecutionPolicy Bypass -File scripts\publish.ps1
# One-time setup before it:   winget install GitHub.cli    then    gh auth login
# NOTE: keep this file ASCII-only (Windows PowerShell 5.1 misreads UTF-8 without BOM).
param([string]$Repo = 'favorites-app', [switch]$Private)
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Fail($m) { Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Fail 'gh is not installed. Run: winget install GitHub.cli  (then close and reopen this window)' }
gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'Log in first: gh auth login' }

# Signing keystore: generated once, kept in signing\ (outside git)
$tools = Join-Path (Split-Path (Get-Location) -Parent) '.tools'
$jdk = Get-ChildItem -Path $tools -Filter 'jdk-21*' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
node scripts/make-keystore.mjs
if ($LASTEXITCODE -ne 0) { Fail 'Could not create the keystore (JDK needed: set JAVA_HOME)' }

if (-not (Test-Path .git)) { git init -b main | Out-Null }
git add -A
git -c user.name="favorites" -c user.email="favorites@users.noreply.github.com" commit -m "Update" 2>$null | Out-Null

$user = (gh api user --jq .login)
if (-not $user) { Fail 'Could not read your GitHub user name' }
gh repo view "$user/$Repo" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  $vis = '--public'; if ($Private) { $vis = '--private' }
  gh repo create $Repo $vis --source . --remote origin --description "Personal favorites library"
  if ($LASTEXITCODE -ne 0) { Fail 'Could not create the repository' }
} elseif (-not (git remote | Select-String -Quiet '^origin$')) {
  git remote add origin "https://github.com/$user/$Repo.git"
}

# Secrets first, so the very first build can sign the APK
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path 'signing\release.keystore')))
$b64 | gh secret set KEYSTORE_B64 --repo "$user/$Repo"
if ($LASTEXITCODE -ne 0) { Fail 'Could not set secret KEYSTORE_B64' }
(Get-Content 'signing\keystore.pass' -Raw).Trim() | gh secret set KEYSTORE_PASS --repo "$user/$Repo"
if ($LASTEXITCODE -ne 0) { Fail 'Could not set secret KEYSTORE_PASS' }

git push -u origin main
if ($LASTEXITCODE -ne 0) { Fail 'git push failed' }

Write-Host ''
Write-Host 'Uploaded. The build is running now (10-20 minutes):' -ForegroundColor Green
Write-Host "  https://github.com/$user/$Repo/actions"
Write-Host 'Fixed download links (valid after the build finishes):' -ForegroundColor Green
Write-Host "  APK: https://github.com/$user/$Repo/releases/download/latest/Favorites.apk"
Write-Host "  IPA: https://github.com/$user/$Repo/releases/download/latest/Favorites.ipa"
Write-Host ''
Write-Host "Watch the build from here:  gh run watch --repo $user/$Repo"
