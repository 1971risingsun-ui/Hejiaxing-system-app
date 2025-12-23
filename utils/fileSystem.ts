
/**
 * 使用 File System Access API 進行本機資料夾存取
 */

const DB_FILENAME = 'db.json';

export const getDirectoryHandle = async (): Promise<FileSystemDirectoryHandle> => {
  // 1. 檢查是否在 iframe 中 (跨網域 iframe 禁止使用此 API)
  const isIframe = window.self !== window.top;
  if (isIframe) {
    throw new Error('安全性限制：請點擊右上角「在新分頁開啟」本應用程式，才能連結本機資料夾。');
  }

  // 2. 檢查 API 是否存在
  if (!('showDirectoryPicker' in window)) {
    throw new Error('您的瀏覽器不支援 File System Access API。請使用 PC 版 Chrome 或 Edge。');
  }

  // 3. 檢查是否為安全內容 (HTTPS 或 localhost)
  if (!window.isSecureContext) {
    throw new Error('此功能僅能在安全連線 (HTTPS) 下運作。');
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });
    return handle;
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error('已取消選擇');
    }
    if (e.message.includes('Cross origin')) {
      throw new Error('安全性限制：目前環境不允許開啟檔案視窗。請在新分頁中開啟網頁。');
    }
    throw new Error('無法取得權限：' + e.message);
  }
};

export const saveDbToLocal = async (handle: FileSystemDirectoryHandle, data: any) => {
  try {
    const fileHandle = await handle.getFileHandle(DB_FILENAME, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  } catch (e) {
    console.error('儲存本機檔案失敗', e);
  }
};

export const loadDbFromLocal = async (handle: FileSystemDirectoryHandle): Promise<any | null> => {
  try {
    const fileHandle = await handle.getFileHandle(DB_FILENAME);
    const file = await fileHandle.getFile();
    const content = await file.text();
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
};
