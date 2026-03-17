import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  HomeIcon, ShoppingBagIcon, BriefcaseIcon, UsersIcon,
  MessageCircleIcon, CreditCardIcon, DashboardIcon,
  LogOutIcon, ZapIcon
} from '../Icons';

const navItems = [
  { label: 'MAIN', type: 'section' },
  { to: '/', icon: HomeIcon, label: 'Home' },
  { to: '/marketplace', icon: ShoppingBagIcon, label: 'Marketplace' },
  { to: '/services', icon: BriefcaseIcon, label: 'Services' },
  { to: '/community', icon: UsersIcon, label: 'Community' },
  { label: 'PERSONAL', type: 'section' },
  { to: '/chat', icon: MessageCircleIcon, label: 'Messages' },
  { to: '/transactions', icon: CreditCardIcon, label: 'Transactions' },
  { to: '/dashboard', icon: DashboardIcon, label: 'Dashboard' },
  { label: 'AI', type: 'section' },
  { to: '/ai-search', icon: ZapIcon, label: 'Smart Search' },
];

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getInitials = (user) => {
    if (!user) return 'CX';
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
  };

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 150,
        display: window.innerWidth <= 768 ? 'block' : 'none'
      }} />}
      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <svg width="36" height="36" viewBox="0 0 64 64" fill="none">
            <defs>
              <linearGradient id="logo-g" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6C63FF"/>
                <stop offset="100%" stopColor="#3B82F6"/>
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="14" fill="url(#logo-g)"/>
            <text x="32" y="44" textAnchor="middle" fill="white" fontFamily="Inter,sans-serif" fontWeight="800" fontSize="32">CX</text>
          </svg>
          <span className="sidebar-logo-text">CommuneX</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
            if (item.type === 'section') {
              return <div key={i} className="sidebar-section-title">{item.label}</div>;
            }
            const IconComp = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `sidebar-link ${isActive || (item.to === '/' && location.pathname === '/') ? 'active' : ''}`
                }
                end={item.to === '/'}
                onClick={onClose}
              >
                <IconComp size={20} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{getInitials(user)}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.firstName} {user.lastName}</div>
              <div className="sidebar-user-role">{user.department || 'Student'}</div>
            </div>
            <button onClick={logout} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.5)' }} title="Logout">
              <LogOutIcon size={18} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
