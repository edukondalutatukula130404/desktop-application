const { app, BrowserWindow, ipcMain, dialog, clipboard, shell, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

// Load configuration (MONGO_URI, JWT_SECRET, PORT) BEFORE anything reads process.env.
// In a packaged build there is no project-root .env, so we also look next to the
// executable and in the app resources folder for a shipped config file.
(function loadEnvConfig() {
  // Secrets first (dotenv keeps the first value seen per key), then non-secret
  // runtime config, then dev fallbacks.
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'app.secret.env') : null,
    process.execPath ? path.join(path.dirname(process.execPath), 'app.secret.env') : null,
    path.join(__dirname, 'app.secret.env'),
    process.resourcesPath ? path.join(process.resourcesPath, 'app.env') : null,
    process.execPath ? path.join(path.dirname(process.execPath), 'app.env') : null,
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../backend/.env')
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        require('dotenv').config({ path: p });
      }
    } catch (e) {}
  }
})();

// Packaged builds must not be weakenable via environment: strip dev/test license
// toggles and pin production mode regardless of a hand-edited app.env.
try {
  const { app: _app } = require('electron');
  if (_app && _app.isPackaged) {
    delete process.env.LICENSE_ENFORCE;
    delete process.env.LICENSE_FORCE_OFFLINE;
    process.env.NODE_ENV = 'production';
  }
} catch (e) {}

const { startMongo, stopMongo } = require('./mongoManager.cjs');
const { buildAppMenu } = require('./menu.cjs');

// Global Uncaught Exception Handlers to prevent silent app crashes on new devices
process.on('uncaughtException', (err) => {
  console.error('[Electron UncaughtException]', err);
  const msg = String((err && err.message) ? err.message : err);
  // Safely log non-fatal background service notices without annoying modal dialogs
  if (
    msg.includes('Unexpected non-whitespace') ||
    msg.includes('JSON') ||
    msg.includes('MongoMemoryServer') ||
    msg.includes('EADDRINUSE') ||
    msg.includes('ECONNREFUSED')
  ) {
    return;
  }
  try {
    if (dialog && dialog.showErrorBox) {
      dialog.showErrorBox('Nexus Suite Application Notice', `Background Service Notice: ${msg}`);
    }
  } catch (e) {}
});

process.on('unhandledRejection', (reason) => {
  console.error('[Electron UnhandledRejection]', reason);
});

let mainWindow = null;
let backendServer = null;
let isQuitting = false;
let PORT = 5050;

const isDev = !app.isPackaged && (process.env.NODE_ENV === 'development' || !!process.env.ELECTRON_START_URL);

// Single Instance Lock (Enforce single instance only in packaged production)
if (app.isPackaged) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    console.log('[Electron Main] Another instance is already running. Quitting.');
    app.quit();
    process.exit(0);
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  }
}

async function createWindow() {
  const appIcoPath = path.join(__dirname, 'icon.ico');
  const appPngPath = path.join(__dirname, 'icon.png');
  const iconPath = fs.existsSync(appIcoPath) ? appIcoPath : (fs.existsSync(appPngPath) ? appPngPath : undefined);
  const appIcon = iconPath ? nativeImage.createFromPath(iconPath) : undefined;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'Nexus Suite | Enterprise Invoices & Bills Dashboard',
    icon: appIcon || iconPath,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (appIcon && !appIcon.isEmpty()) {
    try {
      mainWindow.setIcon(appIcon);
    } catch (e) {
      console.warn('[Electron Main] setIcon error:', e);
    }
  }

  // No application menu bar (File / Edit / View / Window / Help) in the shipped app.
  try {
    const { Menu } = require('electron');
    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);
    mainWindow.removeMenu();
  } catch (e) {}

  const distIndexPath = path.join(__dirname, '../frontend/dist/index.html');
  const hasDistFile = fs.existsSync(distIndexPath);

  let loaded = false;
  if (!isDev && hasDistFile) {
    console.log(`[Electron Main] Production Mode: Loading local static bundle ${distIndexPath}`);
    try {
      await mainWindow.loadFile(distIndexPath);
      loaded = true;
    } catch (e) {
      console.warn('[Electron Main] loadFile error, falling back to HTTP:', e.message);
    }
  }

  if (!loaded) {
    const startUrl = process.env.ELECTRON_START_URL || (isDev ? 'http://127.0.0.1:3000' : `http://127.0.0.1:${PORT}`);
    console.log(`[Electron Main] Target renderer URL: ${startUrl}`);

    for (let attempt = 1; attempt <= 60; attempt++) {
      try {
        await mainWindow.loadURL(startUrl);
        loaded = true;
        break;
      } catch (err) {
        if (attempt % 5 === 0) {
          console.warn(`[Electron Main] Waiting for backend HTTP server (attempt ${attempt}/60)...`);
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  if (!loaded) {
    const fallbackUrl = `http://127.0.0.1:${PORT}`;
    console.log(`[Electron Main] Loading fallback URL: ${fallbackUrl}`);
    try {
      await mainWindow.loadURL(fallbackUrl);
    } catch (e) {
      console.error('[Electron Main] Fallback renderer load error:', e.message);
    }
  }

  // DevTools can be toggled via View -> Toggle Developer Tools or Ctrl+Shift+I
  // if (isDev) {
  //   mainWindow.webContents.openDevTools({ mode: 'detach' });
  // }

  // Confirm Exit Dialog on window Cross [X] Close button
  mainWindow.on('close', (e) => {
    if (isQuitting) return;

    e.preventDefault();

    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'none',
      buttons: ['OK', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: 'invoicepro-desktop',
      message: 'Are you sure you want to exit application?'
    });

    if (choice === 0) {
      isQuitting = true;
      app.quit();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Configure robust module resolution paths for packaged production mode
  const Module = require('module');
  const extraPaths = [
    path.join(__dirname, '../node_modules'),
    path.join(__dirname, '../backend/node_modules'),
    path.join(process.resourcesPath, 'backend/node_modules'),
    path.join(process.resourcesPath, 'app.asar/node_modules'),
    path.join(process.resourcesPath, 'app.asar/backend/node_modules')
  ];
  extraPaths.forEach((p) => {
    if (fs.existsSync(p) && !Module.globalPaths.includes(p)) {
      Module.globalPaths.push(p);
    }
  });

  // 1. Open Electron Window IMMEDIATELY so app UI displays instantly on any computer
  createWindow().catch((err) => {
    console.error('[Electron Main] createWindow error:', err);
  });

  // 2. Start Backend & Database services asynchronously in background
  try {
    console.log('[Electron Main] Starting MongoDB database...');
    startMongo().then((mongoUri) => {
      // Never let the embedded/local Mongo fallback overwrite a real cloud URI.
      const existing = process.env.MONGO_URI || '';
      const isCloud = existing && !existing.includes('127.0.0.1') && !existing.includes('localhost');
      if (mongoUri && !isCloud) process.env.MONGO_URI = mongoUri;
    }).catch((e) => {
      console.warn('[Electron Main] startMongo non-blocking error:', e.message);
    });

    console.log('[Electron Main] Starting Express API Server...');
    try {
      const backendModule = require('../backend/server');
      if (backendModule && typeof backendModule.startServer === 'function') {
        PORT = backendModule.PORT || 5050;
        backendServer = await backendModule.startServer(PORT);
      }
    } catch (srvErr) {
      console.error('[Electron Main] Express server launch error:', srvErr.stack || srvErr.message);
    }

    // ── License enforcement: bind the DPAPI vault + real machine fingerprint,
    //    then run the authoritative monotonic watchdog in the main process. ──
    try {
      const licenseState = require('../backend/src/licensing/licenseState');
      const { readVault, writeVault } = require('./licensing/vault');
      const { getMachineFingerprint } = require('./licensing/machineFingerprint');
      const watchdog = require('./licensing/watchdog');

      licenseState.init({ readVault, writeVault, getMachineFingerprint });
      await licenseState.evaluate().catch(() => {});

      // Per-client builds bundle a license so the customer types nothing.
      // Register it with licenseState — evaluate()/the watchdog then adopt it,
      // retry it if this device previously held a different license, and
      // auto-recover if it was blocked by the activation limit and a slot frees.
      try {
        const licCandidates = [
          path.join(__dirname, 'embedded-license.lic'),
          process.resourcesPath ? path.join(process.resourcesPath, 'embedded-license.lic') : null,
          process.execPath ? path.join(path.dirname(process.execPath), 'embedded-license.lic') : null
        ].filter(Boolean);
        for (const p of licCandidates) {
          if (!fs.existsSync(p)) continue;
          licenseState.setEmbeddedLicense(fs.readFileSync(p, 'utf8').trim());
          const st = await licenseState.evaluate({ force: true }).catch(() => null);
          console.log('[Electron Main] Embedded license ->', st && st.status);
          if (st && mainWindow && !mainWindow.isDestroyed()) {
            const { ENFORCED: _E } = require('../backend/src/licensing/enforcement');
            mainWindow.webContents.send('license:state', Object.assign({ enforced: _E }, st));
          }
          break;
        }
      } catch (e) {}

      const { ENFORCED } = require('../backend/src/licensing/enforcement');
      watchdog.start({
        intervalMs: 20000,
        onChange: (st) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('license:state', Object.assign({ enforced: ENFORCED }, st));
          }
        }
      });

      try {
        const { powerMonitor } = require('electron');
        powerMonitor.on('resume', () => watchdog.forceCheck());
        powerMonitor.on('unlock-screen', () => watchdog.forceCheck());
      } catch (e) {}

      global.__license = { licenseState, watchdog, getMachineFingerprint };
      console.log('[Electron Main] License watchdog active.');
    } catch (licErr) {
      console.error('[Electron Main] License wiring error:', licErr.stack || licErr.message);
    }
  } catch (err) {
    console.error('[Electron Main] Error initializing backend services:', err.stack || err.message);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (backendServer && backendServer.close) {
    try { backendServer.close(); } catch (e) {}
  }
  await stopMongo();
});

// ── License IPC (renderer <-> main). Not gated: reachable pre-login / while locked. ──
function withEnforced(state) {
  try {
    const { ENFORCED } = require('../backend/src/licensing/enforcement');
    return Object.assign({ enforced: ENFORCED }, state);
  } catch (e) {
    return state;
  }
}
ipcMain.handle('license:get-state', () => {
  try { return withEnforced(require('../backend/src/licensing/licenseState').getState()); }
  catch (e) { return { ok: false, status: 'INVALID', code: 'LICENSE_INTERNAL', reason: e.message }; }
});
ipcMain.handle('license:refresh', async () => {
  try { return withEnforced(await require('../backend/src/licensing/licenseState').evaluate({ force: true })); }
  catch (e) { return { ok: false, status: 'INVALID', code: 'LICENSE_INTERNAL', reason: e.message }; }
});
ipcMain.handle('license:activate', async (event, licenseKey) => {
  try {
    const st = await require('../backend/src/licensing/licenseState').activate({ licString: String(licenseKey || '').trim() });
    const payload = withEnforced(st);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('license:state', payload);
    return { success: true, license: payload };
  } catch (err) {
    return { success: false, code: err.code || 'ACTIVATION_FAILED', message: err.message || 'Activation failed.' };
  }
});
ipcMain.handle('license:get-machine-id', () => {
  try { return require('./licensing/machineFingerprint').getMachineFingerprint().hash; }
  catch (e) { return ''; }
});
ipcMain.handle('license:clear', () => {
  try { return require('../backend/src/licensing/licenseState').clearLocal(); }
  catch (e) { return { ok: false, status: 'NOT_ACTIVATED', code: 'LICENSE_NOT_ACTIVATED' }; }
});

// Window IPC Handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('quit-app', () => {
  isQuitting = true;
  app.quit();
});

// List printers connected to this machine
ipcMain.handle('list-printers', async () => {
  try {
    if (mainWindow && mainWindow.webContents && typeof mainWindow.webContents.getPrintersAsync === 'function') {
      const printers = await mainWindow.webContents.getPrintersAsync();
      return (printers || []).map((p) => ({
        name: p.name,
        displayName: p.displayName || p.name,
        isDefault: !!p.isDefault,
        status: p.status,
        location: (p.options && (p.options['printer-location'] || p.options['location'])) || p.description || ''
      }));
    }
    if (mainWindow && mainWindow.webContents && typeof mainWindow.webContents.getPrinters === 'function') {
      return (mainWindow.webContents.getPrinters() || []).map((p) => ({
        name: p.name, displayName: p.displayName || p.name, isDefault: !!p.isDefault, status: p.status
      }));
    }
  } catch (e) {
    console.warn('[Print] list-printers error:', e.message);
  }
  return [];
});

// Print invoice HTML directly (optionally silent, optionally to a named printer)
ipcMain.handle('print-html', async (event, { html, printerName, silent, invoiceId }) => {
  return await new Promise((resolve) => {
    let win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    });
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      try { if (win && !win.isDestroyed()) win.close(); } catch (e) {}
      win = null;
      resolve(result);
    };

    const fullDoc = `<!doctype html><html><head><meta charset="utf-8">
      <style>@page{margin:8mm} html,body{margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif} *{box-sizing:border-box}</style>
      </head><body>${html || ''}</body></html>`;

    // No physical printer chosen (or a PDF/XPS "printer") → generate a PDF file
    // ourselves and drop it straight into Downloads, named by the invoice number.
    // No "Save as" dialog.
    const isPdfTarget = !printerName || /pdf|xps|onenote|fax/i.test(String(printerName));

    win.webContents.once('did-finish-load', async () => {
      if (isPdfTarget) {
        try {
          const data = await win.webContents.printToPDF({
            printBackground: true,
            margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
          });
          const invoicesDir = path.join(app.getPath('desktop'), 'Nexus Invoices');
          if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });
          const safe = String(invoiceId || `Invoice_${Date.now()}`).replace(/[^A-Za-z0-9._-]/g, '_');
          let outPath = path.join(invoicesDir, `${safe}.pdf`);
          let n = 1;
          while (fs.existsSync(outPath)) { outPath = path.join(invoicesDir, `${safe} (${n++}).pdf`); }
          fs.writeFileSync(outPath, data);
          done({ success: true, pdf: true, savedPath: outPath, folderPath: invoicesDir });
        } catch (e) {
          done({ success: false, failureReason: e.message });
        }
        return;
      }

      const opts = {
        silent: !!silent,
        printBackground: true,
        margins: { marginType: 'custom', top: 20, bottom: 20, left: 20, right: 20 },
        deviceName: printerName
      };
      try {
        win.webContents.print(opts, (success, failureReason) => {
          done({ success: !!success, failureReason: failureReason || '' });
        });
      } catch (e) {
        done({ success: false, failureReason: e.message });
      }
    });

    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullDoc)).catch((e) => {
      done({ success: false, failureReason: e.message });
    });

    setTimeout(() => done({ success: false, failureReason: 'timeout' }), 20000);
  });
});

ipcMain.handle('save-pdf-file', async (event, { base64Data, defaultFilename }) => {
  try {
    // Save into Desktop\Nexus Invoices so the shop owner can find it instantly.
    const invoicesDir = path.join(app.getPath('desktop'), 'Nexus Invoices');
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

    const filename = defaultFilename || `Invoice_${Date.now()}.pdf`;
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    let targetPath = path.join(invoicesDir, filename);
    let counter = 1;
    while (fs.existsSync(targetPath)) {
      targetPath = path.join(invoicesDir, `${base} (${counter})${ext}`);
      counter++;
    }

    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(targetPath, buffer);
    console.log(`[Electron] PDF saved to: ${targetPath}`);
    return { success: true, filePath: targetPath, folderPath: invoicesDir };
  } catch (err) {
    console.error('Error auto-saving PDF file in desktop app:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('copy-pdf-to-clipboard', async (event, { base64Data, defaultFilename }) => {
  try {
    const tempDir = app.getPath('temp');
    const tempFilePath = path.join(tempDir, defaultFilename || 'Invoice.pdf');
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(tempFilePath, buffer);

    if (process.platform === 'win32') {
      const ucs2Buffer = Buffer.from(tempFilePath + '\0', 'ucs2');
      clipboard.writeBuffer('FileNameW', ucs2Buffer);
    }
    return { success: true, tempFilePath };
  } catch (err) {
    console.error('Error copying PDF file to clipboard:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-pdf-file-silent', async (event, { base64Data, defaultFilename }) => {
  try {
    // Save to Desktop/Nexus Invoices/ so user can easily find and attach in WhatsApp
    const desktopDir = app.getPath('desktop');
    const invoicesDir = path.join(desktopDir, 'Nexus Invoices');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }
    const pdfFilePath = path.join(invoicesDir, defaultFilename || 'Invoice.pdf');
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(pdfFilePath, buffer);

    // Also copy as file to Windows clipboard (allows Ctrl+V paste as file)
    if (process.platform === 'win32') {
      const ucs2Buffer = Buffer.from(pdfFilePath + '\0', 'ucs2');
      clipboard.writeBuffer('FileNameW', ucs2Buffer);
    }
    return { success: true, filePath: pdfFilePath, folderPath: invoicesDir };
  } catch (err) {
    console.error('Error saving PDF file silently:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-pdf-folder', async (event, folderPath) => {
  try {
    if (folderPath && fs.existsSync(folderPath)) {
      await shell.openPath(folderPath);
      return { success: true };
    }
    // fallback: open Desktop/Nexus Invoices
    const desktopDir = app.getPath('desktop');
    const invoicesDir = path.join(desktopDir, 'Nexus Invoices');
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });
    await shell.openPath(invoicesDir);
    return { success: true };
  } catch (err) {
    console.error('Error opening PDF folder:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-external-url', async (event, url) => {
  try {
    if (url) {
      await shell.openExternal(url);
      return { success: true };
    }
    return { success: false };
  } catch (err) {
    console.error('Error opening external URL:', err);
    return { success: false, error: err.message };
  }
});

// ─── WhatsApp PDF Auto-Send via embedded WhatsApp Web window ──────────────────
let whatsappWindow = null;

ipcMain.handle('send-whatsapp-pdf', async (event, { base64Data, pdfFilename, phone }) => {
  try {
    // 1. Save PDF to Desktop\Nexus Invoices (overwrite — no (1)(2)(3) clutter).
    const invoicesDir = path.join(app.getPath('desktop'), 'Nexus Invoices');
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });
    const cleanName = String(pdfFilename || 'Invoice.pdf').replace(/[^A-Za-z0-9._-]/g, '_');
    const pdfFilePath = path.join(invoicesDir, cleanName);
    await fs.promises.writeFile(pdfFilePath, Buffer.from(base64Data, 'base64'));
    console.log('[WA] PDF saved:', pdfFilePath);

    // 2. Put the PDF on the clipboard as a real file so Ctrl+V attaches it.
    let clipCopied = false;
    if (process.platform === 'win32') {
      try {
        const { execFileSync } = require('child_process');
        execFileSync('powershell', [
          '-NoProfile', '-NonInteractive', '-Command',
          `Set-Clipboard -LiteralPath ${JSON.stringify(pdfFilePath)}`
        ], { timeout: 8000, windowsHide: true });
        clipCopied = true;
      } catch (e) {
        console.warn('[WA] Set-Clipboard failed:', e.message);
        try {
          clipboard.writeBuffer('FileNameW', Buffer.from(pdfFilePath + '\0', 'ucs2'));
          clipCopied = true;
        } catch (e2) {}
      }
    }

    // 3. Open the WhatsApp chat for this number. wa.me works for both the
    //    desktop app and WhatsApp Web.
    const num = String(phone || '').replace(/[^0-9]/g, '');
    let opened = false;
    if (num) {
      try { await shell.openExternal(`https://wa.me/${num}`); opened = true; } catch (e) {}
      if (!opened) { try { await shell.openExternal(`whatsapp://send?phone=${num}`); opened = true; } catch (e) {} }
    }

    // (Auto keystroke-send removed: it is unreliable across WhatsApp Web tabs /
    //  the Store app. The PDF is on the clipboard — one Ctrl+V in the chat.)
    return { success: true, pdfPath: pdfFilePath, folderPath: invoicesDir, opened, clipboard: clipCopied, autoSent: false };
  } catch (err) {
    console.error('[WA] send-whatsapp-pdf error:', err);
    return { success: false, error: err.message };
  }
});


