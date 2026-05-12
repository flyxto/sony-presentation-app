import { useState, useEffect } from 'react'
import DashboardView from './DashboardView'
import PresentationView from './PresentationView'

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      downloadImages: (params: { folderPath: string; username: string; images: any[] }) => Promise<any[]>;
      getConfig: () => Promise<any>;
      getLocalImages: (params: { folderPath: string; username: string }) => Promise<any[]>;
      getUsers: () => Promise<any[]>;
      getImages: (params: { userId: string }) => Promise<any[]>;
      setSaveFolder: (folderPath: string) => Promise<any>;
      startPresentation: () => void;
      sendPresentationCommand: (cmd: string, data?: any) => void;
      onPresentationEvent: (callback: (event: any, cmd: string, data: any) => void) => () => void;
    };
  }
}

export default function App() {
  const [route, setRoute] = useState(window.location.hash)

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (route === '#/presentation') {
    return <PresentationView />
  }

  return <DashboardView />
}
