
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Project, ProjectStatus, User, UserRole, MaterialStatus, AuditLog, ProjectType, Attachment } from './types';
import ProjectList from './components/ProjectList';
import ProjectDetail from './components/ProjectDetail';
import UserManagement from './components/UserManagement';
import AddProjectModal from './components/AddProjectModal';
import EditProjectModal from './components/EditProjectModal';
import LoginScreen from './components/LoginScreen';
import GlobalWorkReport from './components/GlobalWorkReport';
import GlobalMaterials from './components/GlobalMaterials';
import { HomeIcon, UserIcon, LogOutIcon, ShieldIcon, MenuIcon, XIcon, ChevronRightIcon, WrenchIcon, UploadIcon, LoaderIcon, ClipboardListIcon, LayoutGridIcon, BoxIcon, DownloadIcon } from './components/Icons';
import { getDirectoryHandle, saveDbToLocal, loadDbFromLocal } from './utils/fileSystem';
import { downloadBlob } from './utils/fileHelpers';

declare const ExcelJS: any;

export const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (e) {}
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// 嘗試從 LocalStorage 恢復資料作為墊底方案
const getInitialData = (key: string, defaultValue: any) => {
  const saved = localStorage.getItem(`hjx_cache_${key}`);
  return saved ? JSON.parse(saved) : defaultValue;
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>(() => getInitialData('projects', []));
  const [allUsers, setAllUsers] = useState<User[]>(() => getInitialData('users', [
    { id: 'u-1', name: 'Admin User', email: 'admin@hejiaxing.ai', role: UserRole.ADMIN, avatar: '' },
  ]));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => getInitialData('auditLogs', []));
  
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const isIframe = window.self !== window.top;

  // 連結本機資料夾
  const connectWorkspace = async () => {
    setIsWorkspaceLoading(true);
    try {
      const handle = await getDirectoryHandle();
      setDirHandle(handle);
      
      const savedData = await loadDbFromLocal(handle);
      if (savedData) {
        if (savedData.projects) setProjects(savedData.projects);
        if (savedData.users) setAllUsers(savedData.users);
        if (savedData.auditLogs) setAuditLogs(savedData.auditLogs);
      } else {
        await saveDbToLocal(handle, { projects, users: allUsers, auditLogs });
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsWorkspaceLoading(false);
    }
  };

  // 手動下載 db.json 作為備份 (iframe 環境的替代方案)
  const manualDownloadDb = () => {
    const data = { projects, users: allUsers, auditLogs, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `hjx_db_backup.json`);
  };

  // 自動儲存至本機資料夾 (若有連結) 並同時備份至 LocalStorage
  useEffect(() => {
    const dataToSave = { projects, users: allUsers, auditLogs, lastSaved: new Date().toISOString() };
    
    // 1. 同步至瀏覽器暫存 (避免 iframe 重新整理資料遺失)
    localStorage.setItem('hjx_cache_projects', JSON.stringify(projects));
    localStorage.setItem('hjx_cache_users', JSON.stringify(allUsers));
    localStorage.setItem('hjx_cache_auditLogs', JSON.stringify(auditLogs));

    // 2. 若有連結資料夾，同步至本機檔案
    if (dirHandle) {
      saveDbToLocal(dirHandle, dataToSave);
    }
  }, [projects, allUsers, auditLogs, dirHandle]);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [view, setView] = useState<'construction' | 'modular_house' | 'maintenance' | 'report' | 'materials' | 'users'>('construction');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogin = (user: User) => { setCurrentUser(user); setView('construction'); };
  const handleLogout = () => { setCurrentUser(null); setIsSidebarOpen(false); };

  const handleAddProject = (newProject: Project) => { setProjects([newProject, ...projects]); setIsAddModalOpen(false); };
  const handleUpdateProject = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    if (selectedProject?.id === updatedProject.id) setSelectedProject(updatedProject);
  };

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  const currentViewProjects = projects.filter(p => {
      if (view === 'construction') return p.type === ProjectType.CONSTRUCTION;
      if (view === 'modular_house') return p.type === ProjectType.MODULAR_HOUSE;
      if (view === 'maintenance') return p.type === ProjectType.MAINTENANCE;
      return false;
  });

  const renderSidebarContent = () => (
    <>
      <div className="flex items-center justify-center w-full px-2 py-6 mb-2">
         <h1 className="text-2xl font-bold text-white tracking-wider border-b-2 border-yellow-500 pb-1">
           合家興 <span className="text-yellow-500">AI</span>
         </h1>
      </div>
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto no-scrollbar">
        {/* 本機連線按鈕區塊 */}
        <div className="space-y-1">
          <button 
            onClick={connectWorkspace}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all border ${
              dirHandle 
                ? 'bg-green-600/10 border-green-500 text-green-400' 
                : isIframe
                  ? 'bg-slate-800 border-slate-700 text-slate-400 opacity-80 cursor-default'
                  : 'bg-red-600/10 border-red-500 text-red-400 font-bold animate-pulse hover:bg-red-600/20'
            }`}
          >
            {isWorkspaceLoading ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <LayoutGridIcon className="w-5 h-5" />}
            <div className="flex flex-col items-start">
              <span className="text-sm font-bold">{dirHandle ? '已連結本機資料夾' : '連結本機資料夾'}</span>
              {!dirHandle && <span className="text-[10px] opacity-70 truncate max-w-[150px]">{isIframe ? '安全性限制：請在新分頁開啟' : '儲存至 C:\\app test\\v1\\'}</span>}
            </div>
          </button>

          {/* 如果是 iframe 且未連結，提供手動備份按鈕 */}
          {!dirHandle && (
            <button 
              onClick={manualDownloadDb}
              className="flex items-center justify-center gap-2 w-full py-1.5 text-[10px] text-slate-500 hover:text-white transition-colors border border-transparent hover:border-slate-700 rounded-lg"
            >
              <DownloadIcon className="w-3 h-3" /> 手動下載備份 (db.json)
            </button>
          )}
        </div>

        <div className="h-4"></div>

        <button onClick={() => { setSelectedProject(null); setView('construction'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'construction' && !selectedProject ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
          <HomeIcon className="w-5 h-5 flex-shrink-0" /> <span className="font-medium">圍籬總覽</span>
        </button>
        <button onClick={() => { setSelectedProject(null); setView('modular_house'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'modular_house' && !selectedProject ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
          <LayoutGridIcon className="w-5 h-5 flex-shrink-0" /> <span className="font-medium">組合屋總覽</span>
        </button>
        <button onClick={() => { setSelectedProject(null); setView('maintenance'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'maintenance' && !selectedProject ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
          <WrenchIcon className="w-5 h-5 flex-shrink-0" /> <span className="font-medium">維修總覽</span>
        </button>
        <button onClick={() => { setSelectedProject(null); setView('report'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'report' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
          <ClipboardListIcon className="w-5 h-5 flex-shrink-0" /> <span className="font-medium">工作回報</span>
        </button>
        <button onClick={() => { setSelectedProject(null); setView('materials'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'materials' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
          <BoxIcon className="w-5 h-5 flex-shrink-0" /> <span className="font-medium">材料請購</span>
        </button>

        {currentUser.role === UserRole.ADMIN && (
           <button onClick={() => { setView('users'); setSelectedProject(null); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
             <ShieldIcon className="w-5 h-5 flex-shrink-0" /> <span className="font-medium">權限管理</span>
           </button>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800 w-full mt-auto mb-safe">
        <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-sm bg-slate-800/50 border border-slate-700 active:scale-95">
          <LogOutIcon className="w-4 h-4" /> 登出
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
      {/* 行動版側邊欄抽屜 */}
      <div className={`fixed inset-0 z-[100] md:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        {/* 遮罩層 */}
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
        {/* 側邊欄本體 */}
        <aside className={`absolute left-0 top-0 bottom-0 w-64 bg-slate-900 text-white shadow-2xl transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
          <div className="flex justify-end p-4">
            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white p-2">
              <XIcon className="w-6 h-6" />
            </button>
          </div>
          {renderSidebarContent()}
        </aside>
      </div>

      {/* 桌機版側邊欄 */}
      <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-white flex-shrink-0">
        {renderSidebarContent()}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shadow-sm z-20">
          <div className="flex items-center gap-4">
             <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-slate-500 p-2 hover:bg-slate-100 rounded-lg transition-colors">
               <MenuIcon className="w-6 h-6" />
             </button>
             <div className="flex items-center text-sm">
                <span className="font-bold text-slate-800">{selectedProject ? selectedProject.name : view}</span>
                {dirHandle && <span className="ml-3 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-bold">已同步本機資料夾</span>}
                {!dirHandle && <span className="ml-3 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full font-bold italic">瀏覽器暫存模式</span>}
             </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-slate-700">{currentUser.name}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><UserIcon className="w-5 h-5 text-slate-400" /></div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-[#f8fafc] pb-safe">
          {view === 'users' ? (
            <UserManagement users={allUsers} onUpdateUsers={setAllUsers} auditLogs={auditLogs} onLogAction={()=>{}} importUrl="" onUpdateImportUrl={()=>{}} />
          ) : view === 'report' ? (
            <GlobalWorkReport projects={projects} currentUser={currentUser} onUpdateProject={handleUpdateProject} />
          ) : view === 'materials' ? (
            <GlobalMaterials projects={projects} onSelectProject={setSelectedProject} />
          ) : selectedProject ? (
            <ProjectDetail project={selectedProject} currentUser={currentUser} onBack={() => setSelectedProject(null)} onUpdateProject={handleUpdateProject} onEditProject={setEditingProject} />
          ) : (
            <ProjectList projects={currentViewProjects} currentUser={currentUser} onSelectProject={setSelectedProject} onAddProject={() => setIsAddModalOpen(true)} onDeleteProject={(id)=>setProjects(prev=>prev.filter(p=>p.id!==id))} onDuplicateProject={()=>{}} onEditProject={setEditingProject} />
          )}
        </main>
      </div>

      {isAddModalOpen && <AddProjectModal onClose={() => setIsAddModalOpen(false)} onAdd={handleAddProject} defaultType={view === 'maintenance' ? ProjectType.MAINTENANCE : view === 'modular_house' ? ProjectType.MODULAR_HOUSE : ProjectType.CONSTRUCTION} />}
      {editingProject && <EditProjectModal project={editingProject} onClose={() => setEditingProject(null)} onSave={handleUpdateProject} />}
    </div>
  );
};

export default App;
