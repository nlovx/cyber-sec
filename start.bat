@echo off
chcp 65001 >nul
title CYBER SEC server
cd /d "%~dp0"
rem Код-приглашение для регистрации (убери строку ниже, чтобы регистрация была открытой):
rem set INVITE_CODE=придумай-свой-код
echo Открой в браузере: http://localhost:8080
node tools\server.mjs
pause
