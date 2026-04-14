import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../components/ui/Toast';

const OTP_TTL_SECONDS = 60;

const VerifyOtp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifySignupOtp, resendSignupOtp, error, clearError } = useAuth();

  const initialEmail = location.state?.email || '';
  const firstName = location.state?.firstName || 'User';

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(OTP_TTL_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!email) return;
    setTimer(OTP_TTL_SECONDS);
  }, [email]);

  useEffect(() => {
    if (timer <= 0) return undefined;
    const id = setInterval(() => setTimer((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const handleVerify = async (e) => {
    e.preventDefault();
    clearError();

    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      toast.error('OTP must be a 6-digit code');
      return;
    }

    setSubmitting(true);
    try {
      const user = await verifySignupOtp({ email: email.trim().toLowerCase(), otp: otp.trim() });
      toast.success(`Welcome ${user.firstName || firstName}, your account is ready 🎉`);
      navigate('/');
    } catch (_) {
      // Error is handled in context and toast.
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      toast.error('Email is required to resend OTP');
      return;
    }

    setResending(true);
    try {
      await resendSignupOtp(email.trim().toLowerCase());
      setTimer(OTP_TTL_SECONDS);
      toast.success('OTP resent successfully');
    } catch (_) {
      // Error is handled in context.
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-right" style={{ margin: '0 auto' }}>
        <div className="auth-form-container">
          <h1 className="auth-form-title">Verify Email</h1>
          <p className="auth-form-subtitle">Enter the 6-digit OTP sent to your email</p>

          {error && (
            <div className="badge badge-danger" style={{ padding: '10px 16px', marginBottom: 20, width: '100%', justifyContent: 'center' }}>
              {error}
              <button onClick={clearError} style={{ marginLeft: 8, color: 'inherit' }}>&times;</button>
            </div>
          )}

          <form onSubmit={handleVerify}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">OTP</label>
              <input
                type="text"
                className="form-input"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
              {submitting ? 'Verifying...' : 'Create Account'}
            </button>
          </form>

          <div style={{ marginTop: 16, textAlign: 'center', color: 'var(--cx-text-muted)' }}>
            {timer > 0 ? `Resend OTP in ${timer}s` : 'OTP expired'}
          </div>

          {timer <= 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ marginTop: 12 }}
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? 'Resending...' : 'Resend OTP'}
            </button>
          )}

          <div className="auth-form-footer">
            Already verified? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyOtp;
