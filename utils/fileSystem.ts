
/**
 * 使用 File System Access API 進行本機資料夾存取
 * 並透過 IndexedDB 持久化 Handle
 */

const DB_NAME = 'hjx_handle_db';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'current_dir';
const DB_FILENAME = 'db.json';

// 初始化 IndexedDB
const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.onerror);
  });
};

export const saveHandleToIdb = async (handle: FileSystemDirectoryHandle) => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
  return new Promise((resolve) => (tx.oncomplete = resolve));
};

export const getHandleFromIdb = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch (e) {
    return null;
  }
};

export const clearHandleFromIdb = async () => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
  return new Promise((resolve) => (tx.oncomplete = resolve));
};

export const getDirectoryHandle = async (): Promise<FileSystemDirectoryHandle> => {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('您的瀏覽器不支援本機存取，請使用 Chrome 或 Edge。');
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });
    await saveHandleToIdb(handle);
    return handle;
  } catch (e: any) {
    if (e.name === 'AbortError') throw new Error('已取消選擇');
    throw new Error('無法取得權限：' + e.message);
  }
};

export const saveDbToLocal = async (handle: FileSystemDirectoryHandle, data: any) => {
  try {
    // 檢查權限
    // Fix: Cast to any to access File System Access API methods not yet in standard TS types
    if ((await (handle as any).queryPermission({ mode: 'readwrite' })) !== 'granted') return;
    
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
    // 檢查權限
    // Fix: Cast to any to access File System Access API methods not yet in standard TS types
    if ((await (handle as any).queryPermission({ mode: 'read' })) !== 'granted') return null;
    
    const fileHandle = await handle.getFileHandle(DB_FILENAME);
    const file = await fileHandle.getFile();
    const content = await file.text();
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
};
