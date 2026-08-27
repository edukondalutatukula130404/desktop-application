/**
 * build-portable.js — Reliable Portable Windows EXE Builder
 * Uses WinForms progress window so users know it's working.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appDir = path.resolve(__dirname, '..');
const distDir = path.join(appDir, 'dist-desktop');
const packedDir = path.join(distDir, 'InvoiceProDesktop-win32-x64');
const zipFile = path.join(distDir, 'InvoiceProDesktop-Windows.zip');
const outputExe = path.join(distDir, 'NexusSuite-Setup.exe');

// Step 1: Build latest app package
console.log('[1/3] Packaging app with electron-packager...');
execSync(
  `npx electron-packager . InvoiceProDesktop --platform=win32 --arch=x64 --out="${distDir}" --overwrite --ignore="dist-desktop" --ignore="release"`,
  { cwd: appDir, stdio: 'inherit' }
);

if (!fs.existsSync(packedDir)) {
  console.error('ERROR: electron-packager output not found at', packedDir);
  process.exit(1);
}

// Step 2: Re-zip the packed folder (ensures all DLLs are included)
console.log('[2/3] Creating fresh ZIP archive with all DLLs...');
if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);

const psZipCmd = `powershell -ExecutionPolicy Bypass -Command "Compress-Archive -Path '${packedDir}\\*' -DestinationPath '${zipFile}' -Force"`;
execSync(psZipCmd, { stdio: 'inherit' });

if (!fs.existsSync(zipFile)) {
  console.error('ERROR: ZIP file was not created.');
  process.exit(1);
}

console.log('ZIP created:', zipFile, `(${(fs.statSync(zipFile).size / 1024 / 1024).toFixed(1)} MB)`);

// Step 3: Compile self-extracting EXE with WinForms progress bar
console.log('[3/3] Compiling self-extracting portable EXE with progress window...');

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
            DateTime launcherTime = DateTime.MinValue;
            try { launcherTime = File.GetLastWriteTime(Assembly.GetExecutingAssembly().Location); } catch {}
            DateTime installedTime = File.Exists(exePath) ? File.GetLastWriteTime(exePath) : DateTime.MinValue;

            bool needsExtract = !Directory.Exists(installDir) || !File.Exists(exePath) || (launcherTime > installedTime.AddSeconds(2));

            if (needsExtract) {
                // Terminate any running old instances before updating
                try {
                    Process[] procs = Process.GetProcessesByName("InvoiceProDesktop");
                    foreach (Process p in procs) {
                        try { p.Kill(); p.WaitForExit(1000); } catch {}
                    }
                } catch {}

                // Show progress form
                Form form = new Form();
                form.Text = "NexusSuite — Updating Application";
                form.Size = new Size(460, 160);
                form.StartPosition = FormStartPosition.CenterScreen;
                form.FormBorderStyle = FormBorderStyle.FixedSingle;
                form.MaximizeBox = false;
                form.MinimizeBox = false;
                form.BackColor = Color.FromArgb(245, 245, 255);

                Label lbl = new Label();
                lbl.Text = File.Exists(exePath) ? "Updating NexusSuite to the latest version..." : "Setting up NexusSuite for this device...";
                lbl.Font = new Font("Segoe UI", 10, FontStyle.Regular);
                lbl.ForeColor = Color.FromArgb(60, 60, 80);
                lbl.Location = new Point(24, 22);
                lbl.Size = new Size(400, 22);
                form.Controls.Add(lbl);

                Label sub = new Label();
                sub.Text = "Please wait while files are updated.";
                sub.Font = new Font("Segoe UI", 8, FontStyle.Regular);
                sub.ForeColor = Color.FromArgb(120, 120, 150);
                sub.Location = new Point(24, 46);
                sub.Size = new Size(400, 18);
                form.Controls.Add(sub);

                ProgressBar pb = new ProgressBar();
                pb.Location = new Point(24, 76);
                pb.Size = new Size(395, 22);
                pb.Style = ProgressBarStyle.Marquee;
                pb.MarqueeAnimationSpeed = 30;
                form.Controls.Add(pb);

                Thread extractThread = new Thread(() => {
                    try {
                        if (!Directory.Exists(installDir)) Directory.CreateDirectory(installDir);

                        Assembly assembly = Assembly.GetExecutingAssembly();
                        using (Stream stream = assembly.GetManifestResourceStream("payload.zip")) {
                            if (stream == null) {
                                MessageBox.Show("Embedded payload not found. Please re-download NexusSuite.", "Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                                form.Invoke(new Action(() => form.Close()));
                                return;
                            }

                            ZipArchive archive = new ZipArchive(stream, ZipArchiveMode.Read);
                            int total = archive.Entries.Count;
                            int done = 0;

                            foreach (ZipArchiveEntry entry in archive.Entries) {
                                string destPath = Path.Combine(installDir, entry.FullName);
                                if (string.IsNullOrEmpty(entry.Name)) {
                                    if (!Directory.Exists(destPath)) Directory.CreateDirectory(destPath);
                                } else {
                                    string dir = Path.GetDirectoryName(destPath);
                                    if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                                    for (int attempt = 0; attempt < 3; attempt++) {
                                        try { entry.ExtractToFile(destPath, true); break; }
                                        catch { Thread.Sleep(100); }
                                    }
                                }
                                done++;
                            }
                            archive.Dispose();
                        }

                        form.Invoke(new Action(() => {
                            lbl.Text = "Starting NexusSuite...";
                            pb.Style = ProgressBarStyle.Continuous;
                            pb.Value = 100;
                        }));

                        Thread.Sleep(600);
                        form.Invoke(new Action(() => form.Close()));

                    } catch (Exception ex) {
                        MessageBox.Show("Setup error: " + ex.Message, "NexusSuite Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        form.Invoke(new Action(() => form.Close()));
                    }
                });

                extractThread.IsBackground = true;
                extractThread.Start();

                Application.Run(form);
            }

            // Verify DLL before launching
            string ffmpegDll = Path.Combine(installDir, "ffmpeg.dll");
            if (!File.Exists(ffmpegDll)) {
                // Extraction may have failed — delete and ask user to re-run
                if (Directory.Exists(installDir)) {
                    try { Directory.Delete(installDir, true); } catch {}
                }
                MessageBox.Show(
                    "Installation was incomplete. Please double-click NexusSuite-Setup.exe again to retry.",
                    "NexusSuite — Retry Required",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning
                );
                return;
            }

            if (File.Exists(exePath)) {
                ProcessStartInfo psi = new ProcessStartInfo(exePath);
                psi.WorkingDirectory = installDir;
                psi.UseShellExecute = true;
                Process.Start(psi);
            } else {
                MessageBox.Show(
                    "Could not find NexusSuite.exe at: " + exePath + "\\n\\nPlease re-run the setup.",
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
  console.error('ERROR: csc.exe not found.');
  process.exit(1);
}

// Use winexe target + reference WinForms + embed icon if present
const iconPath = path.join(appDir, 'electron', 'icon.ico');
const iconFlag = fs.existsSync(iconPath) ? `/win32icon:"${iconPath}"` : '';

const compileCmd = `"${cscPath}" /target:winexe /out:"${outputExe}" ${iconFlag} /resource:"${zipFile}",payload.zip /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "${tempCsFile}"`;

try {
  execSync(compileCmd, { stdio: 'inherit' });
  fs.unlinkSync(tempCsFile);
  console.log('\n✅ PORTABLE EXE WITH PROGRESS WINDOW CREATED!');
  console.log('File:', outputExe);
  console.log(`Size: ${(fs.statSync(outputExe).size / 1024 / 1024).toFixed(1)} MB`);
  console.log('\nUsers will see a "Setting up NexusSuite..." progress window when first running.');
  console.log('Copy this single file to ANY Windows computer and double-click to run.\n');
} catch (err) {
  console.error('Compilation failed:', err.message);
  process.exit(1);
}
