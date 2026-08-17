const { app, BrowserWindow, ipcMain, Menu, dialog, clipboard, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { startServer, PORT } = require('../backend/server');

let mainWindow = null;
let backendServer = null;

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'InvoicePro Desktop App',
    show: true,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    // In Dev Mode, connect to Vite Dev Server
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:3000';
    console.log(`[Electron Main] Dev Mode: Loading ${devUrl}`);
    try {
      await mainWindow.loadURL(devUrl);
    } catch (err) {
      console.error(`[Electron Main] Failed to load ${devUrl}, retrying...`, err.message);
      setTimeout(() => mainWindow.loadURL(devUrl), 1000);
    }
    mainWindow.webContents.openDevTools();
  } else {
    // In Production Mode, connect to local Express server endpoint
    const prodUrl = `http://127.0.0.1:${PORT}`;
    console.log(`[Electron Main] Production Mode: Loading ${prodUrl}`);
    await mainWindow.loadURL(prodUrl);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    console.log('[Electron Main] Starting Backend & Database Services...');
    backendServer = startServer(PORT);
  } catch (err) {
    console.error('[Electron Main] Error launching backend server:', err.message);
  }

  await createWindow();


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

app.on('before-quit', () => {
  if (backendServer && backendServer.close) {
    backendServer.close();
  }
});

// IPC handlers for UI interactions
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
    const tempDir = app.getPath('temp');
    const tempFilePath = path.join(tempDir, defaultFilename || 'Invoice.pdf');
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(tempFilePath, buffer);

    if (process.platform === 'win32') {
      const ucs2Buffer = Buffer.from(tempFilePath + '\0', 'ucs2');
      clipboard.writeBuffer('FileNameW', ucs2Buffer);
    }
    return { success: true, filePath: tempFilePath };
  } catch (err) {
    console.error('Error saving PDF file silently:', err);
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
