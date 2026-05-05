import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../components/ui/Toast';
import { SettingsIcon, UsersIcon, ShoppingBagIcon, BriefcaseIcon, CreditCardIcon, SendIcon } from '../../components/Icons';

const Admin = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.isAdmin) {
      setLoading(false);
      return;
    }

    Promise.all([adminAPI.getOverview(), adminAPI.getUsers()])
      .then(([overviewRes, usersRes]) => {
        setOverview(overviewRes.data.data);
        setUsers(usersRes.data.data || []);
      })
      .catch(() => toast.error('Failed to load admin controls'))
      .finally(() => setLoading(false));
  }, [user?.isAdmin]);

  const sendEmails = async () => {
    try {
      const { data } = await adminAPI.sendRecommendationEmails();
      toast.success(data.message || 'Recommendation emails sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send emails');
    }
  };

  const toggleUser = async (id, field, value) => {
    try {
      const { data } = await adminAPI.updateUser(id, { [field]: value });
      setUsers((prev) => prev.map((entry) => (entry._id === id ? data.data : entry)));
    } catch (_) {
      toast.error('Failed to update user');
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /><p>Loading admin...</p></div>;

  if (!user?.isAdmin) {
    return (
      <div className="empty-state">
        <SettingsIcon size={64} />
        <h3>Admin access required</h3>
        <p>Only a separate admin account can open this control page.</p>
      </div>
    );
  }

  const stats = overview?.stats || {};

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Control</h1>
          <p className="page-subtitle">Full platform oversight for users, services, listings, transactions, and recommendations.</p>
        </div>
        <button className="btn btn-primary" onClick={sendEmails}><SendIcon size={18} /> Send Recommendation Emails</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><UsersIcon /></div><div className="stat-info"><div className="stat-value">{stats.users || 0}</div><div className="stat-label">Users</div></div></div>
        <div className="stat-card"><div className="stat-icon purple"><ShoppingBagIcon /></div><div className="stat-info"><div className="stat-value">{stats.listings || 0}</div><div className="stat-label">Listings</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><BriefcaseIcon /></div><div className="stat-info"><div className="stat-value">{stats.services || 0}</div><div className="stat-label">Services</div></div></div>
        <div className="stat-card"><div className="stat-icon orange"><CreditCardIcon /></div><div className="stat-info"><div className="stat-value">{stats.transactions || 0}</div><div className="stat-label">Transactions</div></div></div>
      </div>

      <div className="form-card">
        <h2 style={{ fontSize: '1rem', marginBottom: 16 }}>User Controls</h2>
        <div className="admin-table">
          {users.map((entry) => (
            <div className="admin-row" key={entry._id}>
              <div>
                <strong>{entry.firstName} {entry.lastName}</strong>
                <span>{entry.email}</span>
              </div>
              <label className="toggle-line">
                <input type="checkbox" checked={!!entry.isVerified} onChange={(e) => toggleUser(entry._id, 'isVerified', e.target.checked)} />
                Verified
              </label>
              <label className="toggle-line">
                <input type="checkbox" checked={!!entry.isAdmin} onChange={(e) => toggleUser(entry._id, 'isAdmin', e.target.checked)} />
                Admin
              </label>
              <span className="badge badge-info">{entry.tokens?.balance || 0} tokens</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Admin;
