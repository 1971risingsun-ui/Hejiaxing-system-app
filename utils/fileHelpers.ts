
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/**
 * Handles file reading from an input element.
 * Returns a Promise that resolves to a Base64 Data URL.
 */
export const processFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Helper to convert a Blob to a pure Base64 string (without the data:mime/type;base64, prefix).
 * This is required for Capacitor Filesystem writes.
 */
const blobToBase64Data = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Remove the "data:application/xxx;base64," prefix
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Main export function implementing the architecture:
 * Blob -> Base64 -> Filesystem (Cache) -> Native Share Sheet
 */
export const saveFile = async (blob: Blob, filename: string) => {
  try {
    // 1. Check if running on Native Android/iOS
    if (Capacitor.isNativePlatform()) {
      // Step A: Blob -> Base64
      const base64Data = await blobToBase64Data(blob);

      // Step B: Write to Native Filesystem (Cache Directory)
      // We use the Cache directory so the OS can clean it up later, 
      // and it's safer for temporary sharing.
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache, 
      });

      // Step C: Share the File URI
      // This opens the native Android share sheet, where users can choose
      // to "Save to Drive", "Gmail", "Line", or "Save to Files".
      await Share.share({
        title: filename,
        url: savedFile.uri,
      });

    } else {
      // 2. Fallback for Web/Browser Environment
      // Legacy anchor tag download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    }
  } catch (error) {
    console.error("File Save/Share Failed:", error);
    alert("檔案匯出失敗，請檢查權限設定。");
  }
};

/**
 * Alias for saveFile to maintain compatibility
 */
export const downloadBlob = async (blob: Blob, filename: string) => {
    await saveFile(blob, filename);
};

export const shareFile = async (blob: Blob, filename: string) => {
    await saveFile(blob, filename);
};
