
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
import { HomeIcon, UserIcon, LogOutIcon, ShieldIcon, MenuIcon, XIcon, ChevronRightIcon, WrenchIcon, UploadIcon, LoaderIcon, ClipboardListIcon, LayoutGridIcon, BoxIcon } from './components/Icons';

declare const XLSX: any;
declare const ExcelJS: any;

// Safe ID Generator fallback
export const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (e) {}
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p-101',
    name: '內湖科技園區辦公室裝修',
    type: ProjectType.CONSTRUCTION,
    clientName: '迅達科技股份有限公司',
    clientContact: '陳經理',
    clientPhone: '0912-345-678',
    address: '台北市內湖區營光路 500 號',
    status: ProjectStatus.IN_PROGRESS,
    progress: 45,
    appointmentDate: '2023-10-01',
    reportDate: '2023-12-15',
    description: '300 坪辦公室室內裝修工程，包含隔間拆除、全新空調系統安裝、開放式辦公區規劃及主管辦公室裝潢。',
    remarks: '',
    milestones: [
      { id: 'm-1', title: '拆除工程', date: '2023-10-05', completed: true, notes: '原有隔間與天花板拆除' },
      { id: 'm-2', title: '水電配置', date: '2023-10-20', completed: true, notes: '重新拉線，配置 Cat6 網路線' },
    ],
    photos: [],
    materials: [],
    materialFillingDate: '2023-10-01',
    materialRequisitioner: 'Admin User',
    materialDeliveryDate: '2023-10-15',
    materialDeliveryLocation: '現場',
    materialReceiver: '陳經理',
    reports: [],
    attachments: [],
    constructionItems: [],
    constructionSignatures: [],
    completionReports: []
  }
];

const INITIAL_USERS: User[] = [
  { id: 'u-1', name: 'Admin User', email: 'admin@hejiaxing.ai', role: UserRole.ADMIN, avatar: '' },
  { id: 'u-2', name: 'Project Manager', email: 'pm@hejiaxing.ai', role: UserRole.MANAGER, avatar: '' },
  { id: 'u-3', name: 'Site Worker', email: 'worker@hejiaxing.ai', role: UserRole.WORKER, avatar: '' },
];

const STORAGE_KEY_PREFIX = 'hejiaxing_app_';
const DEFAULT_DATA_SOURCE_URL = '\\\\HJXSERVER\\App test\\上傳排程表.xlsx';

const App: React.FC = () => {
  const loadState = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      if (!saved || saved === 'null' || saved === 'undefined') return fallback;
      const parsed = JSON.parse(saved);
      if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
      return parsed ?? fallback;
    } catch (e) {
      console.error(`Error loading state for ${key}:`, e);
      return fallback;
    }
  };

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [projects, setProjects] = useState<Project[]>(() => {
      const raw = loadState('projects', INITIAL_PROJECTS);
      const items = Array.isArray(raw) ? raw : INITIAL_PROJECTS;
      
      return items.map((p: any) => {
          if (!p || typeof p !== 'object') return null;
          return {
            ...p,
            id: p.id || generateId(),
            name: p.name || '未命名專案',
            type: p.type || ProjectType.CONSTRUCTION,
            appointmentDate: p.appointmentDate || p.startDate || '',
            reportDate: p.reportDate || p.endDate || '',
            status: p.status || ProjectStatus.PLANNING,
            progress: typeof p.progress === 'number' ? p.progress : 0,
            remarks: p.remarks || '',
            completionReports: Array.isArray(p.completionReports) ? p.completionReports : [],
            constructionItems: Array.isArray(p.constructionItems) ? p.constructionItems : [],
            photos: Array.isArray(p.photos) ? p.photos : [],
            materials: Array.isArray(p.materials) ? p.materials : [],
            materialFillingDate: p.materialFillingDate || '',
            materialRequisitioner: p.materialRequisitioner || '',
            materialDeliveryDate: p.materialDeliveryDate || '',
            materialDeliveryLocation: p.materialDeliveryLocation || '現場',
            materialReceiver: p.materialReceiver || '',
            reports: Array.isArray(p.reports) ? p.reports : [],
            milestones: Array.isArray(p.milestones) ? p.milestones : [],
            attachments: Array.isArray(p.attachments) ? p.attachments : []
          };
      }).filter((p): p is Project => p !== null);
  });

  const [allUsers, setAllUsers] = useState<User[]>(() => {
    const raw = loadState('users', INITIAL_USERS);
    return Array.isArray(raw) ? raw : INITIAL_USERS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const raw = loadState('audit_logs', []);
    return Array.isArray(raw) ? raw : [];
  });

  const [lastImportDate, setLastImportDate] = useState<string | null>(() => loadState('last_import_date', null));
  const [importUrl, setImportUrl] = useState<string>(() => loadState('import_url', DEFAULT_DATA_SOURCE_URL));

  const sortedProjects = useMemo(() => {
    if (!Array.isArray(projects)) return [];
    return [...projects].sort((a, b) => {
      const dateA = a?.appointmentDate || a?.reportDate || '9999-12-31';
      const dateB = b?.appointmentDate || b?.reportDate || '9999-12-31';
      return dateA.localeCompare(dateB);
    });
  }, [projects]);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [view, setView] = useState<'construction' | 'modular_house' | 'maintenance' | 'report' | 'materials' | 'users'>('construction');
  const [isImporting, setIsImporting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sub = CapacitorApp.addListener('backButton', () => {
      if (isAddModalOpen) setIsAddModalOpen(false);
      else if (editingProject) setEditingProject(null);
      else if (isSidebarOpen) setIsSidebarOpen(false);
      else if (selectedProject) setSelectedProject(null);
      else if (view !== 'construction') setView('construction');
      else CapacitorApp.exitApp();
    });
    return () => { sub.then(s => s.remove()); };
  }, [isAddModalOpen, editingProject, isSidebarOpen, selectedProject, view]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'projects', JSON.stringify(projects)); }, [projects]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'users', JSON.stringify(allUsers)); }, [allUsers]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'audit_logs', JSON.stringify(auditLogs)); }, [auditLogs]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'last_import_date', JSON.stringify(lastImportDate)); }, [lastImportDate]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'import_url', JSON.stringify(importUrl)); }, [importUrl]);

  const addAuditLog = (action: string, details: string) => {
    if (!currentUser) return;
    const newLog: AuditLog = {
      id: generateId(),
      userId: currentUser.id,
      userName: currentUser.name,
      action,
      details,
      timestamp: Date.now()
    };
    setAuditLogs(prev => [newLog, ...(Array.isArray(prev) ? prev : [])]);
  };

  const handleLogin = (user: User) => {
    const usersList = Array.isArray(allUsers) ? allUsers : INITIAL_USERS;
    if (!usersList.some(u => u && u.email === user.email)) {
        setAllUsers([...usersList, user]);
    }
    setCurrentUser(user);
    setView('construction');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedProject(null);
    setEditingProject(null);
    setIsSidebarOpen(false);
  };

  const handleAddProject = (newProject: Project) => {
    setProjects([newProject, ...projects]);
    addAuditLog('CREATE_PROJECT', `Created ${newProject.type} project: ${newProject.name}`);
    setIsAddModalOpen(false);
  };

  const handleUpdateProject = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    if (selectedProject?.id === updatedProject.id) {
       setSelectedProject(updatedProject); 
    }
  };

  const handleSaveEditedProject = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    if (selectedProject?.id === updatedProject.id) setSelectedProject(updatedProject);
    addAuditLog('UPDATE_PROJECT', `Updated project details: ${updatedProject.name}`);
    setEditingProject(null);
  };

  const handleDeleteProject = (projectId: string) => {
    const projectToDelete = projects.find(p => p.id === projectId);
    if (window.confirm(`確定要刪除專案「${projectToDelete?.name}」嗎？`)) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (selectedProject?.id === projectId) setSelectedProject(null);
      addAuditLog('DELETE_PROJECT', `Deleted project: ${projectToDelete?.name || projectId}`);
    }
  };

  const handleDuplicateProject = (project: Project) => {
    const duplicatedProject: Project = {
      ...project,
      id: generateId(),
      name: `${project.name} (複製)`,
      status: ProjectStatus.PLANNING,
      progress: 0,
      appointmentDate: '',
      reportDate: '',
      remarks: '',
      milestones: (project.milestones || []).map(m => ({...m, id: generateId(), completed: false})),
      photos: [],
      reports: [],
      materials: (project.materials || []).map(m => ({...m, id: generateId(), status: MaterialStatus.PENDING})),
      attachments: (project.attachments || []).map(a => ({...a, id: generateId()})),
      constructionItems: [],
      constructionSignatures: [],
      completionReports: []
    };
    setProjects([duplicatedProject, ...projects]);
    addAuditLog('DUPLICATE_PROJECT', `Duplicated project: ${project.name} -> ${duplicatedProject.name}`);
  };

  const handleEditProject = (project: Project) => setEditingProject(project);

  const handleRestoreData = (data: { projects: Project[], users: User[], auditLogs: AuditLog[] }) => {
    if (data.projects) setProjects(data.projects.map((p: any) => ({...p, type: p.type || ProjectType.CONSTRUCTION})));
    if (data.users) setAllUsers(data.users);
    if (data.auditLogs) setAuditLogs(data.auditLogs);
    addAuditLog('SYSTEM_RESTORE', 'Restored system data from backup');
    alert('系統資料還原成功！');
  };

  const processImportData = (rawRows: any[][], rowImageMap?: Record<number, string>) => {
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
         if (JSON.stringify(rawRows[i]).includes('客戶')) {
             headerRowIndex = i;
             break;
         }
      }

      if (headerRowIndex === -1) {
          alert('匯入失敗：找不到標題列 (請確認包含「客戶」欄位)');
          return;
      }

      const headers = rawRows[headerRowIndex].map(h => String(h).trim());
      const dataRows = rawRows.slice(headerRowIndex + 1);

      const getIndex = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));
      const idxCategory = getIndex(['類別']), 
            idxCustomer = getIndex(['客戶']), 
            idxContact = getIndex(['聯絡人']),
            idxPhone = getIndex(['電話']), 
            idxAddress = getIndex(['地址']), 
            idxEngineering = getIndex(['工程']),
            idxAppoint = getIndex(['預約日期']),
            idxReport = getIndex(['報修日期']);

      if (idxCustomer === -1) { alert('匯入失敗：找不到標題列'); return; }

      const newProjects: Project[] = [];

      let skippedCount = 0, photoCount = 0;

      for (let i = 0; i < dataRows.length; i++) {
         const row = dataRows[i];
         const originalRowIndex = i + headerRowIndex + 1;
         if (!row || row.length === 0) continue;

         // Improved value extraction helper
         const getVal = (idx: number) => {
            if (idx === -1 || row[idx] === undefined || row[idx] === null) return '';
            const val = row[idx];
            // Normalize dates to YYYY-MM-DD for internal storage compatibility with HTML date inputs
            if (val instanceof Date) {
               return val.toISOString().split('T')[0];
            }
            const str = String(val).trim();
            // Handle common Excel string date patterns to convert to YYYY-MM-DD
            if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(str)) {
                return str.replace(/\//g, '-');
            }
            return str;
         };

         const customerField = getVal(idxCustomer);
         if (!customerField) continue;

         const address = getVal(idxAddress);
         const projectName = customerField;
         if (projects.some(p => p.name === projectName && p.address === address)) {
             skippedCount++; continue; 
         }

         const category = getVal(idxCategory);
         let type = ProjectType.CONSTRUCTION;
         if (category.includes('維修')) type = ProjectType.MAINTENANCE;
         else if (category.includes('組合屋')) type = ProjectType.MODULAR_HOUSE;

         const newProject: Project = {
             id: generateId(), 
             name: projectName, 
             type, 
             clientName: customerField.split('-')[0].trim(),
             clientContact: getVal(idxContact), 
             clientPhone: getVal(idxPhone), 
             address, 
             description: getVal(idxEngineering),
             remarks: '',
             status: ProjectStatus.PLANNING, 
             progress: 0, 
             appointmentDate: getVal(idxAppoint), 
             reportDate: getVal(idxReport),
             milestones: [], 
             photos: [], 
             materials: [], 
             reports: [], 
             attachments: [], 
             constructionItems: [], 
             constructionSignatures: [], 
             completionReports: []
         };

         if (rowImageMap && rowImageMap[originalRowIndex as any]) {
             const photoUrl = rowImageMap[originalRowIndex as any];
             newProject.photos.push({
                 id: generateId(), url: photoUrl, timestamp: Date.now(), description: '匯入之現場照片'
             });
             newProject.attachments.push({
                 id: generateId(), name: `現場照片_${projectName.substring(0, 10)}.jpg`,
                 size: Math.round(photoUrl.length * 0.75), type: 'image/jpeg', url: photoUrl
             });
             photoCount++;
         }
         newProjects.push(newProject);
      }
      
      const now = new Date();
      // Set last import date in MM/DD/YYYY format as requested
      setLastImportDate(`${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear()}`);

      if (newProjects.length > 0) {
          setProjects(prev => [...newProjects, ...prev]);
          addAuditLog('IMPORT_EXCEL', `Imported ${newProjects.length} projects with ${photoCount} photos`);
          alert(`匯入完成！\n成功新增: ${newProjects.length} 筆\n附加照片: ${photoCount} 張`);
      } else {
          alert(`未新增任何專案 (重複略過: ${skippedCount} 筆)`);
      }
  };

  const handleManualImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsImporting(true);
      try {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(arrayBuffer);
          const worksheet = workbook.getWorksheet(1);
          if (!worksheet) throw new Error("Sheet not found");

          const rowImageMap: Record<number, string> = {};
          if (worksheet.getImages()) {
            worksheet.getImages().forEach((img: any) => {
              const image = (workbook as any).model.media[img.imageId as any];
              if (image && image.buffer) {
                const rowIndex = img.range.tl.row;
                const base64 = `data:image/jpeg;base64,${image.buffer.toString('base64')}`;
                if (!rowImageMap[rowIndex as any]) rowImageMap[rowIndex as any] = base64;
              }
            });
          }

          const data: any[][] = [];
          worksheet.eachRow({ includeEmpty: true }, (row) => {
              const rowValues: any[] = [];
              if (Array.isArray(row.values)) {
                for (let i = 1; i < row.values.length; i++) {
                    const cell = row.values[i];
                    rowValues.push(cell && typeof cell === 'object' && 'result' in cell ? (cell as any).result : cell);
                }
              }
              data.push(rowValues);
          });
          processImportData(data, rowImageMap);
      } catch (err) {
          alert("檔案解析失敗");
      } finally {
          setIsImporting(false);
          if (importFileRef.current) importFileRef.current.value = '';
      }
  };

  const handleImportData = async () => {
    setIsImporting(true);
    try {
        const response = await fetch(importUrl);
        if (!response.ok) throw new Error('Network error');
        const arrayBuffer = await response.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) throw new Error("No worksheet");

        const data: any[][] = [], rowImageMap: Record<number, string> = {};
        if (worksheet.getImages()) {
            worksheet.getImages().forEach((img: any) => {
                const image = (workbook as any).model.media[img.imageId as any];
                if (image && image.buffer) {
                    rowImageMap[img.range.tl.row as any] = `data:image/jpeg;base64,${image.buffer.toString('base64')}`;
                }
            });
        }
        worksheet.eachRow({ includeEmpty: true }, (row) => {
            const rowValues: any[] = [];
            if (Array.isArray(row.values)) {
                for (let i = 1; i < row.values.length; i++) {
                    const cell = row.values[i];
                    rowValues.push(cell && typeof cell === 'object' && 'result' in cell ? (cell as any).result : cell);
                }
            }
            data.push(rowValues);
        });
        processImportData(data, rowImageMap);
    } catch (error) {
        setIsImporting(false);
        const shouldOpenDrive = window.confirm("無法連結伺服器，是否手動選取下載好的檔案進行匯入？");
        if (shouldOpenDrive) window.open("http://192.168.1.2:8080/share.cgi?ssid=920d875a5d614bed8f72c539dcd42053", '_blank');
        importFileRef.current?.click();
    } finally { setIsImporting(false); }
  };

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  const inProgressProjects = sortedProjects.filter(p => p && p.status === ProjectStatus.IN_PROGRESS);
  const currentViewProjects = sortedProjects.filter(p => {
      if (!p) return false;
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
        <button onClick={() => { setSelectedProject(null); setView('construction'); setIsSidebarOpen(false); }}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'construction' && !selectedProject ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
          <HomeIcon className="w-5 h-5 flex-shrink-0" /> <span className="font-medium">圍籬總覽</span>
        </button>

        <button onClick={() => { setSelectedProject(null); setView('modular_house'); setIsSidebarOpen(false); }}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'modular_house' && !selectedProject ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
          <LayoutGridIcon className="w-5 h-5 flex-shrink-0" /> <span className="font-medium">組合屋總覽</span>
        </button>

        <button onClick={() => { setSelectedProject(null); setView('maintenance'); setIsSidebarOpen(false); }}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'maintenance' && !selectedProject ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
          <WrenchIcon className="w-5 h-5 flex-shrink-0" /> <span className="font-medium">維修總覽</span>
        </button>

        <button onClick={() => { setSelectedProject(null); setView('report'); setIsSidebarOpen(false); }}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'report' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
          <ClipboardListIcon className="w-5 h-5 flex-shrink-0" /> <span className="font-medium">工作回報</span>
        </button>

        <button onClick={() => { setSelectedProject(null); setView('materials'); setIsSidebarOpen(false); }}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'materials' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
          <BoxIcon className="w-5 h-5 flex-shrink-0" /> <span className="font-medium">材料請購</span>
        </button>

        {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && (
            <>
              <input type="file" ref={importFileRef} onChange={handleManualImport} className="hidden" accept=".xlsx, .xls" />
              <button onClick={handleImportData} disabled={isImporting}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
              >
                  {isImporting ? <LoaderIcon className="w-5 h-5 animate-spin flex-shrink-0" /> : <UploadIcon className="w-5 h-5 flex-shrink-0" />}
                  <div className="flex flex-col items-start text-left">
                     <span className="font-medium">匯入排程表</span>
                     {typeof lastImportDate === 'string' && <span className="text-[10px] opacity-60 font-light">({lastImportDate})</span>}
                  </div>
              </button>
            </>
        )}

        {currentUser.role === UserRole.ADMIN && (
           <button onClick={() => { setView('users'); setSelectedProject(null); setIsSidebarOpen(false); }}
             className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-colors ${view === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
           >
             <ShieldIcon className="w-5 h-5 flex-shrink-0" /> <span className="font-medium">權限管理</span>
           </button>
        )}

        <div className="pt-6 mt-6 border-t border-slate-800">
          <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3 px-2">進行中專案</h3>
          <div className="space-y-1">
            {inProgressProjects.length > 0 ? (
               inProgressProjects.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProject(p);
                    if (p.type === ProjectType.CONSTRUCTION) setView('construction');
                    else if (p.type === ProjectType.MODULAR_HOUSE) setView('modular_house');
                    else setView('maintenance');
                    setIsSidebarOpen(false);
                  }}
                  className={`block w-full text-left text-sm font-bold whitespace-nowrap overflow-hidden text-ellipsis py-2.5 px-4 rounded transition-all duration-200 border-l-2 ${selectedProject?.id === p.id ? 'text-blue-400 bg-blue-400/10 border-blue-500 font-bold' : 'text-slate-500 border-transparent hover:bg-slate-800 hover:text-slate-300'}`}
                >
                  {p.name}
                </button>
              ))
            ) : (
              <div className="px-4 py-2 text-[10px] text-slate-600 italic">尚無進行中案件</div>
            )}
          </div>
        </div>
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
      <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-white flex-shrink-0">{renderSidebarContent()}</aside>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-slate-900 text-white flex flex-col shadow-2xl animate-slide-in pb-safe">
            <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-2"><XIcon className="w-6 h-6" /></button>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shadow-sm flex-shrink-0 z-20">
          <div className="flex items-center gap-4">
             <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-slate-500 hover:text-slate-700 p-2 -ml-2"><MenuIcon className="w-6 h-6" /></button>
             <div className="flex items-center text-sm">
                <span className="text-slate-500 font-medium hidden md:inline">首頁</span>
                <ChevronRightIcon className="w-4 h-4 text-slate-300 mx-2 hidden md:inline" />
                {view === 'users' ? <span className="font-bold text-slate-800">權限管理</span> : view === 'report' ? <span className="font-bold text-slate-800">工作回報</span> : view === 'materials' ? <span className="font-bold text-slate-800">材料請購</span> : selectedProject ? (
                   <>
                     <button onClick={() => setSelectedProject(null)} className="text-slate-500 hover:text-blue-600 transition-colors font-medium hidden md:inline">
                        {view === 'maintenance' ? '維修列表' : view === 'modular_house' ? '組合屋列表' : '圍籬列表'}
                     </button>
                     <ChevronRightIcon className="w-4 h-4 text-slate-300 mx-2 hidden md:inline" />
                     <span className="font-bold text-slate-800 truncate max-w-[150px] md:max-w-xs">{selectedProject.name}</span>
                   </>
                ) : <span className="font-bold text-slate-800">{view === 'maintenance' ? '維修總覽' : view === 'modular_house' ? '組合屋總覽' : '圍籬總覽'}</span>}
             </div>
          </div>
          <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-slate-700">{currentUser.name}</div>
              <div className="text-xs text-slate-500 uppercase">{currentUser.role}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400"><UserIcon className="w-5 h-5" /></div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-[#f8fafc] pb-safe">
          {view === 'users' && currentUser.role === UserRole.ADMIN ? (
            <UserManagement 
                users={allUsers} 
                onUpdateUsers={setAllUsers} 
                auditLogs={auditLogs} 
                onLogAction={addAuditLog} 
                projects={projects} 
                onRestoreData={handleRestoreData} 
                importUrl={importUrl}
                onUpdateImportUrl={setImportUrl}
            />
          ) : view === 'report' ? (
            <GlobalWorkReport 
                projects={projects} 
                currentUser={currentUser} 
                onUpdateProject={handleUpdateProject} 
            />
          ) : view === 'materials' ? (
            <GlobalMaterials 
                projects={projects} 
                onSelectProject={(p) => {
                   setSelectedProject(p);
                   if (p.type === ProjectType.CONSTRUCTION) setView('construction');
                   else if (p.type === ProjectType.MODULAR_HOUSE) setView('modular_house');
                   else setView('maintenance');
                }}
            />
          ) : selectedProject ? (
            <ProjectDetail project={selectedProject} currentUser={currentUser} onBack={() => setSelectedProject(null)} onUpdateProject={handleUpdateProject} onEditProject={handleEditProject} />
          ) : (
            <ProjectList title={view === 'maintenance' ? '維修總覽' : view === 'modular_house' ? '組合屋總覽' : '圍籬總覽'} projects={currentViewProjects} currentUser={currentUser} onSelectProject={setSelectedProject} onAddProject={() => setIsAddModalOpen(true)} onDeleteProject={handleDeleteProject} onDuplicateProject={handleDuplicateProject} onEditProject={handleEditProject} />
          )}
        </main>
      </div>

      {isAddModalOpen && <AddProjectModal onClose={() => setIsAddModalOpen(false)} onAdd={handleAddProject} defaultType={view === 'maintenance' ? ProjectType.MAINTENANCE : view === 'modular_house' ? ProjectType.MODULAR_HOUSE : ProjectType.CONSTRUCTION} />}
      {editingProject && <EditProjectModal project={editingProject} onClose={() => setEditingProject(null)} onSave={handleSaveEditedProject} />}
    </div>
  );
};

export default App;
