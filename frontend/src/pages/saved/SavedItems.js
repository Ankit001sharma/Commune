import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../../services/api';
import { HeartFilledIcon, MapPinIcon, TagIcon } from '../../components/Icons';
import AppImage from '../../components/common/AppImage';
import { toast } from '../../components/ui/Toast';
import { resolveImageUrl } from '../../utils/image';

const SavedItems = () => {
  const navigate = useNavigate();
  const [savedItems, setSavedItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Separate data
  const listings = savedItems.filter((item) => item.itemType === 'listing');
  const services = savedItems.filter((item) => item.itemType === 'service');
  const posts = savedItems.filter((item) => item.itemType === 'post');

  useEffect(() => {
    const fetchSavedItems = async () => {
      try {
        const res = await userAPI.getSavedItems();
        console.log("FULL RESPONSE:", res.data);

        const items = res.data?.data || [];
        setSavedItems(items);

      } catch (error) {
        console.error('❌ Failed to load saved items:', error);
        console.log('Error response:', error?.response?.data);

        toast.error(
          error?.response?.data?.message || 'Failed to fetch saved items'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSavedItems();
  }, []);

  // ✅ Price helper
  const getPriceText = (entry) => {
    const item = entry.item;
    if (!item) return "N/A";

    if (entry.itemType === 'listing') {
      const value = item.price || 0;
      return value === 0 ? 'Free' : `₹${Number(value).toLocaleString()}`;
    }

    if (entry.itemType === 'post') {
      return 'Community Post';
    }

    const pricing = item.pricing;
    if (!pricing) return 'Contact';

    if (pricing.type === 'free') return 'Free';
    if (pricing.type === 'negotiable') return 'Negotiable';

    const suffix = pricing.type === 'hourly' ? '/hr' : '';
    return `₹${Number(pricing.amount || 0).toLocaleString()}${suffix}`;
  };

  // ✅ Navigation
  const openItem = (entry) => {
    const item = entry.item;
    if (!item?._id) return;

    if (entry.itemType === 'listing') {
      navigate(`/marketplace/${item._id}`);
    } else if (entry.itemType === 'service') {
      navigate(`/services/${item._id}`);
    } else if (entry.itemType === 'post') {
      navigate(`/community/${item._id}`);
    }
  };

  // ✅ REUSABLE CARD (MAIN IMPROVEMENT)
  const renderCard = (entry, index, label) => {
    const item = entry.item;
    if (!item) return null;

    const image = resolveImageUrl(item.images?.[0]?.url);

    const tags = (entry.tags || []).slice(0, 4);

    return (
      <div
        key={`${entry.itemType}-${item._id || index}`}
        className="card"
        style={{ cursor: 'pointer' }}
        onClick={() => openItem(entry)}
      >
        {image && <AppImage src={image} height={180} />}

        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="card-category">{label}</span>
            <span className="badge badge-success">Saved</span>
          </div>

          <div className="card-title">{item.title || 'Untitled'}</div>
          <div className="card-price">{getPriceText(entry)}</div>

          {entry.itemType === 'post' && item.content && (
            <div className="card-description" style={{ marginTop: 8 }}>
              {item.content.length > 120 ? `${item.content.slice(0, 120)}...` : item.content}
            </div>
          )}

          {item.location && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 10,
              }}
            >
    <MapPinIcon size={14} />

    <span>
      {typeof item.location === 'string'
        ? item.location
        : item.location?.address || 'No location'}
    </span>
  </div>
)}

          {tags.length > 0 && (
            <div className="detail-tags" style={{ marginTop: 10 }}>
              {tags.map((tag) => (
                <span key={tag} className="tag">
                  <TagIcon size={12} /> {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 🔄 Loading UI
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading saved items...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Saved Items</h1>
        <p className="page-subtitle">
          Items you saved for quick access and personalized recommendations
        </p>
      </div>

      {/* ❌ EMPTY STATE */}
      {savedItems.length === 0 ? (
        <div className="empty-state">
          <HeartFilledIcon size={64} />
          <h3>No saved items yet</h3>
          <p>Save listings and services to build your personalized feed.</p>
        </div>
      ) : (
        <>
          {/* 🔥 LISTINGS */}
          {listings.length > 0 && (
            <>
              <h2 style={{ marginTop: 20, marginBottom: 10 }}>
                Listings ({listings.length})
              </h2>

              <div className="card-grid">
                {listings.map((entry, i) =>
                  renderCard(entry, i, "Listing")
                )}
              </div>
            </>
          )}

          {/* 🔥 SERVICES */}
          {services.length > 0 && (
            <>
              <h2 style={{ marginTop: 30, marginBottom: 10 }}>
                Services ({services.length})
              </h2>

              <div className="card-grid">
                {services.map((entry, i) =>
                  renderCard(entry, i, 'Service')
                )}
              </div>
            </>
          )}

          {/* 🔥 POSTS */}
          {posts.length > 0 && (
            <>
              <h2 style={{ marginTop: 30, marginBottom: 10 }}>
                Posts ({posts.length})
              </h2>

              <div className="card-grid">
                {posts.map((entry, i) =>
                  renderCard(entry, i, 'Post')
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default SavedItems;