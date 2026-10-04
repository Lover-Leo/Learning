@echo off
setlocal

call "D:\VS2026\Common7\Tools\VsDevCmd.bat" -arch=x64 >nul
if errorlevel 1 exit /b %errorlevel%

cl /nologo /W4 /utf-8 /EHsc /std:c++20 ^
    "%~dp0bookManager.cpp" ^
    "%~dp0book.cpp" ^
    /Fe:"%~dp0bookManager.exe"

exit /b %errorlevel%
