
import React, { useState } from 'react';
import { Project, Milestone, User, UserRole } from '../types';
import { UserIcon, PhoneIcon, PaperclipIcon, DownloadIcon, FileTextIcon, PlusIcon, CheckCircleIcon, TrashIcon, XIcon, EditIcon } from './Icons';

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
    const progress = milestones.length > 0 
      ? Math.round((completed / milestones.length) * 100) 
      : 0;

    onUpdateProject({
      ...project,
      milestones,
      progress
    });
  };

  const handleSaveRemarks = () => {
    onUpdateProject({
      ...project,
      remarks: localRemarks
    });
  };

  return (
    <div className="space-y-6">
      {/* Client Info Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">客戶資訊</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
              <div>
                 <label className="text-xs text-slate-400 block mb-1">客戶</label>
                 <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-slate-400" />
                    <div className="font-bold text-slate-800 text-lg">{project.clientName}</div>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs text-slate-400 block mb-1">聯絡人</label>
                   <div className="font-medium text-slate-700">{project.clientContact || '-'}</div>
                </div>
                <div>
                   <label className="text-xs text-slate-400 block mb-1">電話</label>
                   <div className="flex items-center gap-2">
                      <PhoneIcon className="w-4 h-4 text-slate-400" />
                      <div className="font-medium text-slate-700">{project.clientPhone || '-'}</div>
                   </div>
                </div>
              </div>
           </div>
      </div>

      {/* Engineering Summary Card (formerly Description) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-lg mb-3 text-slate-800">工程概要</h3>
          <p className="text-slate-600 leading-relaxed text-sm mb-6 whitespace-pre-wrap">{project.description}</p>
          
          {project.attachments && project.attachments.length > 0 && (
             <div className="pt-4 border-t border-slate-100">
               <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <PaperclipIcon className="w-4 h-4" /> 專案附件與照片
               </h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {project.attachments.map(att => {
                     const isImage = att.type.startsWith('image/');
                     return (
                        <div key={att.id} className="flex flex-col bg-slate-50 rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
                           {/* Preview Section */}
                           {isImage ? (
                             <div 
                                className="h-32 bg-slate-200 cursor-zoom-in overflow-hidden relative"
                                onClick={() => setViewingPhoto(att.url)}
                             >
                                <img src={att.url} alt={att.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                   <span className="text-white opacity-0 group-hover:opacity-100 bg-black/50 px-2 py-1 rounded text-[10px] font-bold">點擊放大</span>
                                </div>
                             </div>
                           ) : (
                             <div className="h-32 bg-slate-100 flex items-center justify-center text-slate-300">
                                <FileTextIcon className="w-12 h-12" />
                             </div>
                           )}
                           
                           {/* File Info */}
                           <div className="p-3 flex items-center justify-between">
                              <div className="flex-1 min-w-0 mr-2">
                                 <div className="text-xs font-bold text-slate-700 truncate" title={att.name}>{att.name}</div>
                                 <div className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(1)} KB</div>
                              </div>
                              <a 
                                href={att.url} 
                                download={att.name} 
                                className="text-slate-400 hover:text-blue-600 p-2 bg-white rounded-full border border-slate-100 shadow-sm transition-colors"
                                title="下載檔案"
                                onClick={(e) => e.stopPropagation()}
                              >
                                 <DownloadIcon className="w-3.5 h-3.5" />
                              </a>
                           </div>
                        </div>
                     );
                  })}
               </div>
             </div>
          )}
      </div>

      {/* Milestones Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-slate-800">工期進度</h3>
            {canEdit && (
              <button 
                onClick={() => setIsAddingMilestone(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                title="新增工期"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="space-y-4">
            {project.milestones.map((milestone) => (
              <div 
                key={milestone.id}
                className={`relative pl-8 pb-4 border-l-2 last:border-0 ${milestone.completed ? 'border-blue-200' : 'border-slate-200'}`}
              >
                <div 
                  className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 cursor-pointer transition-colors ${
                    milestone.completed ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 hover:border-blue-400'
                  }`}
                  onClick={() => toggleMilestone(milestone.id)}
                >
                   {milestone.completed && <CheckCircleIcon className="w-3 h-3 text-white m-[0.5px]" />}
                </div>
                
                <div className="group relative">
                  <div className={`transition-opacity ${milestone.completed ? 'opacity-50' : 'opacity-100'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <h4 
                        className={`font-semibold text-base cursor-pointer ${milestone.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}
                        onClick={() => toggleMilestone(milestone.id)}
                      >
                        {milestone.title}
                      </h4>
                      <div className="flex items-center gap-2">
                         <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                           {milestone.date.split('-')[1]}/{milestone.date.split('-')[2]}/{milestone.date.split('-')[0]}
                         </span>
                         {canEdit && (
                           <button onClick={() => deleteMilestone(milestone.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                             <TrashIcon className="w-3.5 h-3.5" />
                           </button>
                         )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2">{milestone.notes || milestone.title}</p>
                  </div>
                </div>
              </div>
            ))}

            {isAddingMilestone && (
              <div className="bg-slate-50 p-4 rounded-lg border border-blue-200 mt-4 animate-fade-in">
                <h4 className="text-sm font-bold text-slate-700 mb-3">新增工期</h4>
                <div className="grid grid-cols-1 gap-3 mb-3">
                  <input type="text" placeholder="名稱" className="px-3 py-2 border rounded-md text-sm" value={newMilestone.title} onChange={e => setNewMilestone({...newMilestone, title: e.target.value})} />
                  <input type="date" className="px-3 py-2 border rounded-md text-sm" value={newMilestone.date} onChange={e => setNewMilestone({...newMilestone, date: e.target.value})} />
                </div>
                <input type="text" placeholder="備註" className="w-full px-3 py-2 border rounded-md text-sm mb-3" value={newMilestone.notes} onChange={e => setNewMilestone({...newMilestone, notes: e.target.value})} />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsAddingMilestone(false)} className="px-3 py-1.5 text-sm text-slate-500">取消</button>
                  <button onClick={handleAddMilestone} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md">確認</button>
                </div>
              </div>
            )}
            
            {!isAddingMilestone && project.milestones.length === 0 && (
               <div className="text-center py-8 text-slate-400 italic">尚無進度</div>
            )}
          </div>
      </div>

      {/* Manual Remarks Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800">備註</h3>
              {canEdit && (
                  <button 
                      onClick={handleSaveRemarks}
                      className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-1.5"
                  >
                      <CheckCircleIcon className="w-3.5 h-3.5" /> 儲存備註
                  </button>
              )}
          </div>
          <textarea 
              value={localRemarks}
              onChange={(e) => setLocalRemarks(e.target.value)}
              onBlur={handleSaveRemarks}
              disabled={!canEdit}
              placeholder="點擊此處輸入備註資訊..."
              className="w-full min-h-[120px] p-4 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all resize-none disabled:bg-slate-50 disabled:cursor-not-allowed"
          ></textarea>
      </div>

      {/* Image Preview Modal (Lightbox) */}
      {viewingPhoto && (
        <div 
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setViewingPhoto(null)}
        >
           <button 
              className="absolute top-6 right-6 text-white/70 hover:text-white p-2 transition-colors"
              onClick={() => setViewingPhoto(null)}
           >
              <XIcon className="w-8 h-8" />
           </button>
           <img 
              src={viewingPhoto} 
              alt="Preview" 
              className="max-w-full max-h-[90vh] object-contain shadow-2xl rounded" 
              onClick={(e) => e.stopPropagation()}
           />
           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-xs">
              點擊背景關閉
           </div>
        </div>
      )}
    </div>
  );
};

export default ProjectOverview;
