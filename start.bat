@echo off
title Catholic Krillion ("Credillion") Server
echo ========================================================
echo    Catholic Krillion ("Credillion") 3-Screen Game
echo ========================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on this system!
    echo Please install Node.js from https://nodejs.org/ to run the game.
    pause
    exit /b 1
)

:: Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo [Setup] Installing required packages (ws, qrcode)...
    call npm install --omit=dev
)

:: Start Server
echo [Server] Starting Catholic Krillion server on port 3000...
start "" http://localhost:3000/
node server.js
