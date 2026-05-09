import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { adminAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../components/ui/Toast';
import {
  SettingsIcon, UsersIcon, ShoppingBagIcon, BriefcaseIcon, CreditCardIcon,
  SendIcon, DashboardIcon, BellIcon, TrendingUpIcon, ShieldIcon, CheckIcon,
  TrashIcon, SearchIcon, AlertCircleIcon, ClockIcon, DollarIcon,
  PackageIcon, MegaphoneIcon, ZapIcon, EyeIcon, BookOpenIcon
} from '../../components/Icons';

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */
const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};
const fmtRelative = (d) => {
  if (!d) return '';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};
const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const STATUS_BADGE = {
  active: 'badge-success',
  sold: 'badge-info',
  removed: 'badge-danger',
  pending: 'badge-warning',
  reserved: 'badge-warning',
  completed: 'badge-success',
  initiated: 'badge-info',
  'escrow-held': 'badge-warning',
  'payment-pending': 'badge-warning',
  cancelled: 'badge-danger',
  refunded: 'badge-danger',
  disputed: 'badge-danger',
};

/* ------------------------------------------------------------------ */
/* Tiny inline SVG charts — no extra dependency                          */
/* ------------------------------------------------------------------ */
const SparkBarChart = ({ data = [], color = 'var(--cx-primary)' }) => {
  if (!data.length) return <div className="admin-chart-empty">No data yet</div>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="admin-bar-chart">
      {data.map((d, i) => (
        <div key={d._id || i} className="admin-bar-col">
          <div
            className="admin-bar"
            style={{ height: `${Math.max(6, (d.count / max) * 100)}%`, background: color }}
            title={`${d._id}: ${d.count}`}
          />
          <span>{(d._id || '').slice(5)}</span>
        </div>
      ))}
    </div>
  );
};

const HBarChart = ({ data = [], color = 'var(--cx-primary)' }) => {
  if (!data.length) return <div className="admin-chart-empty">No data yet</div>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="admin-hbar-chart">
      {data.map((d) => (
        <div key={d._id} className="admin-hbar-row">
          <span className="admin-hbar-label">{d._id || 'unknown'}</span>
          <div className="admin-hbar-track">
            <div className="admin-hbar-fill" style={{ width: `${(d.count / max) * 100}%`, background: color }} />
          </div>
          <span className="admin-hbar-count">{d.count}</span>
        </div>
      ))}
    </div>
  );
};

const Donut = ({ data = [] }) => {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const COLORS = ['#6666FF', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F472B6'];
  let offset = 0;
  const radius = 60;
  const C = 2 * Math.PI * radius;
  return (
    <div className="admin-donut">
      <svg viewBox="0 0 160 160" width="160" height="160">
        <circle cx="80" cy="80" r={radius} fill="transparent" stroke="#F1F5F9" strokeWidth="20" />
        {data.map((d, i) => {
          const len = (d.count / total) * C;
          const seg = (
            <circle
              key={d._id || i}
              cx="80" cy="80" r={radius} fill="transparent"
              stroke={COLORS[i % COLORS.length]} strokeWidth="20"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 80 80)"
            />
          );
          offset += len;
          return seg;
        })}
        <text x="80" y="78" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--cx-text)">{total}</text>
        <text x="80" y="96" textAnchor="middle" fontSize="11" fill="var(--cx-text-muted)">total</text>
      </svg>
      <div className="admin-donut-legend">
        {data.map((d, i) => (
          <div key={d._id || i} className="admin-donut-legend-row">
            <span className="dot" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="lbl">{d._id || 'unknown'}</span>
            <span className="val">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Activity icon mapping                                                */
/* ------------------------------------------------------------------ */
const ACTIVITY_ICON = {
  user_signup: { I: UsersIcon, color: 'blue' },
  listing_created: { I: ShoppingBagIcon, color: 'purple' },
  service_created: { I: BriefcaseIcon, color: 'green' },
  post_created: { I: MegaphoneIcon, color: 'orange' },
  transaction: { I: CreditCardIcon, color: 'red' },
};

/* ================================================================== */
/* Tabs                                                                  */
/* ================================================================== */
const TABS = [
  { key: 'overview', label: 'Overview', I: DashboardIcon },
  { key: 'activity', label: 'Activity', I: BellIcon },
  { key: 'users', label: 'Users', I: UsersIcon },
  { key: 'listings', label: 'Listings', I: ShoppingBagIcon },
  { key: 'services', label: 'Services', I: BriefcaseIcon },
  { key: 'transactions', label: 'Transactions', I: CreditCardIcon },
  { key: 'posts', label: 'Posts', I: BookOpenIcon },
  { key: 'tools', label: 'Tools', I: ZapIcon },
];

/* ================================================================== */
/* Main Admin Component                                                  */
/* ================================================================== */
const Admin = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');

  /* Shared state across tabs */
  const [overview, setOverview] = useState(null);
  const [activity, setActivity] = useState([]);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [services, setServices] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [posts, setPosts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  /* ------------------------- Initial loaders ----------------------- */
  const loadOverview = useCallback(async () => {
    try {
      const { data } = await adminAPI.getOverview();
      setOverview(data.data);
    } catch (_) { /* handled by caller */ }
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const { data } = await adminAPI.getActivity();
      setActivity(data.data || []);
    } catch (_) { /* ignore */ }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await adminAPI.getUsers();
      setUsers(data.data || []);
    } catch (_) { /* ignore */ }
  }, []);

  const loadListings = useCallback(async () => {
    try {
      const { data } = await adminAPI.getListings();
      setListings(data.data || []);
    } catch (_) { /* ignore */ }
  }, []);

  const loadServices = useCallback(async () => {
    try {
      const { data } = await adminAPI.getServices();
      setServices(data.data || []);
    } catch (_) { /* ignore */ }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const { data } = await adminAPI.getTransactions();
      setTransactions(data.data || []);
    } catch (_) { /* ignore */ }
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const { data } = await adminAPI.getPosts();
      setPosts(data.data || []);
    } catch (_) { /* ignore */ }
  }, []);

  /* Boot */
  useEffect(() => {
    if (!user?.isAdmin) { setLoading(false); return; }
    (async () => {
      try {
        await Promise.all([loadOverview(), loadActivity(), loadUsers()]);
      } catch (_) {
        toast.error('Failed to load admin controls');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.isAdmin, loadOverview, loadActivity, loadUsers]);

  /* Lazy-load by tab */
  useEffect(() => {
    if (!user?.isAdmin) return;
    if (tab === 'listings' && !listings.length) loadListings();
    if (tab === 'services' && !services.length) loadServices();
    if (tab === 'transactions' && !transactions.length) loadTransactions();
    if (tab === 'posts' && !posts.length) loadPosts();
  }, [tab, user?.isAdmin, listings.length, services.length, transactions.length, posts.length, loadListings, loadServices, loadTransactions, loadPosts]);

  /* ----------------------- Refresh button -------------------------- */
  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadOverview(),
        loadActivity(),
        loadUsers(),
        listings.length && loadListings(),
        services.length && loadServices(),
        transactions.length && loadTransactions(),
        posts.length && loadPosts(),
      ].filter(Boolean));
      toast.success('Admin data refreshed');
    } finally {
      setRefreshing(false);
    }
  };

  /* ------------------------- Mutations ----------------------------- */
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
      toast.success('User updated');
    } catch (_) {
      toast.error('Failed to update user');
    }
  };

  const removeUser = async (id) => {
    if (!window.confirm('Remove this user? This cannot be undone.')) return;
    try {
      await adminAPI.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u._id !== id));
      toast.success('User removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const setListingStatus = async (id, status) => {
    try {
      const { data } = await adminAPI.updateListingStatus(id, status);
      setListings((prev) => prev.map((l) => (l._id === id ? data.data : l)));
      toast.success(`Listing marked ${status}`);
    } catch (_) {
      toast.error('Failed to update listing');
    }
  };

  const removeListing = async (id) => {
    if (!window.confirm('Delete this listing permanently?')) return;
    try {
      await adminAPI.deleteListing(id);
      setListings((prev) => prev.filter((l) => l._id !== id));
      toast.success('Listing deleted');
    } catch (_) {
      toast.error('Failed to delete listing');
    }
  };

  const removeService = async (id) => {
    if (!window.confirm('Delete this service permanently?')) return;
    try {
      await adminAPI.deleteService(id);
      setServices((prev) => prev.filter((s) => s._id !== id));
      toast.success('Service deleted');
    } catch (_) {
      toast.error('Failed to delete service');
    }
  };

  const removePost = async (id) => {
    if (!window.confirm('Delete this post permanently?')) return;
    try {
      await adminAPI.deletePost(id);
      setPosts((prev) => prev.filter((p) => p._id !== id));
      toast.success('Post deleted');
    } catch (_) {
      toast.error('Failed to delete post');
    }
  };

  /* --------------------- Derived values ---------------------------- */
  const stats = overview?.stats || {};
  const charts = overview?.charts || {};
  const popular = overview?.popularListings || [];

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.firstName, u.lastName, u.email, u.rollNumber, u.department]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [users, search]);

  /* ------------------------ Guards --------------------------------- */
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading admin panel...</p>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="empty-state" style={{ padding: '64px 24px' }}>
        <ShieldIcon size={64} />
        <h3>Admin access required</h3>
        <p>Sign in with the admin account (admin@communex.com) to open this control center.</p>
      </div>
    );
  }

  /* ================================================================ */
  /* Render                                                            */
  /* ================================================================ */
  return (
    <div className="admin-shell">
      {/* Top header banner */}
      <div className="admin-header">
        <div className="admin-header-left">
          <div className="admin-header-icon"><ShieldIcon size={26} /></div>
          <div>
            <h1 className="admin-title">Admin Control Center</h1>
            <p className="admin-subtitle">Welcome back, {user.firstName}. Full oversight of CommuneX users, listings, services & transactions.</p>
          </div>
        </div>
        <div className="admin-header-actions">
          <button className="btn btn-outline" onClick={refreshAll} disabled={refreshing}>
            <ClockIcon size={16} /> {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="btn btn-primary" onClick={sendEmails}>
            <SendIcon size={16} /> Send Recommendations
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="admin-tabs">
        {TABS.map((t) => {
          const I = t.I;
          return (
            <button
              key={t.key}
              className={`admin-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <I size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===== Overview ===== */}
      {tab === 'overview' && (
        <>
          <div className="admin-kpi-grid">
            <KpiCard tone="blue" Icon={UsersIcon} value={stats.users} label="Total Users" delta={stats.newUsers7d} deltaLabel="new this week" />
            <KpiCard tone="purple" Icon={ShoppingBagIcon} value={stats.listings} label="Listings" delta={stats.newListings7d} deltaLabel="new this week" />
            <KpiCard tone="green" Icon={BriefcaseIcon} value={stats.services} label="Services" />
            <KpiCard tone="orange" Icon={CreditCardIcon} value={stats.transactions} label="Transactions" delta={stats.completedTx} deltaLabel="completed" />
            <KpiCard tone="teal" Icon={DollarIcon} value={fmtMoney(stats.revenue)} label="Revenue" delta={fmtMoney(stats.platformFees)} deltaLabel="platform fees" />
            <KpiCard tone="red" Icon={ShieldIcon} value={stats.admins} label="Admins" />
            <KpiCard tone="blue" Icon={CheckIcon} value={stats.verifiedUsers} label="Verified Users" />
            <KpiCard tone="purple" Icon={MegaphoneIcon} value={stats.posts} label="Community Posts" />
          </div>

          <div className="admin-grid-2">
            <div className="admin-card">
              <div className="admin-card-head">
                <h3><TrendingUpIcon size={18} /> Signups (last 14 days)</h3>
              </div>
              <SparkBarChart data={charts.signupsByDay || []} />
            </div>

            <div className="admin-card">
              <div className="admin-card-head">
                <h3><PackageIcon size={18} /> Transactions by status</h3>
              </div>
              <Donut data={charts.txByStatus || []} />
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-card">
              <div className="admin-card-head"><h3><ShoppingBagIcon size={18} /> Listings by category</h3></div>
              <HBarChart data={charts.listingsByCategory || []} />
            </div>

            <div className="admin-card">
              <div className="admin-card-head">
                <h3><EyeIcon size={18} /> Most popular listings</h3>
              </div>
              <div className="admin-popular-list">
                {popular.length === 0 && <div className="admin-chart-empty">No active listings yet</div>}
                {popular.map((l) => (
                  <div key={l._id} className="admin-popular-row">
                    <div>
                      <strong>{l.title}</strong>
                      <span>{l.seller?.firstName} {l.seller?.lastName} • {fmtMoney(l.price)}</span>
                    </div>
                    <span className={`badge ${STATUS_BADGE[l.status] || 'badge-info'}`}>{l.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== Activity ===== */}
      {tab === 'activity' && (
        <div className="admin-card">
          <div className="admin-card-head">
            <h3><BellIcon size={18} /> Live activity feed</h3>
            <span className="admin-card-sub">{activity.length} recent events</span>
          </div>
          <div className="admin-activity">
            {activity.length === 0 && <div className="admin-chart-empty">No activity yet</div>}
            {activity.map((a, i) => {
              const cfg = ACTIVITY_ICON[a.type] || { I: AlertCircleIcon, color: 'blue' };
              const I = cfg.I;
              return (
                <div className="admin-activity-row" key={i}>
                  <div className={`admin-activity-icon ${cfg.color}`}><I size={16} /></div>
                  <div className="admin-activity-body">
                    <div className="admin-activity-title">{a.title}</div>
                    <div className="admin-activity-sub">{a.subtitle}</div>
                  </div>
                  <div className="admin-activity-time" title={fmtDate(a.at)}>{fmtRelative(a.at)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Users ===== */}
      {tab === 'users' && (
        <div className="admin-card">
          <div className="admin-card-head">
            <h3><UsersIcon size={18} /> User management</h3>
            <div className="admin-search">
              <SearchIcon size={14} />
              <input
                placeholder="Search by name, email, roll no…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="admin-grid-table">
            <div className="admin-grid-head admin-row-users">
              <div>User</div>
              <div>Roll / Dept</div>
              <div>Status</div>
              <div>Tokens</div>
              <div>Joined</div>
              <div>Actions</div>
            </div>
            {filteredUsers.map((u) => (
              <div className="admin-grid-row admin-row-users" key={u._id}>
                <div>
                  <strong>{u.firstName} {u.lastName}</strong>
                  <span className="muted">{u.email}</span>
                </div>
                <div>
                  <strong>{u.rollNumber || '—'}</strong>
                  <span className="muted">{u.department || ''}</span>
                </div>
                <div className="stack">
                  <label className="toggle-line">
                    <input type="checkbox" checked={!!u.isVerified} onChange={(e) => toggleUser(u._id, 'isVerified', e.target.checked)} />
                    Verified
                  </label>
                  <label className="toggle-line">
                    <input type="checkbox" checked={!!u.isAdmin} onChange={(e) => toggleUser(u._id, 'isAdmin', e.target.checked)} />
                    Admin
                  </label>
                </div>
                <div><span className="badge badge-info">{u.tokens?.balance || 0}</span></div>
                <div>{fmtDate(u.createdAt)}</div>
                <div>
                  <button className="btn-icon danger" onClick={() => removeUser(u._id)} title="Delete user">
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && <div className="admin-chart-empty">No users match.</div>}
          </div>
        </div>
      )}

      {/* ===== Listings ===== */}
      {tab === 'listings' && (
        <div className="admin-card">
          <div className="admin-card-head">
            <h3><ShoppingBagIcon size={18} /> Marketplace listings</h3>
            <span className="admin-card-sub">{listings.length} total</span>
          </div>
          <div className="admin-grid-table">
            <div className="admin-grid-head admin-row-listings">
              <div>Title</div><div>Seller</div><div>Price</div><div>Status</div><div>Created</div><div>Actions</div>
            </div>
            {listings.map((l) => (
              <div className="admin-grid-row admin-row-listings" key={l._id}>
                <div><strong>{l.title}</strong><span className="muted">{l.category}</span></div>
                <div>{l.seller?.firstName} {l.seller?.lastName}<span className="muted">{l.seller?.email}</span></div>
                <div><strong>{fmtMoney(l.price)}</strong></div>
                <div>
                  <select value={l.status} onChange={(e) => setListingStatus(l._id, e.target.value)} className="admin-select">
                    <option value="active">active</option>
                    <option value="sold">sold</option>
                    <option value="reserved">reserved</option>
                    <option value="pending">pending</option>
                    <option value="removed">removed</option>
                  </select>
                </div>
                <div>{fmtDate(l.createdAt)}</div>
                <div>
                  <button className="btn-icon danger" onClick={() => removeListing(l._id)} title="Delete">
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            ))}
            {listings.length === 0 && <div className="admin-chart-empty">No listings yet.</div>}
          </div>
        </div>
      )}

      {/* ===== Services ===== */}
      {tab === 'services' && (
        <div className="admin-card">
          <div className="admin-card-head">
            <h3><BriefcaseIcon size={18} /> Services</h3>
            <span className="admin-card-sub">{services.length} total</span>
          </div>
          <div className="admin-grid-table">
            <div className="admin-grid-head admin-row-services">
              <div>Title</div><div>Provider</div><div>Type</div><div>Status</div><div>Created</div><div></div>
            </div>
            {services.map((s) => {
              const owner = s.provider || s.user || {};
              return (
                <div className="admin-grid-row admin-row-services" key={s._id}>
                  <div><strong>{s.title}</strong><span className="muted">{s.category}</span></div>
                  <div>{owner.firstName} {owner.lastName}<span className="muted">{owner.email}</span></div>
                  <div>{s.serviceType || '—'}</div>
                  <div><span className={`badge ${STATUS_BADGE[s.status] || 'badge-info'}`}>{s.status || 'active'}</span></div>
                  <div>{fmtDate(s.createdAt)}</div>
                  <div>
                    <button className="btn-icon danger" onClick={() => removeService(s._id)} title="Delete">
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            {services.length === 0 && <div className="admin-chart-empty">No services yet.</div>}
          </div>
        </div>
      )}

      {/* ===== Transactions ===== */}
      {tab === 'transactions' && (
        <div className="admin-card">
          <div className="admin-card-head">
            <h3><CreditCardIcon size={18} /> Transactions</h3>
            <span className="admin-card-sub">{transactions.length} total</span>
          </div>
          <div className="admin-grid-table">
            <div className="admin-grid-head admin-row-tx">
              <div>Item</div><div>Buyer</div><div>Seller</div><div>Amount</div><div>Status</div><div>Date</div>
            </div>
            {transactions.map((t) => (
              <div className="admin-grid-row admin-row-tx" key={t._id}>
                <div><strong>{t.listing?.title || t.service?.title || 'Direct'}</strong><span className="muted">{t.paymentMethod}</span></div>
                <div>{t.buyer?.firstName} {t.buyer?.lastName}<span className="muted">{t.buyer?.email}</span></div>
                <div>{t.seller?.firstName} {t.seller?.lastName}<span className="muted">{t.seller?.email}</span></div>
                <div><strong>{fmtMoney(t.amount)}</strong></div>
                <div><span className={`badge ${STATUS_BADGE[t.status] || 'badge-info'}`}>{t.status}</span></div>
                <div>{fmtDate(t.createdAt)}</div>
              </div>
            ))}
            {transactions.length === 0 && <div className="admin-chart-empty">No transactions yet.</div>}
          </div>
        </div>
      )}

      {/* ===== Posts ===== */}
      {tab === 'posts' && (
        <div className="admin-card">
          <div className="admin-card-head">
            <h3><BookOpenIcon size={18} /> Community posts</h3>
            <span className="admin-card-sub">{posts.length} total</span>
          </div>
          <div className="admin-grid-table">
            <div className="admin-grid-head admin-row-posts">
              <div>Title</div><div>Author</div><div>Type</div><div>Created</div><div></div>
            </div>
            {posts.map((p) => (
              <div className="admin-grid-row admin-row-posts" key={p._id}>
                <div><strong>{p.title}</strong></div>
                <div>{p.author?.firstName} {p.author?.lastName}<span className="muted">{p.author?.email}</span></div>
                <div><span className="badge badge-info">{p.type}</span></div>
                <div>{fmtDate(p.createdAt)}</div>
                <div>
                  <button className="btn-icon danger" onClick={() => removePost(p._id)} title="Delete">
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            ))}
            {posts.length === 0 && <div className="admin-chart-empty">No posts yet.</div>}
          </div>
        </div>
      )}

      {/* ===== Tools ===== */}
      {tab === 'tools' && (
        <div className="admin-grid-2">
          <div className="admin-card">
            <div className="admin-card-head"><h3><SendIcon size={18} /> Recommendation Email Blast</h3></div>
            <p className="admin-tool-desc">Send personalised marketplace recommendations to all verified users based on their viewing history.</p>
            <button className="btn btn-primary" onClick={sendEmails}><SendIcon size={16} /> Send Now</button>
          </div>

          <div className="admin-card">
            <div className="admin-card-head"><h3><ClockIcon size={18} /> Refresh Cache</h3></div>
            <p className="admin-tool-desc">Re-fetch every section of the dashboard from the database. Useful after bulk imports or DB edits.</p>
            <button className="btn btn-outline" onClick={refreshAll} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh All Data'}
            </button>
          </div>

          <div className="admin-card">
            <div className="admin-card-head"><h3><SettingsIcon size={18} /> Admin Account</h3></div>
            <div className="admin-account-box">
              <div><span className="muted">Logged in as</span><strong>{user.firstName} {user.lastName}</strong></div>
              <div><span className="muted">Email</span><strong>{user.email}</strong></div>
              <div><span className="muted">Role</span><span className="badge badge-success">Admin</span></div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-head"><h3><AlertCircleIcon size={18} /> Quick reference</h3></div>
            <ul className="admin-tips">
              <li>Toggle <strong>Verified</strong> to grant a user platform features.</li>
              <li>Promote a trusted user to <strong>Admin</strong> to share moderation duties.</li>
              <li>Set listings to <strong>Removed</strong> instead of deleting to preserve audit history.</li>
              <li>Use the <strong>Activity</strong> tab to spot spam waves or unusual patterns.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================================================================== */
/* KPI sub-component                                                     */
/* ================================================================== */
const KpiCard = ({ tone = 'blue', Icon, value, label, delta, deltaLabel }) => (
  <div className={`admin-kpi admin-kpi-${tone}`}>
    <div className="admin-kpi-icon"><Icon size={22} /></div>
    <div className="admin-kpi-body">
      <div className="admin-kpi-value">{value ?? 0}</div>
      <div className="admin-kpi-label">{label}</div>
      {delta !== undefined && delta !== null && (
        <div className="admin-kpi-delta">
          <TrendingUpIcon size={12} /> <strong>{delta}</strong> {deltaLabel}
        </div>
      )}
    </div>
  </div>
);

export default Admin;
