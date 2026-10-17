@echo off
title beLocal in Zurich
cd /d "%~dp0"
if not exist node_modules (
  echo Installazione dipendenze...
  call npm install
)
if not exist .env (
  echo ATTENZIONE: manca il file .env con ANTHROPIC_API_KEY. Il Concierge usera' le risposte di anteprima.
)
start "" http://localhost:8000
node dev-server.mjs
