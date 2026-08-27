const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appDir = path.resolve(__dirname, '..');
const distDir = path.join(appDir, 'dist-desktop');
const zipFile = path.join(distDir, 'InvoiceProDesktop-Windows.zip');
const outputExe1 = path.join(distDir, 'InvoiceProDesktop-Setup.exe');
const outputExe2 = path.join(distDir, 'InvoicePro Desktop.exe');

if (!fs.existsSync(zipFile)) {
  console.error('Zip file not found:', zipFile);
  process.exit(1);
}

console.log('Embedding complete application payload into standalone executable files...');

const csharpCode = `
using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Reflection;

namespace InvoiceProSetup {
    class Program {
        static void Main(string[] args) {
            try {
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string installDir = Path.Combine(localAppData, "InvoiceProDesktop");
                string exePath = Path.Combine(installDir, "InvoiceProDesktop.exe");

                if (!Directory.Exists(installDir)) {
                    Directory.CreateDirectory(installDir);
                }

                // Extract embedded payload safely
                Assembly assembly = Assembly.GetExecutingAssembly();
                using (Stream stream = assembly.GetManifestResourceStream("payload.zip")) {
                    if (stream != null) {
                        using (ZipArchive archive = new ZipArchive(stream)) {
                            foreach (ZipArchiveEntry entry in archive.Entries) {
                                string destinationPath = Path.Combine(installDir, entry.FullName);
                                if (string.IsNullOrEmpty(entry.Name)) {
                                    if (!Directory.Exists(destinationPath)) Directory.CreateDirectory(destinationPath);
                                } else {
                                    string dirName = Path.GetDirectoryName(destinationPath);
                                    if (!Directory.Exists(dirName)) Directory.CreateDirectory(dirName);
                                    try {
                                        entry.ExtractToFile(destinationPath, true);
                                    } catch {}
                                }
                            }
                        }
                    }
                }

                // Launch InvoiceProDesktop.exe
                if (File.Exists(exePath)) {
                    ProcessStartInfo startInfo = new ProcessStartInfo(exePath);
                    startInfo.WorkingDirectory = installDir;
                    Process.Start(startInfo);
                }
            } catch (Exception ex) {
                Console.WriteLine("Launch error: " + ex.Message);
            }
        }
    }
}
`;

const tempCsFile = path.join(distDir, 'Setup.cs');
fs.writeFileSync(tempCsFile, csharpCode);

const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';

if (fs.existsSync(cscPath)) {
  try {
    console.log('Compiling InvoiceProDesktop-Setup.exe...');
    const cmd1 = `"${cscPath}" /target:exe /out:"${outputExe1}" /resource:"${zipFile}",payload.zip /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "${tempCsFile}"`;
    execSync(cmd1, { stdio: 'inherit' });

    console.log('Compiling InvoicePro Desktop.exe...');
    const cmd2 = `"${cscPath}" /target:exe /out:"${outputExe2}" /resource:"${zipFile}",payload.zip /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "${tempCsFile}"`;
    execSync(cmd2, { stdio: 'inherit' });

    console.log('=== PERMANENT SINGLE-FILE EXECUTABLES CREATED SUCCESSFULLY ===');
    console.log('1. ', outputExe1);
    console.log('2. ', outputExe2);
  } catch (err) {
    console.error('Compilation failed:', err.message);
  }
} else {
  console.error('csc.exe not found at', cscPath);
}
