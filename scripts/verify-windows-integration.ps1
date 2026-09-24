param([Parameter(Mandatory = $true)][string]$Installer)
$ErrorActionPreference = 'Stop'
if ($env:CI -ne 'true' -or !$env:RUNNER_TEMP) {
  throw 'Installer verification is restricted to disposable CI runners.'
}
$installDir = Join-Path $env:RUNNER_TEMP ('inklura-shell-' + [guid]::NewGuid())
$appPath = Join-Path $installDir 'Inklura PDF.exe'
$classes = 'HKCU:\Software\Classes'
$ownedKeys = @(
  'com.benfavre.caviard.pdf',
  'SystemFileAssociations\.pdf\shell\InkluraPDF',
  'Directory\shell\InkluraPDF',
  'Directory\Background\shell\InkluraPDF'
)
function PdfDefault {
  $key = Get-Item "$classes\.pdf" -ErrorAction SilentlyContinue
  if ($key) { return $key.GetValue('') }
  return $null
}
function StopTestApp {
  Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $appPath } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
function RunInstaller([string]$file, [string]$arguments) {
  $process = Start-Process -FilePath $file -ArgumentList $arguments -PassThru
  if (!$process.WaitForExit(120000)) { throw 'Installer timed out.' }
  if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
}
$before = PdfDefault
try {
  RunInstaller (Resolve-Path $Installer).Path "/S /currentuser /D=$installDir"
  if (!(Test-Path $appPath)) { throw 'Installed executable missing.' }
  StopTestApp
  foreach ($key in $ownedKeys) {
    if (!(Test-Path "$classes\$key")) { throw "Shell registration missing: $key" }
    $verb = if ($key -eq 'com.benfavre.caviard.pdf') { "$key\shell\open" } else { $key }
    $command = (Get-Item "$classes\$verb\command").GetValue('')
    $argument = if ($key.Contains('Background')) { '%V' } else { '%1' }
    if ($command -ne ('"' + $appPath + '" "' + $argument + '"')) {
      throw "Unexpected shell command for $key : $command"
    }
  }
  $openWith = Get-Item "$classes\.pdf\OpenWithProgids"
  if ('com.benfavre.caviard.pdf' -notin $openWith.GetValueNames()) { throw 'Open With registration missing.' }
  if ((PdfDefault) -ne $before) { throw 'Default PDF reader was changed.' }
  Write-Output 'Installed PDF and folder shell commands verified; default reader preserved.'
} finally {
  StopTestApp
  $uninstaller = Get-ChildItem $installDir -Filter '*uninstall*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($uninstaller) {
    RunInstaller $uninstaller.FullName '/S /currentuser'
    $deadline = (Get-Date).AddSeconds(60)
    while ((Test-Path "$classes\com.benfavre.caviard.pdf") -and (Get-Date) -lt $deadline) {
      Start-Sleep -Milliseconds 500
    }
    foreach ($key in $ownedKeys) {
      if (Test-Path "$classes\$key") { throw "Uninstall left shell registration: $key" }
    }
    $openWith = Get-Item "$classes\.pdf\OpenWithProgids" -ErrorAction SilentlyContinue
    if ($openWith -and 'com.benfavre.caviard.pdf' -in $openWith.GetValueNames()) { throw 'Uninstall left Open With registration.' }
    if ((PdfDefault) -ne $before) { throw 'Uninstall changed the default PDF reader.' }
    Write-Output 'Uninstall removed the owned registrations.'
  }
}
