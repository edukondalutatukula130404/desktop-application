const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appDir = path.resolve(__dirname, '..');
const distDir = path.join(appDir, 'dist-desktop');
const sourceDir = path.join(distDir, 'InvoiceProDesktop-win32-x64');
const sedFile = path.join(distDir, 'setup.sed');
const outputExe = path.join(distDir, 'InvoiceProDesktop-Setup.exe');

if (!fs.existsSync(sourceDir)) {
  console.error('Source directory not found:', sourceDir);
  process.exit(1);
}

// Get list of all files in sourceDir recursively
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

const allFiles = getAllFiles(sourceDir);
console.log(`Found ${allFiles.length} files to package into single .exe installer...`);

// Format files for IExpress SED format
const sourceFilesSection = allFiles.map((f, i) => `%FILE${i}%=""`).join('\n');
const fileListSection = allFiles.map((f, i) => `%FILE${i}%=${f}`).join('\n');

// Create batch launcher to handle nested resources directory
const launchBatch = path.join(distDir, 'launch.bat');
fs.writeFileSync(launchBatch, `@echo off\nstart "" "%~dp0InvoiceProDesktop.exe"\n`);

const sedContent = `
[Version]
Class=IExpress
SEDVersion=3.0
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=1
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=${outputExe}
FriendlyName=InvoicePro Desktop
AppLaunched=cmd /c launch.bat
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
SourceFiles=SourceFiles
[SourceFiles]
SourceFiles0=${distDir}\\
SourceFiles1=${sourceDir}\\
[SourceFiles0]
%FILE0%=""
[SourceFiles1]
${allFiles.map((f, i) => `%FILE${i + 1}%=${path.relative(sourceDir, f)}`).join('\n')}
`;

// Alternative: Create PowerShell self-extracting .exe script wrapper
const setupPs1 = path.join(distDir, 'create-setup.ps1');
fs.writeFileSync(setupPs1, `
$zipFile = "${path.join(distDir, 'InvoiceProDesktop-Windows.zip').replace(/\\/g, '/')}";
$exeFile = "${path.join(distDir, 'InvoiceProDesktop-Setup.exe').replace(/\\/g, '/')}";

Add-Type -AssemblyName System.IO.Compression.FileSystem

console.log("Single EXE Script Ready");
`);

console.log('Building installer...');
