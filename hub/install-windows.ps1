# تشغيل Favorites Hub تلقائيًا مع ويندوز (لحسابك فقط، بلا صلاحية مدير)
#   powershell -ExecutionPolicy Bypass -File hub\install-windows.ps1            تثبيت + تشغيل الآن
#   powershell -ExecutionPolicy Bypass -File hub\install-windows.ps1 -Remove    إلغاء التشغيل التلقائي
param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$hub = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = (Get-Command node -ErrorAction Stop).Source
$data = Join-Path $env:LOCALAPPDATA 'FavoritesHub'
New-Item -ItemType Directory -Force $data | Out-Null
$startup = [Environment]::GetFolderPath('Startup')
$vbs = Join-Path $startup 'FavoritesHub.vbs'

if ($Remove) {
  if (Test-Path $vbs) { Remove-Item $vbs -Confirm:$false }
  Write-Output ('أُلغي التشغيل التلقائي. بياناتك باقية في ' + $data)
  exit 0
}

# مشغّل مخفي: يعيد تشغيل الخادم تلقائيًا إن توقف، ويكتب السجل في مجلد البيانات
$cmd = "cmd /c cd /d `"$hub`" && `"$node`" server.mjs >> `"$data\hub.log`" 2>&1"
$content = @"
Set sh = CreateObject("WScript.Shell")
Do
  sh.Run "$($cmd.Replace('"','""'))", 0, True
  WScript.Sleep 30000
Loop
"@
Set-Content -Path $vbs -Value $content -Encoding ASCII
Start-Process wscript.exe -ArgumentList "`"$vbs`"" -WindowStyle Hidden
Start-Sleep 3
try { $h = Invoke-RestMethod http://127.0.0.1:7710/health -TimeoutSec 5; Write-Output "Favorites Hub يعمل ✓  لوحة التحكم: http://127.0.0.1:7710/" }
catch { Write-Output "لم يستجب الخادم بعد. راجع السجل: $data\hub.log" }
Write-Output ''
Write-Output 'لتصل المزامنة من الجوال وNuvio على التلفاز (نفس الشبكة)، اسمح بالمنفذ 7710 في جدار الحماية مرة واحدة (PowerShell كمدير):'
Write-Output '  New-NetFirewallRule -DisplayName "Favorites Hub" -Direction Inbound -Protocol TCP -LocalPort 7710 -Profile Private -Action Allow'
