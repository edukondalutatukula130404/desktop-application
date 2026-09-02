using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Diagnostics;
using System.Windows.Forms;

namespace NexusSuiteLauncher
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                string targetDir = Path.Combine(appData, "NexusSuiteApp");
                string exePath = Path.Combine(targetDir, "NexusSuite.exe");

                // Ensure target directory exists and extract embedded payload if needed
                if (!Directory.Exists(targetDir) || !File.Exists(exePath))
                {
                    if (Directory.Exists(targetDir))
                    {
                        try { Directory.Delete(targetDir, true); } catch { }
                    }
                    Directory.CreateDirectory(targetDir);

                    Assembly assembly = Assembly.GetExecutingAssembly();
                    using (Stream stream = assembly.GetManifestResourceStream("payload.zip"))
                    {
                        if (stream == null)
                        {
                            MessageBox.Show("Embedded payload missing from executable.", "NexusSuite Launcher Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                            return;
                        }

                        string tempZip = Path.Combine(Path.GetTempPath(), "NexusSuite_payload.zip");
                        using (FileStream fs = new FileStream(tempZip, FileMode.Create, FileAccess.Write))
                        {
                            stream.CopyTo(fs);
                        }

                        ZipFile.ExtractToDirectory(tempZip, targetDir);
                        try { File.Delete(tempZip); } catch { }
                    }
                }

                if (File.Exists(exePath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = exePath;
                    psi.WorkingDirectory = targetDir;
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                }
                else
                {
                    MessageBox.Show("NexusSuite.exe not found after extraction.", "NexusSuite Launcher Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Failed to launch NexusSuite: " + ex.Message, "NexusSuite Launcher Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
