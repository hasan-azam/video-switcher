# Builds dist\Video Switcher.zip: a self-contained copy someone can unzip on a
# fresh Windows PC and run by double-clicking "Start Video Switcher.bat".
#
# It bundles a trimmed copy of Python, so the other computer needs nothing installed.
#
# Usage (from the repo root):
#   powershell -ExecutionPolicy Bypass -File scripts\make-share-zip.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\make-share-zip.ps1 -Python C:\path\to\python.exe

param(
    # Python to bundle. Defaults to the one found on this computer.
    [string]$Python
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$stage = Join-Path $dist "Video Switcher"
$zip = Join-Path $dist "Video Switcher.zip"

# --- Find a real Python install (not the Microsoft Store stub).
$py = $null
if ($Python) {
    if (-not (Test-Path $Python)) { throw "Python not found at $Python" }
    $py = (Resolve-Path $Python).Path
}
if (-not $py -and (Get-Command py -ErrorAction SilentlyContinue)) {
    $py = (& py -3 -c "import sys; print(sys.executable)").Trim()
}
if (-not $py) {
    $py = (Get-Command python -All -ErrorAction SilentlyContinue |
        Where-Object { $_.Source -notmatch "WindowsApps" } |
        Select-Object -First 1).Source
}
if (-not $py) { throw "No Python install found to bundle." }
$pyHome = Split-Path -Parent $py
$pyVer = (& $py -c "import sys; print(f'{sys.version_info[0]}{sys.version_info[1]}')").Trim()
Write-Host "Bundling Python from $pyHome (python$pyVer)"

# --- Fresh staging folder.
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
if (Test-Path $zip) { Remove-Item -Force $zip }
New-Item -ItemType Directory -Force $stage | Out-Null

# --- App files (only what's needed at runtime; no .git, node_modules, CI).
$appFiles = @("index.html", "setup.html", "server.py", "Start Video Switcher.bat")
foreach ($f in $appFiles) { Copy-Item (Join-Path $root $f) $stage }
Copy-Item (Join-Path $root "readme.txt") (Join-Path $stage "READ ME FIRST.txt")
foreach ($d in @("css", "js", "loadouts", "setup-dist", "videos")) {
    robocopy (Join-Path $root $d) (Join-Path $stage $d) /E /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copying $d failed" }
}

# --- Portable Python runtime.
$rt = Join-Path $stage "runtime\python"
New-Item -ItemType Directory -Force $rt | Out-Null
foreach ($f in @("python.exe", "python3.dll", "python$pyVer.dll", "vcruntime140.dll", "vcruntime140_1.dll", "LICENSE.txt")) {
    $src = Join-Path $pyHome $f
    if (Test-Path $src) { Copy-Item $src $rt }
}
robocopy (Join-Path $pyHome "Lib") (Join-Path $rt "Lib") /E /NFL /NDL /NJH /NJS /NP `
    /XD test tests idlelib tkinter turtledemo site-packages ensurepip __pycache__ | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Copying Python Lib failed" }
robocopy (Join-Path $pyHome "DLLs") (Join-Path $rt "DLLs") /E /NFL /NDL /NJH /NJS /NP `
    /XF tcl*.dll tk*.dll _tkinter.pyd | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Copying Python DLLs failed" }

# A ._pth file makes this Python ignore any PYTHONPATH/PYTHONHOME or other
# Python installs on the destination computer.
Set-Content -Encoding ascii (Join-Path $rt "python$pyVer._pth") "Lib`r`nDLLs`r`n."

# --- Sanity check: the bundled runtime can import what server.py needs.
& (Join-Path $rt "python.exe") -c "import http.server, json, webbrowser, socketserver; print('runtime ok')"
if ($LASTEXITCODE -ne 0) { throw "Bundled Python failed its self-test" }

# --- Zip it (Windows' built-in tar writes real .zip files, fast).
Push-Location $dist
try { tar -a -c -f "Video Switcher.zip" "Video Switcher" } finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { throw "Zipping failed" }

$mb = [math]::Round((Get-Item $zip).Length / 1MB)
Write-Host "Done: $zip ($mb MB)"
