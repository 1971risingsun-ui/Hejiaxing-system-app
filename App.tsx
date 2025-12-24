
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

declare const ExcelJS: any;

export const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (e) {}
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// 優化：直接從 Buffer 轉 Base64 以保持原始品質且不壓縮
const bufferToBase64 = (buffer: ArrayBuffer, mimeType: string): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
};

const parseExcelDate = (val: any): string => {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString().split('T')[0];
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
  const [dirPermission, setDirPermission] = useState<'granted' | 'prompt' | 'denied'>('prompt');
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const restoreHandle = async () => {
      const savedHandle = await getHandleFromIdb();
      if (savedHandle) {
        setDirHandle(savedHandle);
        const status = await (savedHandle as any).queryPermission({ mode: 'readwrite' });
        setDirPermission(status);
      }
    };
    restoreHandle();
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
          if (addedFromDbCount > 0) alert(`已從資料夾同步 ${addedFromDbCount} 筆新案件。`);
          setProjects(sortProjects(mergedProjects));
          if (savedData.users) setAllUsers(savedData.users);
          if (savedData.auditLogs) setAuditLogs(savedData.auditLogs);
          await syncToLocal(handle, { projects: mergedProjects, users: savedData.users || allUsers, auditLogs: savedData.auditLogs || auditLogs });
        } else {
          await syncToLocal(handle, { projects, users: allUsers, auditLogs });
        }
      }
    } catch (e: any) {
      alert(e.message);
      if (e.message.includes('權限')) setDirPermission('denied');
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
    const file = e.target.files?.[0];
    if (!file) return;

    setIsWorkspaceLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.getWorksheet(1);
      
      const currentProjects = [...projects];
      let newCount = 0;
      let updateCount = 0;
      
      // 1. 識別標題索引
      const headers: Record<string, number> = {};
      const firstRow = worksheet.getRow(1);
      firstRow.eachCell((cell: any, colNumber: number) => {
        const headerText = cell.value?.toString().trim();
        if (headerText) headers[headerText] = colNumber;
      });

      const getValByHeader = (row: any, headerName: string) => {
        const idx = headers[headerName];
        if (!idx) return null;
        return row.getCell(idx).value;
      };

      // 2. 預處理 Excel 內的所有圖片與其所在列數
      // worksheet.getImages() 回傳的 tl (top-left) row 是 0-indexed
      const excelImages = worksheet.getImages();
      const imagesByRow: Record<number, any[]> = {};
      excelImages.forEach((imgMeta: any) => {
        const rowIdx = Math.floor(imgMeta.range.tl.row) + 1; // 轉為 1-indexed 以匹配 rowNumber
        if (!imagesByRow[rowIdx]) imagesByRow[rowIdx] = [];
        imagesByRow[rowIdx].push(imgMeta);
      });

      // 3. 迭代資料列 (從第二列開始)
      worksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return;

        const rawName = getValByHeader(row, '客戶')?.toString().trim() || '';
        if (!rawName) return; 

        const categoryStr = getValByHeader(row, '類別')?.toString() || '';
        let projectType = ProjectType.CONSTRUCTION;
        if (categoryStr.includes('維修')) {
          projectType = ProjectType.MAINTENANCE;
        } else if (categoryStr.includes('組合屋')) {
          projectType = ProjectType.MODULAR_HOUSE;
        }

        const clientName = rawName.includes('-') ? rawName.split('-')[0].trim() : rawName;
        const existingIdx = currentProjects.findIndex(p => p.name === rawName);
        
        // 提取當前列的圖片
        const rowImages = imagesByRow[rowNumber] || [];
        const newAttachments: Attachment[] = [];
        rowImages.forEach((imgMeta: any, idx: number) => {
          const img = workbook.getImage(imgMeta.imageId);
          if (img) {
            const mimeType = `image/${img.extension}`;
            const base64 = bufferToBase64(img.buffer, mimeType);
            newAttachments.push({
              id: `excel-img-${rowNumber}-${idx}-${Date.now()}`,
              name: `匯入圖片_${rowNumber}_${idx}.${img.extension}`,
              size: img.buffer.byteLength,
              type: mimeType,
              url: base64
            });
          }
        });

        const projectUpdateData: Partial<Project> = {
          name: rawName,
          type: projectType,
          clientName: clientName,
          clientContact: getValByHeader(row, '聯絡人')?.toString() || '',
          clientPhone: getValByHeader(row, '電話')?.toString() || '',
          address: getValByHeader(row, '地址')?.toString() || '',
          appointmentDate: parseExcelDate(getValByHeader(row, '預約日期')),
          reportDate: parseExcelDate(getValByHeader(row, '報修日期')),
          description: getValByHeader(row, '工程')?.toString() || '',
          remarks: getValByHeader(row, '備註')?.toString() || '',
        };

        if (existingIdx !== -1) {
          // 覆蓋現有專案 (Upsert)
          const existingProject = currentProjects[existingIdx];
          
          // 合併附件：保留原本手動上傳的，但加入 Excel 抓到的新附件
          const mergedAttachments = [...(existingProject.attachments || [])];
          newAttachments.forEach(na => {
              if (!mergedAttachments.some(ma => ma.name === na.name && ma.size === na.size)) {
                  mergedAttachments.push(na);
              }
          });

          currentProjects[existingIdx] = {
            ...existingProject,
            ...projectUpdateData,
            attachments: mergedAttachments
          };
          updateCount++;
        } else {
          // 新增專案
          const newProject: Project = {
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
          };
          currentProjects.push(newProject);
          newCount++;
        }
      });

      if (newCount > 0 || updateCount > 0) {
        setProjects(sortProjects(currentProjects));
        alert(`匯入完成！\n新增：${newCount} 筆\n更新(同名覆蓋)：${updateCount} 筆\n(Excel 缺失之案件已保留未刪除)`);
        
        setAuditLogs(prev => [{
          id: generateId(),
          userId: currentUser?.id || 'system',
          userName: currentUser?.name || '系統',
          action: 'IMPORT_EXCEL',
          details: `匯入 Excel: ${file.name}, 新增 ${newCount}, 更新 ${updateCount}, 含原始品質圖片匯入。`,
          timestamp: Date.now()
        }, ...prev]);
      } else {
        alert('找不到有效的資料列。請檢查 Excel 標題欄位（客戶、類別等）。');
      }
    } catch (error: any) {
      console.error('Excel 匯入失敗', error);
      alert('Excel 匯入失敗: ' + error.message);
    } finally {
      setIsWorkspaceLoading(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const lastSaved = new Date().toISOString();
    const saveCache = () => {
        try {
            localStorage.setItem('hjx_cache_projects', JSON.stringify(projects));
            localStorage.setItem('hjx_cache_users', JSON.stringify(allUsers));
            localStorage.setItem('hjx_cache_auditLogs', JSON.stringify(auditLogs));
            localStorage.setItem('hjx_cache_lastSaved', lastSaved);
        } catch (e: any) {
            if (e.name === 'QuotaExceededError') console.warn('LocalStorage 已滿');
        }
    };
    saveCache();
    if (dirHandle && dirPermission === 'granted') {
        syncToLocal(dirHandle, { projects, users: allUsers, auditLogs });
    }
  }, [projects, allUsers, auditLogs, dirHandle, dirPermission]);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [view, setView] = useState<'construction' | 'modular_house' | 'maintenance' | 'report' | 'materials' | 'users'>('construction');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogin = (user: User) => { setCurrentUser(user); setView('construction'); };
  const handleLogout = () => { setCurrentUser(null); setIsSidebarOpen(false); };

  const handleDeleteProject = (id: string) => {
    if (window.confirm('確定要刪除此案件嗎？此動作將同步刪除資料夾中的紀錄。')) {
      const newList = projects.filter(p => p.id !== id);
      setProjects(sortProjects(newList));
      const deletedProj = projects.find(p => p.id === id);
      setAuditLogs(prev => [{
        id: generateId(),
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || '系統',
        action: 'DELETE_PROJECT',
        details: `刪除案件: ${deletedProj?.name || id}`,
        timestamp: Date.now()
      }, ...prev]);
    }
  };

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

  const renderSidebarContent = () => {
    const isConnected = dirHandle && dirPermission === 'granted';
    const isPending = dirHandle && dirPermission === 'prompt';
    const isDenied = dirHandle && dirPermission === 'denied';

    return (
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
                isConnected ? 'bg-green-600/10 border-green-500 text-green-400' : isPending || isDenied ? 'bg-orange-600/10 border-orange-500 text-orange-500 font-bold animate-pulse' : 'bg-red-600/10 border-red-500 text-red-400 font-bold hover:bg-red-600/20'
              }`}
            >
              {isWorkspaceLoading ? <LoaderIcon className="w-5 h-5 animate-spin" /> : isConnected ? <CheckCircleIcon className="w-5 h-5" /> : <AlertIcon className="w-5 h-5" />}
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-bold">{isConnected ? '已連結 db.json' : (isPending || isDenied) ? '恢復資料夾連結' : '連結本機資料夾'}</span>
                <span className="text-[10px] opacity-70">{isConnected ? '自動同步啟動中' : '點擊授權讀寫權限'}</span>
              </div>
            </button>
            {isConnected && currentUser.role === UserRole.ADMIN && (
                <button onClick={async () => { if(confirm('要斷開資料夾連結嗎？(不影響本地暫存)')) { await clearHandleFromIdb(); setDirHandle(null); setDirPermission('prompt'); } }} className="text-[10px] text-slate-500 hover:text-red-400 px-4 flex items-center gap-1 transition-colors">
                    <XCircleIcon className="w-3 h-3" /> 斷開連結控制柄
                </button>
            )}
            <div className="px-1 pt-2">
              <input type="file" accept=".xlsx, .xls" ref={excelInputRef} className="hidden" onChange={(e) => { if (!isConnected) { if (!confirm('尚未連結資料夾，匯入的資料將僅儲存在瀏覽器暫存中。是否繼續？')) return; } handleImportExcel(e); }} />
              <button onClick={() => excelInputRef.current?.click()} disabled={isWorkspaceLoading} className="flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white group disabled:opacity-50">
                <FileTextIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-bold">{isWorkspaceLoading ? '處理中...' : '匯入排程表'}</span>
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
  };

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
            <ProjectList projects={currentViewProjects} currentUser={currentUser} onSelectProject={setSelectedProject} onAddProject={() => setIsAddModalOpen(true)} onDeleteProject={handleDeleteProject} onDuplicateProject={()=>{}} onEditProject={setEditingProject} />
          )}
        </main>
      </div>
      {isAddModalOpen && <AddProjectModal onClose={() => setIsAddModalOpen(false)} onAdd={(p) => { setProjects(sortProjects([p, ...projects])); setIsAddModalOpen(false); }} defaultType={view === 'maintenance' ? ProjectType.MAINTENANCE : view === 'modular_house' ? ProjectType.MODULAR_HOUSE : ProjectType.CONSTRUCTION} />}
      {editingProject && <EditProjectModal project={editingProject} onClose={() => setEditingProject(null)} onSave={handleUpdateProject} />}
    </div>
  );
};

export default App;
