@echo off
echo Iniciando servidor local para TurnosWeb...
echo.
echo Presiona Ctrl+C para detener el servidor.
echo.
npx -y http-server -p 8080 -o admin.html
pause
