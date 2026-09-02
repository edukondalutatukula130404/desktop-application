$ErrorActionPreference = "Stop"

Write-Host "1. Building frontend and electron package..." -ForegroundColor Green
Set-Location "c:\Users\Lenovo\Desktop\desktop-application"
npm run frontend:build
npx cross-env CSC_IDENTITY_AUTO_DISCOVERY=false WIN_CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --win dir

Write-Host "2. Ensuring win-unpacked NexusSuite.exe is present..." -ForegroundColor Green
$unpackedDir = "c:\Users\Lenovo\Desktop\desktop-application\dist-installer\win-unpacked"
if (Test-Path "$unpackedDir\electron.exe") {
    Copy-Item "$unpackedDir\electron.exe" -Destination "$unpackedDir\NexusSuite.exe" -Force
}

Write-Host "3. Creating payload zip archive..." -ForegroundColor Green
$payloadZip = "c:\Users\Lenovo\Desktop\desktop-application\scripts\payload.zip"
if (Test-Path $payloadZip) { Remove-Item $payloadZip -Force }
Compress-Archive -Path "$unpackedDir\*" -DestinationPath $payloadZip -Force

Write-Host "4. Compiling single-file C# executable using csc.exe..." -ForegroundColor Green
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$outExe = "C:\Users\Lenovo\Desktop\NexusSuite-SingleFile.exe"
if (Test-Path $outExe) { Remove-Item $outExe -Force }

& $csc /target:winexe /out:$outExe /resource:$payloadZip,payload.zip /r:System.dll,System.IO.Compression.dll,System.IO.Compression.FileSystem.dll,System.Windows.Forms.dll "c:\Users\Lenovo\Desktop\desktop-application\scripts\SingleFileLauncher.cs"

Write-Host "5. Single-file executable created successfully at $outExe!" -ForegroundColor Green
Get-Item $outExe | Select-Object FullName, Length, LastWriteTime
