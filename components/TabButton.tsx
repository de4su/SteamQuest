import React from 'react';

type TabColor = 'blue' | 'pink' | 'emerald';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: TabColor;
}

const activeColorMap: Record<TabColor, string> = {
  blue:    'bg-blue-600/20 border-blue-500/50 text-blue-400',
  pink:    'bg-pink-600/20 border-pink-500/50 text-pink-400',
  emerald: 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400',
};

const inactiveClass = 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:border-white/20';

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, children, color = 'blue' }) => (
  <button
    onClick={onClick}
    className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all border ${
      active ? activeColorMap[color] : inactiveClass
    }`}
  >
    {children}
  </button>
);

export default TabButton;
