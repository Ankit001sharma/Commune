import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { SearchIcon, BellIcon, MenuIcon, ChevronLeftIcon } from '../Icons';

const Topbar = ({ onMenuToggle, onSidebarCollapseToggle }) => {
  const { user, isAuthenticated } = useAuth();
  const { unreadNotificationCount } = useNotifications();
  const navigate = useNavigate();

  console.log('Topbar rendering with count:', unreadNotificationCount);

  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/ai-search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button className="menu-toggle" onClick={onMenuToggle}>
          <MenuIcon size={22} />
        </button>
        <button className="sidebar-desktop-toggle" onClick={onSidebarCollapseToggle} title="Open or close sidebar">
          <ChevronLeftIcon size={18} />
        </button>

        <form className="topbar-search" onSubmit={handleSearch}>
          <SearchIcon />
          <input
            type="text"
            placeholder="Search marketplace, services, community..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      <div className="topbar-right">
        {isAuthenticated ? (
          <>
            {/* Messages */}
            <button
              className="topbar-icon-btn"
              onClick={() => navigate('/chat')}
              title="Messages"
            >
              <MessageCircleIconSmall />
            </button>

            {/* 🔔 Notifications */}
            <button
              className="topbar-icon-btn"
              title="Notifications"
              onClick={() => navigate('/notifications')}
              style={{ position: 'relative' }}
            >
              <BellIcon size={20} />

              {unreadNotificationCount > 0 && (
                <span className="topbar-badge">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            {/* Profile */}
            <button
              className="topbar-icon-btn"
              onClick={() => navigate('/dashboard')}
              title="Profile"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--cx-primary)',
                color: '#fff',
                fontSize: '0.82rem',
                fontWeight: 700
              }}
            >
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>
              Log In
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/register')}>
              Sign Up
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

const MessageCircleIconSmall = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
  </svg>
);

export default Topbar;
