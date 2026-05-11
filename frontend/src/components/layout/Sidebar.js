import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  HomeIcon, ShoppingBagIcon, BriefcaseIcon, UsersIcon,
  MessageCircleIcon, CreditCardIcon, DashboardIcon,
  LogOutIcon, ZapIcon, HeartIcon, SettingsIcon, TrendingUpIcon, BellIcon,
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
  { to: '/saved-items', icon: HeartIcon, label: 'Saved Items' },
  { to: '/dashboard', icon: DashboardIcon, label: 'Dashboard' },
  { to: '/admin', icon: SettingsIcon, label: 'Admin', adminOnly: true },
  { label: 'AI', type: 'section' },
  { to: '/ai-search', icon: ZapIcon, label: 'Smart Search' },
  { to: '/recommendations', icon: TrendingUpIcon, label: 'AI picks' },
  { to: '/settings/email-preferences', icon: BellIcon, label: 'Email alerts' },
];

const Sidebar = ({ isOpen, collapsed, onClose }) => {
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
      <aside className={`app-sidebar ${isOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo">
          <img src="/logo.jpeg" alt="CommuneX" className="sidebar-logo-img" />
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
            if (item.type === 'section') {
              return <div key={i} className="sidebar-section-title">{item.label}</div>;
            }
            if (item.adminOnly && !user?.isAdmin) return null;
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
                <span className="sidebar-link-label">{item.label}</span>
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
            <button className="sidebar-logout" onClick={logout} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.5)' }} title="Logout">
              <LogOutIcon size={18} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
