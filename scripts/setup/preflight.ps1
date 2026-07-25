#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..'))
Push-Location $RootDir

$failCount = 0
$warnCount = 0

function Fail([string]$msg) {
    Write-Host "FAIL: $msg" -ForegroundColor Red
    $script:failCount++
}

function Warn([string]$msg) {
    Write-Host "WARN: $msg" -ForegroundColor Yellow
    $script:warnCount++
}

function Pass([string]$msg) {
    Write-Host "PASS: $msg" -ForegroundColor Green
}

function Require-File([string]$path) {
    if (Test-Path $path -PathType Leaf) {
        Pass "$path exists"
    } else {
        Fail "$path is missing"
    }
}

function Test-IsUnder([string]$child, [string]$parent) {
    if ([string]::IsNullOrWhiteSpace($child) -or [string]::IsNullOrWhiteSpace($parent)) {
        return $false
    }

    $separators = @([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) | Select-Object -Unique
    $childFull = [System.IO.Path]::GetFullPath($child).TrimEnd($separators)
    $parentFull = [System.IO.Path]::GetFullPath($parent).TrimEnd($separators)

    if ($childFull.Equals($parentFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }

    foreach ($separator in $separators) {
        if ($childFull.StartsWith($parentFull + $separator, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }

    return $false
}

function Expand-EnvTemplate([string]$value) {
    $expanded = [System.Environment]::ExpandEnvironmentVariables($value)
    return [regex]::Replace($expanded, '\$\{([A-Za-z_][A-Za-z0-9_]*)\}', {
        param($match)
        $name = $match.Groups[1].Value
        $replacement = [System.Environment]::GetEnvironmentVariable($name, 'Process')
        if ($null -eq $replacement) {
            return $match.Value
        }
        return $replacement
    })
}

function Test-GitIgnored([string]$path) {
    try {
        $null = git check-ignore -q $path 2>$null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

# --- Load local.paths.env ---
function Load-LocalPaths {
    $envFile = Join-Path $RootDir 'local.paths.env'
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith('#')) {
                $parts = $line -split '=', 2
                if ($parts.Count -eq 2 -and $parts[0].Trim()) {
                    $name = $parts[0].Trim()
                    $value = Expand-EnvTemplate $parts[1].Trim()
                    [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
                }
            }
        }
        Pass "local.paths.env loaded"
    } else {
        Warn "local.paths.env is missing"
    }
}

# --- Check required files ---
function Check-RequiredFiles {
    Require-File 'AGENTS.md'
    Require-File 'ARCHITECTURE.md'
    Require-File 'PRD.md'
    Require-File 'LESSONS.md'
    Require-File 'HANDOVER.md'
    Require-File '.gitignore'
}

# --- Check template empty files ---
function Check-TemplateEmptyFiles {
    $mode = [System.Environment]::GetEnvironmentVariable('FRAMEWORK_MODE', 'Process')
    if ($mode -eq 'template' -or [string]::IsNullOrEmpty($mode)) {
        foreach ($file in @('PRD.md', 'LESSONS.md', 'HANDOVER.md')) {
            if (Test-Path $file) {
                $content = Get-Content $file -Raw -ErrorAction SilentlyContinue
                if ([string]::IsNullOrWhiteSpace($content)) {
                    Pass "$file is empty for template mode"
                } else {
                    Fail "$file must stay empty in template mode"
                }
            }
        }
    }
}

# --- Check git rules ---
function Check-GitRules {
    try {
        $null = git rev-parse --is-inside-work-tree 2>$null
        if ($LASTEXITCODE -ne 0) {
            Fail "not a git repository"
            return
        }
        Pass "git repository detected"
    } catch {
        Fail "not a git repository"
        return
    }

    foreach ($path in @('.env.secret', 'local.paths.env', 'RESEARCH/', 'test-results/')) {
        if (Test-GitIgnored $path) {
            Pass "$path is ignored by git"
        } else {
            Fail "$path is not ignored by git"
        }
    }

    $patterns = @('.env*', '*.key', '*.pem', '*.p12', '*.pfx', 'credentials.json', 'token.json', 'service-account*.json', '*service-account*.json')
    $tracked = @()
    foreach ($pattern in $patterns) {
        $result = git ls-files $pattern 2>$null
        if ($result) {
            $tracked += $result
        }
    }
    if ($tracked.Count -gt 0) {
        Fail "secret candidate files are tracked by git"
        $tracked | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    } else {
        Pass "no tracked secret candidate files"
    }
}

# --- Check forbidden project artifacts ---
function Check-ForbiddenProjectArtifacts {
    $forbidden = @('.venv', 'venv', 'env', 'node_modules', 'vendor', 'dist', 'build', 'out',
                   '.next', '.nuxt', 'target', 'coverage', 'htmlcov', 'playwright-report', 'blob-report')
    foreach ($path in $forbidden) {
        if (Test-Path $path) {
            Fail "$path must not exist in project root"
        }
    }
}

# --- Check project paths ---
function Check-ProjectPaths {
    $mode = [System.Environment]::GetEnvironmentVariable('FRAMEWORK_MODE', 'Process')
    if ($mode -ne 'project') {
        Warn "FRAMEWORK_MODE is not project; project path checks skipped"
        return
    }

    $requiredVars = @('PROJECT_NAME', 'PROJECT_ROOT', 'CLOUD_SYNC_ROOT', 'LOCAL_ROOT',
                      'ENV_DIR', 'CACHE_DIR', 'BUILD_DIR', 'TEST_WORK_DIR',
                      'RELEASE_DIR', 'TEST_RESULTS_DIR')
    foreach ($name in $requiredVars) {
        $value = [System.Environment]::GetEnvironmentVariable($name, 'Process')
        if (-not [string]::IsNullOrEmpty($value)) {
            Pass "$name is set"
        } else {
            Fail "$name is required in project mode"
        }
    }

    $projectRoot = [System.Environment]::GetEnvironmentVariable('PROJECT_ROOT', 'Process')
    $cloudRoot = [System.Environment]::GetEnvironmentVariable('CLOUD_SYNC_ROOT', 'Process')
    $localRoot = [System.Environment]::GetEnvironmentVariable('LOCAL_ROOT', 'Process')

    if ([string]::IsNullOrEmpty($projectRoot) -or [string]::IsNullOrEmpty($cloudRoot) -or [string]::IsNullOrEmpty($localRoot)) {
        return
    }

    if (Test-IsUnder $localRoot $projectRoot) {
        Fail "LOCAL_ROOT must not be inside PROJECT_ROOT"
    } else {
        Pass "LOCAL_ROOT is outside PROJECT_ROOT"
    }

    if (Test-IsUnder $localRoot $cloudRoot) {
        Fail "LOCAL_ROOT must not be inside CLOUD_SYNC_ROOT"
    } else {
        Pass "LOCAL_ROOT is outside CLOUD_SYNC_ROOT"
    }

    foreach ($name in @('ENV_DIR', 'CACHE_DIR', 'BUILD_DIR', 'TEST_WORK_DIR')) {
        $value = [System.Environment]::GetEnvironmentVariable($name, 'Process')
        if (-not [string]::IsNullOrEmpty($value) -and (Test-IsUnder $value $localRoot)) {
            Pass "$name is under LOCAL_ROOT"
        } else {
            Fail "$name must be under LOCAL_ROOT"
        }
    }

    $prdFile = [System.Environment]::GetEnvironmentVariable('PRD_FILE', 'Process')
    if ([string]::IsNullOrEmpty($prdFile)) { $prdFile = './PRD.md' }
    if ($prdFile -eq './PRD.md' -and (Test-Path 'PRD.md')) {
        $content = Get-Content 'PRD.md' -Raw -ErrorAction SilentlyContinue
        if (-not [string]::IsNullOrWhiteSpace($content)) {
            Pass "PRD.md has content for project mode"
        } else {
            Fail "PRD.md must have content before project implementation"
        }
    } else {
        Fail "PRD.md must have content before project implementation"
    }

    $units = [System.Environment]::GetEnvironmentVariable('PROJECT_UNITS', 'Process')
    if (-not [string]::IsNullOrEmpty($units)) {
        $unitConfig = [System.Environment]::GetEnvironmentVariable('UNIT_CONFIG', 'Process')
        if ([string]::IsNullOrEmpty($unitConfig)) { $unitConfig = './config/units.json' }
        if (Test-Path $unitConfig) {
            Pass "UNIT_CONFIG exists for PROJECT_UNITS"
        } else {
            Fail "UNIT_CONFIG is required when PROJECT_UNITS is set"
        }
    }
}

# --- Main ---
function Main {
    Load-LocalPaths
    Check-RequiredFiles
    Check-TemplateEmptyFiles
    Check-GitRules
    Check-ForbiddenProjectArtifacts
    Check-ProjectPaths

    Write-Host ""
    if ($failCount -gt 0) {
        Write-Host "preflight failed: $failCount failure(s), $warnCount warning(s)" -ForegroundColor Red
        Pop-Location
        exit 1
    }

    Write-Host "preflight passed: $warnCount warning(s)" -ForegroundColor Green
    Pop-Location
    exit 0
}

Main
