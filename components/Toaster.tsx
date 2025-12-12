import React from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { IconCheckCircle, IconXCircle, IconAlert, IconInfo } from './Icons';

const Toaster: React.FC = () => {
  const notifications = useNotificationStore((state) => state.notifications);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  const getIcon = (type: 'success' | 'info' | 'error' | 'warning') => {
    switch (type) {
      case 'success':
        return <IconCheckCircle className="text-green-400" size={20} />;
      case 'error':
        return <IconXCircle className="text-red-400" size={20} />;
      case 'warning':
        return <IconAlert className="text-yellow-400" size={20} />;
      case 'info':
      default:
        return <IconInfo className="text-blue-400" size={20} />;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col items-end gap-3">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="w-80 max-w-[90vw] glass-panel bg-vibe-800/80 rounded-xl shadow-2xl border border-vibe-border flex items-start p-4 animate-in slide-in-from-right-8 fade-in duration-300"
          role="alert"
          aria-live="assertive"
        >
          <div className="shrink-0 mr-3">{getIcon(n.type)}</div>
          <p className="flex-1 text-sm text-slate-200">{n.message}</p>
          <button
            onClick={() => removeNotification(n.id)}
            className="ml-2 text-slate-500 hover:text-white"
            aria-label="Close notification"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toaster;
