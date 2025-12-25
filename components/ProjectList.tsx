
import React, { useState, useEffect, useRef } from 'react';
import { Project, ProjectStatus, User, UserRole } from '../types';
import { CalendarIcon, MapPinIcon, SearchIcon, MoreVerticalIcon, EditIcon, CopyIcon, TrashIcon, LayoutGridIcon, ListIcon, PlusIcon } from './Icons';

interface ProjectListProps {
  title?: string;
  projects: Project[];
  currentUser: User;
  onSelectProject: (project: Project) => void;
  onAddProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onDuplicateProject: (project: Project) => void;
  onEditProject: (project: Project) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ title, projects, currentUser, onSelectProject, onAddProject, onDeleteProject, onDuplicateProject, onEditProject }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid'); 
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${m}/${d}/${y}`;
  };

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.COMPLETED: return 'bg-green-100 text-green-800 border-green-200';
      case ProjectStatus.IN_PROGRESS: return 'bg-blue-100 text-blue-800 border-blue-200';
      case ProjectStatus.PLANNING: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredProjects = projects.filter(project => {
    if (!project) return false;
    
    const search = searchTerm.toLowerCase();
    const name = (project.name || '').toLowerCase();
    const client = (project.clientName || '').toLowerCase();
    const addr = (project.address || '').toLowerCase();
    
    const matchesSearch = 
      name.includes(search) || 
      client.includes(search) || 
      addr.includes(search);
    
    const matchesStatus = statusFilter === 'ALL' || project.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const canAddProject = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;
  const canManageProject = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

  const handleMenuClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === projectId ? null : projectId);
  };

  const handleEditClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    onEditProject(project);
    setActiveMenuId(null);
  };

  const handleDelete = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    onDeleteProject(projectId);
    setActiveMenuId(null);
  };

  const handleDuplicate = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    onDuplicateProject(project);
    setActiveMenuId(null);
  };

  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto pb-20 md:pb-6" onClick={() => setActiveMenuId(null)}>
      <div className="flex flex-row items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{title || '圍籬總覽'}</h1>
        </div>
        {canAddProject && (
          <button
            onClick={onAddProject}
            className="bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 rounded-full shadow-sm flex items-center justify-center transition-all active:scale-95"
            title="新增案件"
          >
            <PlusIcon className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-10 md:static">
        <div className="flex gap-2">
            <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="搜尋專案..." 
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 flex-shrink-0">
                <button 
                    onClick={() => setViewMode('table')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <ListIcon className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <LayoutGridIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
            
        <div className="flex gap-2 overflow-x-auto w-full pb-1 no-scrollbar">
            {['ALL', ProjectStatus.IN_PROGRESS, ProjectStatus.PLANNING, ProjectStatus.COMPLETED].map((status) => (
                <button 
                    key={status}
                    onClick={() => setStatusFilter(status as any)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${statusFilter === status ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                    {status === 'ALL' ? '全部' : status}
                </button>
            ))}
        </div>
      </div>

      {filteredProjects.length === 0 ? (
          <div className="w-full py-20 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
             沒有找到符合條件的專案
          </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredProjects.map((project) => (
            <div 
              key={project.id} 
              onClick={() => onSelectProject(project)}
              className="bg-white rounded-xl border border-slate-200 shadow-sm active:scale-[0.98] transition-all cursor-pointer overflow-hidden group relative"
            >
              <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    {canManageProject && (
                      <div className="relative">
                        <button 
                          onClick={(e) => handleMenuClick(e, project.id)}
                          className="text-slate-400 hover:text-slate-600 p-2 -mr-2 rounded-full active:bg-slate-100 transition-colors"
                        >
                          <MoreVerticalIcon className="w-5 h-5" />
                        </button>
                        
                        {activeMenuId === project.id && (
                          <div 
                            ref={menuRef}
                            className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in"
                          >
                            <button onClick={(e) => handleEditClick(e, project)} className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2">
                              <EditIcon className="w-4 h-4" /> 編輯
                            </button>
                            <button onClick={(e) => handleDuplicate(e, project)} className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2">
                              <CopyIcon className="w-4 h-4" /> 複製
                            </button>
                            {currentUser.role === UserRole.ADMIN && (
                              <button onClick={(e) => handleDelete(e, project.id)} className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-slate-50">
                                <TrashIcon className="w-4 h-4" /> 刪除
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-slate-800 mb-2 leading-tight">
                  {project.name}
                </h3>
                
                <p className="text-slate-500 text-xs md:text-sm mb-4 line-clamp-2 min-h-[2.5em]">
                  {project.description}
                </p>

                <div className="space-y-1.5 text-xs md:text-sm text-slate-600 mb-5">
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{project.address}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-slate-500 whitespace-nowrap">預約:</span>
                      <span className="text-slate-700">{formatDate(project.appointmentDate)}</span>
                    </div>
                    {project.reportDate && (
                      <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                        <span className="font-medium text-slate-500 whitespace-nowrap">報修:</span>
                        <span className="text-slate-700">{formatDate(project.reportDate)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-auto">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-600">進度</span>
                    <span className="font-bold text-blue-600">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${project.progress}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 w-20 whitespace-nowrap">狀態</th>
                            <th className="px-4 py-3 whitespace-nowrap">專案名稱</th>
                            <th className="px-4 py-3 whitespace-nowrap">客戶 / 地址</th>
                            <th className="px-4 py-3 whitespace-nowrap">日期資訊</th>
                            <th className="px-4 py-3 w-32 whitespace-nowrap">進度</th>
                            {canManageProject && <th className="px-4 py-3 w-20 text-right whitespace-nowrap">操作</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredProjects.map((project) => (
                            <tr key={project.id} onClick={() => onSelectProject(project)} className="hover:bg-slate-50 transition-colors cursor-pointer group active:bg-slate-100">
                                <td className="px-4 py-3 align-top whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${getStatusColor(project.status)}`}>
                                        {project.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 align-top whitespace-nowrap">
                                    <div className="font-bold text-slate-800 text-sm mb-1">{project.name}</div>
                                    <div className="text-slate-400 text-xs line-clamp-1 max-w-[200px]">{project.description}</div>
                                </td>
                                <td className="px-4 py-3 align-top whitespace-nowrap">
                                    <div className="text-sm font-medium text-slate-700">{project.clientName}</div>
                                    <div className="text-xs text-slate-400 truncate max-w-[120px]">{project.address}</div>
                                </td>
                                <td className="px-4 py-3 align-top text-xs text-slate-500 whitespace-nowrap">
                                    <div className="flex flex-wrap gap-x-4">
                                      <span><span className="font-semibold">預約:</span> {formatDate(project.appointmentDate) || '-'}</span>
                                      <span><span className="font-semibold">報修:</span> {formatDate(project.reportDate) || '-'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 align-top whitespace-nowrap">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-blue-600">{project.progress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1">
                                        <div className="bg-blue-600 h-1 rounded-full transition-all duration-500" style={{ width: `${project.progress}%` }}></div>
                                    </div>
                                </td>
                                {canManageProject && (
                                    <td className="px-4 py-3 align-top text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={(e) => handleEditClick(e, project)} className="p-2 text-slate-400 hover:text-blue-600 rounded-full">
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
};

export default ProjectList;
