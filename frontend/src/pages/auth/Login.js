import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShoppingBagIcon, UsersIcon, ShieldIcon, ZapIcon } from '../../components/Icons';

const Login = () => {
  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form);
      navigate('/');
    } catch (_) {} finally { setLoading(false); }
  };

  return (
    <div className="auth-layout">
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-brand-logo">
            <img src="/logo.jpeg" alt="CommuneX" className="auth-logo-img" />
          </div>
          <p className="auth-brand-tagline">
            Your campus marketplace for buying, selling, exchanging products and discovering services within a secure college ecosystem.
          </p>
          <div className="auth-features">
            <div className="auth-feature">
              <div className="auth-feature-icon"><ShoppingBagIcon size={20} /></div>
              <span>Buy & sell textbooks, electronics, furniture and more</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon"><UsersIcon size={20} /></div>
              <span>Connect with verified campus members only</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon"><ShieldIcon size={20} /></div>
              <span>Secure escrow-based transactions</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon"><ZapIcon size={20} /></div>
              <span>AI-powered recommendations and smart search</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-container">
          <h1 className="auth-form-title">Welcome back</h1>
          <p className="auth-form-subtitle">Sign in to your CommuneX account to continue</p>

          {error && (
            <div className="badge badge-danger" style={{ padding: '10px 16px', marginBottom: 20, width: '100%', justifyContent: 'center' }}>
              {error}
              <button onClick={clearError} style={{ marginLeft: 8, color: 'inherit' }}>&times;</button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@college.edu"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="auth-form-footer">
            Don't have an account? <Link to="/register">Create one</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
