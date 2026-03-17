import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShoppingBagIcon, UsersIcon, ShieldIcon, ZapIcon } from '../../components/Icons';

const Register = () => {
  const { register, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', rollNumber: '',
    password: '', confirmPassword: '', department: '', year: 1, phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setValidationError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const { confirmPassword, ...data } = form;
      await register(data);
      navigate('/');
    } catch (_) {} finally { setLoading(false); }
  };

  return (
    <div className="auth-layout">
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-brand-logo">
            <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
              <defs><linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#6C63FF"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs>
              <rect width="64" height="64" rx="14" fill="url(#lg2)"/>
              <text x="32" y="44" textAnchor="middle" fill="white" fontFamily="Inter,sans-serif" fontWeight="800" fontSize="32">CX</text>
            </svg>
            <span className="auth-brand-name">CommuneX</span>
          </div>
          <p className="auth-brand-tagline">
            Join your campus marketplace. Connect with fellow students to buy, sell, and exchange within a trusted college ecosystem.
          </p>
          <div className="auth-features">
            <div className="auth-feature">
              <div className="auth-feature-icon"><ShoppingBagIcon size={20} /></div>
              <span>Campus-exclusive marketplace for students</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon"><UsersIcon size={20} /></div>
              <span>Verified with roll number for safety</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon"><ShieldIcon size={20} /></div>
              <span>Secure escrow payments protect every deal</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon"><ZapIcon size={20} /></div>
              <span>AI-powered smart search and recommendations</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-container">
          <h1 className="auth-form-title">Create Account</h1>
          <p className="auth-form-subtitle">Join CommuneX with your college credentials</p>

          {(error || validationError) && (
            <div className="badge badge-danger" style={{ padding: '10px 16px', marginBottom: 20, width: '100%', justifyContent: 'center' }}>
              {validationError || error}
              <button onClick={() => { clearError(); setValidationError(''); }} style={{ marginLeft: 8, color: 'inherit' }}>&times;</button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input type="text" name="firstName" className="form-input" placeholder="John" value={form.firstName} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input type="text" name="lastName" className="form-input" placeholder="Doe" value={form.lastName} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">College Email</label>
              <input type="email" name="email" className="form-input" placeholder="john@college.edu" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Roll Number</label>
                <input type="text" name="rollNumber" className="form-input" placeholder="CS2024001" value={form.rollNumber} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input type="text" name="department" className="form-input" placeholder="Computer Science" value={form.department} onChange={handleChange} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Year</label>
                <select name="year" className="form-select" value={form.year} onChange={handleChange}>
                  <option value={1}>1st Year</option>
                  <option value={2}>2nd Year</option>
                  <option value={3}>3rd Year</option>
                  <option value={4}>4th Year</option>
                  <option value={5}>5th Year</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phone (Optional)</label>
                <input type="tel" name="phone" className="form-input" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={handleChange} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" name="password" className="form-input" placeholder="Min 8 characters" value={form.password} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input type="password" name="confirmPassword" className="form-input" placeholder="Confirm password" value={form.confirmPassword} onChange={handleChange} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="auth-form-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
