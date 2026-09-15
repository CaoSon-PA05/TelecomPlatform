@echo off
title SRAU Logger Launcher
chcp 65001 >nul

echo ============================================
echo   SRAU Logger + ngrok - Sentinel Platform
echo ============================================
echo.

:: â”€â”€ Cáº¤U HÃŒNH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
:: Äiá»n domain ngrok static cá»§a báº¡n vÃ o Ä‘Ã¢y (láº¥y táº¡i ngrok.com/dashboard > Domains)
:: VÃ­ dá»¥: SET NGROK_DOMAIN=salmon-wolf-1234.ngrok-free.app
SET NGROK_DOMAIN=alibi-wake-sassy.ngrok-free.dev

:: Äiá»n API Key Logger (pháº£i khá»›p vá»›i ADMIN_PASSWORD / API_KEY trong .env)
SET LOGGER_API_KEY=sentinel-dev-key
:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

IF "%NGROK_DOMAIN%"=="" (
    echo [WARN] Chua dat NGROK_DOMAIN trong file nay.
    echo [WARN] URL ngrok se thay doi moi lan chay.
    echo [WARN] Vao ngrok.com/dashboard ^> Domains de lay static domain.
    echo.
    start "ngrok - Tunnel" cmd /k "ngrok http 5000"
) ELSE (
    echo [OK] Dung static domain: https://%NGROK_DOMAIN%
    start "ngrok - Tunnel" cmd /k "ngrok http --domain=%NGROK_DOMAIN% 5000"
)

:: Khoi dong Flask Logger
start "Logger - Flask" cmd /k "cd /d %~dp0 && python app.py"

:: Cho Flask khoi dong xong
timeout /t 3 /nobreak >nul

echo.
echo ============================================
IF NOT "%NGROK_DOMAIN%"=="" (
    echo   Logger URL (giu nguyen moi lan):
    echo   https://%NGROK_DOMAIN%
    echo.
    echo   SRAU screen:
    echo   SERVER URL : https://%NGROK_DOMAIN%
    echo   API KEY    : %LOGGER_API_KEY%
    echo.
    echo   Tracking URL mau:
    echo   https://%NGROK_DOMAIN%/t/TOKEN_CUA_BAN
) ELSE (
    echo   Copy URL https://... tu cua so ngrok
    echo   Dan vao SRAU > SERVER URL > nhan enter
)
echo ============================================
echo.
echo Nhan phim bat ky de dong cua so nay...
echo (Logger va ngrok van tiep tuc chay)
pause >nul

