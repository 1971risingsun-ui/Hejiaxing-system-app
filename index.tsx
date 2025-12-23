
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 使用非同步方式註冊 PWA，避免 virtual:pwa-register 在某些 Preview 環境下導致錯誤
const initPWA = async () => {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      // @ts-ignore - 虛擬模組在某些環境下可能無法被 TS 靜態識別
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({ 
        immediate: true,
        onRegisterError(error: any) {
          console.error('PWA 註冊失敗:', error);
        }
      });
    } catch (e) {
      // 在 Preview 環境或非 PWA 模式下忽略此錯誤，不影響主程式運行
      console.log('PWA 功能在當前環境下未啟用');
    }
  }
};

initPWA();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
