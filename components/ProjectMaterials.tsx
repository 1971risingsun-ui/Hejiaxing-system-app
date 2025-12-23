
import React, { useState, useEffect } from 'react';
import { Project, Material, MaterialStatus, User, UserRole } from '../types';
import { DownloadIcon, PlusIcon, TrashIcon, BoxIcon, CalendarIcon, UserIcon, MapPinIcon } from './Icons';
import { downloadBlob } from '../utils/fileHelpers';
import { generateId } from '../App';

declare const XLSX: any;

interface ProjectMaterialsProps {
  project: Project;
  currentUser: User;
  onUpdateProject: (updatedProject: Project) => void;
}

const ProjectMaterials: React.FC<ProjectMaterialsProps> = ({ project, currentUser, onUpdateProject }) => {
  const [newMaterial, setNewMaterial] = useState({ name: '', quantity: 1, unit: '個', notes: '' });
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  
  const canEdit = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

  // 初始化欄位：填表日期預設今日，需到貨日期預設明日
  useEffect(() => {
    if (canEdit) {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      let needsUpdate = false;
      const updates: any = {};
      
      if (!project.materialFillingDate) {
        updates.materialFillingDate = todayStr;
        needsUpdate = true;
      }
      if (!project.materialDeliveryDate) {
        updates.materialDeliveryDate = tomorrowStr;
        needsUpdate = true;
      }
      if (!project.materialRequisitioner) {
        updates.materialRequisitioner = currentUser.name;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        onUpdateProject({
          ...project,
          ...updates
        });
      }
    }
  }, [project.id]);

  const handleHeaderChange = (field: string, value: string) => {
    onUpdateProject({
      ...project,
      [field]: value
    });
  };

  const handleAddMaterial = () => {
    if (!newMaterial.name) return;
    const material: Material = {
      id: generateId(),
      name: newMaterial.name,
      quantity: Number(newMaterial.quantity),
      unit: newMaterial.unit,
      status: MaterialStatus.PENDING,
      notes: newMaterial.notes
    };
    onUpdateProject({
      ...project,
      materials: [...(project.materials || []), material]
    });
    setNewMaterial({ name: '', quantity: 1, unit: '個', notes: '' });
    setIsAddingMaterial(false);
  };

  const deleteMaterial = (id: string) => {
    if (!window.confirm('確定要刪除此材料嗎？')) return;
    
    // 確保正確取得材料列表並更新
    const currentMaterials = Array.isArray(project.materials) ? project.materials : [];
    const updatedMaterials = currentMaterials.filter(m => m.id !== id);
    
    onUpdateProject({ 
      ...project, 
      materials: updatedMaterials 
    });
  };

  const handleExportMaterials = () => {
    try {
      const data = [
        ["合家興材料請購單"],
        ["專案名稱", project.name],
        ["填表日期", project.materialFillingDate || ""],
        ["請購人", project.materialRequisitioner || ""],
        ["需到貨日期", project.materialDeliveryDate || ""],
        ["送貨地點", project.materialDeliveryLocation || ""],
        ["收貨人", project.materialReceiver || ""],
        [],
        ["項次", "材料名稱", "數量", "單位", "備註"]
      ];

      (project.materials || []).forEach((m, index) => {
        data.push([
          (index + 1).toString(),
          m.name,
          m.quantity.toString(),
          m.unit,
          m.notes || ""
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "材料請購");
      
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `${project.name}_材料請購單.xlsx`);
    } catch (error) {
      console.error("Export error:", error);
      alert("匯出失敗");
    }
  };

  return (
    <div className="space-y-6">
      {/* Requisition Header Information */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
          請購資訊
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">填表日期</label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={project.materialFillingDate || ''}
                disabled={!canEdit}
                onChange={(e) => handleHeaderChange('materialFillingDate', e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-70"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">請購人</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                value={project.materialRequisitioner || ''}
                disabled={!canEdit}
                onChange={(e) => handleHeaderChange('materialRequisitioner', e.target.value)}
                placeholder="請輸入姓名"
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-70"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">需到貨日期</label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={project.materialDeliveryDate || ''}
                disabled={!canEdit}
                onChange={(e) => handleHeaderChange('materialDeliveryDate', e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-70"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">送貨地點</label>
            <div className="relative">
              <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select 
                value={project.materialDeliveryLocation || '現場'}
                disabled={!canEdit}
                onChange={(e) => handleHeaderChange('materialDeliveryLocation', e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none disabled:opacity-70"
              >
                <option value="現場">現場 (Site)</option>
                <option value="廠內">廠內 (Factory)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">收貨人</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                value={project.materialReceiver || ''}
                disabled={!canEdit}
                onChange={(e) => handleHeaderChange('materialReceiver', e.target.value)}
                placeholder="收貨窗口姓名"
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-70"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Materials Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-bold text-lg text-slate-800">材料清單</h3>
            <p className="text-sm text-slate-500">管理的請購項目</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleExportMaterials} 
              className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 w-10 h-10 rounded-full shadow-sm flex items-center justify-center transition-colors" 
              title="匯出 Excel"
            >
              <DownloadIcon className="w-5 h-5" />
            </button>
            {canEdit && (
              <button 
                onClick={() => setIsAddingMaterial(true)} 
                className="bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 rounded-full shadow-sm flex items-center justify-center transition-colors" 
                title="新增材料"
              >
                <PlusIcon className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {isAddingMaterial && (
           <div className="p-4 bg-blue-50 border-b border-blue-100 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
               <div>
                 <label className="text-[10px] font-bold text-blue-700 mb-1 block">材料名稱</label>
                 <input placeholder="例如：鍍鋅鋼板" className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} />
               </div>
               <div className="grid grid-cols-2 gap-2">
                 <div>
                    <label className="text-[10px] font-bold text-blue-700 mb-1 block">數量</label>
                    <input type="number" placeholder="數量" className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newMaterial.quantity} onChange={e => setNewMaterial({...newMaterial, quantity: Number(e.target.value)})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-blue-700 mb-1 block">單位</label>
                    <input placeholder="單位 (如: 片)" className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})} />
                 </div>
               </div>
             </div>
             <div className="mt-3">
                <label className="text-[10px] font-bold text-blue-700 mb-1 block">備註</label>
                <input placeholder="規格、顏色或其他需求..." className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newMaterial.notes} onChange={e => setNewMaterial({...newMaterial, notes: e.target.value})} />
             </div>
             <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setIsAddingMaterial(false)} className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">取消</button>
                <button onClick={handleAddMaterial} className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-all font-bold">新增材料</button>
             </div>
           </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 min-w-[120px] whitespace-nowrap">工程項目</th>
                <th className="px-4 py-3 w-20 whitespace-nowrap text-center">數量</th>
                <th className="px-4 py-3 w-20 whitespace-nowrap text-center">單位</th>
                <th className="px-4 py-3 min-w-[200px] whitespace-nowrap">備註</th>
                {canEdit && <th className="px-4 py-3 w-16 text-right whitespace-nowrap">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {project.materials && project.materials.length > 0 ? project.materials.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-800 text-sm">{item.name}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono text-center">{item.quantity}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm whitespace-nowrap text-center">{item.unit}</td>
                  <td className="px-4 py-3 text-slate-500 text-sm truncate max-w-[300px]" title={item.notes}>{item.notes || '-'}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteMaterial(item.id);
                        }} 
                        className="text-slate-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors flex items-center justify-center ml-auto"
                        title="刪除項目"
                        type="button"
                      >
                         <TrashIcon className="w-5 h-5" />
                      </button>
                    </td>
                  )}
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-400">
                    <BoxIcon className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-medium">尚未添加任何請購材料</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProjectMaterials;
