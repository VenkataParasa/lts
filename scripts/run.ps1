param([ValidateSet('dev', 'build', 'preview', 'test', 'test:e2e')][string]$Task = 'dev')
$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $taskProjectRoot
try {
    $taskNodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($taskNodeCommand) { $taskNode = $taskNodeCommand.Source }
    elseif (Test-Path -LiteralPath '.tools/node.exe') { $taskNode = Join-Path $taskProjectRoot '.tools/node.exe' }
    else { throw 'Install Node 22.16 or later, then run npm ci.' }
    $env:PATH = "$(Split-Path $taskNode -Parent);$env:PATH"
    switch ($Task) {
        'dev' { & $taskNode node_modules/vite/bin/vite.js }
        'preview' { & $taskNode node_modules/vite/bin/vite.js preview }
        'build' {
            & $taskNode node_modules/typescript/bin/tsc --noEmit
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            & $taskNode node_modules/vite/bin/vite.js build
        }
        'test' { & $taskNode tests/run.mjs }
        'test:e2e' { & $taskNode node_modules/playwright/cli.js test }
    }
    exit $LASTEXITCODE
} finally { Pop-Location }
