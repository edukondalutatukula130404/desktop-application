const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  savePdfFile: (base64Data, defaultFilename) => ipcRenderer.invoke('save-pdf-file', { base64Data, defaultFilename }),
  savePdfFileSilent: (base64Data, defaultFilename) => ipcRenderer.invoke('save-pdf-file-silent', { base64Data, defaultFilename }),
  copyPdfToClipboard: (base64Data, defaultFilename) => ipcRenderer.invoke('copy-pdf-to-clipboard', { base64Data, defaultFilename }),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  openPdfFolder: (folderPath) => ipcRenderer.invoke('open-pdf-folder', folderPath),
  sendWhatsappPdf: (base64Data, pdfFilename, phone) => ipcRenderer.invoke('send-whatsapp-pdf', { base64Data, pdfFilename, phone }),
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  printHtml: (html, opts) => ipcRenderer.invoke('print-html', { html, printerName: (opts && opts.printerName) || '', silent: !!(opts && opts.silent), invoiceId: (opts && opts.invoiceId) || '' }),
  isDesktop: true,

  // ── Licensing ──
  license: {
    getState: () => ipcRenderer.invoke('license:get-state'),
    refresh: () => ipcRenderer.invoke('license:refresh'),
    activate: (licenseKey) => ipcRenderer.invoke('license:activate', licenseKey),
    getMachineId: () => ipcRenderer.invoke('license:get-machine-id'),
    clear: () => ipcRenderer.invoke('license:clear'),
    onStateChange: (cb) => {
      const handler = (_e, state) => { try { cb(state); } catch (err) {} };
      ipcRenderer.on('license:state', handler);
      return () => ipcRenderer.removeListener('license:state', handler);
    }
  }
});
