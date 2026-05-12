import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  downloadImages: (params: any) => ipcRenderer.invoke('download-images', params),
  getConfig: () => ipcRenderer.invoke('get-config'),
  getLocalImages: (params: any) => ipcRenderer.invoke('get-local-images', params),
  getUsers: () => ipcRenderer.invoke('get-users'),
  getImages: (params: any) => ipcRenderer.invoke('get-images', params),
  setSaveFolder: (folderPath: string) => ipcRenderer.invoke('set-save-folder', folderPath),
  startPresentation: () => ipcRenderer.send('start-presentation'),
  sendPresentationCommand: (cmd: string, data?: any) => ipcRenderer.send('presentation-command', cmd, data),
  onPresentationEvent: (callback: (event: any, cmd: string, data: any) => void) => {
    ipcRenderer.on('presentation-event', callback);
    return () => ipcRenderer.removeAllListeners('presentation-event');
  }
})
