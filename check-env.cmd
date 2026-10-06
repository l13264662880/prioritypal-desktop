@echo off
REM ===================================================================
REM  PriorityPal Desktop - Environment Self-Check
REM
REM  If the desktop app will not start, double-click this file.
REM  It writes the diagnosis to check-result.txt.
REM  Send that file back and the problem can be located.
REM
REM  ASCII-only on purpose (GBK/UTF-8 mismatch garbles Chinese echo).
REM ===================================================================
setlocal

set "HERE=%~dp0"
set "OUT=%HERE%check-result.txt"

echo PriorityPal Desktop - Environment Self-Check > "%OUT%"
echo Time: %date% %time% >> "%OUT%"
echo ============================================== >> "%OUT%"

echo. >> "%OUT%"
echo [1] electron.exe present? >> "%OUT%"
if exist "%HERE%node_modules\electron\dist\electron.exe" (
  echo   OK >> "%OUT%"
) else (
  echo   MISSING - run "npm install" inside prioritypal-desktop >> "%OUT%"
)

echo. >> "%OUT%"
echo [2] Electron version >> "%OUT%"
if exist "%HERE%node_modules\electron\dist\version" (
  type "%HERE%node_modules\electron\dist\version" >> "%OUT%"
) else (
  echo   unreadable >> "%OUT%"
)

echo. >> "%OUT%"
echo [3] API injection test - THE KEY CHECK >> "%OUT%"
set "ELECTRON_RUN_AS_NODE="
set "NODE_OPTIONS="
> "%HERE%_check.js" echo const E=require('electron');console.log('process.type='+process.type);console.log('ipcMain='+typeof E.ipcMain);console.log('app='+typeof E.app);process.exit(0);
pushd "%HERE%"
"%HERE%node_modules\electron\dist\electron.exe" "%HERE%_check.js" >> "%OUT%" 2>&1
popd
if exist "%HERE%_check.js" del /q "%HERE%_check.js"

echo. >> "%OUT%"
echo   HOW TO READ: >> "%OUT%"
echo   process.type=browser ^+ ipcMain=object   -> environment OK >> "%OUT%"
echo   process.type=undefined ^+ ipcMain=undefined -> ELECTRON_RUN_AS_NODE still set >> "%OUT%"
echo   Cannot find module 'electron'          -> ran with wrong node binary >> "%OUT%"

echo. >> "%OUT%"
echo [4] Source files >> "%OUT%"
for %%F in (main.js preload.js package.json) do (
  if exist "%HERE%%%F" (echo   OK: %%F >> "%OUT%") else (echo   MISSING: %%F >> "%OUT%")
)
for %%F in (sprite.html panel.html app.js style.css) do (
  if exist "%HERE%src\%%F" (echo   OK: src\%%F >> "%OUT%") else (echo   MISSING: src\%%F >> "%OUT%")
)

echo. >> "%OUT%"
echo ============================================== >> "%OUT%"
echo Done. >> "%OUT%"

echo.
echo Self-check finished. Result written to:
echo   %OUT%
echo.
echo Please send the contents of that file back.
echo.
pause
