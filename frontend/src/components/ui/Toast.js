import React, { useState, useEffect } from 'react';
import { CheckIcon, AlertCircleIcon, XIcon } from '../Icons';

let toastId = 0;
let addToastFn = null;

export const toast = {
  success: (message) => addToastFn?.({ id: ++toastId, type: 'success', message }),
  error: (message) => addToastFn?.({ id: ++toastId, type: 'error', message }),
  info: (message) => addToastFn?.({ id: ++toastId, type: 'info', message }),
};

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    addToastFn = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== t.id));
      }, 4000);
    };
    return () => { addToastFn = null; };
  }, []);

  const remove = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' && <CheckIcon size={20} />}
          {t.type === 'error' && <AlertCircleIcon size={20} />}
          {t.type === 'info' && <AlertCircleIcon size={20} />}
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => remove(t.id)} style={{ color: 'inherit', opacity: 0.7 }}>
            <XIcon size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
