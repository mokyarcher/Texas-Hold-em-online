@echo off
echo =====================================
echo   Texas Hold'em Poker Server
echo =====================================
cd /d "%~dp0\backend"
echo Starting server...
echo.
node server.js
pause
