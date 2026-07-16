@echo off
title Homework Assistant - DEMO
echo.
echo   Iniciando a demonstracao do Homework Assistant...
echo   (Na primeira vez, baixa o necessario. Pode demorar alguns minutos.)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher.ps1"
echo.
echo   O app foi encerrado. Pode fechar esta janela.
pause
