@echo off
chcp 65001 > nul
title Poker Server

echo.
echo Stopping any existing Node.js processes...
taskkill /F /IM node.exe > nul 2>&1
timeout /t 2 /nobreak > nul

echo.
echo Starting server...
echo.
cd backend
start "Poker Server" node server.js

echo.
echo ========================================
echo   Server Started!
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.

pause