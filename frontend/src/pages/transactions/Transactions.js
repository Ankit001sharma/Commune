import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { transactionAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  CreditCardIcon, CheckIcon, XIcon,
  ShieldIcon, ChevronRightIcon, DollarIcon,
} from '../../components/Icons';
import { toast } from '../../components/ui/Toast';

const statusSteps = ['initiated', 'escrow-held', 'completed'];

const statusConfig = {
  initiated: { label: 'Initiated', color: 'badge-info', description: 'Transaction has been created' },
  'escrow-held': { label: 'Escrow Held', color: 'badge-warning', description: 'Payment is held in escrow' },
  'payment-pending': { label: 'Payment Pending', color: 'badge-warning', description: 'Awaiting payment confirmation' },
  completed: { label: 'Completed', color: 'badge-success', description: 'Transaction completed successfully' },
  disputed: { label: 'Disputed', color: 'badge-danger', description: 'Transaction is under dispute' },
  refunded: { label: 'Refunded', color: 'badge-warning', description: 'Payment has been refunded' },
  cancelled: { label: 'Cancelled', color: 'badge-danger', description: 'Transaction was cancelled' },
};

const Transactions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const { data } = await transactionAPI.getAll();
        setTransactions(data.data || []);
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === 'all') return true;
    return tx.status === filter;
  });

  const getOtherParty = (tx) => {
    const isBuyer = (typeof tx.buyer === 'string' ? tx.buyer : tx.buyer?._id) === user?._id;
    return isBuyer ? tx.seller : tx.buyer;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading transactions...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">{transactions.length} total transactions</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {['all', 'initiated', 'escrow-held', 'completed', 'cancelled'].map((f) => (
          <button
            key={f}
            className={`tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : statusConfig[f]?.label || f}
          </button>
        ))}
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="empty-state">
          <CreditCardIcon size={64} />
          <h3>No transactions</h3>
          <p>{filter === 'all' ? 'Your transactions will appear here' : 'No transactions with this status'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredTransactions.map((tx) => {
            const other = getOtherParty(tx);
            const isBuyer = (typeof tx.buyer === 'string' ? tx.buyer : tx.buyer?._id) === user?._id;
            const config = statusConfig[tx.status] || {};

            return (
              <div
                key={tx._id}
                className="form-card"
                style={{ cursor: 'pointer', padding: 16 }}
                onClick={() => navigate(`/transactions/${tx._id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: isBuyer ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isBuyer ? 'var(--cx-danger)' : 'var(--cx-success)',
                    }}>
                      {isBuyer ? <CreditCardIcon size={20} /> : <DollarIcon size={20} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        {tx.listing?.title || tx.service?.title || `Transaction #${tx._id.slice(-6)}`}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--cx-text-muted)' }}>
                        {isBuyer ? 'Bought from' : 'Sold to'} {other?.firstName} {other?.lastName}
                        {' '}&middot;{' '}
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>
                      {isBuyer ? '-' : '+'}₹{tx.amount?.toLocaleString()}
                    </div>
                    <span className={`badge ${config.color}`}>{config.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Transaction Detail Page
export const TransactionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const { data } = await transactionAPI.getById(id);
        setTx(data.data);
      } catch (err) {
        toast.error('Transaction not found');
        navigate('/transactions');
      } finally {
        setLoading(false);
      }
    };
    fetchTransaction();
  }, [id, navigate]);

  const handleAction = async (action) => {
    const confirmMsg = {
      escrow: 'Hold payment in escrow?',
      complete: 'Mark this transaction as complete?',
      cancel: 'Cancel this transaction?',
    };
    if (!window.confirm(confirmMsg[action])) return;

    setActionLoading(true);
    try {
      const apiCall = {
        escrow: () => transactionAPI.holdEscrow(id),
        complete: () => transactionAPI.complete(id),
        cancel: () => transactionAPI.cancel(id),
      };
      const { data } = await apiCall[action]();
      setTx(data.data);
      toast.success(`Transaction ${action === 'escrow' ? 'escrow held' : action + 'd'}`);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action} transaction`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading transaction...</p>
      </div>
    );
  }

  if (!tx) return null;

  const isBuyer = (typeof tx.buyer === 'string' ? tx.buyer : tx.buyer?._id) === user?._id;
  const config = statusConfig[tx.status] || {};
  const currentStepIndex = statusSteps.indexOf(tx.status);

  return (
    <div className="page-container" style={{ maxWidth: 700, margin: '0 auto' }}>
      <div className="breadcrumb">
        <Link to="/transactions">Transactions</Link>
        <ChevronRightIcon size={14} />
        <span>#{tx._id.slice(-8)}</span>
      </div>

      <div className="form-card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>
          {tx.listing?.title || tx.service?.title || 'Transaction'}
        </h2>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span className={`badge ${config.color}`} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
            {config.label}
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>₹{tx.amount?.toLocaleString()}</div>
        </div>

        {/* Progress Steps */}
        <div className="escrow-flow" style={{ marginBottom: 24 }}>
          {statusSteps.map((step, i) => {
            const isCompleted = currentStepIndex >= i;
            const isCurrent = tx.status === step;
            return (
              <div key={step} className={`escrow-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                <div className={`escrow-step-circle ${isCompleted ? 'completed' : ''} ${isCurrent ? 'active' : ''}`}>
                  {isCompleted ? <CheckIcon size={14} /> : <span>{i + 1}</span>}
                </div>
                <div className="escrow-step-label">{statusConfig[step]?.label}</div>
              </div>
            );
          })}
        </div>

        <p style={{ color: 'var(--cx-text-secondary)', marginBottom: 24 }}>{config.description}</p>

        {/* Parties */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--cx-bg)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--cx-text-muted)', marginBottom: 6 }}>Buyer</div>
            <div style={{ fontWeight: 600 }}>{tx.buyer?.firstName} {tx.buyer?.lastName}</div>
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--cx-bg)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--cx-text-muted)', marginBottom: 6 }}>Seller</div>
            <div style={{ fontWeight: 600 }}>{tx.seller?.firstName} {tx.seller?.lastName}</div>
          </div>
        </div>

        {/* Fee Info */}
        {tx.platformFee > 0 && (
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--cx-bg)', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--cx-text-secondary)' }}>Amount</span>
              <span>₹{tx.amount?.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--cx-text-secondary)' }}>Platform Fee (2%)</span>
              <span>₹{tx.platformFee?.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="detail-actions">
          {tx.status === 'initiated' && isBuyer && (
            <button className="btn btn-primary" onClick={() => handleAction('escrow')} disabled={actionLoading}>
              <ShieldIcon size={18} /> Hold in Escrow
            </button>
          )}
          {tx.status === 'escrow-held' && !isBuyer && (
            <button className="btn btn-primary" onClick={() => handleAction('complete')} disabled={actionLoading}>
              <CheckIcon size={18} /> Complete Transaction
            </button>
          )}
          {['initiated', 'escrow-held'].includes(tx.status) && (
            <button className="btn btn-danger" onClick={() => handleAction('cancel')} disabled={actionLoading}>
              <XIcon size={18} /> Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Transactions;
