
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
import { HomeIcon, UserIcon, LogOutIcon, ShieldIcon, MenuIcon, XIcon, ChevronRightIcon, WrenchIcon, UploadIcon, LoaderIcon, ClipboardListIcon, LayoutGridIcon, BoxIcon, DownloadIcon, FileTextIcon } from './components/Icons';
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

/**
 * 輔助函式：將 Buffer 轉換為 Base64 (解決大型陣列造成手機 call stack 溢位問題)
 * 修正：使用 any 斷言解決 TypeScript 在特定環境下不允許 Uint8Array 轉 BlobPart 的錯誤
 */
const bufferToBase64 = (buffer: Uint8Array, mimeType: string): Promise<string> => {
  return new Promise((resolve) => {
    const blob = new Blob([buffer as any], { type: mimeType });
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

/**
 * 解析日期邏輯
 */
const parseExcelDate = (val: any): string => {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (!str) return '';
  const dateMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dateMatch) {
    let [_, m, d, y] = dateMatch;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (!isNaN(Number(str)) && Number(str) > 30000) {
    const date = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
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
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

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

  const sortProjects = (list: Project[]) => {
    return [...list].sort((a, b) => {
      const dateA = a.appointmentDate || a.reportDate || '9999-12-31';
      const dateB = b.appointmentDate || b.reportDate || '9999-12-31';
      return dateA.localeCompare(dateB);
    });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (typeof ExcelJS === 'undefined') {
        alert("Excel 模組尚未準備就緒，請檢查網路連線或稍後再試。");
        return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsWorkspaceLoading(true); 
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.worksheets[0];

      const imagesByRow: Record<number, { name: string, buffer: Uint8Array, extension: string }[]> = {};
      worksheet.getImages().forEach((image: any) => {
        const imgData = workbook.model.media.find((m: any) => m.index === image.imageId);
        const rowNum = Math.floor(image.range.tl.row) + 1;
        if (imgData) {
          if (!imagesByRow[rowNum]) imagesByRow[rowNum] = [];
          imagesByRow[rowNum].push({
            name: `excel_row${rowNum}_img${image.imageId}.${imgData.extension}`,
            buffer: imgData.buffer,
            extension: imgData.extension
          });
        }
      });

      let headers: Record<string, number> = {};
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell: any, colNumber: number) => {
        const val = String(cell.value || '').trim();
        headers[val] = colNumber;
      });

      const nextProjects = [...projects];
      let addedCount = 0;
      let updatedCount = 0;

      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        const getVal = (key: string) => {
          const colIdx = headers[key];
          if (!colIdx) return '';
          const val = row.getCell(colIdx).value;
          if (val instanceof Date) return val;
          if (val && typeof val === 'object') return (val as any).text || (val as any).result || '';
          return val === null || val === undefined ? '' : val;
        };

        const projectName = String(getVal('客戶') || '').trim();
        if (!projectName) continue;

        const category = String(getVal('類別') || '').trim();
        let projectType = ProjectType.CONSTRUCTION;
        if (category.includes('維修')) projectType = ProjectType.MAINTENANCE;
        else if (category.includes('組合屋')) projectType = ProjectType.MODULAR_HOUSE;

        const appointmentDate = parseExcelDate(getVal('預約日期'));
        const reportDate = parseExcelDate(getVal('報修日期'));

        const rowImages = imagesByRow[i] || [];
        const imageAttachments: Attachment[] = [];
        for (const img of rowImages) {
            const mimeType = img.extension === 'png' ? 'image/png' : 'image/jpeg';
            const dataUrl = await bufferToBase64(img.buffer, mimeType);
            imageAttachments.push({
                id: generateId(),
                name: img.name,
                size: img.buffer.length,
                type: mimeType,
                url: dataUrl
            });
        }

        const existingIdx = nextProjects.findIndex(p => p.name === projectName);
        const projectData: Partial<Project> = {
          type: projectType,
          clientName: projectName.includes('-') ? projectName.split('-')[0].trim() : projectName,
          address: String(getVal('地址') || '').trim(),
          description: String(getVal('工程') || '').trim(),
          clientContact: String(getVal('聯絡人') || '').trim(),
          clientPhone: String(getVal('電話') || '').trim(),
          remarks: String(getVal('備註') || '').trim(),
          appointmentDate,
          reportDate
        };

        if (existingIdx > -1) {
          const existing = nextProjects[existingIdx];
          const newAtts = imageAttachments.filter(na => !(existing.attachments || []).some(ea => ea.name === na.name));
          nextProjects[existingIdx] = { 
            ...existing, 
            ...projectData,
            attachments: [...(existing.attachments || []), ...newAtts]
          };
          updatedCount++;
        } else {
          nextProjects.push({
            id: generateId(),
            name: projectName,
            type: projectType,
            status: ProjectStatus.PLANNING,
            progress: 0,
            milestones: [],
            photos: [],
            materials: [],
            reports: [],
            constructionItems: [],
            constructionSignatures: [],
            completionReports: [],
            attachments: imageAttachments,
            ...projectData
          } as Project);
          addedCount++;
        }
      }

      setProjects(sortProjects(nextProjects));
      alert(`匯入完成！\n新增: ${addedCount} 筆\n更新: ${updatedCount} 筆\n已依日期排序。`);

    } catch (err) {
      console.error('Excel 匯入失敗:', err);
      alert('解析失敗：檔案可能過大或欄位不符。手機版建議一次匯入 50 筆以內資料。');
    } finally {
      setIsWorkspaceLoading(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const saveCache = () => {
        try {
            localStorage.setItem('hjx_cache_projects', JSON.stringify(projects));
            localStorage.setItem('hjx_cache_users', JSON.stringify(allUsers));
            localStorage.setItem('hjx_cache_auditLogs', JSON.stringify(auditLogs));
        } catch (e: any) {
            if (e.name === 'QuotaExceededError') {
                console.warn('LocalStorage 已滿，部分圖片數據無法快取。建議點擊「連結本機資料夾」進行完整儲存。');
            }
        }
    };
    saveCache();
    if (dirHandle) saveDbToLocal(dirHandle, { projects, users: allUsers, auditLogs, lastSaved: new Date().toISOString() });
  }, [projects, allUsers, auditLogs, dirHandle]);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [view, setView] = useState<'construction' | 'modular_house' | 'maintenance' | 'report' | 'materials' | 'users'>('construction');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogin = (user: User) => { setCurrentUser(user); setView('construction'); };
  const handleLogout = () => { setCurrentUser(null); setIsSidebarOpen(false); };

  const handleUpdateProject = (updatedProject: Project) => {
    setProjects(prev => {
        const newList = prev.map(p => p.id === updatedProject.id ? updatedProject : p);
        return sortProjects(newList);
    });
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
        <div className="space-y-3 mb-6">
          <button 
            onClick={connectWorkspace}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all border ${
              dirHandle 
                ? 'bg-green-600/10 border-green-500 text-green-400' 
                : 'bg-red-600/10 border-red-500 text-red-400 font-bold animate-pulse hover:bg-red-600/20'
            }`}
          >
            {isWorkspaceLoading ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <LayoutGridIcon className="w-5 h-5" />}
            <div className="flex flex-col items-start text-left">
              <span className="text-sm font-bold">{dirHandle ? '已連結 v1 資料夾' : '連結本機資料夾'}</span>
              {!dirHandle && <span className="text-[10px] opacity-70">儲存至 C:\\app test\\v1\\</span>}
            </div>
          </button>

          <div className="px-1">
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              ref={excelInputRef} 
              className="hidden" 
              onChange={handleImportExcel} 
            />
            <button 
              onClick={() => excelInputRef.current?.click()}
              disabled={isWorkspaceLoading}
              className="flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white group disabled:opacity-50"
            >
              <FileTextIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-bold">{isWorkspaceLoading ? '匯入處理中...' : '匯入排程表'}</span>
              </div>
            </button>
          </div>
        </div>

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
      <div className={`fixed inset-0 z-[100] md:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
        <aside className={`absolute left-0 top-0 bottom-0 w-64 bg-slate-900 text-white shadow-2xl transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
          <div className="flex justify-end p-4">
            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white p-2">
              <XIcon className="w-6 h-6" />
            </button>
          </div>
          {renderSidebarContent()}
        </aside>
      </div>

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
             </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm font-bold text-slate-700 hidden sm:block">{currentUser.name}</div>
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><UserIcon className="w-5 h-5 text-slate-400" /></div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-[#f8fafc] pb-safe">
          {view === 'users' ? (
            <UserManagement users={allUsers} onUpdateUsers={setAllUsers} auditLogs={auditLogs} onLogAction={(action, details) => setAuditLogs(prev => [{ id: generateId(), userId: currentUser.id, userName: currentUser.name, action, details, timestamp: Date.now() }, ...prev])} importUrl={importUrl} onUpdateImportUrl={(url) => { setImportUrl(url); localStorage.setItem('hjx_import_url', url); }} projects={projects} onRestoreData={(data) => { setProjects(data.projects); setAllUsers(data.users); setAuditLogs(data.auditLogs); }} />
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

      {isAddModalOpen && <AddProjectModal onClose={() => setIsAddModalOpen(false)} onAdd={(p) => { setProjects(sortProjects([p, ...projects])); setIsAddModalOpen(false); }} defaultType={view === 'maintenance' ? ProjectType.MAINTENANCE : view === 'modular_house' ? ProjectType.MODULAR_HOUSE : ProjectType.CONSTRUCTION} />}
      {editingProject && <EditProjectModal project={editingProject} onClose={() => setEditingProject(null)} onSave={handleUpdateProject} />}
    </div>
  );
};

export default App;
