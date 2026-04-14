import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listingAPI, serviceAPI, transactionAPI, chatAPI, userAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ListingCard from '../../components/cards/ListingCard';
import ServiceCard from '../../components/cards/ServiceCard';
import {
  ShoppingBagIcon, BriefcaseIcon, CreditCardIcon, MessageCircleIcon,
  WalletIcon, PlusIcon, StarIcon,
  ChevronRightIcon, EditIcon, ZapIcon,
} from '../../components/Icons';
import { toast } from '../../components/ui/Toast';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();

  const [stats, setStats] = useState({
    listings: 0,
    services: 0,
    transactions: 0,
    unreadMessages: 0,
    activities: 0,
  });
  const [myListings, setMyListings] = useState([]);
  const [myServices, setMyServices] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Profile edit state
  const [editing, setEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    department: '',
    year: '',
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [listingsRes, servicesRes, txRes, unreadRes, activityRes] = await Promise.allSettled([
          listingAPI.getMy(),
          serviceAPI.getMy(),
          transactionAPI.getAll(),
          chatAPI.getUnreadCount(),
          userAPI.getActivity(),
        ]);

        const listings = listingsRes.status === 'fulfilled' ? listingsRes.value.data.data || [] : [];
        const services = servicesRes.status === 'fulfilled' ? servicesRes.value.data.data || [] : [];
        const transactions = txRes.status === 'fulfilled' ? txRes.value.data.data || [] : [];
        const unread = unreadRes.status === 'fulfilled' ? unreadRes.value.data.data?.count || 0 : 0;
        const activityPayload = activityRes.status === 'fulfilled' ? activityRes.value.data.data || {} : {};
        const likes = Array.isArray(activityPayload.likes) ? activityPayload.likes : [];
        const comments = Array.isArray(activityPayload.comments) ? activityPayload.comments : [];
        const activityCount = likes.length + comments.length;

        setMyListings(listings);
        setMyServices(services);
        setRecentTransactions(transactions.slice(0, 5));
        setStats({
          listings: listings.length,
          services: services.length,
          transactions: transactions.length,
          unreadMessages: unread,
          activities: activityCount,
        });
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        department: user.department || '',
        year: user.year?.toString() || '',
      });
    }
  }, [user]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateProfile(profileForm);
      setEditing(false);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    }
  };

  const getInitials = (u) => {
    if (!u) return '??';
    return `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase();
  };

  const getStatusColor = (status) => {
    const map = {
      completed: 'badge-success',
      'escrow-held': 'badge-warning',
      initiated: 'badge-info',
      cancelled: 'badge-danger',
      disputed: 'badge-danger',
      refunded: 'badge-warning',
    };
    return map[status] || 'badge-primary';
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.firstName}</p>
        </div>
      </div>

      {/* Top Stats */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => setActiveTab('listings')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'var(--cx-primary-light)' }}>
            <ShoppingBagIcon size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.listings}</div>
            <div className="stat-label">My Listings</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => setActiveTab('services')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--cx-success)' }}>
            <BriefcaseIcon size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.services}</div>
            <div className="stat-label">My Services</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/transactions')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--cx-warning)' }}>
            <CreditCardIcon size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.transactions}</div>
            <div className="stat-label">Transactions</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/chat')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--cx-secondary)' }}>
            <MessageCircleIcon size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.unreadMessages}</div>
            <div className="stat-label">Unread Messages</div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/activity')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }}>
            <ZapIcon size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.activities}</div>
            <div className="stat-label">Activities</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`tab ${activeTab === 'listings' ? 'active' : ''}`} onClick={() => setActiveTab('listings')}>My Listings</button>
        <button className={`tab ${activeTab === 'services' ? 'active' : ''}`} onClick={() => setActiveTab('services')}>My Services</button>
        <button className={`tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Profile</button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* Wallet */}
          <div className="form-card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <WalletIcon size={24} />
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--cx-text-muted)' }}>Wallet Balance</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--cx-text)' }}>
                    ₹{(user?.wallet?.balance || 0).toLocaleString()}
                  </div>
                </div>
              </div>
              {user?.rating?.average > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StarIcon size={20} style={{ color: 'var(--cx-warning)' }} />
                  <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                    {user.rating.average.toFixed(1)}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--cx-text-muted)' }}>
                    ({user.rating.count} reviews)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="form-card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Recent Transactions</h3>
              <button className="btn btn-ghost" onClick={() => navigate('/transactions')}>
                View All <ChevronRightIcon size={16} />
              </button>
            </div>
            {recentTransactions.length === 0 ? (
              <p style={{ color: 'var(--cx-text-muted)', textAlign: 'center', padding: 16 }}>No transactions yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentTransactions.map((tx) => (
                  <div
                    key={tx._id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', borderRadius: 8, background: 'var(--cx-bg)',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/transactions/${tx._id}`)}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                        {tx.listing?.title || tx.service?.title || 'Transaction'}
                      </div>
                      <span className={`badge ${getStatusColor(tx.status)}`} style={{ fontSize: '0.7rem' }}>
                        {tx.status}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      ₹{tx.amount?.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <button className="btn btn-primary" style={{ padding: 16, justifyContent: 'center' }} onClick={() => navigate('/marketplace/create')}>
              <PlusIcon size={18} /> Post Item
            </button>
            <button className="btn btn-secondary" style={{ padding: 16, justifyContent: 'center' }} onClick={() => navigate('/services/create')}>
              <PlusIcon size={18} /> Post Service
            </button>
            <button className="btn btn-secondary" style={{ padding: 16, justifyContent: 'center' }} onClick={() => navigate('/community/create')}>
              <PlusIcon size={18} /> Create Post
            </button>
          </div>
        </div>
      )}

      {/* Listings Tab */}
      {activeTab === 'listings' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>My Listings ({myListings.length})</h3>
            <button className="btn btn-primary" onClick={() => navigate('/marketplace/create')}>
              <PlusIcon size={18} /> New Listing
            </button>
          </div>
          {myListings.length === 0 ? (
            <div className="empty-state">
              <ShoppingBagIcon size={64} />
              <h3>No listings yet</h3>
              <p>Start selling items on campus</p>
              <button className="btn btn-primary" onClick={() => navigate('/marketplace/create')}>
                <PlusIcon size={18} /> Post Item
              </button>
            </div>
          ) : (
            <div className="card-grid">
              {myListings.map((listing) => (
                <ListingCard key={listing._id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>My Services ({myServices.length})</h3>
            <button className="btn btn-primary" onClick={() => navigate('/services/create')}>
              <PlusIcon size={18} /> New Service
            </button>
          </div>
          {myServices.length === 0 ? (
            <div className="empty-state">
              <BriefcaseIcon size={64} />
              <h3>No services yet</h3>
              <p>Offer your skills to the campus community</p>
              <button className="btn btn-primary" onClick={() => navigate('/services/create')}>
                <PlusIcon size={18} /> Post Service
              </button>
            </div>
          ) : (
            <div className="card-grid">
              {myServices.map((service) => (
                <ServiceCard key={service._id} service={service} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div style={{ maxWidth: 600 }}>
          <div className="form-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'var(--cx-primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', fontWeight: 700,
              }}>
                {getInitials(user)}
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  {user?.firstName} {user?.lastName}
                </div>
                <div style={{ color: 'var(--cx-text-muted)', fontSize: '0.9rem' }}>{user?.email}</div>
                <div style={{ color: 'var(--cx-text-muted)', fontSize: '0.85rem' }}>
                  {user?.rollNumber} | {user?.department} | Year {user?.year}
                </div>
              </div>
            </div>

            {editing ? (
              <form onSubmit={handleProfileUpdate}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input
                      className="form-input"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm((p) => ({ ...p, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input
                      className="form-input"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm((p) => ({ ...p, lastName: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    className="form-input"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input
                      className="form-input"
                      value={profileForm.department}
                      onChange={(e) => setProfileForm((p) => ({ ...p, department: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Year</label>
                    <select
                      className="form-select"
                      value={profileForm.year}
                      onChange={(e) => setProfileForm((p) => ({ ...p, year: e.target.value }))}
                    >
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                </div>
              </form>
            ) : (
              <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                <EditIcon size={18} /> Edit Profile
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
