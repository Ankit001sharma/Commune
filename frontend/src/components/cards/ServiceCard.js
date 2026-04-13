import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StarIcon, EyeIcon, MapPinIcon, HeartIcon, HeartFilledIcon } from '../Icons';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../ui/Toast';

const ServiceCard = ({ service }) => {
  const navigate = useNavigate();
  const { isAuthenticated, toggleSavedItem, isItemSaved } = useAuth();

  const isSaved = isItemSaved(service._id, 'service');

  const handleSave = async (e) => {
    e.stopPropagation();
    if (!isAuthenticated) return navigate('/login');
    try {
      await toggleSavedItem(service._id, 'service');
    } catch (error) {
      toast.error(error.message || 'Failed to update saved state');
    }
  };

  const getInitials = (provider) => {
    if (!provider) return '??';
    return `${provider.firstName?.[0] || ''}${provider.lastName?.[0] || ''}`.toUpperCase();
  };

  const getPriceDisplay = (pricing) => {
    if (!pricing) return 'Contact for price';
    if (pricing.type === 'free') return 'Free';
    if (pricing.type === 'negotiable') return 'Negotiable';
    const amount = pricing.amount || 0;
    const suffix = pricing.type === 'hourly' ? '/hr' : '';
    return `₹${amount.toLocaleString()}${suffix}`;
  };

  return (
    <div className="card" onClick={() => navigate(`/services/${service._id}`)} style={{ cursor: 'pointer' }}>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <span className="card-category">{service.category}</span>
          <span className={`badge ${service.serviceType === 'offering' ? 'badge-success' : 'badge-info'}`}>
            {service.serviceType === 'offering' ? 'Offering' : 'Requesting'}
          </span>
        </div>
        <div className="card-title">{service.title}</div>
        <div className="card-description">{service.description}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <span className="card-price">{getPriceDisplay(service.pricing)}</span>
          {service.rating?.average > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', color: 'var(--cx-warning)' }}>
              <StarIcon size={14} /> {service.rating.average.toFixed(1)}
            </span>
          )}
        </div>

        {service.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '0.8rem', color: 'var(--cx-text-muted)' }}>
            <MapPinIcon size={14} /> {service.location}
          </div>
        )}
      </div>
      <div className="card-footer">
        <div className="card-seller">
          <div className="card-seller-avatar" style={{ background: 'var(--cx-accent)' }}>
            {getInitials(service.provider)}
          </div>
          <span>{service.provider?.firstName} {service.provider?.lastName}</span>
        </div>
        <div className="card-actions">
          <button
            className={`card-action-btn ${isSaved ? 'favorited' : ''}`}
            onClick={handleSave}
            title={isSaved ? 'Saved' : 'Save'}
          >
            {isSaved ? <HeartFilledIcon size={16} /> : <HeartIcon size={16} />}
          </button>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--cx-text-muted)' }}>
            <EyeIcon size={14} /> {service.views || 0}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ServiceCard;
