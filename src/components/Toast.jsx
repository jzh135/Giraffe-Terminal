import { useState, useEffect, useCallback } from 'react';

// Toast Container Component
export function ToastContainer({ toasts, removeToast }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

// Individual Toast Component
function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const getStyles = () => {
    const baseStyle = {
      padding: '0.75rem 1rem',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      minWidth: '280px',
      maxWidth: '400px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      animation: 'slideIn 0.3s ease',
      cursor: 'pointer',
    };

    switch (type) {
      case 'success':
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #22c55e20, #22c55e10)',
          border: '1px solid #22c55e50',
          color: '#22c55e',
        };
      case 'error':
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #ef444420, #ef444410)',
          border: '1px solid #ef444450',
          color: '#ef4444',
        };
      case 'warning':
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #f59e0b20, #f59e0b10)',
          border: '1px solid #f59e0b50',
          color: '#f59e0b',
        };
      default:
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #3b82f620, #3b82f610)',
          border: '1px solid #3b82f650',
          color: '#3b82f6',
        };
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div style={getStyles()} onClick={onClose}>
      <span>{getIcon()}</span>
      <span style={{ flex: 1, color: 'var(--text-primary)' }}>{message}</span>
      <span style={{ opacity: 0.6, fontSize: '1.2rem' }}>×</span>
    </div>
  );
}

// Custom Hook for Toast Management
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
