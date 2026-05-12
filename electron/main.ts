import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import axios from 'axios'
import fs from 'fs'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

// Define simple Mongoose models
const UserSchema = new mongoose.Schema({ username: String });
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const ImageSchema = new mongoose.Schema({ 
  userId: mongoose.Schema.Types.ObjectId, 
  filename: String, 
  r2Key: String,
  createdAt: Date
});
const Image = mongoose.models.Image || mongoose.model('Image', ImageSchema);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // allow file:// loading for images
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

let presentationWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  // Connect to MongoDB
  if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI).catch(err => console.error('MongoDB connection error:', err));
  } else {
    console.error('No MONGODB_URI found in .env');
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.on('start-presentation', () => {
  if (presentationWindow) {
    presentationWindow.focus()
    return
  }

  presentationWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    presentationWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/presentation`)
  } else {
    presentationWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'presentation' })
  }

  presentationWindow.on('closed', () => {
    presentationWindow = null
  })
})

ipcMain.on('presentation-command', (event, cmd, data) => {
  if (presentationWindow) {
    presentationWindow.webContents.send('presentation-event', cmd, data)
  }
})

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

// Define explicit types for IPC params to avoid TS errors
interface DownloadParams {
  folderPath: string;
  username: string;
  images: { filename: string; url: string }[];
}

ipcMain.handle('download-images', async (event: any, { folderPath, username, images }: DownloadParams) => {
  const userFolder = path.join(folderPath, username)
  
  if (!fs.existsSync(userFolder)) {
    fs.mkdirSync(userFolder, { recursive: true })
  }

  const results = []
  
  for (const img of images) {
    const filePath = path.join(userFolder, img.filename)
    try {
      if (fs.existsSync(filePath)) {
        results.push({ filename: img.filename, status: 'skipped', localUrl: `file://${filePath}` })
        continue
      }
      
      const response = await axios({
        url: img.url,
        method: 'GET',
        responseType: 'stream'
      })
      
      const writer = fs.createWriteStream(filePath)
      
      await new Promise((resolve, reject) => {
        response.data.pipe(writer)
        let error: Error | null = null;
        writer.on('error', err => {
          error = err;
          writer.close();
          reject(err);
        });
        writer.on('close', () => {
          if (!error) resolve(true);
        });
      })
      
      results.push({ filename: img.filename, status: 'downloaded', localUrl: `file://${filePath}` })
    } catch (err) {
      console.error(`Failed to download ${img.filename}`, err)
      results.push({ filename: img.filename, status: 'error' })
    }
  }
  
  return results
})

const getConfigData = () => {
  const configPath = path.join(app.getPath('userData'), 'user-config.json')
  let saveFolder = path.join(app.getPath('documents'), 'SonyFestOfflineImages')
  
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      if (data.saveFolder) saveFolder = data.saveFolder
    } catch (err) {}
  }
  return { saveFolder }
}

ipcMain.handle('get-config', () => {
  return getConfigData()
})

ipcMain.handle('set-save-folder', async (event, folderPath) => {
  const configPath = path.join(app.getPath('userData'), 'user-config.json')
  fs.writeFileSync(configPath, JSON.stringify({ saveFolder: folderPath }), 'utf8')
  return getConfigData()
})

interface GetLocalImagesParams {
  folderPath: string;
  username: string;
}

ipcMain.handle('get-local-images', (event: any, { folderPath, username }: GetLocalImagesParams) => {
  const userFolder = path.join(folderPath, username)
  if (!fs.existsSync(userFolder)) return []
  
  const files = fs.readdirSync(userFolder)
  return files
    .filter(f => f.match(/\.(jpg|jpeg|png|gif|webp)$/i))
    .map(filename => ({
      filename,
      localUrl: `file://${path.join(userFolder, filename)}`
    }))
})

ipcMain.handle('get-users', async () => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 }).lean();
    return users.map((u: any) => ({ _id: u._id.toString(), username: u.username }));
  } catch (err) {
    console.error('Failed to fetch users from DB:', err);
    return [];
  }
})

ipcMain.handle('get-images', async (event: any, { userId }: { userId: string }) => {
  try {
    const images = await Image.find({ userId }).sort({ createdAt: -1 }).lean();
    const publicUrl = process.env.R2_PUBLIC_URL || '';
    
    return images.map((img: any) => ({
      id: img._id.toString(),
      filename: img.filename,
      url: `${publicUrl}/${img.r2Key}`
    }));
  } catch (err) {
    console.error('Failed to fetch images from DB:', err);
    return [];
  }
})
