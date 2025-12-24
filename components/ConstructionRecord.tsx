
import React, { useState, useEffect, useRef } from 'react';
import { Project, ConstructionItem, User, UserRole, ConstructionSignature, DailyReport, SitePhoto, ProjectType } from '../types';
// Fix: Use CheckCircleIcon directly without the 'SubmitIcon' alias since it is used as CheckCircleIcon later in the file.
import { DownloadIcon, PlusIcon, ClipboardListIcon, ArrowLeftIcon, ChevronRightIcon, TrashIcon, CheckCircleIcon, PenToolIcon, XIcon, StampIcon, XCircleIcon, SunIcon, CloudIcon, RainIcon, CameraIcon, LoaderIcon, FileTextIcon, BoxIcon, ImageIcon, EditIcon } from './Icons';
import { downloadBlob, processFile } from '../utils/fileHelpers';
import { generateId } from '../App';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';

interface ConstructionRecordProps {
  project: Project;
  currentUser: User;
  onUpdateProject: (updatedProject: Project) => void;
  forceEntryMode?: boolean; 
  initialDate?: string; 
}

const ConstructionRecord: React.FC<ConstructionRecordProps> = ({ project, currentUser, onUpdateProject, forceEntryMode = false, initialDate }) => {
  const isMaintenance = project.type === ProjectType.MAINTENANCE;
  const mainTitle = isMaintenance ? '施工報告' : '施工紀錄';

  const [constructionMode, setConstructionMode] = useState<'overview' | 'entry'>(
    forceEntryMode ? 'entry' : (isMaintenance ? 'entry' : 'overview')
  );
  
  const [constructionDate, setConstructionDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [dailyWorker, setDailyWorker] = useState('');
  const [dailyAssistant, setDailyAssistant] = useState(''); 
  const [pendingAssistant, setPendingAssistant] = useState(''); 
  const [isHalfDay, setIsHalfDay] = useState(false); 
  const [customItem, setCustomItem] = useState({ name: '', quantity: '', unit: '', location: '' });
  
  const [isEditing, setIsEditing] = useState(true);
  const [signatureData, setSignatureData] = useState<ConstructionSignature | null>(null);

  const [reportWeather, setReportWeather] = useState<'sunny' | 'cloudy' | 'rainy'>('sunny');
  const [reportContent, setReportContent] = useState('');
  const [reportPhotos, setReportPhotos] = useState<SitePhoto[]>([]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const reportPhotoInputRef = useRef<HTMLInputElement>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  // Signature states
  const [isSigning, setIsSigning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const canEdit = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

  useEffect(() => {
    const items = (project.constructionItems || []).filter(i => i.date === constructionDate);
    if (items.length > 0) {
      setDailyWorker(items[0].worker || '');
      setDailyAssistant(items[0].assistant || '');
    } else {
      setDailyWorker('');
      setDailyAssistant('');
    }

    const existingSig = (project.constructionSignatures || []).find(s => s.date === constructionDate);
    setSignatureData(existingSig || null);

    const existingReport = (project.reports || []).find(r => r.date === constructionDate);
    if (existingReport) {
        setReportWeather(existingReport.weather);
        setReportContent(existingReport.content);
        const photos = (existingReport.photos || []).map(id => project.photos.find(p => p.id === id)).filter((p): p is SitePhoto => !!p);
        setReportPhotos(photos);
        setIsEditing(false);
    } else {
        setReportWeather('sunny');
        setReportContent('');
        setReportPhotos([]);
        setIsEditing(true);
    }
  }, [constructionDate, project.constructionItems, project.constructionSignatures, project.reports, project.photos]);

  const updateReportData = (updates: Partial<{ weather: 'sunny' | 'cloudy' | 'rainy', content: string, photos: SitePhoto[] }>) => {
      const newWeather = updates.weather || reportWeather;
      const newContent = updates.content !== undefined ? updates.content : reportContent;
      const newPhotos = updates.photos || reportPhotos;
      
      const otherReports = (project.reports || []).filter(r => r.date !== constructionDate);
      const existingPhotoIds = new Set(project.photos.map(p => p.id));
      const photosToAdd = newPhotos.filter(p => !existingPhotoIds.has(p.id));

      const reportPayload: DailyReport = {
          id: (project.reports || []).find(r => r.date === constructionDate)?.id || generateId(),
          date: constructionDate,
          weather: newWeather,
          content: newContent,
          reporter: currentUser.name,
          timestamp: Date.now(),
          photos: newPhotos.map(p => p.id),
          worker: dailyWorker,
          assistant: dailyAssistant
      };

      onUpdateProject({ 
          ...project, 
          reports: [...otherReports, reportPayload], 
          photos: [...project.photos, ...photosToAdd] 
      });
  };

  const handleAddAssistant = () => {
    if (!pendingAssistant.trim()) return;
    const name = isHalfDay ? `${pendingAssistant.trim()} (半天)` : pendingAssistant.trim();
    const currentList = dailyAssistant.split(',').map(s => s.trim()).filter(s => !!s);
    if (!currentList.includes(name)) {
        const newList = [...currentList, name].join(', ');
        setDailyAssistant(newList);
        // 同步更新所有項目的助手欄位
        const otherItems = (project.constructionItems || []).filter(i => i.date !== constructionDate);
        const thisDateItems = (project.constructionItems || []).filter(i => i.date === constructionDate);
        const updatedThisDate = thisDateItems.map(i => ({ ...i, assistant: newList }));
        onUpdateProject({ ...project, constructionItems: [...otherItems, ...updatedThisDate] });
    }
    setPendingAssistant('');
    setIsHalfDay(false);
  };

  const removeAssistant = (name: string) => {
    const newList = dailyAssistant.split(',').map(s => s.trim()).filter(s => !!s && s !== name).join(', ');
    setDailyAssistant(newList);
    const otherItems = (project.constructionItems || []).filter(i => i.date !== constructionDate);
    const thisDateItems = (project.constructionItems || []).filter(i => i.date === constructionDate);
    onUpdateProject({ ...project, constructionItems: [...otherItems, ...thisDateItems.map(i => ({ ...i, assistant: newList }))] });
  };

  const handleAddCustomItem = () => {
    if (!customItem.name) return;
    const newItem: ConstructionItem = {
      id: generateId(),
      date: constructionDate,
      worker: dailyWorker,
      assistant: dailyAssistant,
      ...customItem
    };
    onUpdateProject({ ...project, constructionItems: [...(project.constructionItems || []), newItem] });
    setCustomItem({ name: '', quantity: '', unit: '', location: '' });
  };

  const handleDeleteItem = (id: string) => {
    onUpdateProject({ ...project, constructionItems: project.constructionItems.filter(i => i.id !== id) });
  };

  const handleReportPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessingPhotos(true);
      const files = Array.from(e.target.files) as File[];
      const newPhotos: SitePhoto[] = [];
      for (const file of files) {
          try {
              const dataUrl = await processFile(file);
              newPhotos.push({ id: generateId(), url: dataUrl, timestamp: Date.now(), description: `施工照 - ${constructionDate}` });
          } catch (error) { alert("上傳失敗"); }
      }
      updateReportData({ photos: [...reportPhotos, ...newPhotos] });
      setIsProcessingPhotos(false);
      e.target.value = '';
    }
  };

  // --- Signature Logic ---
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      setIsDrawing(true);
      const pos = 'touches' in e ? e.touches[0] : e as React.MouseEvent;
      const rect = canvas.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(pos.clientX - rect.left, pos.clientY - rect.top);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if ('touches' in e) e.preventDefault();
      const pos = 'touches' in e ? e.touches[0] : e as React.MouseEvent;
      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(pos.clientX - rect.left, pos.clientY - rect.top);
      ctx.stroke();
  };
  const stopDrawing = () => setIsDrawing(false);
  const saveSignature = () => {
      const canvas = canvasRef.current;
      if (canvas) {
          const url = canvas.toDataURL('image/png');
          const newSig: ConstructionSignature = { id: generateId(), date: constructionDate, url, timestamp: Date.now() };
          const otherSigs = (project.constructionSignatures || []).filter(s => s.date !== constructionDate);
          onUpdateProject({ ...project, constructionSignatures: [...otherSigs, newSig] });
          setIsSigning(false);
      }
  };

  const renderConstructionEntry = () => {
    const items = (project.constructionItems || []).filter(i => i.date === constructionDate);
    
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative animate-fade-in">
        <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
          <div className="flex flex-row justify-between items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                 {!isMaintenance && <button onClick={() => setConstructionMode('overview')} className="text-slate-400 hover:text-slate-600 p-2 -ml-2"><ArrowLeftIcon className="w-5 h-5" /></button>}
                 <h3 className="font-bold text-lg text-slate-800">編輯{mainTitle} - {constructionDate}</h3>
              </div>
              <div className="flex gap-2">
                {isEditing ? (
                  <button onClick={() => setIsEditing(false)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm">完成編輯</button>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2"><EditIcon className="w-4 h-4" /> 修改內容</button>
                )}
              </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-200">
             <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">師傅 (Thợ chính)</label>
                <input type="text" value={dailyWorker} onChange={(e) => setDailyWorker(e.target.value)} disabled={!isEditing} placeholder="輸入姓名" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50" />
             </div>
             <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">助手 (Phụ việc)</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {dailyAssistant.split(',').map(s => s.trim()).filter(s => !!s).map(name => (
                        <span key={name} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold border border-blue-100">
                            {name}{isEditing && <button onClick={() => removeAssistant(name)}><XCircleIcon className="w-3.5 h-3.5" /></button>}
                        </span>
                    ))}
                </div>
                {isEditing && (
                    <div className="flex items-center gap-2">
                        <input type="text" value={pendingAssistant} onChange={(e) => setPendingAssistant(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddAssistant()} placeholder="助手姓名" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none" />
                        <label className="flex items-center gap-1 bg-slate-50 px-2 py-2 rounded-lg border border-slate-200 cursor-pointer">
                            <input type="checkbox" checked={isHalfDay} onChange={(e) => setIsHalfDay(e.target.checked)} className="w-4 h-4" />
                            <span className="text-xs font-bold text-slate-500">半天</span>
                        </label>
                        <button onClick={handleAddAssistant} className="bg-slate-800 text-white p-2 rounded-lg"><PlusIcon className="w-5 h-5" /></button>
                    </div>
                )}
             </div>
          </div>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto">
            {/* 施工照區塊 */}
            <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">施工照 (保持原比例)</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {isEditing && (
                        <button onClick={() => reportPhotoInputRef.current?.click()} disabled={isProcessingPhotos} className="aspect-square border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors">
                            {isProcessingPhotos ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <CameraIcon className="w-6 h-6" />}
                        </button>
                    )}
                    <input type="file" multiple accept="image/*" ref={reportPhotoInputRef} className="hidden" onChange={handleReportPhotoUpload} />
                    {reportPhotos.map(p => (
                        <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center group shadow-sm">
                            <img src={p.url} className="max-w-full max-h-full object-contain cursor-zoom-in" onClick={() => setViewingPhoto(p.url)} />
                            {isEditing && (
                                <button onClick={() => updateReportData({ photos: reportPhotos.filter(ph => ph.id !== p.id) })} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <XIcon className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* 施工項目清單 */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-slate-400 uppercase">施工項目清單 (Danh sách hạng mục)</label>
                    {isEditing && <span className="text-[10px] text-blue-500 font-bold">已自動記錄師傅與助手資訊</span>}
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase">
                            <tr>
                                <th className="px-4 py-2">項目</th>
                                <th className="px-4 py-2 w-20 text-center">數量</th>
                                <th className="px-4 py-2 w-16 text-center">單位</th>
                                <th className="px-4 py-2">位置</th>
                                {isEditing && <th className="px-4 py-2 w-10"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                                    <td className="px-4 py-3 text-center font-mono">{item.quantity}</td>
                                    <td className="px-4 py-3 text-center text-slate-400 text-xs">{item.unit}</td>
                                    <td className="px-4 py-3 text-slate-500 text-xs">{item.location}</td>
                                    {isEditing && (
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => handleDeleteItem(item.id)} className="text-slate-300 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {isEditing && (
                                <tr className="bg-blue-50/30">
                                    <td className="px-2 py-2"><input type="text" placeholder="品名" className="w-full bg-white px-2 py-1.5 border rounded text-xs" value={customItem.name} onChange={e => setCustomItem({...customItem, name: e.target.value})} /></td>
                                    <td className="px-2 py-2"><input type="text" placeholder="0" className="w-full bg-white px-2 py-1.5 border rounded text-xs text-center" value={customItem.quantity} onChange={e => setCustomItem({...customItem, quantity: e.target.value})} /></td>
                                    <td className="px-2 py-2"><input type="text" placeholder="單位" className="w-full bg-white px-2 py-1.5 border rounded text-xs text-center" value={customItem.unit} onChange={e => setCustomItem({...customItem, unit: e.target.value})} /></td>
                                    <td className="px-2 py-2"><input type="text" placeholder="位置" className="w-full bg-white px-2 py-1.5 border rounded text-xs" value={customItem.location} onChange={e => setCustomItem({...customItem, location: e.target.value})} /></td>
                                    <td className="px-2 py-2"><button onClick={handleAddCustomItem} className="bg-blue-600 text-white p-1.5 rounded"><PlusIcon className="w-4 h-4" /></button></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 日誌備註 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">當日天氣</label>
                    <div className="flex gap-2">
                        {['sunny', 'cloudy', 'rainy'].map((w) => (
                            <button key={w} disabled={!isEditing} onClick={() => updateReportData({ weather: w as any })} className={`flex-1 py-3 rounded-xl border flex justify-center transition-all ${reportWeather === w ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-slate-200 text-slate-400'}`}>
                                {w === 'sunny' && <SunIcon className="w-6 h-6" />}{w === 'cloudy' && <CloudIcon className="w-6 h-6" />}{w === 'rainy' && <RainIcon className="w-6 h-6" />}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">施工詳情備註 (Ghi chú)</label>
                    <textarea value={reportContent} disabled={!isEditing} onChange={(e) => setReportContent(e.target.value)} onBlur={() => updateReportData({ content: reportContent })} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm h-24 resize-none outline-none shadow-inner disabled:bg-slate-50" placeholder="輸入今日施作重點或異常回報..." />
                </div>
            </div>

            {/* 簽名區塊 */}
            <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row gap-6 items-end">
                <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">客戶/師傅簽名確認</label>
                    {signatureData ? (
                        <div className="relative border border-slate-200 rounded-2xl p-4 bg-white h-32 flex items-center justify-center group shadow-sm">
                            <img src={signatureData.url} alt="Signature" className="max-h-full object-contain" />
                            {isEditing && (
                                <button onClick={() => onUpdateProject({ ...project, constructionSignatures: project.constructionSignatures.filter(s => s.date !== constructionDate) })} className="absolute top-2 right-2 bg-red-100 text-red-600 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ) : (
                        <button onClick={() => setIsSigning(true)} disabled={!isEditing} className="w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:bg-slate-50 transition-colors disabled:opacity-50">
                            <PenToolIcon className="w-6 h-6" />
                            <span className="text-sm font-bold">點擊開始簽名</span>
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* 簽名 Modal */}
        {isSigning && (
            <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-up">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800">電子簽名 (Chữ ký)</h3>
                        <button onClick={() => setIsSigning(false)}><XIcon className="w-6 h-6 text-slate-400" /></button>
                    </div>
                    <div className="p-4 bg-slate-100 flex justify-center overflow-hidden">
                         <canvas 
                            ref={canvasRef} width={340} height={200}
                            className="bg-white shadow-inner cursor-crosshair touch-none rounded-xl border border-slate-200"
                            onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                         />
                    </div>
                    <div className="p-4 flex justify-between gap-3">
                        <button onClick={() => { const ctx = canvasRef.current?.getContext('2d'); ctx?.clearRect(0,0,340,200); }} className="text-slate-400 font-bold px-4 py-2 hover:bg-slate-50 rounded-lg">重簽</button>
                        <div className="flex gap-2">
                            <button onClick={() => setIsSigning(false)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold">取消</button>
                            <button onClick={saveSignature} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-md">確認簽章</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {viewingPhoto && (
            <div className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4" onClick={() => setViewingPhoto(null)}>
                <img src={viewingPhoto} className="max-w-full max-h-full object-contain shadow-2xl" />
                <button className="absolute top-6 right-6 text-white p-2 bg-white/10 rounded-full backdrop-blur-md"><XIcon className="w-8 h-8" /></button>
            </div>
        )}
      </div>
    );
  };

  return constructionMode === 'overview' ? (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] animate-fade-in">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div><h3 className="font-bold text-lg text-slate-800">{mainTitle}總覽</h3><p className="text-sm text-slate-500">歷史紀錄依日期排序</p></div>
          <button onClick={() => { setConstructionDate(new Date().toISOString().split('T')[0]); setConstructionMode('entry'); }} className="bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 rounded-full shadow-sm flex items-center justify-center transition-transform active:scale-90"><PlusIcon className="w-6 h-6" /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                <tr>
                    <th className="px-6 py-4">日期 (Ngày)</th>
                    <th className="px-6 py-4">師傅 (Thợ chính)</th>
                    <th className="px-6 py-4">助手 (Phụ)</th>
                    <th className="px-6 py-4 text-center">簽章</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {(project.reports || []).sort((a,b)=>b.date.localeCompare(a.date)).map(r => (
                   <tr key={r.id} onClick={() => { setConstructionDate(r.date); setConstructionMode('entry'); }} className="hover:bg-blue-50/50 cursor-pointer transition-colors group">
                       <td className="px-6 py-4"><div className="flex items-center gap-2"><span className="font-black text-slate-800">{r.date}</span><ChevronRightIcon className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" /></div></td>
                       <td className="px-6 py-4"><span className="text-sm font-bold text-slate-600">{r.worker || '-'}</span></td>
                       <td className="px-6 py-4"><span className="text-xs text-slate-400 line-clamp-1">{r.assistant || '-'}</span></td>
                       <td className="px-6 py-4 text-center">{(project.constructionSignatures || []).some(s => s.date === r.date) ? <div className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded text-[10px] font-bold border border-green-200"><CheckCircleIcon className="w-3 h-3" /> OK</div> : '-'}</td>
                   </tr>
                ))}
                {(project.reports || []).length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-20 text-center text-slate-400 italic">尚未有任何{mainTitle}紀錄</td></tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
  ) : renderConstructionEntry();
};

export default ConstructionRecord;
