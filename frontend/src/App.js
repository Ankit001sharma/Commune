import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import AIChatbot from './components/AIChatbot';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Home from './pages/Home';

// Marketplace Pages
import Marketplace from './pages/marketplace/Marketplace';
import ListingDetail from './pages/marketplace/ListingDetail';
import CreateListing from './pages/marketplace/CreateListing';

// Services Pages
import Services from './pages/services/Services';
import ServiceDetail from './pages/services/ServiceDetail';
import CreateService from './pages/services/CreateService';

// Community Pages
import Community from './pages/community/Community';
import PostDetail from './pages/community/PostDetail';
import CreatePost from './pages/community/CreatePost';

// Chat
import Chat from './pages/chat/Chat';

// Dashboard
import Dashboard from './pages/dashboard/Dashboard';

// Transactions
import Transactions, { TransactionDetail } from './pages/transactions/Transactions';

// AI Search
import AISearch from './pages/ai/AISearch';
import Notifications from './pages/notifications/Notifications';
import SavedItems from './pages/saved/SavedItems';
import Activity from './pages/activity/Activity';

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const App = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        background: 'var(--cx-bg)',
      }}>
        <div className="spinner" />
        <p style={{ color: 'var(--cx-text-muted)' }}>Loading CommuneX...</p>
      </div>
    );
  }

  return (
    <>
      <Routes>
        {/* Public Auth routes (no layout) */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Main App routes wrapped in ProtectedRoute. 
          If isAuthenticated is false, everything inside here redirects to /login.
        */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          
          <Route path="/" element={<Home />} />
          
          {/* Marketplace */}
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/marketplace/:id" element={<ListingDetail />} />
          <Route path="/marketplace/create" element={<CreateListing />} />
          <Route path="/marketplace/edit/:id" element={<CreateListing />} />

          {/* Services */}
          <Route path="/services" element={<Services />} />
          <Route path="/services/:id" element={<ServiceDetail />} />
          <Route path="/services/create" element={<CreateService />} />
          <Route path="/services/edit/:id" element={<CreateService />} />

          {/* Community */}
          <Route path="/community" element={<Community />} />
          <Route path="/community/:id" element={<PostDetail />} />
          <Route path="/community/create" element={<CreatePost />} />
          <Route path="/community/edit/:id" element={<CreatePost />} />

          {/* Chat */}
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:id" element={<Chat />} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Transactions */}
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/transactions/:id" element={<TransactionDetail />} />

          {/* AI Search & Notifications */}
          <Route path="/ai-search" element={<AISearch />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/saved-items" element={<SavedItems />} />
          <Route path="/activity" element={<Activity />} />
        </Route>

        {/* Global Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* AI Chatbot - floating on all pages */}
      <AIChatbot />
    </>
  );
};

export default App;