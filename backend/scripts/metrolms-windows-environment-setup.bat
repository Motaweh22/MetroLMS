@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================================
REM MetroLMS - Portable Windows Environment Setup & Verification Utility
REM Supports: Windows 10/11 Workstations & Windows Server 2019/2022/2025
REM Self-contained single .bat file (extracts temporary PS1 to %TEMP% and cleans up)
REM ============================================================================

set "SELF_BAT=%~f0"
set "SCRIPT_DIR=%~dp0"
set "MODE=INTERACTIVE"
set "ELEVATED_GUARD=0"
set "NO_PAUSE=0"

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="/HELP" goto show_help
if /I "%~1"=="-HELP" goto show_help
if /I "%~1"=="/?" goto show_help
if /I "%~1"=="/CHECKONLY" set "MODE=CHECKONLY"
if /I "%~1"=="/INSTALL" set "MODE=INSTALL"
if /I "%~1"=="/ELEVATED" set "ELEVATED_GUARD=1"
if /I "%~1"=="/NOPAUSE" set "NO_PAUSE=1"
shift
goto parse_args

:show_help
echo.
echo MetroLMS Windows Environment Setup ^& Verification Utility
echo.
echo Usage:
echo   metrolms-windows-environment-setup.bat              Interactive check and guided setup
echo   metrolms-windows-environment-setup.bat /CHECKONLY   Read-only inspection, no installations
echo   metrolms-windows-environment-setup.bat /INSTALL     Install missing prerequisites after confirmation
echo   metrolms-windows-environment-setup.bat /NOPAUSE     Exit immediately without waiting for keypress
echo   metrolms-windows-environment-setup.bat /HELP        Show this help message
echo.
exit /b 0

:args_done
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM Resolve backend directory relative to this script (backend\scripts\ -> backend\)
set "BACKEND_DIR="
if exist "%SCRIPT_DIR%\..\manage.py" if exist "%SCRIPT_DIR%\..\requirements.txt" (
    for %%I in ("%SCRIPT_DIR%\..") do set "BACKEND_DIR=%%~fI"
)
if not defined BACKEND_DIR (
    if exist "%CD%\manage.py" if exist "%CD%\requirements.txt" set "BACKEND_DIR=%CD%"
)
if not defined BACKEND_DIR (
    if exist "%CD%\backend\manage.py" if exist "%CD%\backend\requirements.txt" set "BACKEND_DIR=%CD%\backend"
)

set "TEMP_PS1=%TEMP%\metrolms-env-setup-%RANDOM%-%RANDOM%.ps1"

REM Extract embedded PowerShell payload below marker ::PS_PAYLOAD_START::
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$lines = Get-Content -LiteralPath '%SELF_BAT%' -Encoding UTF8; " ^
  "$idx = [Array]::IndexOf($lines, '::PS_PAYLOAD_START::'); " ^
  "if ($idx -lt 0) { Write-Error 'Embedded payload marker not found.'; exit 2 }; " ^
  "$payload = $lines[($idx + 1)..($lines.Length - 1)]; " ^
  "Set-Content -LiteralPath '%TEMP_PS1%' -Value $payload -Encoding UTF8"

if errorlevel 1 (
    echo.
    echo =====================================================================
    echo  [FAILURE] Failed to extract temporary setup helper ^(Exit Code: 2^).
    echo =====================================================================
    if "%NO_PAUSE%"=="0" pause
    exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%TEMP_PS1%" -Mode "%MODE%" -BackendDir "%BACKEND_DIR%" -SelfBatPath "%SELF_BAT%" -ElevatedGuard "%ELEVATED_GUARD%"
set "EXIT_CODE=%ERRORLEVEL%"

if exist "%TEMP_PS1%" del /F /Q "%TEMP_PS1%" >nul 2>&1

echo.
if "%EXIT_CODE%"=="0" (
    echo =====================================================================
    echo  [SUCCESS] MetroLMS environment setup/verification completed ^(Exit Code: 0^).
    echo =====================================================================
) else (
    echo =====================================================================
    echo  [FAILURE] MetroLMS environment check/setup reported issues ^(Exit Code: %EXIT_CODE%^).
    echo  Review the summary and diagnostic log above for details.
    echo =====================================================================
)
if "%NO_PAUSE%"=="0" pause
exit /b %EXIT_CODE%

::PS_PAYLOAD_START::
param(
    [string]$Mode = "INTERACTIVE",
    [string]$BackendDir = "",
    [string]$SelfBatPath = "",
    [string]$ElevatedGuard = "0"
)

$ErrorActionPreference = "Stop"

# --- Logging setup (strictly outside Git tree) ---
$LogDir = Join-Path $env:LOCALAPPDATA "MetroLMS\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $LogDir "env-setup-$Timestamp.log"

function Write-Log {
    param([string]$Message, [string]$Color = "Gray")
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $Message"
    Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
    Write-Host $Message -ForegroundColor $Color
}

function Prompt-YesNo {
    param([string]$Question, [bool]$DefaultYes = $true)
    if ($Mode -eq "CHECKONLY") { return $false }
    $suffix = if ($DefaultYes) { "[Y/n]" } else { "[y/N]" }
    $ans = Read-Host "$Question $suffix"
    if ([string]::IsNullOrWhiteSpace($ans)) { return $DefaultYes }
    return ($ans.Trim().ToUpper() -in @("Y", "YES"))
}

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Request-ElevationIfWanted {
    param([string]$Reason)
    if (Test-IsAdmin) { return $true }
    if ($Mode -eq "CHECKONLY" -or $ElevatedGuard -eq "1") { return $false }
    Write-Log "Administrator privileges are needed to: $Reason" "Yellow"
    if (Prompt-YesNo "Relaunch elevated via UAC?" $false) {
        $argList = "/c `"`"$SelfBatPath`" /$Mode /ELEVATED`""
        try {
            Start-Process -FilePath "cmd.exe" -ArgumentList $argList -Verb RunAs -Wait
            exit 0
        } catch {
            Write-Log "UAC elevation declined or cancelled. Continuing with read-only checks." "Yellow"
            return $false
        }
    }
    return $false
}

function Verify-Authenticode {
    param([string]$FilePath)
    $sig = Get-AuthenticodeSignature -LiteralPath $FilePath
    if ($sig.Status -ne "Valid") {
        throw "Authenticode signature verification FAILED for $FilePath (Status: $($sig.Status))."
    }
    Write-Log "Verified signature: $($sig.SignerCertificate.Subject)" "Green"
}

Write-Log "=====================================================================" "Cyan"
Write-Log " MetroLMS Windows Environment Setup & Verification ($Mode)" "Cyan"
Write-Log " Diagnostic Log: $LogFile" "DarkGray"
Write-Log "=====================================================================" "Cyan"

$Summary = [ordered]@{
    "Operating System"       = "UNKNOWN"
    "OS Architecture"        = "UNKNOWN"
    "Windows Server Baseline"= "NOT APPLICABLE"
    "Python 3.12 (x64)"      = "BLOCKED"
    "Virtual Environment"    = "BLOCKED"
    "Django Dependencies"    = "BLOCKED"
    "ODBC Driver 18 (x64)"   = "BLOCKED"
    "SQL Server Location"    = "NOT APPLICABLE"
    "SQL Server Endpoint"    = "NOT APPLICABLE"
    "Network Connectivity"   = "NOT APPLICABLE"
    "SQL Authentication"     = "NOT APPLICABLE"
    "sqlcmd Utility"         = "WARNING"
    "Django System Checks"   = "BLOCKED"
    "Production Readiness"   = "BLOCKED"
}

# -----------------------------------------------------------------------------
# C1. Operating System Detection
# -----------------------------------------------------------------------------
$os = Get-CimInstance Win32_OperatingSystem
$isServer = ($os.ProductType -ne 1)
$is64 = [Environment]::Is64BitOperatingSystem
$isAdmin = Test-IsAdmin
$psVer = $PSVersionTable.PSVersion.ToString()
$Summary["Operating System"] = "$($os.Caption) (Build $($os.BuildNumber))"
$Summary["OS Architecture"] = if ($is64) { "x64 (64-bit)" } else { "x86 (32-bit)" }

Write-Log "OS           : $($Summary['Operating System']) | Type: $(if($isServer){'Windows Server'}else{'Workstation'})" "White"
Write-Log "Architecture : $($Summary['OS Architecture']) | User: $env:USERDOMAIN\$env:USERNAME | Admin: $isAdmin | PS: $psVer" "White"

if ($isServer) {
    if ($os.Caption -match "2022") {
        $Summary["Windows Server Baseline"] = "PASS (Windows Server 2022)"
    } else {
        $Summary["Windows Server Baseline"] = "WARNING (Non-2022 Server: $($os.Caption))"
    }
} else {
    $Summary["Windows Server Baseline"] = "NOT APPLICABLE (Workstation Dev Mode)"
}

if ([int]$os.BuildNumber -lt 19041) {
    Write-Log "WARNING: Windows build $($os.BuildNumber) may be outdated or out of Microsoft support." "Yellow"
}

# Backend directory resolution fallback prompt
while ([string]::IsNullOrWhiteSpace($BackendDir) -or -not (Test-Path (Join-Path $BackendDir "manage.py"))) {
    if ($Mode -eq "CHECKONLY") {
        Write-Log "BLOCKED: Could not locate backend/ directory containing manage.py." "Red"
        break
    }
    $BackendDir = Read-Host "Enter the full path to the MetroLMS backend/ directory"
}

if ($BackendDir -and (Test-Path $BackendDir)) {
    $driveRoot = (Get-Item $BackendDir).PSDrive.Name
    $disk = Get-PSDrive -Name $driveRoot
    $freeGb = [math]::Round($disk.Free / 1GB, 2)
    Write-Log "Backend Dir  : $BackendDir (Free disk on ${driveRoot}: ${freeGb} GB)" "White"
}

try {
    $netOk = (Test-NetConnection -ComputerName "www.python.org" -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue)
    Write-Log "Internet HTTPS (python.org:443): $(if($netOk){'Reachable'}else{'Unreachable'})" "White"
} catch {
    Write-Log "Internet HTTPS check skipped/failed." "Yellow"
}

# -----------------------------------------------------------------------------
# C2. Python 3.12 x64 Detection & Optional Installation
# -----------------------------------------------------------------------------
function Find-Python312 {
    try {
        $out = & py -3.12 -c "import sys, struct; print(sys.executable); print(struct.calcsize('P')*8); print(sys.version.split()[0])" 2>$null
        if ($LASTEXITCODE -eq 0 -and $out.Count -ge 3 -and $out[1].Trim() -eq "64") {
            return @{ Path = $out[0].Trim(); Arch = "64"; Version = $out[2].Trim() }
        }
    } catch {}
    return $null
}

$py312 = Find-Python312
if ($py312) {
    Write-Log "Python 3.12  : PASS ($($py312.Version) x64 at $($py312.Path))" "Green"
    $Summary["Python 3.12 (x64)"] = "PASS ($($py312.Version))"
} else {
    Write-Log "Python 3.12 x64 not found." "Yellow"
    if ($Mode -ne "CHECKONLY" -and (Prompt-YesNo "Install Python 3.12 x64 (Publisher: Python Software Foundation)?" $true)) {
        $installed = $false
        if (Get-Command winget -ErrorAction SilentlyContinue) {
            Write-Log "Attempting winget install Python.Python.3.12..." "Cyan"
            & winget install --exact --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements --silent
            if ($LASTEXITCODE -eq 0) { $installed = $true }
        }
        if (-not $installed) {
            $pyInstaller = Join-Path $env:TEMP "python-3.12.10-amd64.exe"
            $pyUrl = "https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe"
            Write-Log "Downloading official PSF installer from $pyUrl ..." "Cyan"
            Invoke-WebRequest -Uri $pyUrl -OutFile $pyInstaller -UseBasicParsing
            Verify-Authenticode $pyInstaller
            Write-Log "Installing Python 3.12.10 x64 (preserving existing Python versions)..." "Cyan"
            $p = Start-Process -FilePath $pyInstaller -ArgumentList "/quiet InstallAllUsers=0 PrependPath=0 Include_launcher=1" -Wait -PassThru
            Remove-Item -LiteralPath $pyInstaller -Force -ErrorAction SilentlyContinue
            if ($p.ExitCode -ne 0) { Write-Log "Python installer exited with code $($p.ExitCode)" "Red" }
        }
        $py312 = Find-Python312
        if ($py312) {
            Write-Log "Python 3.12  : PASS ($($py312.Version) x64 at $($py312.Path))" "Green"
            $Summary["Python 3.12 (x64)"] = "PASS ($($py312.Version))"
        }
    }
}

# -----------------------------------------------------------------------------
# C3. Microsoft ODBC Driver 18 (x64) & VC++ Runtime Detection
# -----------------------------------------------------------------------------
$odbc18 = Get-OdbcDriver -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "ODBC Driver 18 for SQL Server" -and $_.Platform -eq "64-bit" }
$vcppOk = Test-Path "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64"
Write-Log "VC++ 2015-2022 x64 Runtime: $(if($vcppOk){'Present'}else{'Not detected'})" "White"

if ($odbc18) {
    Write-Log "ODBC Driver 18 (64-bit): PASS" "Green"
    $Summary["ODBC Driver 18 (x64)"] = "PASS"
} else {
    Write-Log "ODBC Driver 18 for SQL Server (64-bit) is missing." "Yellow"
    if ($Mode -ne "CHECKONLY" -and (Prompt-YesNo "Install Microsoft ODBC Driver 18 for SQL Server x64 (Publisher: Microsoft Corporation)?" $false)) {
        if (Request-ElevationIfWanted "Install Microsoft ODBC Driver 18 for SQL Server (machine-wide)") {
            $ok = $false
            if (Get-Command winget -ErrorAction SilentlyContinue) {
                & winget install --exact --id Microsoft.msodbcsql.18 --accept-package-agreements --accept-source-agreements --silent
                if ($LASTEXITCODE -eq 0) { $ok = $true }
            }
            if (-not $ok) {
                $msi = Join-Path $env:TEMP "msodbcsql18_x64.msi"
                Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/?linkid=2266337" -OutFile $msi -UseBasicParsing
                Verify-Authenticode $msi
                $p = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$msi`" IACCEPTMSODBCSQLLICENSETERMS=YES /qn" -Wait -PassThru
                Remove-Item -LiteralPath $msi -Force -ErrorAction SilentlyContinue
            }
            $odbc18 = Get-OdbcDriver -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "ODBC Driver 18 for SQL Server" -and $_.Platform -eq "64-bit" }
            if ($odbc18) { $Summary["ODBC Driver 18 (x64)"] = "PASS" }
        }
    }
}

# -----------------------------------------------------------------------------
# C4. Virtual Environment & Dependencies
# -----------------------------------------------------------------------------
$venvPy = if ($BackendDir) { Join-Path $BackendDir ".venv\Scripts\python.exe" } else { "" }
$reqFile = if ($BackendDir) { Join-Path $BackendDir "requirements.txt" } else { "" }

if ($py312 -and $BackendDir -and (Test-Path $reqFile)) {
    $venvOk = $false
    if (Test-Path $venvPy) {
        $vver = & $venvPy -c "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')" 2>$null
        if ($vver -eq "3.12") {
            $venvOk = $true
            $Summary["Virtual Environment"] = "PASS"
        } else {
            Write-Log "WARNING: Existing .venv uses Python $vver (expected 3.12)." "Yellow"
            if ($Mode -ne "CHECKONLY" -and (Prompt-YesNo "Back up existing .venv and recreate with Python 3.12?" $false)) {
                Rename-Item -LiteralPath (Join-Path $BackendDir ".venv") -NewName ".venv.bak-$Timestamp"
                & py -3.12 -m venv (Join-Path $BackendDir ".venv")
                if ($LASTEXITCODE -eq 0) { $venvOk = $true; $Summary["Virtual Environment"] = "PASS" }
            }
        }
    } elseif ($Mode -ne "CHECKONLY" -and (Prompt-YesNo "Create Python 3.12 virtual environment at backend\.venv?" $true)) {
        & py -3.12 -m venv (Join-Path $BackendDir ".venv")
        if ($LASTEXITCODE -eq 0) { $venvOk = $true; $Summary["Virtual Environment"] = "PASS" }
    }

    if ($venvOk) {
        & $venvPy -m pip check *> $null
        if ($LASTEXITCODE -ne 0 -and $Mode -ne "CHECKONLY") {
            if (Prompt-YesNo "Install/update dependencies from backend\requirements.txt inside .venv?" $true) {
                & $venvPy -m pip install --upgrade pip
                & $venvPy -m pip install -r $reqFile
            }
        }
        $chkOut = & $venvPy -m pip check 2>&1
        $impOk = $false
        & $venvPy -c "import django, rest_framework, mssql, pyodbc, mssql_python, tzdata" 2>$null
        if ($LASTEXITCODE -eq 0) { $impOk = $true }
        if ($LASTEXITCODE -eq 0 -and $impOk) {
            $Summary["Django Dependencies"] = "PASS"
            Write-Log "Dependencies : PASS (pip check + core imports OK)" "Green"
        } else {
            $Summary["Django Dependencies"] = "WARNING (Incomplete or pip check issue)"
            Write-Log "Dependencies : WARNING ($chkOut)" "Yellow"
        }
    }
}

# -----------------------------------------------------------------------------
# C5, D & E. SQL Server Detection, Local/Remote Selection & Connectivity
# -----------------------------------------------------------------------------
$sqlServices = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "MSSQLSERVER" -or $_.Name -like "MSSQL$*" }
$sqlBrowser = Get-Service -Name "SQLBrowser" -ErrorAction SilentlyContinue
$sqlcmdExe = Get-Command sqlcmd.exe -ErrorAction SilentlyContinue

if ($sqlcmdExe) {
    $Summary["sqlcmd Utility"] = "PASS"
    Write-Log "sqlcmd       : PASS ($($sqlcmdExe.Source))" "Green"
} else {
    $Summary["sqlcmd Utility"] = "NOT APPLICABLE (Optional; pyodbc primary)"
    Write-Log "sqlcmd       : Not installed (optional diagnostic tool)" "Yellow"
}

Write-Log "Detected Local SQL Services: $(if($sqlServices){ ($sqlServices | ForEach-Object { "$($_.Name) [$($_.Status)]" }) -join ', ' } else { 'None' })" "White"
Write-Log "SQLBrowser   : $(if($sqlBrowser){ $sqlBrowser.Status } else { 'Not installed' })" "White"

$targetServer = $null
$isLocalChoice = $true
if ($Mode -eq "CHECKONLY") {
    $Summary["SQL Server Location"] = if ($sqlServices) { "Local (Auto-Checked)" } else { "None Detected" }
    if ($sqlServices | Where-Object { $_.Name -eq "MSSQLSERVER" -and $_.Status -eq "Running" }) {
        $targetServer = "localhost"
    }
} else {
    $isLocalChoice = Prompt-YesNo "Is the MetroLMS SQL Server instance hosted on this same machine?" ($null -ne $sqlServices)
    if ($isLocalChoice) {
        $Summary["SQL Server Location"] = "Local"
        if ($sqlServices) {
            $instList = @($sqlServices | ForEach-Object { if ($_.Name -eq "MSSQLSERVER") { "localhost" } else { "localhost\$($_.Name.Substring(6))" } })
            Write-Log "Available local instances: $($instList -join ', ')" "Cyan"
            if ($instList.Count -eq 1) {
                $targetServer = $instList[0]
            } else {
                $sel = Read-Host "Enter local instance from above [$($instList[0])]"
                $targetServer = if ([string]::IsNullOrWhiteSpace($sel)) { $instList[0] } else { $sel.Trim() }
            }
        } else {
            $Summary["SQL Authentication"] = "BLOCKED (No local SQL instance installed)"
        }
    } else {
        $Summary["SQL Server Location"] = "Remote"
        $targetServer = (Read-Host "Enter the SQL Server server address or instance (e.g. SQLSERVER01, SQLSERVER01\INSTANCE01, tcp:192.168.1.50,1433)").Trim()
    }
}

if (-not [string]::IsNullOrWhiteSpace($targetServer)) {
    $Summary["SQL Server Endpoint"] = $targetServer
    # Parse host and optional explicit TCP port
    $cleanHost = $targetServer -replace '^tcp:', ''
    $explicitPort = $null
    if ($cleanHost -match '^([^,\\]+),(\d+)$') {
        $cleanHost = $matches[1]
        $explicitPort = [int]$matches[2]
    } elseif ($cleanHost -match '^([^\\]+)\\.+$') {
        $cleanHost = $matches[1]
    }

    # DNS & TCP test
    try {
        [void][System.Net.Dns]::GetHostAddresses($cleanHost)
        Write-Log "DNS Lookup   : PASS ($cleanHost resolved)" "Green"
        if ($explicitPort) {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $iar = $tcp.BeginConnect($cleanHost, $explicitPort, $null, $null)
            $ok = $iar.AsyncWaitHandle.WaitOne(3000, $false)
            if ($ok -and $tcp.Connected) {
                $tcp.EndConnect($iar)
                $Summary["Network Connectivity"] = "PASS (TCP $explicitPort)"
            } else {
                $Summary["Network Connectivity"] = "BLOCKED (TCP $explicitPort unreachable)"
            }
            $tcp.Close()
        } elseif ($isLocalChoice) {
            $Summary["Network Connectivity"] = "PASS (Local Host)"
        } else {
            $Summary["Network Connectivity"] = "WARNING (DNS OK; named-instance/default port unprobed)"
        }
    } catch {
        $Summary["Network Connectivity"] = "BLOCKED (DNS/Host resolution failed for $cleanHost)"
    }

    # Authenticated SQL check via pyodbc (Trusted_Connection) or sqlcmd (never logs passwords)
    $authOk = $false
    if ((Test-Path $venvPy) -and $odbc18) {
        try {
            $verOut = & $venvPy -c "import pyodbc, sys; c=pyodbc.connect(f'Driver={{ODBC Driver 18 for SQL Server}};Server={sys.argv[1]};Trusted_Connection=yes;TrustServerCertificate=yes;', timeout=5); r=c.cursor().execute('SELECT CAST(SERVERPROPERTY(\'ProductVersion\') AS NVARCHAR(50)), CAST(SERVERPROPERTY(\'Edition\') AS NVARCHAR(100))').fetchone(); print(r[0], '|', r[1]); c.close()" $targetServer 2>&1
            if ($LASTEXITCODE -eq 0) {
                $authOk = $true
                $Summary["SQL Authentication"] = "PASS ($($verOut.Trim()))"
                Write-Log "SQL Server   : PASS ($($verOut.Trim()))" "Green"
                if ($verOut -notmatch '^16\.') {
                    Write-Log "NOTE: Detected SQL version is not SQL Server 2022 (16.x); SQL Server 2022 remains the production target." "Yellow"
                }
            } else {
                $Summary["SQL Authentication"] = "WARNING (pyodbc auth failed: check Windows Auth / TLS / firewall)"
            }
        } catch {
            $Summary["SQL Authentication"] = "WARNING (pyodbc check error)"
        }
    } elseif ($sqlcmdExe) {
        $scOut = & sqlcmd -S $targetServer -E -C -h -1 -Q "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(50))" 2>&1
        if ($LASTEXITCODE -eq 0) {
            $authOk = $true
            $Summary["SQL Authentication"] = "PASS (SQL $($scOut.Trim()))"
        } else {
            $Summary["SQL Authentication"] = "WARNING (sqlcmd auth failed)"
        }
    }
}

# -----------------------------------------------------------------------------
# Django System Checks (read-only)
# -----------------------------------------------------------------------------
if ((Test-Path $venvPy) -and ($Summary["Django Dependencies"] -eq "PASS") -and $BackendDir) {
    Push-Location $BackendDir
    try {
        $chkAllOk = $true
        foreach ($cfg in @("config.settings.development", "config.settings.testing", "config.settings.production")) {
            & $venvPy manage.py check --settings=$cfg *> $null
            if ($LASTEXITCODE -ne 0) { $chkAllOk = $false }
        }
        if ($chkAllOk) {
            $Summary["Django System Checks"] = "PASS (dev/test/prod)"
        } else {
            $Summary["Django System Checks"] = "BLOCKED (manage.py check failed)"
        }
    } finally {
        Pop-Location
    }
}

$Summary["Production Readiness"] = if ($isServer -and $os.Caption -match "2022" -and $Summary["Django System Checks"] -like "PASS*") {
    "WARNING (Pending DB Provisioning & Prod Infra)"
} else {
    "NOT APPLICABLE (Dev Workstation / Pending Prod Infra)"
}

Write-Log "" "White"
Write-Log "MetroLMS Windows Environment Assessment" "Cyan"
Write-Log "-----------------------------------------" "Cyan"
foreach ($k in $Summary.Keys) {
    Write-Log ("{0,-24}: {1}" -f $k, $Summary[$k]) "White"
}
Write-Log "-----------------------------------------" "Cyan"
if ($Summary["Python 3.12 (x64)"] -like "PASS*" -and $Summary["Django System Checks"] -like "PASS*") {
    Write-Log "Result: LOCAL ENVIRONMENT READY" "Green"
    exit 0
} else {
    Write-Log "Result: ACTION REQUIRED (See summary above)" "Yellow"
    exit 1
}
