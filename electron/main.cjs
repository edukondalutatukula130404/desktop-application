const { app, BrowserWindow, ipcMain, dialog, clipboard, shell, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { startMongo, stopMongo } = require('./mongoManager.cjs');
const { buildAppMenu } = require('./menu.cjs');

// Global Uncaught Exception Handlers to prevent silent app crashes on new devices
process.on('uncaughtException', (err) => {
  console.error('[Electron UncaughtException]', err);
  try {
    if (dialog && dialog.showErrorBox) {
      dialog.showErrorBox('Nexus Suite Application Warning', `Background Service Warning: ${err.message || err}`);
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
    autoHideMenuBar: false,
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

  buildAppMenu(mainWindow);

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

  // Confirm Exit Dialog on Close
  mainWindow.on('close', (e) => {
    if (isQuitting) return;

    e.preventDefault();

    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Exit Application', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Confirm Exit',
      message: 'Are you sure you want to exit InvoicePro Desktop?',
      detail: 'Any active operations will be safely finalized before exit.'
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
  // 1. Open Electron window immediately (under 1 second startup)
  const windowPromise = createWindow();

  // 2. Start Backend & Database services asynchronously
  (async () => {
    try {
      console.log('[Electron Main] Starting MongoDB database...');
      const mongoUri = await startMongo();
      process.env.MONGO_URI = mongoUri;

      console.log('[Electron Main] Starting Express API Server...');
      try {
        const backendModule = require('../backend/server');
        if (backendModule && typeof backendModule.startServer === 'function') {
          PORT = backendModule.PORT || 5050;
          backendServer = await backendModule.startServer(PORT);
        }
      } catch (srvErr) {
        console.error('[Electron Main] Express server launch error:', srvErr.message);
      }
    } catch (err) {
      console.error('[Electron Main] Error initializing backend services:', err.message);
    }
  })();

  await windowPromise;

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
ipcMain.handle('quit-app', () => app.quit());

ipcMain.handle('save-pdf-file', async (event, { base64Data, defaultFilename }) => {
  try {
    const downloadsDir = app.getPath('downloads');
    const filename = defaultFilename || `Invoice_${Date.now()}.pdf`;
    let targetPath = path.join(downloadsDir, filename);

    let counter = 1;
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    while (fs.existsSync(targetPath)) {
      targetPath = path.join(downloadsDir, `${base}_(${counter})${ext}`);
      counter++;
    }

    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(targetPath, buffer);
    console.log(`[Electron] PDF automatically saved to: ${targetPath}`);
    return { success: true, filePath: targetPath };
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
    // 1. Save PDF to Desktop/Nexus Invoices/
    const desktopDir = app.getPath('desktop');
    const invoicesDir = path.join(desktopDir, 'Nexus Invoices');
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });
    const pdfFilePath = path.join(invoicesDir, pdfFilename || 'Invoice.pdf');
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(pdfFilePath, buffer);
    console.log('[WA] PDF saved:', pdfFilePath);

    // 2. Close previous WhatsApp window if open
    if (whatsappWindow && !whatsappWindow.isDestroyed()) {
      try { whatsappWindow.close(); } catch(e) {}
    }

    // 3. Open WhatsApp Web in dedicated BrowserWindow — phone number only, no text
    whatsappWindow = new BrowserWindow({
      width: 1200, height: 800,
      title: 'WhatsApp',
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: true,
      }
    });

    // 4. Attach CDP debugger & enable file chooser interception BEFORE navigation
    const dbg = whatsappWindow.webContents.debugger;
    try { dbg.attach('1.3'); } catch(e) {}
    await dbg.sendCommand('Page.enable');
    await dbg.sendCommand('Page.setInterceptFileChooserDialog', { enabled: true });

    // 5. When CDP fires fileChooserOpened → auto-select our PDF
    dbg.on('message', async (evt, method, params) => {
      if (method === 'Page.fileChooserOpened') {
        console.log('[WA CDP] fileChooserOpened — injecting PDF:', pdfFilePath);
        try {
          await dbg.sendCommand('Page.handleFileChooser', {
            action: 'accept',
            files: [pdfFilePath]
          });
          console.log('[WA CDP] PDF injected into file chooser.');
        } catch (cdpErr) {
          console.error('[WA CDP] handleFileChooser error:', cdpErr.message);
        }
      }
    });

    // 6. Load WhatsApp Web — phone only, no pre-filled text
    const waUrl = `https://web.whatsapp.com/send?phone=${phone}`;
    console.log('[WA] Loading:', waUrl);
    await whatsappWindow.loadURL(waUrl, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });

    // 7. Automation script — injected via dom-ready, polls for each UI element
    const automationScript = `
      (async function autoSendPdf() {
        const sleep = ms => new Promise(r => setTimeout(r, ms));

        async function waitFor(selectors, timeoutMs = 60000) {
          const sels = Array.isArray(selectors) ? selectors : [selectors];
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            for (const sel of sels) {
              const el = document.querySelector(sel);
              if (el) return el;
            }
            await sleep(600);
          }
          return null;
        }

        function clickEl(el) {
          if (!el) return false;
          try {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
            el.click();
            return true;
          } catch(e) { return false; }
        }

        console.log('[WA-Auto] Waiting for WhatsApp chat UI...');

        // Wait for the compose box (proves WhatsApp is fully loaded and chat is open)
        const compose = await waitFor([
          '[data-testid="conversation-compose-box-input"]',
          'div[contenteditable="true"][data-tab]',
          'div[role="textbox"]'
        ], 90000);

        if (!compose) {
          console.warn('[WA-Auto] Compose box not found. User may need to log in (scan QR).');
          return;
        }
        console.log('[WA-Auto] WhatsApp loaded. Compose box found.');
        await sleep(1200);

        // Clear any pre-filled text in compose box (don't send text, only PDF)
        try {
          compose.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);
        } catch(e) {}
        await sleep(400);

        // Click attachment button (paperclip / plus icon)
        const attachBtn = await waitFor([
          '[data-testid="attach-menu-plus"]',
          '[data-icon="attach-menu-plus"]',
          'button[title="Attach"]',
          'span[data-icon="attach"]',
          'span[data-icon="plus"]',
          '[aria-label="Attach"]',
        ], 10000);

        if (attachBtn) {
          clickEl(attachBtn.closest('button') || attachBtn.closest('[role="button"]') || attachBtn);
          console.log('[WA-Auto] Attach button clicked.');
        } else {
          // Fallback: iterate all spans to find attach/clip icon
          const allSpans = document.querySelectorAll('span[data-icon]');
          let clicked = false;
          for (const sp of allSpans) {
            const icon = sp.getAttribute('data-icon') || '';
            if (icon === 'attach-menu-plus' || icon === 'attach' || icon === 'clip' || icon === 'plus') {
              clickEl(sp.closest('button, [role="button"]') || sp);
              console.log('[WA-Auto] Attach icon clicked via fallback:', icon);
              clicked = true;
              break;
            }
          }
          if (!clicked) {
            console.warn('[WA-Auto] Attach button NOT found. Trying direct file input...');
          }
        }
        await sleep(800);

        // Click "Document" option from attachment menu
        const docOption = await waitFor([
          '[data-testid="mi-attach-document"]',
          '[aria-label="Document"]',
          'li[aria-label="Document"]',
        ], 5000);

        if (docOption) {
          clickEl(docOption);
          console.log('[WA-Auto] Document option clicked.');
          await sleep(600);
        }

        // Trigger the file input (CDP intercepts and injects our PDF)
        const fileInput = await waitFor('input[type="file"]', 5000);
        if (fileInput) {
          fileInput.click();
          console.log('[WA-Auto] File input triggered — CDP will inject PDF.');
        } else {
          console.warn('[WA-Auto] File input not found after document click.');
        }

        // Wait for preview to render after CDP injects the file
        await sleep(3500);

        // Click the Send button
        const sendBtn = await waitFor([
          '[data-testid="send"]',
          'button[aria-label="Send"]',
          'span[data-testid="send"]',
          '[data-icon="send"]',
        ], 8000);

        if (sendBtn) {
          clickEl(sendBtn.closest('button, [role="button"]') || sendBtn);
          console.log('[WA-Auto] SEND clicked — PDF sent successfully!');
        } else {
          // Last resort: find send button by icon
          const allIcons = document.querySelectorAll('span[data-icon]');
          for (const ic of allIcons) {
            if (ic.getAttribute('data-icon') === 'send') {
              clickEl(ic.closest('button, [role="button"]') || ic);
              console.log('[WA-Auto] Send icon clicked via fallback.');
              break;
            }
          }
        }
      })();
    `;

    // Run automation on dom-ready (earlier than did-finish-load, WhatsApp loads progressively)
    whatsappWindow.webContents.on('dom-ready', () => {
      console.log('[WA] dom-ready — scheduling automation...');
      // Small delay then inject; WhatsApp still loads React after dom-ready
      setTimeout(async () => {
        try {
          await whatsappWindow.webContents.executeJavaScript(automationScript);
        } catch(jsErr) {
          console.error('[WA] Automation injection error:', jsErr.message);
        }
      }, 3000);
    });

    return { success: true, pdfPath: pdfFilePath };
  } catch (err) {
    console.error('[WA] send-whatsapp-pdf error:', err);
    return { success: false, error: err.message };
  }
});

