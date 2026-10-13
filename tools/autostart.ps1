# Richtet den Autostart des Hilfsdienstes ein bzw. entfernt ihn (Verknuepfung im Autostart-Ordner, keine Adminrechte noetig)
# Aufruf: powershell -File tools\autostart.ps1 einrichten|entfernen
param([ValidateSet('einrichten', 'entfernen')][string]$Aktion = 'einrichten')
$startup = [Environment]::GetFolderPath('Startup')
$lnk = Join-Path $startup 'Faecheruebersicht Hilfsdienst.lnk'
$vbs = Join-Path $PSScriptRoot 'server-unsichtbar.vbs'

function Stop-Dienst {
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -like '*tools*server.mjs*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
}

if ($Aktion -eq 'einrichten') {
  $sh = New-Object -ComObject WScript.Shell
  $s = $sh.CreateShortcut($lnk)
  $s.TargetPath = "$env:WINDIR\System32\wscript.exe"
  $s.Arguments = '"' + $vbs + '"'
  $s.WorkingDirectory = Split-Path $PSScriptRoot
  $s.Description = 'Faecheruebersicht: aktualisiert Termine und Pruefungen aus TUMonline'
  $s.Save()
  Stop-Dienst
  Start-Process "$env:WINDIR\System32\wscript.exe" -ArgumentList ('"' + $vbs + '"')
  Write-Host "Autostart eingerichtet: $lnk"
  Write-Host 'Der Hilfsdienst laeuft jetzt und startet kuenftig bei jeder Anmeldung automatisch.'
} else {
  if (Test-Path $lnk) { Remove-Item $lnk }
  Stop-Dienst
  Write-Host 'Autostart entfernt und Hilfsdienst beendet.'
}
