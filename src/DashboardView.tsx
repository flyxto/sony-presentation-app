import { useState, useEffect } from 'react';
import { Users, MonitorPlay, Search, RefreshCw, ServerOff, ChevronLeft, ChevronRight, HardDriveDownload } from 'lucide-react';

interface User {
  _id: string;
  fullName: string;
}

interface Image {
  id?: string;
  filename: string;
  url?: string;
  localUrl?: string;
}

export default function DashboardView() {
  const [config, setConfig] = useState({ saveFolder: '' });
  
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const [images, setImages] = useState<Image[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'done'>('idle');
  
  const [globalSyncStatus, setGlobalSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'done'>('idle');
  const [syncingUser, setSyncingUser] = useState('');
  
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    async function init() {
      if (window.electronAPI) {
        const conf = await window.electronAPI.getConfig();
        setConfig(conf);
        
        try {
          const fetchedUsers = await window.electronAPI.getUsers();
          setUsers(fetchedUsers);
          if (fetchedUsers.length > 0) setIsOffline(false);
        } catch (err) {
          console.error(err);
          setIsOffline(true);
        }
      }
    }
    init();
  }, []);

  const loadLocalImages = async (user: User, folder: string) => {
    if (!window.electronAPI) return;
    const localFiles = await window.electronAPI.getLocalImages({
      folderPath: folder,
      fullName: user.fullName
    });
    setImages(localFiles);
    setSyncStatus('idle');
  };

  const selectUser = async (user: User) => {
    setSelectedUser(user);
    setSearchQuery('');
    setImages([]);
    
    await loadLocalImages(user, config.saveFolder);
  };

  const handleSyncUser = async () => {
    if (!selectedUser) return;
    setSyncStatus('syncing');
    try {
      const fetchedImages = await window.electronAPI.getImages({ userId: selectedUser._id });
      if (window.electronAPI) {
        await window.electronAPI.downloadImages({
          folderPath: config.saveFolder,
          fullName: selectedUser.fullName,
          images: fetchedImages
        });
        await loadLocalImages(selectedUser, config.saveFolder);
      }
      setSyncStatus('done');
      setIsOffline(false);
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      setIsOffline(true);
    }
  };

  const handleSyncAll = async () => {
    if (!config.saveFolder) return;
    setGlobalSyncStatus('syncing');
    
    try {
      for (const u of users) {
        setSyncingUser(u.fullName);
        const fetchedImages = await window.electronAPI.getImages({ userId: u._id });
        if (fetchedImages.length > 0) {
          await window.electronAPI.downloadImages({
            folderPath: config.saveFolder,
            fullName: u.fullName,
            images: fetchedImages
          });
        }
      }
      setGlobalSyncStatus('done');
      setSyncingUser('');
      if (selectedUser) {
        loadLocalImages(selectedUser, config.saveFolder);
      }
      setIsOffline(false);
    } catch (err) {
      console.error(err);
      setGlobalSyncStatus('error');
      setIsOffline(true);
    }
  };

  const startRemotePresentation = () => {
    window.electronAPI.startPresentation();
    setTimeout(() => {
      window.electronAPI.sendPresentationCommand('load-images', images);
    }, 1000); // give the window a second to load if it's new
  };

  const filteredUsers = users.filter(u => u.fullName.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto flex flex-col gap-6">
      <header className="flex items-center justify-between vault-card p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <MonitorPlay className="text-[#c9a84c] w-6 h-6" />
          <h1 className="text-lg font-bold">Dashboard Control Center</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#1a1610] px-3 py-1.5 rounded border border-[#2e281c]">
            <span className="text-xs text-[#7a7060] truncate max-w-[200px]" title={config.saveFolder}>
              {config.saveFolder || 'Loading folder...'}
            </span>
            <button 
              onClick={async () => {
                if (window.electronAPI) {
                  const folder = await window.electronAPI.selectFolder();
                  if (folder) {
                    const newConfig = await window.electronAPI.setSaveFolder(folder);
                    setConfig(newConfig);
                  }
                }
              }}
              className="text-xs text-[#c9a84c] hover:underline"
            >
              Change Folder
            </button>
          </div>
          <button 
            onClick={handleSyncAll}
            disabled={globalSyncStatus === 'syncing' || isOffline || users.length === 0}
            className="vault-btn-secondary flex items-center gap-2 text-sm px-4 py-2"
          >
            <HardDriveDownload className={`w-4 h-4 ${globalSyncStatus === 'syncing' ? 'animate-bounce' : ''}`} />
            {globalSyncStatus === 'syncing' ? `Syncing @${syncingUser}...` : 'Sync Everything'}
          </button>
          {isOffline && (
            <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
              <ServerOff className="w-4 h-4" /> Offline
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        
        {/* Left Sidebar - Users List */}
        <div className="vault-card rounded-xl flex flex-col overflow-hidden h-[calc(100vh-8rem)]">
          <div className="p-4 border-b border-[#2e281c]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7a7060]" />
              <input 
                type="text" 
                placeholder="Search users..." 
                className="vault-input pl-10"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredUsers.length === 0 ? (
               <div className="text-center p-4 text-[#7a7060] text-sm">No users found.</div>
            ) : (
              filteredUsers.map(u => (
                <button 
                  key={u._id}
                  onClick={() => selectUser(u)}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors mb-1 ${selectedUser?._id === u._id ? 'bg-[#c9a84c]/20 text-[#c9a84c]' : 'hover:bg-[#1a1610]'}`}
                >
                  <Users className="w-5 h-5 opacity-70" />
                  <span className="font-medium">{u.fullName}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Content - Controls */}
        <div className="md:col-span-2 vault-card rounded-xl p-6 flex flex-col items-center justify-center text-center">
          {!selectedUser ? (
            <div className="text-[#7a7060] max-w-sm">
              <MonitorPlay className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <h2 className="text-xl font-medium text-[#e8dfc8] mb-2">Dashboard Ready</h2>
              <p>Select a user to control their presentation, or use 'Sync Everything' to download all data offline.</p>
            </div>
          ) : (
            <div className="w-full max-w-md space-y-8">
              <h2 className="text-3xl font-display text-[#c9a84c] mb-2">@{selectedUser.fullName}</h2>
              
              <div className="bg-[#1a1610] border border-[#2e281c] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MonitorPlay className="w-5 h-5 text-[#c9a84c]" />
                    <span className="text-lg font-medium">{images.length} Local Images</span>
                  </div>
                  <button 
                    onClick={handleSyncUser}
                    disabled={syncStatus === 'syncing' || isOffline || globalSyncStatus === 'syncing'}
                    className="vault-btn-secondary py-2 px-4 flex items-center gap-2 text-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                    {syncStatus === 'syncing' ? 'Syncing...' : 'Sync User'}
                  </button>
                </div>
                
                {(syncStatus === 'syncing') && (
                  <div className="w-full bg-[#0e0c09] rounded-full h-2 mb-2 overflow-hidden">
                    <div className="bg-[#c9a84c] h-2 rounded-full w-full animate-pulse"></div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <button 
                  onClick={startRemotePresentation}
                  disabled={images.length === 0}
                  className="vault-btn-primary w-full py-4 text-lg flex items-center justify-center gap-3"
                >
                  <MonitorPlay className="w-6 h-6" />
                  Open Presentation Window
                </button>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => window.electronAPI.sendPresentationCommand('prev')}
                    disabled={images.length === 0}
                    className="vault-btn-secondary py-4 flex items-center justify-center gap-2 hover:bg-[#2e281c] transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" /> Previous
                  </button>
                  <button 
                    onClick={() => window.electronAPI.sendPresentationCommand('next', { max: images.length - 1 })}
                    disabled={images.length === 0}
                    className="vault-btn-secondary py-4 flex items-center justify-center gap-2 hover:bg-[#2e281c] transition-colors"
                  >
                    Next <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <p className="text-xs text-[#7a7060] mt-4">
                Ensure the presentation window is open before clicking Next/Prev.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
