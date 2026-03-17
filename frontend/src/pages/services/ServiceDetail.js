import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { serviceAPI, chatAPI, transactionAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  MapPinIcon, ClockIcon, EyeIcon, TagIcon, StarIcon,
  MessageCircleIcon, EditIcon, TrashIcon, ChevronRightIcon,
  DollarIcon,
} from '../../components/Icons';
import { toast } from '../../components/ui/Toast';

const ServiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchService = async () => {
      try {
        const { data } = await serviceAPI.getById(id);
        setService(data.data);
      } catch (err) {
        toast.error('Service not found');
        navigate('/services');
      } finally {
        setLoading(false);
      }
    };
    fetchService();
  }, [id, navigate]);

  const isOwner = user?._id === service?.provider?._id;

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    setDeleting(true);
    try {
      await serviceAPI.delete(id);
      toast.success('Service deleted');
      navigate('/services');
    } catch (err) {
      toast.error('Failed to delete service');
    } finally {
      setDeleting(false);
    }
  };

  const handleContact = async () => {
    if (!isAuthenticated) return navigate('/login');
    try {
      const { data } = await chatAPI.createConversation({
        participantId: service.provider._id,
        serviceId: service._id,
      });
      navigate(`/chat/${data.data._id}`);
    } catch (err) {
      toast.error('Failed to start conversation');
    }
  };

  const handleHire = async () => {
    if (!isAuthenticated) return navigate('/login');
    try {
      const { data } = await transactionAPI.initiate({
        serviceId: service._id,
        sellerId: service.provider._id,
        amount: service.pricing?.amount || 0,
        type: 'service',
      });
      toast.success('Transaction initiated');
      navigate(`/transactions/${data.data._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate transaction');
    }
  };

  const getInitials = (u) => {
    if (!u) return '??';
    return `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase();
  };

  const getPriceDisplay = (pricing) => {
    if (!pricing) return 'Contact for price';
    if (pricing.type === 'free') return 'Free';
    if (pricing.type === 'negotiable') return 'Negotiable';
    const amount = pricing.amount || 0;
    const suffix = pricing.type === 'hourly' ? '/hr' : '';
    return `₹${amount.toLocaleString()}${suffix}`;
  };

  const timeAgo = (dateStr) => {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading service...</p>
      </div>
    );
  }

  if (!service) return null;

  return (
    <div className="page-container">
      <div className="breadcrumb">
        <Link to="/services">Services</Link>
        <ChevronRightIcon size={14} />
        <span>{service.category}</span>
        <ChevronRightIcon size={14} />
        <span>{service.title}</span>
      </div>

      <div className="detail-layout">
        {/* Main Content */}
        <div className="detail-gallery" style={{ padding: 0 }}>
          <div className="form-card" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <span className="card-category">{service.category}</span>
                <span className={`badge ${service.serviceType === 'offering' ? 'badge-success' : 'badge-info'}`} style={{ marginLeft: 8 }}>
                  {service.serviceType === 'offering' ? 'Offering' : 'Requesting'}
                </span>
                <span className={`badge ${service.status === 'active' ? 'badge-success' : 'badge-warning'}`} style={{ marginLeft: 8 }}>
                  {service.status}
                </span>
              </div>
            </div>

            <h1 className="detail-title">{service.title}</h1>

            <div className="detail-price">{getPriceDisplay(service.pricing)}</div>

            <div className="detail-meta">
              <span><ClockIcon size={16} /> Posted {timeAgo(service.createdAt)}</span>
              <span><EyeIcon size={16} /> {service.views || 0} views</span>
              {service.location && <span><MapPinIcon size={16} /> {service.location}</span>}
              {service.rating?.average > 0 && (
                <span style={{ color: 'var(--cx-warning)' }}>
                  <StarIcon size={16} /> {service.rating.average.toFixed(1)} ({service.rating.count} reviews)
                </span>
              )}
            </div>

            <div className="detail-section">
              <h3>Description</h3>
              <p className="detail-description">{service.description}</p>
            </div>

            {service.availability && (
              <div className="detail-section">
                <h3>Availability</h3>
                <p className="detail-description">{service.availability}</p>
              </div>
            )}

            {service.tags?.length > 0 && (
              <div className="detail-section">
                <h3>Tags</h3>
                <div className="detail-tags">
                  {service.tags.map((tag, i) => (
                    <span key={i} className="tag"><TagIcon size={12} /> {tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="detail-info">
          {/* Provider Card */}
          <div className="detail-section">
            <h3>Provider</h3>
            <div className="detail-seller-card" onClick={() => navigate(`/profile/${service.provider?._id}`)} style={{ cursor: 'pointer' }}>
              <div className="detail-seller-avatar" style={{ background: 'var(--cx-accent)' }}>{getInitials(service.provider)}</div>
              <div className="detail-seller-info">
                <div className="detail-seller-name">
                  {service.provider?.firstName} {service.provider?.lastName}
                </div>
                <div className="detail-seller-meta">
                  {service.provider?.department && <span>{service.provider.department}</span>}
                  {service.provider?.rating?.average > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <StarIcon size={14} /> {service.provider.rating.average.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="detail-actions" style={{ flexDirection: 'column' }}>
            {isOwner ? (
              <>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate(`/services/edit/${service._id}`)}>
                  <EditIcon size={18} /> Edit Service
                </button>
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleDelete} disabled={deleting}>
                  <TrashIcon size={18} /> {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleContact}>
                  <MessageCircleIcon size={18} /> Contact Provider
                </button>
                {service.serviceType === 'offering' && service.pricing?.type !== 'free' && (
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleHire}>
                    <DollarIcon size={18} /> Hire / Pay
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetail;
