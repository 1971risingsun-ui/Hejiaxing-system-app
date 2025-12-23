import React, { useState } from 'react';
import { Project, ProjectStatus, User, UserRole, ProjectType } from '../types';
import { ArrowLeftIcon, CalendarIcon, MapPinIcon, ExternalLinkIcon, ClipboardListIcon, BoxIcon, EditIcon, FileTextIcon } from './Icons';
import ProjectOverview from './ProjectOverview';
import ConstructionRecord from './ConstructionRecord';
import ProjectMaterials from './ProjectMaterials';
import CompletionReport from './CompletionReport';

interface ProjectDetailProps {
  project: Project;
  currentUser: User;
  onBack: () => void;
  onUpdateProject: (updatedProject: Project) => void;
  onEditProject: (project: Project) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, currentUser, onBack, onUpdateProject, onEditProject }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'construction' | 'completion'>('overview');
  const canEdit = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.address)}`;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${m}/${d}/${y}`;
  };

  const STATUS_CYCLE = [
    ProjectStatus.PLANNING,
    ProjectStatus.IN_PROGRESS,
    ProjectStatus.COMPLETED,
    ProjectStatus.ON_HOLD
  ];

  const handleStatusCycle = () => {
    if (!canEdit) return;
    
    const currentIndex = STATUS_CYCLE.indexOf(project.status);
    const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
    const nextStatus = STATUS_CYCLE[nextIndex];

    onUpdateProject({
      ...project,
      status: nextStatus
    });
  };

  // 判斷是否為支援完工報告的類型 (圍籬或組合屋)
  const supportsCompletionReport = project.type === ProjectType.CONSTRUCTION || project.type === ProjectType.MODULAR_HOUSE;

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6 py-4 shadow-sm">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 mb-4 transition-colors">
          <ArrowLeftIcon className="w-4 h-4 mr-1" /> 返回列表
        </button>
        
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
               <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
               {canEdit && (
                 <button onClick={() => onEditProject(project)} className="text-slate-400 hover:text-blue-600 p-1.5 hover:bg-slate-100 rounded-full transition-colors" title="編輯專案">
                   <EditIcon className="w-4 h-4" />
                 </button>
               )}
            </div>
            <div className="flex flex-wrap items-center gap-y-2 gap-x-6 mt-2 text-sm text-slate-600">
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-600 transition-colors group" title="在 Google 地圖中開啟">
                <MapPinIcon className="w-4 h-4 group-hover:text-blue-500" /> 
                <span className="underline decoration-dotted underline-offset-2">{project.address}</span>
                <ExternalLinkIcon className="w-3 h-3 opacity-50" />
              </a>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4 text-slate-400" /> 
                  <span className="font-semibold">預約:</span> {formatDate(project.appointmentDate) || '未定'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-400">報修:</span> {formatDate(project.reportDate) || '未定'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="text-right mr-2">
                <div className="text-xs text-slate-500 uppercase font-semibold">專案進度</div>
                <div className="text-2xl font-bold text-blue-600">{project.progress}%</div>
             </div>
             
             <button 
               onClick={handleStatusCycle}
               disabled={!canEdit}
               className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all active:scale-95 select-none ${
                 !canEdit ? 'cursor-default opacity-80' : 'cursor-pointer hover:shadow-md'
               } ${
                 project.status === ProjectStatus.COMPLETED ? 'bg-green-100 text-green-800 border-green-200' : 
                 project.status === ProjectStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                 project.status === ProjectStatus.ON_HOLD ? 'bg-gray-100 text-gray-800 border-gray-200' :
                 'bg-yellow-100 text-yellow-800 border-yellow-200'
               }`}
               title={canEdit ? "點擊切換狀態" : ""}
             >
               {project.status}
             </button>
          </div>
        </div>

        <div className="flex gap-6 mt-8 border-b border-slate-200 overflow-x-auto no-scrollbar">
          <button className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab('overview')}>
            詳細資訊
          </button>
          <button className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'construction' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab('construction')}>
            <ClipboardListIcon className="w-4 h-4" /> {project.type === ProjectType.CONSTRUCTION ? '施工紀錄' : '施工報告'} ({project.constructionItems?.length || 0})
          </button>
          {supportsCompletionReport && (
            <button className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'completion' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab('completion')}>
                <FileTextIcon className="w-4 h-4" /> 完工報告 ({(project.completionReports || []).length})
            </button>
          )}
          <button className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'materials' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab('materials')}>
            <BoxIcon className="w-4 h-4" /> 材料請購 ({project.materials?.length || 0})
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-auto bg-slate-50">
        {activeTab === 'overview' && <ProjectOverview project={project} currentUser={currentUser} onUpdateProject={onUpdateProject} />}
        {activeTab === 'construction' && <ConstructionRecord project={project} currentUser={currentUser} onUpdateProject={onUpdateProject} />}
        {activeTab === 'completion' && supportsCompletionReport && <CompletionReport project={project} currentUser={currentUser} onUpdateProject={onUpdateProject} />}
        {activeTab === 'materials' && <ProjectMaterials project={project} currentUser={currentUser} onUpdateProject={onUpdateProject} />}
      </div>
    </div>
  );
};

export default ProjectDetail;