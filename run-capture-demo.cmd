@echo off
set "ELECTRON_RUN_AS_NODE="
set "NODE_OPTIONS="
cd /d "%~dp0"
"%~dp0node_modules\electron\dist\electron.exe" capture-demo.js
