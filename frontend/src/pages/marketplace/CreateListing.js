import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listingAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { XIcon, PlusIcon } from '../../components/Icons';
import { toast } from '../../components/ui/Toast';
import { resolveImageUrl } from '../../utils/image';
import LocationPicker from '../../components/location/LocationPicker';
import BackButton from '../../components/common/BackButton';

const CATEGORIES = [
  { value: 'books', label: 'Books' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'sports', label: 'Sports' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'food', label: 'Food' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'other', label: 'Other' },
];

const CONDITIONS = ['new', 'like-new', 'good', 'fair', 'poor'];

const CreateListing = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const isEdit = !!id;

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'books',
    price: '',
    negotiable: false,
    condition: 'good',
    location: '',
    locationData: { address: '', mode: 'manual', coordinates: { lat: '', lng: '' } },
    tags: '',
  });
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (isEdit) {
      const fetchListing = async () => {
        try {
          const { data } = await listingAPI.getById(id);
          const l = data.data;
          setForm({
            title: l.title || '',
            description: l.description || '',
            category: l.category || 'books',
            price: l.price?.toString() || '',
            negotiable: l.negotiable || false,
            condition: l.condition || 'good',
            location: typeof l.location === 'string' ? l.location : l.location?.address || '',
            locationData: typeof l.location === 'object' ? {
              address: l.location?.address || '',
              mode: l.location?.mode || 'manual',
              coordinates: {
                lat: l.location?.coordinates?.lat || '',
                lng: l.location?.coordinates?.lng || '',
              },
            } : { address: l.location || '', mode: 'manual', coordinates: { lat: '', lng: '' } },
            tags: l.tags?.join(', ') || '',
          });
          if (l.images?.length) {
            setPreviews(l.images.map((img) => resolveImageUrl(img.url)));
          }
        } catch (err) {
          toast.error('Failed to load listing');
          navigate('/marketplace');
        } finally {
          setFetchLoading(false);
        }
      };
      fetchListing();
    }
  }, [id, isEdit, isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }
    setImages((prev) => [...prev, ...files]);
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title.trim());
      formData.append('description', form.description.trim());
      formData.append('category', form.category);
      formData.append('price', form.price || '0');
      formData.append('negotiable', form.negotiable);
      formData.append('condition', form.condition);
      if (form.locationData?.address?.trim()) formData.append('locationAddress', form.locationData.address.trim());
      formData.append('locationMode', form.locationData?.mode || 'manual');
      if (form.locationData?.coordinates?.lat) formData.append('locationLat', form.locationData.coordinates.lat);
      if (form.locationData?.coordinates?.lng) formData.append('locationLng', form.locationData.coordinates.lng);
      if (form.tags.trim()) {
        const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
        tags.forEach((t) => formData.append('tags', t));
      }
      images.forEach((img) => formData.append('images', img));

      if (isEdit) {
        await listingAPI.update(id, formData);
        toast.success('Listing updated successfully');
        navigate(`/marketplace/${id}`);
      } else {
        const { data } = await listingAPI.create(formData);
        toast.success('Listing created successfully');
        navigate(`/marketplace/${data.data._id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} listing`);
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <BackButton fallback="/marketplace" />
          <h1 className="page-title">{isEdit ? 'Edit Listing' : 'Post New Item'}</h1>
          {!isEdit && <p className="page-subtitle">2 uploads are free. After that, 1 product upload uses 1 token worth INR 5.</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-card">
        {/* Images */}
        <div className="form-group">
          <label className="form-label">Images (up to 5)</label>
          <div className="image-upload-grid">
            {previews.map((src, i) => (
              <div key={i} className="image-upload-preview">
                <img src={src} alt={`Preview ${i + 1}`} />
                <button type="button" className="image-upload-remove" onClick={() => removeImage(i)}>
                  <XIcon size={14} />
                </button>
              </div>
            ))}
            {previews.length < 5 && (
              <label className="image-upload-btn">
                <input type="file" accept="image/*" multiple onChange={handleImageChange} hidden />
                <PlusIcon size={24} />
                <span>Add Photo</span>
              </label>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="form-group">
          <label className="form-label" htmlFor="title">Title *</label>
          <input
            id="title"
            name="title"
            type="text"
            className="form-input"
            placeholder="What are you selling?"
            value={form.title}
            onChange={handleChange}
            required
            maxLength={100}
          />
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="form-label" htmlFor="description">Description *</label>
          <textarea
            id="description"
            name="description"
            className="form-textarea"
            placeholder="Describe your item in detail..."
            value={form.description}
            onChange={handleChange}
            required
            rows={5}
            maxLength={2000}
          />
        </div>

        {/* Category & Condition */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="category">Category</label>
            <select id="category" name="category" className="form-select" value={form.category} onChange={handleChange}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="condition">Condition</label>
            <select id="condition" name="condition" className="form-select" value={form.condition} onChange={handleChange}>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('-', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Price & Negotiable */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'end' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="price">Price (₹)</label>
            <input
              id="price"
              name="price"
              type="number"
              className="form-input"
              placeholder="0 for free"
              value={form.price}
              onChange={handleChange}
              min="0"
            />
          </div>
          <div className="form-group" style={{ paddingBottom: 8 }}>
            <label className="form-checkbox">
              <input type="checkbox" name="negotiable" checked={form.negotiable} onChange={handleChange} />
              <span>Negotiable</span>
            </label>
          </div>
        </div>

        {/* Location */}
        <div className="form-group">
          <label className="form-label">Location and Product Tracking</label>
          <LocationPicker
            value={form.locationData}
            onChange={(locationData) => setForm((prev) => ({ ...prev, locationData, location: locationData.address || '' }))}
          />
        </div>

        {/* Tags */}
        <div className="form-group">
          <label className="form-label" htmlFor="tags">Tags (comma separated)</label>
          <input
            id="tags"
            name="tags"
            type="text"
            className="form-input"
            placeholder="e.g., textbook, engineering, semester-4"
            value={form.tags}
            onChange={handleChange}
          />
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update Listing' : 'Post Item'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateListing;
