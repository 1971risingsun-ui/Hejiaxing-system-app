
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
import { HomeIcon, UserIcon, LogOutIcon, ShieldIcon, MenuIcon, XIcon, ChevronRightIcon, WrenchIcon, UploadIcon, LoaderIcon, ClipboardListIcon, LayoutGridIcon, BoxIcon, DownloadIcon, FileTextIcon, CheckCircleIcon, AlertIcon, XCircleIcon } from './components/Icons';
import { getDirectoryHandle, saveDbToLocal, loadDbFromLocal, getHandleFromIdb, clearHandleFromIdb } from './utils/fileSystem';
import { downloadBlob } from './utils/fileHelpers';
import ExcelJS from 'exceljs';

export const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (e) {}
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/**
 * 記憶體友善的 Base64 轉換函數
 * 使用 Blob + FileReader，這是處理大型檔案最穩定的方式
 */
const bufferToBase64 = (buffer: ArrayBuffer, mimeType: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer], { type: mimeType });
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const parseExcelDate = (val: any): string => {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    try {
      return val.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  }
  const str = String(val).trim();
  if (!str) return '';
  const dateMatch = str.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
  if (dateMatch) {
    let [_, p1, p2, p3] = dateMatch;
    if (p1.length === 4) return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
    if (p3.length === 4) return `${p3}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`;
  }
  if (!isNaN(Number(str)) && Number(str) > 30000) {
    try {
      const date = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
    } catch (e) {}
  }
  return str;
};

const getInitialData = (key: string, defaultValue: any) => {
  try {
    const saved = localStorage.getItem(`hjx_cache_${key}`);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>(() => getInitialData('projects', []));
  const [allUsers, setAllUsers] = useState<User[]>(() => getInitialData('users', [
    { id: 'u-1', name: 'Admin User', email: 'admin@hejiaxing.ai', role: UserRole.ADMIN, avatar: '' },
  ]));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => getInitialData('auditLogs', []));
  const [importUrl, setImportUrl] = useState(() => localStorage.getItem('hjx_import_url') || '\\\\HJXSERVER\\App test\\上傳排程表.xlsx');
  
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirPermission, setDirPermission] = useState<'granted' | 'prompt' | 'denied'>('prompt');
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const excelInputRef = useRef<HTMLInputElement>(null);

  const sortProjects = (list: Project[]) => {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
      const dateA = a.appointmentDate || a.reportDate || '9999-12-31';
      const dateB = b.appointmentDate || b.reportDate || '9999-12-31';
      return String(dateA).localeCompare(String(dateB));
    });
  };

  useEffect(() => {
    const restoreAndLoad = async () => {
      try {
        const savedHandle = await getHandleFromIdb();
        if (savedHandle) {
          setDirHandle(savedHandle);
          const status = await (savedHandle as any).queryPermission({ mode: 'readwrite' });
          setDirPermission(status);
          if (status === 'granted') {
            const savedData = await loadDbFromLocal(savedHandle);
            if (savedData) {
              if (Array.isArray(savedData.projects)) setProjects(sortProjects(savedData.projects));
              if (Array.isArray(savedData.users)) setAllUsers(savedData.users);
              if (Array.isArray(savedData.auditLogs)) setAuditLogs(savedData.auditLogs);
            }
          }
        }
      } catch (e) {
        console.error('啟動恢復失敗', e);
      } finally {
        setIsInitialized(true);
      }
    };
    restoreAndLoad();
  }, []);

  const syncToLocal = async (handle: FileSystemDirectoryHandle, data: { projects: Project[], users: User[], auditLogs: AuditLog[] }) => {
    try {
      const payload = { ...data, lastSaved: new Date().toISOString() };
      await saveDbToLocal(handle, payload);
    } catch (e) {
      console.error('同步至資料夾失敗', e);
    }
  };

  const connectWorkspace = async () => {
    setIsWorkspaceLoading(true);
    try {
      let handle = dirHandle;
      if (!handle || dirPermission === 'denied') {
        handle = await getDirectoryHandle();
        setDirHandle(handle);
      }
      const status = await (handle as any).requestPermission({ mode: 'readwrite' });
      setDirPermission(status);
      if (status === 'granted') {
        const savedData = await loadDbFromLocal(handle);
        if (savedData) {
          const mergedProjects = [...projects];
          let addedFromDbCount = 0;
          (savedData.projects || []).forEach((fp: Project) => {
            const exists = mergedProjects.some(lp => lp.id === fp.id);
            if (!exists) {
              mergedProjects.push(fp);
              addedFromDbCount++;
            }
          });
          const sorted = sortProjects(mergedProjects);
          setProjects(sorted);
          if (savedData.users) setAllUsers(savedData.users);
          if (savedData.auditLogs) setAuditLogs(savedData.auditLogs);
          await syncToLocal(handle, { projects: sorted, users: savedData.users || allUsers, auditLogs: savedData.auditLogs || auditLogs });
          if (addedFromDbCount > 0) alert(`已從資料夾同步 ${addedFromDbCount} 筆新案件。`);
        }
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsWorkspaceLoading(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsWorkspaceLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) throw new Error('找不到工作表。');

      const currentProjects = [...projects];
      let newCount = 0;
      let updateCount = 0;
      
      const headers: Record<string, number> = {};
      worksheet.getRow(1).eachCell((cell: any, colNumber: number) => {
        const headerText = cell.value?.toString().trim();
        if (headerText) headers[headerText] = colNumber;
      });

      if (!headers['客戶'] || !headers['類別']) throw new Error('缺少必要欄位：「客戶」或「類別」。');

      const excelImages = worksheet.getImages();
      const imagesByRow: Record<number, any[]> = {};
      excelImages.forEach((imgMeta: any) => {
        const rowIdx = Math.floor(imgMeta.range.tl.row) + 1;
        if (!imagesByRow[rowIdx]) imagesByRow[rowIdx] = [];
        imagesByRow[rowIdx].push(imgMeta);
      });

      const rows = worksheet.getRows(2, worksheet.rowCount - 1) || [];
      for (const row of rows) {
        const rowNumber = row.number;
        const rawName = row.getCell(headers['客戶']).value?.toString().trim() || '';
        if (!rawName) continue;

        const categoryStr = row.getCell(headers['類別']).value?.toString() || '';
        let projectType = ProjectType.CONSTRUCTION;
        if (categoryStr.includes('維修')) projectType = ProjectType.MAINTENANCE;
        else if (categoryStr.includes('組合屋')) projectType = ProjectType.MODULAR_HOUSE;

        const clientName = rawName.includes('-') ? rawName.split('-')[0].trim() : rawName;
        const existingIdx = currentProjects.findIndex(p => p.name === rawName);
        
        const rowImages = imagesByRow[rowNumber] || [];
        const newAttachments: Attachment[] = [];
        for (const [idx, imgMeta] of rowImages.entries()) {
          try {
            const img = workbook.getImage(imgMeta.imageId);
            if (img && img.buffer && img.buffer.byteLength < 2000000) {
              const mimeType = `image/${img.extension}`;
              const base64 = await bufferToBase64(img.buffer, mimeType);
              newAttachments.push({
                id: `excel-img-${rowNumber}-${idx}-${Date.now()}`,
                name: `匯入圖片_${rowNumber}_${idx}.${img.extension}`,
                size: img.buffer.byteLength,
                type: mimeType,
                url: base64
              });
            }
          } catch (e) {
            console.warn('圖片處理失敗', e);
          }
        }

        const projectUpdateData: Partial<Project> = {
          name: rawName,
          type: projectType,
          clientName: clientName,
          clientContact: row.getCell(headers['聯絡人'] || 0).value?.toString() || '',
          clientPhone: row.getCell(headers['電話'] || 0).value?.toString() || '',
          address: row.getCell(headers['地址'] || 0).value?.toString() || '',
          appointmentDate: parseExcelDate(row.getCell(headers['預約日期'] || 0).value),
          reportDate: parseExcelDate(row.getCell(headers['報修日期'] || 0).value),
          description: row.getCell(headers['工程'] || 0).value?.toString() || '',
          remarks: row.getCell(headers['備註'] || 0).value?.toString() || '',
        };

        if (existingIdx !== -1) {
          const existingProject = currentProjects[existingIdx];
          const mergedAttachments = [...(existingProject.attachments || [])];
          newAttachments.forEach(na => {
              if (!mergedAttachments.some(ma => ma.name === na.name && ma.size === na.size)) {
                  mergedAttachments.push(na);
              }
          });
          currentProjects[existingIdx] = { ...existingProject, ...projectUpdateData, attachments: mergedAttachments };
          updateCount++;
        } else {
          currentProjects.push({
            id: generateId(),
            status: ProjectStatus.PLANNING,
            progress: 0,
            milestones: [],
            photos: [],
            materials: [],
            reports: [],
            constructionItems: [],
            constructionSignatures: [],
            completionReports: [],
            attachments: newAttachments,
            ...(projectUpdateData as Project)
          });
          newCount++;
        }
        if (rowNumber % 20 === 0) await new Promise(r => setTimeout(r, 0));
      }

      setProjects(sortProjects(currentProjects));
      alert(`匯入完成！\n新增：${newCount} 筆\n更新：${updateCount} 筆`);
      setAuditLogs(prev => [{ id: generateId(), userId: currentUser?.id || 'system', userName: currentUser?.name || '系統', action: 'IMPORT_EXCEL', details: `匯入 Excel: ${file.name}, 新增 ${newCount}, 更新 ${updateCount}`, timestamp: Date.now() }, ...prev]);
    } catch (error: any) {
      alert('Excel 匯入失敗: ' + error.message);
    } finally {
      setIsWorkspaceLoading(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('hjx_cache_projects', JSON.stringify(projects));
      localStorage.setItem('hjx_cache_users', JSON.stringify(allUsers));
      localStorage.setItem('hjx_cache_auditLogs', JSON.stringify(auditLogs));
      if (dirHandle && dirPermission === 'granted') syncToLocal(dirHandle, { projects, users: allUsers, auditLogs });
    } catch (e) {
      console.warn('自動儲存失敗', e);
    }
  }, [projects, allUsers, auditLogs, dirHandle, dirPermission, isInitialized]);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [view, setView] = useState<'construction' | 'modular_house' | 'maintenance' | 'report' | 'materials' | 'users'>('construction');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogin = (user: User) => { setCurrentUser(user); setView('construction'); };
  const handleLogout = () => { setCurrentUser(null); setIsSidebarOpen(false); };
  const handleDeleteProject = (id: string) => {
    if (window.confirm('確定要刪除此案件嗎？')) setProjects(sortProjects(projects.filter(p => p.id !== id)));
  };
  const handleUpdateProject = (updatedProject: Project) => {
    setProjects(prev => sortProjects(prev.map(p => p.id === updatedProject.id ? updatedProject : p)));
    if (selectedProject?.id === updatedProject.id) setSelectedProject(updatedProject);
  };

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;
  
  const currentViewProjects = projects.filter(p => {
    if (view === 'construction') return p.type === ProjectType.CONSTRUCTION;
    if (view === 'modular_house') return p.type === ProjectType.MODULAR_HOUSE;
    if (view === 'maintenance') return p.type === ProjectType.MAINTENANCE;
    return false;
  });

  const renderSidebarContent = () => {
    const isConnected = dirHandle && dirPermission === 'granted';
    return (
      <>
        <div className="flex items-center justify-center w-full px-2 py-6 mb-2">
           <h1 className="text-2xl font-bold text-white tracking-wider border-b-2 border-yellow-500 pb-1">
             合家興 <span className="text-yellow-500">AI</span>
           </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto no-scrollbar">
          {!isInitialized && <div className="px-4 py-2 text-xs text-yellow-500 animate-pulse flex items-center gap-2"><LoaderIcon className="w-3 h-3 animate-spin" /> 資料同步載入中...</div>}
          <div className="space-y-3 mb-6">
            <button onClick={connectWorkspace} className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all border ${isConnected ? 'bg-green-600/10 border-green-500 text-green-400' : 'bg-red-600/10 border-red-500 text-red-400'}`}>
              {isWorkspaceLoading ? <LoaderIcon className="w-5 h-5 animate-spin" /> : isConnected ? <CheckCircleIcon className="w-5 h-5" /> : <AlertIcon className="w-5 h-5" />}
              <div className="flex flex-col items-start text-left"><span className="text-sm font-bold">{isConnected ? '資料庫已連結' : '連結本機資料夾'}</span><span className="text-[10px] opacity-70">db.json 自動同步</span></div>
            </button>
            <div className="px-1 pt-2">
              <input type="file" accept=".xlsx, .xls" ref={excelInputRef} className="hidden" onChange={handleImportExcel} />
              <button onClick={() => excelInputRef.current?.click()} disabled={isWorkspaceLoading || !isInitialized} className="flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white group disabled:opacity-50">
                <FileTextIcon className="w-5 h-5" />
                <span className="text-sm font-bold">匯入排程表</span>
              </button>
            </div>
          </div>
          <button onClick={() => { setSelectedProject(null); setView('construction'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'construction' && !selectedProject ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><HomeIcon className="w-5 h-5" /> <span className="font-medium">圍籬總覽</span></button>
          <button onClick={() => { setSelectedProject(null); setView('modular_house'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'modular_house' && !selectedProject ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><LayoutGridIcon className="w-5 h-5" /> <span className="font-medium">組合屋總覽</span></button>
          <button onClick={() => { setSelectedProject(null); setView('maintenance'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'maintenance' && !selectedProject ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><WrenchIcon className="w-5 h-5" /> <span className="font-medium">維修總覽</span></button>
          <button onClick={() => { setSelectedProject(null); setView('report'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'report' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><ClipboardListIcon className="w-5 h-5" /> <span className="font-medium">工作回報</span></button>
          <button onClick={() => { setSelectedProject(null); setView('materials'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'materials' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><BoxIcon className="w-5 h-5" /> <span className="font-medium">材料請購</span></button>
          {currentUser.role === UserRole.ADMIN && (<button onClick={() => { setView('users'); setSelectedProject(null); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'users' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><ShieldIcon className="w-5 h-5" /> <span className="font-medium">權限管理</span></button>)}
        </nav>
        <div className="p-4 border-t border-slate-800 w-full mt-auto mb-safe"><button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-sm"><LogOutIcon className="w-4 h-4" /> 登出</button></div>
      </>
    );
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
      <div className={`fixed inset-0 z-[100] md:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
        <aside className={`absolute left-0 top-0 bottom-0 w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>{renderSidebarContent()}</aside>
      </div>
      <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-white flex-shrink-0">{renderSidebarContent()}</aside>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shadow-sm z-20">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-slate-500 p-2"><MenuIcon className="w-6 h-6" /></button>
          <div className="text-sm font-bold text-slate-700">{selectedProject ? selectedProject.name : view}</div>
          <div className="flex items-center gap-3"><div className="text-sm font-bold text-slate-700 hidden sm:block">{currentUser.name}</div><div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><UserIcon className="w-5 h-5 text-slate-400" /></div></div>
        </header>
        <main className="flex-1 overflow-auto bg-[#f8fafc] pb-safe">
          {view === 'users' ? (<UserManagement users={allUsers} onUpdateUsers={setAllUsers} auditLogs={auditLogs} onLogAction={(action, details) => setAuditLogs(prev => [{ id: generateId(), userId: currentUser.id, userName: currentUser.name, action, details, timestamp: Date.now() }, ...prev])} importUrl={importUrl} onUpdateImportUrl={(url) => { setImportUrl(url); localStorage.setItem('hjx_import_url', url); }} projects={projects} onRestoreData={(data) => { setProjects(data.projects); setAllUsers(data.users); setAuditLogs(data.auditLogs); }} />) : 
           view === 'report' ? (<GlobalWorkReport projects={projects} currentUser={currentUser} onUpdateProject={handleUpdateProject} />) : 
           view === 'materials' ? (<GlobalMaterials projects={projects} onSelectProject={setSelectedProject} />) : 
           selectedProject ? (<ProjectDetail project={selectedProject} currentUser={currentUser} onBack={() => setSelectedProject(null)} onUpdateProject={handleUpdateProject} onEditProject={setEditingProject} />) : 
           (<ProjectList projects={currentViewProjects} currentUser={currentUser} onSelectProject={setSelectedProject} onAddProject={() => setIsAddModalOpen(true)} onDeleteProject={handleDeleteProject} onDuplicateProject={()=>{}} onEditProject={setEditingProject} />)}
        </main>
      </div>
      {isAddModalOpen && <AddProjectModal onClose={() => setIsAddModalOpen(false)} onAdd={(p) => { setProjects(sortProjects([p, ...projects])); setIsAddModalOpen(false); }} defaultType={view === 'maintenance' ? ProjectType.MAINTENANCE : view === 'modular_house' ? ProjectType.MODULAR_HOUSE : ProjectType.CONSTRUCTION} />}
      {editingProject && <EditProjectModal project={editingProject} onClose={() => setEditingProject(null)} onSave={handleUpdateProject} />}
    </div>
  );
};

export default App;
