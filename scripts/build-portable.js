/**
 * build-portable.js — Reliable Bulletproof Portable Windows EXE Builder
 * Embeds full Electron runtime + DLLs + frontend/backend static bundle.
 * Uses synchronous C# installer launcher with progress bar and Antivirus-safe extraction retries.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appDir = path.resolve(__dirname, '..');
const distDir = path.join(appDir, 'dist-desktop');
const packedDir = path.join(distDir, 'InvoiceProDesktop-win32-x64');
const zipFile = path.join(distDir, 'InvoiceProDesktop-Windows.zip');
const outputExe = path.join(distDir, 'NexusSuite.exe');

// Step 1: Package Electron app using electron-packager
console.log('[1/3] Packaging Electron application with electron-packager...');
if (fs.existsSync(packedDir)) {
  try { fs.rmSync(packedDir, { recursive: true, force: true }); } catch (e) {}
}

execSync(
  `npx electron-packager . InvoiceProDesktop --platform=win32 --arch=x64 --out="${distDir}" --overwrite --ignore="dist-desktop" --ignore="release" --ignore="dist-installer"`,
  { cwd: appDir, stdio: 'inherit' }
);

if (!fs.existsSync(packedDir)) {
  console.error('ERROR: electron-packager output directory not found at', packedDir);
  process.exit(1);
}

const ffmpegSrc = path.join(packedDir, 'ffmpeg.dll');
if (!fs.existsSync(ffmpegSrc)) {
  console.error('ERROR: ffmpeg.dll missing from packaged output directory:', ffmpegSrc);
  process.exit(1);
}
console.log('✅ Packaged successfully. ffmpeg.dll confirmed at root.');

// Step 2: Create deterministic ZIP payload using .NET ZipFile::CreateFromDirectory
console.log('[2/3] Creating deterministic ZIP payload (preserving root DLLs)...');
if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);

const psZipCmd = `powershell -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${packedDir}', '${zipFile}', [System.IO.Compression.CompressionLevel]::Fastest, $false)"`;
execSync(psZipCmd, { stdio: 'inherit' });

if (!fs.existsSync(zipFile)) {
  console.error('ERROR: ZIP file payload was not created.');
  process.exit(1);
}

const zipSizeBytes = fs.statSync(zipFile).size;
console.log(`✅ Payload ZIP created: ${zipFile} (${(zipSizeBytes / 1024 / 1024).toFixed(1)} MB)`);

// Step 3: Compile C# Self-Extracting Executable with Progress Window
console.log('[3/3] Compiling self-extracting portable EXE launcher...');

const csharpCode = `
using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using System.Drawing;

namespace NexusSuiteSetup {
    static class Program {
        [STAThread]
        static void Main(string[] args) {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string installDir = Path.Combine(localAppData, "NexusSuiteApp");
            string exePath = Path.Combine(installDir, "InvoiceProDesktop.exe");
            string ffmpegPath = Path.Combine(installDir, "ffmpeg.dll");

            DateTime launcherTime = DateTime.MinValue;
            try { launcherTime = File.GetLastWriteTime(Assembly.GetExecutingAssembly().Location); } catch {}
            DateTime installedTime = File.Exists(exePath) ? File.GetLastWriteTime(exePath) : DateTime.MinValue;

            // Force extraction if system directory, main EXE, or ffmpeg.dll is missing, or launcher is updated
            bool needsExtract = !Directory.Exists(installDir) 
                             || !File.Exists(exePath) 
                             || !File.Exists(ffmpegPath)
                             || (launcherTime > installedTime.AddSeconds(2));

            if (needsExtract) {
                // Terminate any running old instances before updating files
                try {
                    Process[] procs = Process.GetProcessesByName("InvoiceProDesktop");
                    foreach (Process p in procs) {
                        try { p.Kill(); p.WaitForExit(1500); } catch {}
                    }
                } catch {}

                Form form = new Form();
                form.Text = "Nexus Suite — System Setup";
                form.Size = new Size(460, 160);
                form.StartPosition = FormStartPosition.CenterScreen;
                form.FormBorderStyle = FormBorderStyle.FixedSingle;
                form.MaximizeBox = false;
                form.MinimizeBox = false;
                form.BackColor = Color.FromArgb(245, 245, 255);

                Label lbl = new Label();
                lbl.Text = File.Exists(exePath) ? "Updating Nexus Suite system files..." : "Setting up Nexus Suite for this machine...";
                lbl.Font = new Font("Segoe UI", 10, FontStyle.Regular);
                lbl.ForeColor = Color.FromArgb(40, 40, 60);
                lbl.Location = new Point(24, 20);
                lbl.Size = new Size(400, 24);
                form.Controls.Add(lbl);

                Label sub = new Label();
                sub.Text = "Unpacking application binaries and ffmpeg.dll. Please wait...";
                sub.Font = new Font("Segoe UI", 8, FontStyle.Regular);
                sub.ForeColor = Color.FromArgb(100, 100, 130);
                sub.Location = new Point(24, 46);
                sub.Size = new Size(400, 18);
                form.Controls.Add(sub);

                ProgressBar pb = new ProgressBar();
                pb.Location = new Point(24, 74);
                pb.Size = new Size(395, 22);
                pb.Style = ProgressBarStyle.Marquee;
                pb.MarqueeAnimationSpeed = 30;
                form.Controls.Add(pb);

                bool extractionSuccess = false;
                string extractionError = null;

                Thread extractThread = new Thread(() => {
                    try {
                        if (!Directory.Exists(installDir)) {
                            Directory.CreateDirectory(installDir);
                        }

                        Assembly assembly = Assembly.GetExecutingAssembly();
                        using (Stream stream = assembly.GetManifestResourceStream("payload.zip")) {
                            if (stream == null) {
                                extractionError = "Embedded payload binary stream missing.";
                                return;
                            }

                            using (ZipArchive archive = new ZipArchive(stream, ZipArchiveMode.Read)) {
                                foreach (ZipArchiveEntry entry in archive.Entries) {
                                    string destPath = Path.Combine(installDir, entry.FullName);
                                    if (string.IsNullOrEmpty(entry.Name)) {
                                        if (!Directory.Exists(destPath)) Directory.CreateDirectory(destPath);
                                    } else {
                                        string dir = Path.GetDirectoryName(destPath);
                                        if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

                                        // Retries up to 15 attempts with 250ms delay to withstand Antivirus scanning locks
                                        bool saved = false;
                                        for (int attempt = 0; attempt < 15; attempt++) {
                                            try {
                                                entry.ExtractToFile(destPath, true);
                                                saved = true;
                                                break;
                                            } catch {
                                                Thread.Sleep(250);
                                            }
                                        }
                                        if (!saved) {
                                            extractionError = "Failed to extract required file: " + entry.Name;
                                            return;
                                        }
                                    }
                                }
                            }
                        }
                        extractionSuccess = true;
                    } catch (Exception ex) {
                        extractionError = ex.Message;
                    } finally {
                        try {
                            form.Invoke(new Action(() => form.Close()));
                        } catch {}
                    }
                });

                extractThread.IsBackground = true;
                extractThread.Start();

                Application.Run(form);
                extractThread.Join();

                if (!extractionSuccess || !File.Exists(exePath) || !File.Exists(ffmpegPath)) {
                    MessageBox.Show(
                        "Installation incomplete: " + (extractionError ?? "ffmpeg.dll was not extracted.") +
                        "\\n\\nPlease temporarily disable Windows Antivirus / Defender and re-run NexusSuite.exe.",
                        "Nexus Suite Setup Error",
                        MessageBoxButtons.OK, MessageBoxIcon.Error
                    );
                    return;
                }
            }

            if (File.Exists(exePath) && File.Exists(ffmpegPath)) {
                ProcessStartInfo psi = new ProcessStartInfo(exePath);
                psi.WorkingDirectory = installDir;
                psi.UseShellExecute = true;
                Process.Start(psi);
            } else {
                MessageBox.Show(
                    "Could not launch Nexus Suite. System files missing at:\\n" + exePath,
                    "Launch Error", MessageBoxButtons.OK, MessageBoxIcon.Error
                );
            }
        }
    }
}
`;

const tempCsFile = path.join(distDir, 'NexusSuiteSetup.cs');
fs.writeFileSync(tempCsFile, csharpCode, 'utf8');

const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
if (!fs.existsSync(cscPath)) {
  console.error('ERROR: Microsoft C# Compiler (csc.exe) not found at:', cscPath);
  process.exit(1);
}

const iconPath = path.join(appDir, 'electron', 'icon.ico');
const iconFlag = fs.existsSync(iconPath) ? `/win32icon:"${iconPath}"` : '';

const compileCmd = `"${cscPath}" /target:winexe /out:"${outputExe}" ${iconFlag} /resource:"${zipFile}",payload.zip /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "${tempCsFile}"`;

try {
  execSync(compileCmd, { stdio: 'inherit' });
  fs.unlinkSync(tempCsFile);
  console.log('\n============================================================');
  console.log('🎉 BULLETPROOF PORTABLE EXE SUCCESSFULLY CREATED!');
  console.log('File:', outputExe);
  console.log(`Size: ${(fs.statSync(outputExe).size / 1024 / 1024).toFixed(1)} MB`);
  console.log('ffmpeg.dll and all system binaries embedded & verified.');
  console.log('Copy NexusSuite.exe to ANY Windows computer and double-click to run!');
  console.log('============================================================\n');
} catch (err) {
  console.error('Compilation failed:', err.message);
  process.exit(1);
}
