
import React, { useState, useRef } from 'react';
import { Project, DailyReport, SitePhoto, User, UserRole } from '../types';
import { DownloadIcon, PlusIcon, FileTextIcon, SunIcon, CloudIcon, RainIcon, CameraIcon, XIcon, EditIcon, LoaderIcon, ChevronRightIcon, TrashIcon } from './Icons';
import { processFile, downloadBlob } from '../utils/fileHelpers';
import { generateId } from '../App';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

interface ProjectReportsProps {
  project: Project;
  currentUser: User;
  onUpdateProject: (updatedProject: Project) => void;
}

const ProjectReports: React.FC<ProjectReportsProps> = ({ project, currentUser, onUpdateProject }) => {
  const [isAddingReport, setIsAddingReport] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [newReport, setNewReport] = useState({
    date: new Date().toISOString().split('T')[0],
    weather: 'sunny' as 'sunny' | 'cloudy' | 'rainy',
    content: ''
  });
  const [tempReportPhotos, setTempReportPhotos] = useState<SitePhoto[]>([]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const reportPhotoInputRef = useRef<HTMLInputElement>(null);
  
  const canEdit = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

  const handleReportPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessingPhotos(true);
      const files = Array.from(e.target.files) as File[];
      const newPhotos: SitePhoto[] = [];

      for (const file of files) {
          try {
              const dataUrl = await processFile(file);
              newPhotos.push({
                id: generateId(),
                url: dataUrl,
                timestamp: Date.now(),
                description: `日誌附件 - ${new Date().toLocaleDateString()}`
              });
          } catch (error) { alert("照片處理失敗"); }
      }
      
      setTempReportPhotos(prev => [...prev, ...newPhotos]);
      setIsProcessingPhotos(false);
      e.target.value = '';
    }
  };

  const removeTempPhoto = (id: string) => {
    setTempReportPhotos(prev => prev.filter(p => p.id !== id));
  };

  const resetReportForm = () => {
    setNewReport({
      date: new Date().toISOString().split('T')[0],
      weather: 'sunny',
      content: ''
    });
    setTempReportPhotos([]);
    setEditingReportId(null);
    setIsAddingReport(false);
  };

  const handleEditReport = (report: DailyReport) => {
    setNewReport({
      date: report.date,
      weather: report.weather as any,
      content: report.content
    });
    const existingPhotos = (report.photos || [])
      .map(id => project.photos.find(p => p.id === id))
      .filter((p): p is SitePhoto => !!p);
    setTempReportPhotos(existingPhotos);
    setEditingReportId(report.id);
    setIsAddingReport(true);
  };

  const handleDeleteReport = (id: string) => {
      if(!confirm("確定要刪除此日誌嗎？")) return;
      onUpdateProject({ ...project, reports: (project.reports || []).filter(r => r.id !== id) });
  };

  const handleSaveReport = () => {
    if (!newReport.content) return;
    if (isProcessingPhotos) {
        alert("請等待照片處理完成");
        return;
    }

    const isDuplicateDate = (project.reports || []).some(r => r.date === newReport.date && r.id !== editingReportId);
    if (isDuplicateDate) {
      alert("此日期已有日誌記錄。");
      return;
    }

    let updatedProjectPhotos = [...(project.photos || [])];
    if (editingReportId) {
       const originalReport = project.reports.find(r => r.id === editingReportId);
       const originalPhotoIds = originalReport?.photos || [];
       updatedProjectPhotos = updatedProjectPhotos.filter(p => !originalPhotoIds.includes(p.id));
    }
    updatedProjectPhotos = [...updatedProjectPhotos, ...tempReportPhotos];

    const reportId = editingReportId || generateId();
    const reportPayload: DailyReport = {
      id: reportId,
      date: newReport.date,
      weather: newReport.weather,
      content: newReport.content,
      reporter: currentUser.name,
      timestamp: Date.now(),
      photos: tempReportPhotos.map(p => p.id)
    };

    let updatedReports;
    if (editingReportId) {
      updatedReports = project.reports.map(r => r.id === editingReportId ? reportPayload : r);
    } else {
      updatedReports = [...(project.reports || []), reportPayload].sort((a, b) => 
        b.date.localeCompare(a.date)
      );
    }

    onUpdateProject({
      ...project,
      reports: updatedReports,
      photos: updatedProjectPhotos
    });
    resetReportForm();
  };

  const handleExportReports = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('工程日誌');
      worksheet.columns = [
        { header: '日期', key: 'date', width: 15 },
        { header: '天氣', key: 'weather', width: 10 },
        { header: '記錄人', key: 'reporter', width: 15 },
        { header: '日誌內容', key: 'content', width: 60 },
      ];

      (project.reports || []).forEach(report => {
        const weatherText = report.weather === 'sunny' ? '晴天' : report.weather === 'cloudy' ? '陰天' : '雨天';
        worksheet.addRow({
          date: report.date,
          weather: weatherText,
          reporter: report.reporter,
          content: report.content,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      await downloadBlob(blob, `${project.name}_工程日誌.xlsx`);
    } catch (error) { alert("匯出失敗"); }
  };

  const handleDownloadPhotosZip = async (report: DailyReport) => {
    if (!report.photos || report.photos.length === 0) return;
    try {
      const zip = new JSZip();
      report.photos.forEach((photoId, index) => {
        const photo = project.photos.find(p => p.id === photoId);
        if (photo?.url?.includes('base64,')) {
          const base64Data = photo.url.split('base64,')[1];
          zip.file(`${report.date}_照片_${index + 1}.jpg`, base64Data, { base64: true });
        }
      });
      const content = await zip.generateAsync({ type: "blob" });
      downloadBlob(content, `${project.name}_${report.date}_現場照.zip`);
    } catch (error) { alert("打包失敗"); }
  };

  const getWeatherIcon = (weather: string) => {
    switch (weather) {
      case 'rainy': return <RainIcon className="w-5 h-5 text-blue-500" />;
      case 'cloudy': return <CloudIcon className="w-5 h-5 text-slate-500" />;
      default: return <SunIcon className="w-5 h-5 text-orange-500" />;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col md:flex-row animate-fade-in">
      {/* 左側清單/編輯區 */}
      {isAddingReport && (
        <div className="w-full md:w-96 border-b md:border-b-0 md:border-r border-slate-200 bg-blue-50/30 p-6 flex-shrink-0 flex flex-col gap-4 overflow-y-auto max-h-[800px] shadow-inner">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-slate-800 flex items-center gap-2"><FileTextIcon className="w-5 h-5 text-blue-600" />{editingReportId ? '編輯' : '撰寫'}工程日誌</h4>
            <button onClick={resetReportForm} className="text-slate-400 hover:text-slate-600"><XIcon className="w-6 h-6" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">選擇日期</label>
              <input type="date" value={newReport.date} onChange={e => setNewReport({...newReport, date: e.target.value})} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-blue-600 outline-none shadow-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">今日天氣</label>
              <div className="flex gap-2">
                {['sunny', 'cloudy', 'rainy'].map((w) => (
                   <button key={w} onClick={() => setNewReport({...newReport, weather: w as any})} className={`flex-1 py-3 rounded-xl border flex justify-center items-center transition-all ${newReport.weather === w ? 'bg-white border-blue-500 text-blue-600 shadow-md' : 'bg-slate-100/50 border-transparent text-slate-400'}`}>
                     {w === 'sunny' && <SunIcon className="w-5 h-5" />}
                     {w === 'cloudy' && <CloudIcon className="w-5 h-5" />}
                     {w === 'rainy' && <RainIcon className="w-5 h-5" />}
                   </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">施工詳情 (Ghi chú)</label>
              <textarea value={newReport.content} onChange={e => setNewReport({...newReport, content: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm h-32 resize-none outline-none shadow-sm focus:ring-2 focus:ring-blue-500" placeholder="記錄今日重點工程項目..." />
            </div>
            <div>
               <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">現場照片附件</label>
               <input type="file" multiple accept="image/*" ref={reportPhotoInputRef} className="hidden" onChange={handleReportPhotoUpload} />
               <button onClick={() => reportPhotoInputRef.current?.click()} disabled={isProcessingPhotos} className="w-full border-2 border-dashed border-slate-300 bg-white hover:bg-slate-50 text-slate-500 rounded-xl py-4 text-sm flex flex-col items-center justify-center transition-all disabled:opacity-50 group">
                  {isProcessingPhotos ? <LoaderIcon className="w-6 h-6 animate-spin text-blue-500" /> : <CameraIcon className="w-8 h-8 group-active:scale-90" />}
                  <span className="text-[10px] mt-1 font-bold">點擊上傳現場照</span>
               </button>
               {tempReportPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                     {tempReportPhotos.map(p => (
                        <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-200 group border border-slate-100 flex items-center justify-center">
                           <img src={p.url} className="max-w-full max-h-full object-contain" />
                           <button onClick={() => removeTempPhoto(p.id)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <XIcon className="w-3 h-3" />
                           </button>
                        </div>
                     ))}
                  </div>
               )}
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={resetReportForm} className="flex-1 py-3 text-sm font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">取消</button>
              <button onClick={handleSaveReport} disabled={isProcessingPhotos || !newReport.content} className="flex-1 py-3 text-sm font-bold bg-blue-600 text-white rounded-xl shadow-lg disabled:opacity-50 transition-all active:scale-95">
                {editingReportId ? '儲存變更' : '建立日誌'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 右側主列表區 */}
      <div className="flex-1 flex flex-col min-w-0">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="font-bold text-lg text-slate-800">工程日誌 (Nhật ký)</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Construction Log</p>
            </div>
            <div className="flex gap-2">
              {(project.reports || []).length > 0 && (
                <button onClick={handleExportReports} className="bg-white border border-slate-200 text-slate-600 hover:text-blue-600 w-10 h-10 rounded-full shadow-sm flex items-center justify-center transition-all active:scale-90" title="匯出 Excel">
                  <DownloadIcon className="w-5 h-5" />
                </button>
              )}
              {!isAddingReport && (
                  <button onClick={() => { resetReportForm(); setIsAddingReport(true); }} className="bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-90" title="撰寫日誌">
                    <PlusIcon className="w-6 h-6" />
                  </button>
              )}
            </div>
          </div>

          <div className="flex-1 p-6 bg-slate-50/30 overflow-y-auto">
            {(!project.reports || project.reports.length === 0) ? (
              <div className="text-center py-24 text-slate-300">
                <FileTextIcon className="w-16 h-16 mx-auto mb-4 opacity-10" />
                <p className="text-sm font-bold italic">目前尚無工程日誌</p>
              </div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto">
                {project.reports.map((report) => (
                  <div key={report.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-black tracking-tight shadow-sm">{report.date}</div>
                        <div className="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                          {getWeatherIcon(report.weather)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">{report.reporter}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {report.photos && report.photos.length > 0 && (
                              <button onClick={() => handleDownloadPhotosZip(report)} className="text-slate-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded-lg" title="下載照片打包檔">
                                <DownloadIcon className="w-4 h-4" />
                              </button>
                            )}
                            {canEdit && (
                              <>
                                <button onClick={() => handleEditReport(report)} className="text-slate-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded-lg" title="編輯日誌"><EditIcon className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteReport(report.id)} className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg" title="刪除"><TrashIcon className="w-4 h-4" /></button>
                              </>
                            )}
                        </div>
                      </div>
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed mb-5 font-medium border-l-4 border-slate-100 pl-4">{report.content}</p>
                    {report.photos && report.photos.length > 0 && (
                       <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3 mt-4">
                          {report.photos.map(photoId => {
                             const photo = project.photos.find(p => p.id === photoId);
                             if (!photo) return null;
                             return (
                                <div key={photoId} className="aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-100 flex items-center justify-center cursor-zoom-in group/img" onClick={() => setViewingPhoto(photo.url)}>
                                   <img src={photo.url} className="max-w-full max-h-full object-contain transition-transform group-hover/img:scale-110" />
                                </div>
                             );
                          })}
                       </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>
      
      {viewingPhoto && (
        <div className="fixed inset-0 z-[110] bg-black/98 flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingPhoto(null)}>
            <img src={viewingPhoto} className="max-w-full max-h-full object-contain shadow-2xl" />
            <button className="absolute top-6 right-6 text-white bg-white/10 p-2 rounded-full backdrop-blur-md hover:bg-white/20 transition-all"><XIcon className="w-8 h-8" /></button>
        </div>
      )}
    </div>
  );
};

export default ProjectReports;
