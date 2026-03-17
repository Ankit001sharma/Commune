import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import AIChatbot from './components/AIChatbot';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

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
        {/* Auth routes (no layout) */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* App routes (with layout) */}
        <Route element={<AppLayout />}>
          {/* Home redirects to marketplace */}
          <Route path="/" element={<Navigate to="/marketplace" replace />} />

          {/* Marketplace */}
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/marketplace/:id" element={<ListingDetail />} />
          <Route path="/marketplace/create" element={
            <ProtectedRoute><CreateListing /></ProtectedRoute>
          } />
          <Route path="/marketplace/edit/:id" element={
            <ProtectedRoute><CreateListing /></ProtectedRoute>
          } />

          {/* Services */}
          <Route path="/services" element={<Services />} />
          <Route path="/services/:id" element={<ServiceDetail />} />
          <Route path="/services/create" element={
            <ProtectedRoute><CreateService /></ProtectedRoute>
          } />
          <Route path="/services/edit/:id" element={
            <ProtectedRoute><CreateService /></ProtectedRoute>
          } />

          {/* Community */}
          <Route path="/community" element={<Community />} />
          <Route path="/community/:id" element={<PostDetail />} />
          <Route path="/community/create" element={
            <ProtectedRoute><CreatePost /></ProtectedRoute>
          } />
          <Route path="/community/edit/:id" element={
            <ProtectedRoute><CreatePost /></ProtectedRoute>
          } />

          {/* Chat */}
          <Route path="/chat" element={
            <ProtectedRoute><Chat /></ProtectedRoute>
          } />
          <Route path="/chat/:id" element={
            <ProtectedRoute><Chat /></ProtectedRoute>
          } />

          {/* Dashboard */}
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />

          {/* Transactions */}
          <Route path="/transactions" element={
            <ProtectedRoute><Transactions /></ProtectedRoute>
          } />
          <Route path="/transactions/:id" element={
            <ProtectedRoute><TransactionDetail /></ProtectedRoute>
          } />

          {/* AI Search */}
          <Route path="/ai-search" element={<AISearch />} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/marketplace" replace />} />
        </Route>
      </Routes>

      {/* AI Chatbot - floating on all pages */}
      <AIChatbot />
    </>
  );
};

export default App;
