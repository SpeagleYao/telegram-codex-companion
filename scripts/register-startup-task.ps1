param(
  [string]$TaskName = "Telegram Codex Companion",
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$resolvedRoot = (Resolve-Path $ProjectRoot).Path
$npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
$workingCommand = "cd /d `"$resolvedRoot`" && `"$npmPath`" start"

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c $workingCommand"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description "Starts Telegram Codex Companion on user logon." `
  -Force
