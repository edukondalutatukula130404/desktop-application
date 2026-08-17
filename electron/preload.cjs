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
  isDesktop: true
});
