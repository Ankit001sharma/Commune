import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartIcon, HeartFilledIcon, EyeIcon, ImageIcon } from '../Icons';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../ui/Toast';
import AppImage from "../common/AppImage";
import { resolveImageUrl } from '../../utils/image';

const ListingCard = ({ listing }) => {
  const { isAuthenticated, toggleSavedItem, isItemSaved } = useAuth();
  const navigate = useNavigate();

  const isFavorited = isItemSaved(listing._id, 'listing');

  const handleFavorite = async (e) => {
    e.stopPropagation();
    if (!isAuthenticated) return navigate('/login');
    try {
      await toggleSavedItem(listing._id, 'listing');
    } catch (error) {
      toast.error(error.message || 'Failed to update saved state');
    }
  };

  const getInitials = (seller) => {
    if (!seller) return '??';
    return `${seller.firstName?.[0] || ''}${seller.lastName?.[0] || ''}`.toUpperCase();
  };

  const imageUrl = resolveImageUrl(listing.images?.[0]?.url);

  return (
    <div
      className="card"
      onClick={() => navigate(`/marketplace/${listing._id}`)}
      style={{ cursor: 'pointer' }}
    >
      {/* 🔥 IMAGE FIX (GLOBAL) */}
      {imageUrl ? (
        <AppImage src={imageUrl} height={200} />
      ) : (
        <div className="card-image-placeholder">
          <ImageIcon size={48} />
        </div>
      )}

      {/* CONTENT */}
      <div className="card-body">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8
        }}>
          <span className="card-category">{listing.category}</span>
          {listing.condition && (
            <span className="tag">{listing.condition}</span>
          )}
        </div>

        <div className="card-title">{listing.title}</div>

        <div className="card-description">
          {listing.description?.slice(0, 60)}...
        </div>

        <div className="card-meta">
          <span className="card-price">
            {listing.price === 0 ? 'Free' : `₹${listing.price.toLocaleString()}`}
          </span>
          {listing.negotiable && (
            <span className="badge badge-success">Negotiable</span>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div className="card-footer">
        <div className="card-seller">
          <div className="card-seller-avatar">
            {getInitials(listing.seller)}
          </div>
          <span>
            {listing.seller?.firstName} {listing.seller?.lastName}
          </span>
        </div>

        <div className="card-actions">
          <button
            className={`card-action-btn ${isFavorited ? 'favorited' : ''}`}
            onClick={handleFavorite}
            title="Favorite"
          >
            {isFavorited ? (
              <HeartFilledIcon size={16} />
            ) : (
              <HeartIcon size={16} />
            )}
          </button>

          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.75rem',
            color: 'var(--cx-text-muted)'
          }}>
            <EyeIcon size={14} /> {listing.views || 0}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;