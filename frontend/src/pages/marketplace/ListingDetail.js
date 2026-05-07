import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { listingAPI, chatAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  HeartIcon, HeartFilledIcon, MapPinIcon, ClockIcon, EyeIcon, TagIcon,
  MessageCircleIcon, EditIcon, TrashIcon, ImageIcon, StarIcon,
  ChevronRightIcon,
} from '../../components/Icons';
import { toast } from '../../components/ui/Toast';
import AppImage from "../../components/common/AppImage";
import { resolveImageUrl } from '../../utils/image';
import LiveTrackingMap from '../../components/location/LiveTrackingMap';
import BackButton from '../../components/common/BackButton';

const isValidObjectId = (value) => (
  /^[a-fA-F0-9]{24}$/.test(`${value || ''}`)
);

const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, toggleSavedItem, isItemSaved } = useAuth();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let isActive = true;
    const listingId = `${id || ''}`.trim();

    setLoading(true);
    setError(null);
    setListing(null);

    if (!isValidObjectId(listingId)) {
      if (isActive) {
        setError({ type: 'invalid_id' });
        setLoading(false);
      }
      return () => {
        isActive = false;
      };
    }

    const fetchListing = async () => {
      try {
        const { data } = await listingAPI.getById(listingId);
        const payload = data?.data;

        if (!payload || typeof payload !== 'object') {
          if (isActive) {
            setError({ type: 'failed' });
          }
          return;
        }

        if (payload?.deleted || payload?.isDeleted) {
          if (isActive) {
            setError({ type: 'deleted' });
          }
          return;
        }

        if (isActive) {
          setListing(payload);
        }
      } catch (err) {
        if (!isActive) return;

        if (err?.response?.status === 404) {
          setError({ type: 'not_found' });
          return;
        }

        setError({ type: 'failed' });
        toast.error('Failed to load listing');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchListing();

    return () => {
      isActive = false;
    };
  }, [id]);

  const isFavorited = listing ? isItemSaved(listing._id, 'listing') : false;

  const isOwner = user?._id === listing?.seller?._id;

  const handleFavorite = async () => {
    if (!isAuthenticated) return navigate('/login');
    try {
      await toggleSavedItem(listing._id, 'listing');
    } catch (error) {
      toast.error(error.message || 'Failed to update saved state');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    setDeleting(true);
    try {
      await listingAPI.delete(id);
      toast.success('Listing deleted');
      navigate('/marketplace');
    } catch (err) {
      toast.error('Failed to delete listing');
    } finally {
      setDeleting(false);
    }
  };

  const handleContact = async () => {
    if (!isAuthenticated) return navigate('/login');
    try {
      const { data } = await chatAPI.createConversation({
        // participantId: listing.seller._id,
        recipientId: listing.seller._id,
        listingId: listing._id,
      });
      navigate(`/chat/${data.data._id}`);
    } catch (err) {
      toast.error('Failed to start conversation');
    }
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

  const getInitials = (u) => {
    if (!u) return '??';
    return `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading listing...</p>
      </div>
    );
  }

  if (error) {
    const errorTitle =
      error.type === 'invalid_id'
        ? 'Invalid listing link'
        : error.type === 'deleted'
          ? 'This listing no longer exists'
          : error.type === 'not_found'
            ? 'Listing not found'
            : 'Failed to load listing';

    const errorMessage =
      error.type === 'invalid_id'
        ? 'The link to this listing appears to be invalid.'
        : error.type === 'deleted'
          ? 'The item may have been deleted by the owner.'
          : error.type === 'not_found'
            ? 'This listing may have been removed or is no longer available.'
            : 'Something went wrong while loading this item.';

    return (
      <div className="page-container">
        <BackButton fallback="/marketplace" />

        <div
          style={{
            padding: '80px 20px',
            textAlign: 'center',
          }}
        >
          <h2>{errorTitle}</h2>

          <p
            style={{
              marginTop: 12,
              opacity: 0.7,
            }}
          >
            {errorMessage}
          </p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="page-container">
        <BackButton fallback="/marketplace" />

        <div
          style={{
            padding: '80px 20px',
            textAlign: 'center',
          }}
        >
          <h2>Failed to load listing</h2>

          <p
            style={{
              marginTop: 12,
              opacity: 0.7,
            }}
          >
            Something went wrong while loading this item.
          </p>
        </div>
      </div>
    );
  }

  const images = listing.images || [];
  const locationLabel = typeof listing.location === 'string' ? listing.location : listing.location?.address;

  return (
    <div className="page-container">
      <BackButton fallback="/marketplace" />
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/marketplace">Marketplace</Link>
        <ChevronRightIcon size={14} />
        <span>{listing.category}</span>
        <ChevronRightIcon size={14} />
        <span>{listing.title}</span>
      </div>

      <div className="detail-layout">
        {/* Image Gallery */}
        <div className="detail-gallery">
          <div className="detail-main-image">
            {images.length > 0 ? (

          <AppImage
            src={resolveImageUrl(images[selectedImage]?.url)}
            height={400}
          />
            ) : (
              <div className="card-image-placeholder" style={{ height: 400 }}>
                <ImageIcon size={64} />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="detail-thumbnails">
              {images.map((img, i) => (
                <div
                  key={i}
                  className={`detail-thumbnail ${selectedImage === i ? 'active' : ''}`}
                  onClick={() => setSelectedImage(i)}
                >
                  <img src={resolveImageUrl(img.url)} alt={`${listing.title} ${i + 1}`} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Info */}
        <div className="detail-info">
          <div className="detail-info-header">
            <div>
              <span className="card-category">{listing.category}</span>
              {listing.condition && (
                <span className="tag" style={{ marginLeft: 8 }}>{listing.condition}</span>
              )}
              <span className={`badge ${listing.status === 'available' ? 'badge-success' : 'badge-warning'}`} style={{ marginLeft: 8 }}>
                {listing.status}
              </span>
            </div>
          </div>

          <h1 className="detail-title">{listing.title}</h1>

          <div className="detail-price">
            {listing.price === 0 ? 'Free' : `₹${listing.price?.toLocaleString()}`}
            {listing.negotiable && <span className="badge badge-success" style={{ marginLeft: 12 }}>Negotiable</span>}
          </div>

          <div className="detail-meta">
            <span><ClockIcon size={16} /> Listed {timeAgo(listing.createdAt)}</span>
            <span><EyeIcon size={16} /> {listing.views || 0} views</span>
            {locationLabel && <span><MapPinIcon size={16} /> {locationLabel}</span>}
          </div>

          {/*<LiveTrackingMap location={listing.location} title={`${listing.title} tracking`} /> */}

          <div className="detail-section">
            <h3>Description</h3>
            <p className="detail-description">{listing.description}</p>
          </div>

          {listing.tags?.length > 0 && (
            <div className="detail-section">
              <h3>Tags</h3>
              <div className="detail-tags">
                {listing.tags.map((tag, i) => (
                  <span key={i} className="tag"><TagIcon size={12} /> {tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Seller Card */}
          <div className="detail-section">
            <h3>Seller</h3>
            <div className="detail-seller-card" onClick={() => navigate(`/profile/${listing.seller?._id}`)} style={{ cursor: 'pointer' }}>
              <div className="detail-seller-avatar">{getInitials(listing.seller)}</div>
              <div className="detail-seller-info">
                <div className="detail-seller-name">
                  {listing.seller?.firstName} {listing.seller?.lastName}
                </div>
                <div className="detail-seller-meta">
                  {listing.seller?.department && <span>{listing.seller.department}</span>}
                  {listing.seller?.rating?.average > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <StarIcon size={14} /> {listing.seller.rating.average.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="detail-actions">
            {isOwner ? (
              <>
                <button className="btn btn-primary" onClick={() => navigate(`/marketplace/edit/${listing._id}`)}>
                  <EditIcon size={18} /> Edit Listing
                </button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                  <TrashIcon size={18} /> {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={handleContact}>
                  <MessageCircleIcon size={18} /> Contact Seller
                </button>
                <button className={`btn ${isFavorited ? 'btn-secondary' : 'btn-ghost'}`} onClick={handleFavorite}>
                  {isFavorited ? <HeartFilledIcon size={18} /> : <HeartIcon size={18} />}
                  {isFavorited ? 'Saved' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
