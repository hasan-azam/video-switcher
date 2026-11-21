# Smoke-tests the shareable zip the way a friend's fresh PC would run it:
# unzip into an empty folder, double-click-equivalent the launcher with no
# Python on PATH, and check the app actually serves its pages, loadouts and
# every video a loadout points at.
#
# Usage (from the repo root, after make-share-zip.ps1):
#   powershell -ExecutionPolicy Bypass -File scripts\smoke-test-share-zip.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\smoke-test-share-zip.ps1 -Zip "path\to\some.zip"
#
# Exits 0 when everything passes, 1 otherwise.

param(
    [string]$Zip = (Join-Path (Split-Path -Parent $PSScriptRoot) "dist\Video Switcher.zip")
)

$ErrorActionPreference = "Stop"
$failures = New-Object System.Collections.Generic.List[string]
function Pass($msg) { Write-Host "  PASS  $msg" }
function Fail($msg) { Write-Host "  FAIL  $msg"; $failures.Add($msg) }

if (-not (Test-Path $Zip)) { throw "Zip not found: $Zip (run scripts\make-share-zip.ps1 first)" }

$work = Join-Path ([System.IO.Path]::GetTempPath()) ("vs-smoke-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
New-Item -ItemType Directory -Force $work | Out-Null
$proc = $null

try {
    Write-Host "Extracting $Zip"
    & "$env:SystemRoot\System32\tar.exe" -xf $Zip -C $work
    if ($LASTEXITCODE -ne 0) { throw "Extracting the zip failed" }

    # The zip holds one top-level folder; find the launcher inside it.
    $launcher = Get-ChildItem $work -Recurse -Filter "Start Video Switcher.bat" | Select-Object -First 1
    if (-not $launcher) { throw "Start Video Switcher.bat not found in zip" }
    $app = $launcher.DirectoryName

    Write-Host "Checking contents"
    foreach ($f in @("server.py", "index.html", "setup-dist\index.html", "runtime\python\python.exe", "READ ME FIRST.txt")) {
        if (Test-Path (Join-Path $app $f)) { Pass "has $f" } else { Fail "missing $f" }
    }

    # Every video any loadout references must be in the zip.
    $referenced = @()
    foreach ($lf in Get-ChildItem (Join-Path $app "loadouts") -Filter *.json) {
        $json = Get-Content $lf.FullName -Raw | ConvertFrom-Json
        $srcs = @($json.initial.src) + @($json.bindings.PSObject.Properties | ForEach-Object { $_.Value.src })
        foreach ($s in $srcs) { if ($s) { $referenced += [pscustomobject]@{ Loadout = $json.name; Src = $s } } }
    }
    foreach ($r in $referenced) {
        if (-not (Test-Path -LiteralPath (Join-Path $app $r.Src))) { Fail "loadout '$($r.Loadout)' points at missing $($r.Src)" }
    }
    Pass "$($referenced.Count) loadout video references checked on disk"

    Write-Host "Starting launcher with no Python on PATH"
    $psi = New-Object System.Diagnostics.ProcessStartInfo "cmd.exe", "/c `"`"$($launcher.FullName)`"`""
    $psi.WorkingDirectory = $app
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardInput = $true   # closed below so the launcher's "pause" can't hang
    $psi.EnvironmentVariables["PATH"] = "$env:SystemRoot\System32;$env:SystemRoot"
    $psi.EnvironmentVariables["VIDEO_SWITCHER_NO_BROWSER"] = "1"
    $proc = [System.Diagnostics.Process]::Start($psi)
    $proc.StandardInput.Close()

    # The server picks the first free port from 8000 and logs it.
    $log = Join-Path $app "server.log"
    $port = $null
    $deadline = (Get-Date).AddSeconds(30)
    while (-not $port -and (Get-Date) -lt $deadline) {
        if (Test-Path $log) {
            $m = Select-String -Path $log -Pattern "Serving on 127\.0\.0\.1:(\d+)" | Select-Object -First 1
            if ($m) { $port = $m.Matches[0].Groups[1].Value }
        }
        if (-not $port) { Start-Sleep -Milliseconds 250 }
    }
    if (-not $port) { throw "Server never reported a port (see $log)" }
    Pass "server listening on port $port"

    $py = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.ExecutablePath -like "$app*" }
    if ($py) { Pass "running on the bundled Python" } else { Fail "server is not running on the bundled Python" }

    $base = "http://127.0.0.1:$port"
    function Get-Url($path, $method = "Get") {
        Invoke-WebRequest -UseBasicParsing -Method $method -TimeoutSec 15 "$base/$path"
    }

    Write-Host "Checking pages and API"
    foreach ($p in @("index.html", "setup/")) {
        try { $r = Get-Url $p; if ($r.StatusCode -eq 200) { Pass "GET /$p" } else { Fail "GET /$p -> $($r.StatusCode)" } }
        catch { Fail "GET /$p -> $_" }
    }

    try {
        $names = (Get-Url "api/loadouts").Content | ConvertFrom-Json | Select-Object -ExpandProperty loadouts
        if (@($names).Count -gt 0) { Pass "GET /api/loadouts ($(@($names) -join ', '))" } else { Fail "no loadouts served" }
        foreach ($n in $names) {
            try { Get-Url ("api/loadouts/" + [uri]::EscapeDataString($n)) | Out-Null; Pass "GET loadout '$n'" }
            catch { Fail "GET loadout '$n' -> $_" }
        }
    } catch { Fail "GET /api/loadouts -> $_" }

    try {
        $videos = (Get-Url "api/videos").Content | ConvertFrom-Json | Select-Object -ExpandProperty videos
        Pass "GET /api/videos ($(@($videos).Count) videos)"
    } catch { Fail "GET /api/videos -> $_" }

    Write-Host "Checking every loadout video is served"
    $served = 0
    foreach ($src in ($referenced | Select-Object -ExpandProperty Src -Unique)) {
        $url = ($src -split "/" | ForEach-Object { [uri]::EscapeDataString($_) }) -join "/"
        try {
            $r = Get-Url $url "Head"
            if ($r.StatusCode -eq 200 -and $r.Headers["Content-Type"] -like "video/*") { $served++ }
            else { Fail "HEAD /$src -> $($r.StatusCode) $($r.Headers['Content-Type'])" }
        } catch { Fail "HEAD /$src -> $_" }
    }
    Pass "$served videos served with a video content type"
}
catch {
    Fail $_.Exception.Message
}
finally {
    # Stop the bundled server, let the launcher exit, then clean up.
    Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
        Where-Object { $_.ExecutablePath -like "$work*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    if ($proc -and -not $proc.WaitForExit(10000)) { $proc.Kill() }
    for ($i = 0; $i -lt 10 -and (Test-Path $work); $i++) {
        try { Remove-Item -Recurse -Force $work -ErrorAction Stop } catch { Start-Sleep -Milliseconds 500 }
    }
}

Write-Host ""
if ($failures.Count -gt 0) {
    Write-Host "SMOKE TEST FAILED ($($failures.Count) problem(s))"
    exit 1
}
Write-Host "SMOKE TEST PASSED"
exit 0
