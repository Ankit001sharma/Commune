import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShoppingBagIcon, UsersIcon, ShieldIcon, ZapIcon } from '../../components/Icons';

const DEPARTMENT_BY_CODE = {
  UFIE: 'First Year',
  UFIA: 'First Year',
  UCSE: 'CSE',
  UITE: 'CSE',
  UADS: 'CSE',
  UCHE: 'Chemical',
  UPIE: 'P&I',
  UPTR: 'Petroleum',
  UECE: 'Electronics',
  UECC: 'Electronics',
  UEEE: 'Electronics',
  UELE: 'Electrical',
  UMIE: 'Mining',
  UCIV: 'Civil',
  UMEC: 'Mechanical',
};

const DEPARTMENTS = [
  'First Year',
  'CSE',
  'Chemical',
  'P&I',
  'Petroleum',
  'Electronics',
  'Electrical',
  'Mining',
  'Civil',
  'Mechanical',
];

const ROLL_REGEX = /^\d{2}[A-Za-z]{4}\d+$/;
const PHONE_REGEX = /^[0-9]{10}$/;

const getDepartmentFromRoll = (rollNumber) => {
  const normalizedRoll = `${rollNumber || ''}`.trim().toUpperCase();
  if (!ROLL_REGEX.test(normalizedRoll)) return null;
  const code = normalizedRoll.slice(2, 6);
  return DEPARTMENT_BY_CODE[code] || null;
};

const hasSpecialCharacter = (value) => /[^A-Za-z0-9]/.test(value || '');

const Register = () => {
  const { sendSignupOtp, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', rollNumber: '',
    password: '', confirmPassword: '', department: '', year: 1, phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  const phoneError = form.phone && !PHONE_REGEX.test(form.phone)
    ? 'Phone number must be exactly 10 digits'
    : '';
  const isPhoneValid = PHONE_REGEX.test(form.phone);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      const phoneValue = value.replace(/\D/g, '').slice(0, 10);
      setForm({ ...form, phone: phoneValue });
    } else {
      setForm({ ...form, [name]: value });
    }
    setValidationError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || form.firstName.trim().length < 2) {
      setValidationError('First name must be at least 2 characters');
      return;
    }
    if (!form.lastName.trim() || form.lastName.trim().length < 2) {
      setValidationError('Last name must be at least 2 characters');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setValidationError('Please enter a valid email address');
      return;
    }
    if (!ROLL_REGEX.test(form.rollNumber.trim().toUpperCase())) {
      setValidationError('Roll number format is invalid. Use format like 23UADS2122');
      return;
    }
    const expectedDepartment = getDepartmentFromRoll(form.rollNumber);
    if (!expectedDepartment) {
      setValidationError('Roll number department code is not recognized');
      return;
    }
    if (!form.department) {
      setValidationError('Please select a department');
      return;
    }
    if (form.department !== expectedDepartment) {
      setValidationError(`Department mismatch. Roll number maps to ${expectedDepartment}`);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return;
    }
    if (!hasSpecialCharacter(form.password)) {
      setValidationError('Password must include at least one special character');
      return;
    }
    if (!PHONE_REGEX.test(form.phone)) {
      setValidationError('Phone number must be exactly 10 digits');
      return;
    }
    if (![1, 2, 3, 4].includes(Number(form.year))) {
      setValidationError('Year must be between 1st Year and 4th Year');
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...data } = form;
      await sendSignupOtp(data);
      navigate('/verify-otp', {
        state: {
          email: form.email.trim().toLowerCase(),
          firstName: form.firstName.trim(),
        },
      });
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
                <input type="text" name="rollNumber" className="form-input" placeholder="23UADS2122" value={form.rollNumber} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select name="department" className="form-select" value={form.department} onChange={handleChange} required>
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map((department) => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
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
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  className="form-input"
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={handleChange}
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  required
                />
                {phoneError && <div className="text-danger" style={{ marginTop: 6 }}>{phoneError}</div>}
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
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading || !isPhoneValid}>
              {loading ? 'Sending OTP...' : 'Submit'}
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
