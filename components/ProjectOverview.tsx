
import React, { useState } from 'react';
import { Project, Milestone, User, UserRole } from '../types';
import { UserIcon, PhoneIcon, PaperclipIcon, DownloadIcon, FileTextIcon, PlusIcon, CheckCircleIcon, TrashIcon, XIcon } from './Icons';

interface ProjectOverviewProps {
  project: Project;
  currentUser: User;
  onUpdateProject: (updatedProject: Project) => void;
}

const ProjectOverview: React.FC<ProjectOverviewProps> = ({ project, currentUser, onUpdateProject }) => {
  const [newMilestone, setNewMilestone] = useState({ title: '', date: '', notes: '' });
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [localRemarks, setLocalRemarks] = useState(project.remarks || '');
  
  const canEdit = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

  const toggleMilestone = (id: string) => {
    const updatedMilestones = project.milestones.map(m => 
      m.id === id ? { ...m, completed: !m.completed } : m
    );
    updateProjectProgress(updatedMilestones);
  };

  const deleteMilestone = (id: string) => {
    if (!confirm('刪除此工期?')) return;
    const updatedMilestones = project.milestones.filter(m => m.id !== id);
    updateProjectProgress(updatedMilestones);
  };

  const handleAddMilestone = () => {
    if (!newMilestone.title || !newMilestone.date) return;
    const milestone: Milestone = {
      id: crypto.randomUUID(),
      title: newMilestone.title,
      date: newMilestone.date,
      notes: newMilestone.notes,
      completed: false
    };
    const updatedMilestones = [...project.milestones, milestone].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    updateProjectProgress(updatedMilestones);
    setNewMilestone({ title: '', date: '', notes: '' });
    setIsAddingMilestone(false);
  };

  const updateProjectProgress = (milestones: Milestone[]) => {
    const completed = milestones.filter(m => m.completed).length;
    const progress = milestones.length > 0 ? Math.round((completed / milestones.length) * 100) : 0;
    onUpdateProject({ ...project, milestones, progress });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">客戶資訊</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                 <label className="text-xs text-slate-400 block mb-1">客戶 (專案名稱)</label>
                 <div className="font-bold text-slate-800 text-lg">{project.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs text-slate-400 block mb-1">聯絡人</label>
                   <div className="font-medium text-slate-700">{project.clientContact || '-'}</div>
                </div>
                <div>
                   <label className="text-xs text-slate-400 block mb-1">電話</label>
                   <div className="font-medium text-slate-700">{project.clientPhone || '-'}</div>
                </div>
              </div>
           </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-lg mb-3 text-slate-800">工程概要</h3>
          <p className="text-slate-600 leading-relaxed text-sm mb-6 whitespace-pre-wrap">{project.description}</p>
          
          {project.attachments && project.attachments.length > 0 && (
             <div className="pt-4 border-t border-slate-100">
               <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <PaperclipIcon className="w-4 h-4" /> 圖面與附件 (Excel 自動匯入)
               </h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {project.attachments.map(att => {
                     const isImage = att.type.startsWith('image/');
                     return (
                        <div key={att.id} className="flex flex-col bg-slate-50 rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
                           {isImage ? (
                             <div 
                                className="h-48 bg-slate-200 cursor-zoom-in overflow-hidden relative flex items-center justify-center"
                                onClick={() => setViewingPhoto(att.url)}
                             >
                                <img src={att.url} alt={att.name} className="max-w-full max-h-full object-contain transition-transform duration-300" />
                             </div>
                           ) : (
                             <div className="h-48 bg-slate-100 flex items-center justify-center text-slate-300">
                                <FileTextIcon className="w-12 h-12" />
                             </div>
                           )}
                           <div className="p-3 flex items-center justify-between bg-white border-t border-slate-100">
                              <div className="flex-1 min-w-0 mr-2">
                                 <div className="text-xs font-bold text-slate-700 truncate">{att.name}</div>
                                 <div className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(1)} KB</div>
                              </div>
                              <a href={att.url} download={att.name} className="text-slate-400 hover:text-blue-600 p-1.5" onClick={(e) => e.stopPropagation()}>
                                 <DownloadIcon className="w-4 h-4" />
                              </a>
                           </div>
                        </div>
                     );
                  })}
               </div>
             </div>
          )}
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-lg text-slate-800 mb-4">備註資訊</h3>
          <textarea 
              value={localRemarks}
              onChange={(e) => setLocalRemarks(e.target.value)}
              onBlur={() => onUpdateProject({ ...project, remarks: localRemarks })}
              placeholder="點擊輸入額外備註..."
              className="w-full min-h-[100px] p-4 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-700 focus:bg-white outline-none transition-all resize-none"
          ></textarea>
      </div>

      {viewingPhoto && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setViewingPhoto(null)}>
           <img src={viewingPhoto} alt="Original" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
           <button className="absolute top-6 right-6 text-white/70 hover:text-white p-2"><XIcon className="w-8 h-8" /></button>
        </div>
      )}
    </div>
  );
};

export default ProjectOverview;
