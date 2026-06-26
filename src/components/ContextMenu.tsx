import React, { useEffect } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  options: { label: string; onClick: () => void; icon?: React.ReactNode; disabled?: boolean }[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, options, onClose }: ContextMenuProps) {
  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div 
      className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 min-w-40 text-sm overflow-hidden ring-1 ring-black/5"
      style={{ top: y, left: x }}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((opt, i) => (
        <button key={i} disabled={opt.disabled}
          onClick={() => { opt.onClick(); onClose(); }}
          className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors cursor-pointer">
          {opt.icon}{opt.label}
        </button>
      ))}
    </div>
  );
}
