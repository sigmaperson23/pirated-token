# Switchyard shell marks. They tell the app when a command starts and ends, and which folder is open.
$global:__sy_token = [string]$env:SWITCHYARD_TOKEN
$__sy_startup = [string]$env:SWITCHYARD_STARTUP
Remove-Item Env:SWITCHYARD_TOKEN, Env:SWITCHYARD_STARTUP -ErrorAction SilentlyContinue
$global:__sy_busy = $false
$global:__sy_user_prompt = $function:prompt

function global:__sy_osc([string]$body) {
    [Console]::Write("$([char]27)]$body$([char]7)")
}

if (Test-Path Function:\PSConsoleHostReadLine) {
    $global:__sy_readline = $function:PSConsoleHostReadLine
    function global:PSConsoleHostReadLine {
        $line = & $global:__sy_readline
        if ($line -and $line.Trim()) {
            $global:__sy_busy = $true
            $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($line))
            __sy_osc "5151;cmd;$global:__sy_token;$encoded"
            __sy_osc "133;C;$global:__sy_token"
        }
        $line
    }
}

function global:prompt {
    $ok = $global:?
    $code = if ($ok) { 0 } elseif ($global:LASTEXITCODE) { $global:LASTEXITCODE } else { 1 }
    if ($global:__sy_busy) {
        __sy_osc "133;D;$code;$global:__sy_token"
        $global:__sy_busy = $false
    }
    try { __sy_osc "5151;cwd;$global:__sy_token;$((Get-Location).Path)" } catch { }
    __sy_osc "133;A;$global:__sy_token"
    if ($global:__sy_user_prompt) { & $global:__sy_user_prompt } else { "PS $(Get-Location)> " }
}

if ($__sy_startup) {
    $global:__sy_busy = $true
    __sy_osc "133;C;$global:__sy_token"
    Invoke-Expression $__sy_startup
}
