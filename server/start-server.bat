@echo off
title RD Manager API Server
cd /d %~dp0
echo ===================================================
echo     RD Manager Enterprise API Server (Port 5000)
echo ===================================================
node index.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Server stopped with error.
    pause
)
