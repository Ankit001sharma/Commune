import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import socketService from '../services/socket';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('cx_token');
      if (!token) {
        setLoading(false);
        return;
      }
      const { data } = await authAPI.getMe();
      setUser(data.data);
      socketService.connect(token);
    } catch (err) {
      localStorage.removeItem('cx_token');
      localStorage.removeItem('cx_refresh_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
    return () => socketService.disconnect();
  }, [loadUser]);

  const login = async (credentials) => {
    try {
      setError(null);
      const { data } = await authAPI.login(credentials);
      localStorage.setItem('cx_token', data.data.token);
      localStorage.setItem('cx_refresh_token', data.data.refreshToken);
      setUser(data.data.user);
      socketService.connect(data.data.token);
      return data.data.user;
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      const { data } = await authAPI.register(userData);
      localStorage.setItem('cx_token', data.data.token);
      localStorage.setItem('cx_refresh_token', data.data.refreshToken);
      setUser(data.data.user);
      socketService.connect(data.data.token);
      return data.data.user;
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = () => {
    localStorage.removeItem('cx_token');
    localStorage.removeItem('cx_refresh_token');
    setUser(null);
    socketService.disconnect();
  };

  const updateProfile = async (data) => {
    try {
      const res = await authAPI.updateProfile(data);
      setUser(res.data.data);
      return res.data.data;
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Update failed');
    }
  };

  const toggleFavorite = async (listingId) => {
    try {
      const { data } = await authAPI.toggleFavorite(listingId);
      setUser((prev) => ({ ...prev, favorites: data.data.favorites }));
      return data.data.favorites;
    } catch (err) {
      throw new Error('Failed to update favorites');
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
    toggleFavorite,
    isAuthenticated: !!user,
    clearError: () => setError(null),
    reloadUser: loadUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
