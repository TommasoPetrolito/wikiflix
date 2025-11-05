@echo off
REM Quick script to find your local IP address for sharing Flux (Windows)

echo Finding your local IP address...
echo.

REM Get IP address from ipconfig
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    set IP=!IP: =!
    echo Your local IP address is: !IP!
    echo.
    echo Share this URL with your family:
    echo    http://!IP!:3000
    echo.
    echo Make sure:
    echo    - Flux server is running (npm run dev)
    echo    - All devices are on the same WiFi network
    echo    - Your firewall allows connections on port 3000
    echo.
    goto :found
)

echo Could not find your IP address automatically.
echo Please run 'ipconfig' and look for IPv4 Address under your active adapter.
goto :end

:found
pause

:end

