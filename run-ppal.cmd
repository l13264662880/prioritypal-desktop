@echo off
REM ===================================================================
REM  PriorityPal Desktop Launcher
REM
REM  WHY THIS FILE EXISTS:
REM    If ELECTRON_RUN_AS_NODE=1 is set in the environment, Electron
REM    degrades into plain Node.js -- no window, no APIs, and it fails
REM    with "Cannot read properties of undefined (reading 'on')".
REM    Some IDE toolchains preset that variable, so we clear it here.
REM
REM  Do NOT launch electron.exe directly. Always use this file.
REM  (Comments are ASCII-only on purpose: GBK/UTF-8 mismatch would
REM   turn Chinese REM lines into bogus commands.)
REM ===================================================================

set "ELECTRON_RUN_AS_NODE="
set "NODE_OPTIONS="

cd /d "%~dp0"
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
