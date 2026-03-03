import React from 'react';
import { SteamUser } from '../types';

interface LoginButtonProps {
  user: SteamUser | null;
  onProfileClick: () => void;
  onLogout: () => void;
}

const LoginButton: React.FC<LoginButtonProps> = ({ user, onProfileClick, onLogout }) => {
  if (user) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={onProfileClick}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all"
          title="View Profile"
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-7 h-7 rounded-full border border-white/20"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-black">
              {user.username.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold text-white max-w-[120px] truncate">{user.username}</span>
        </button>
        <button
          onClick={onLogout}
          className="px-3 py-1.5 text-xs font-black text-gray-400 hover:text-white border border-white/5 hover:border-white/20 rounded-full transition-all uppercase tracking-wider"
          title="Sign Out"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <a
      href="/api/auth/steam"
      className="flex items-center gap-2 px-4 py-2 bg-[#1b2838] hover:bg-[#2a3f5f] border border-[#66c0f4]/30 hover:border-[#66c0f4]/60 text-[#66c0f4] rounded-full font-black text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(102,192,244,0.1)] hover:shadow-[0_0_20px_rgba(102,192,244,0.25)]"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.187.008l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.455 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
      </svg>
      Sign in with Steam
    </a>
  );
};

export default LoginButton;
