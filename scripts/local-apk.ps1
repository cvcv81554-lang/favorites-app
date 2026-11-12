# Build a signed APK locally on Windows. Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File scripts\local-apk.ps1
# Needs: Node.js + JDK 21 + Android SDK (platform 35 and build-tools 35).
# NOTE: keep this file ASCII-only (Windows PowerShell 5.1 misreads UTF-8 without BOM).
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

# JDK 21: use the portable copy next to the project if present, else the current JAVA_HOME
$tools = Join-Path (Split-Path (Get-Location) -Parent) '.tools'
$jdk = Get-ChildItem -Path $tools -Filter 'jdk-21*' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
if (-not $env:JAVA_HOME) { throw 'Install JDK 21 and set JAVA_HOME' }
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
if (-not (Test-Path "$env:ANDROID_HOME\platforms\android-35")) { throw 'Android SDK platform 35 is missing (install it from SDK Manager)' }
if (-not $env:VERSION_CODE) { $env:VERSION_CODE = [string][int]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() / 60) }
if (-not $env:VERSION_NAME) { $env:VERSION_NAME = '1.0.' + (Get-Date -Format 'yyMMdd') }
$env:APP_VERSION = $env:VERSION_NAME

function Run($cmd) {
  Write-Host ">> $cmd" -ForegroundColor Cyan
  cmd /c $cmd
  if ($LASTEXITCODE -ne 0) { throw "FAILED: $cmd" }
}

if (-not (Test-Path node_modules)) { Run 'npm install --no-audit --no-fund' }
Run 'node scripts/build.mjs'
if (-not (Test-Path android)) { Run 'npx cap add android' }
Run 'node scripts/patch-android.mjs'
Run 'npx cap sync android'
Push-Location android
Run 'gradlew.bat assembleRelease --no-daemon -q'
Pop-Location
Run 'node scripts/make-keystore.mjs'
Run 'node scripts/sign-apk.mjs'
Write-Host ''
Write-Host 'DONE: dist\Favorites.apk' -ForegroundColor Green
