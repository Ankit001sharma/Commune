import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { serviceAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../components/ui/Toast';

const CATEGORIES = [
  { value: 'tutoring', label: 'Tutoring' },
  { value: 'freelancing', label: 'Freelancing' },
  { value: 'coding-help', label: 'Coding Help' },
  { value: 'room-rental', label: 'Room Rental' },
  { value: 'event-help', label: 'Event Help' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'repair', label: 'Repair' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' },
];

const PRICING_TYPES = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'hourly', label: 'Hourly Rate' },
  { value: 'negotiable', label: 'Negotiable' },
  { value: 'free', label: 'Free' },
];

const CreateService = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const isEdit = !!id;

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'tutoring',
    serviceType: 'offering',
    pricingType: 'fixed',
    pricingAmount: '',
    location: '',
    availability: '',
    tags: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (isEdit) {
      const fetchService = async () => {
        try {
          const { data } = await serviceAPI.getById(id);
          const s = data.data;
          setForm({
            title: s.title || '',
            description: s.description || '',
            category: s.category || 'tutoring',
            serviceType: s.serviceType || 'offering',
            pricingType: s.pricing?.type || 'fixed',
            pricingAmount: s.pricing?.amount?.toString() || '',
            location: s.location || '',
            availability: s.availability || '',
            tags: s.tags?.join(', ') || '',
          });
        } catch (err) {
          toast.error('Failed to load service');
          navigate('/services');
        } finally {
          setFetchLoading(false);
        }
      };
      fetchService();
    }
  }, [id, isEdit, isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
      formData.append('serviceType', form.serviceType);
      formData.append('pricing[type]', form.pricingType);
      if (form.pricingType !== 'free' && form.pricingType !== 'negotiable') {
        formData.append('pricing[amount]', form.pricingAmount || '0');
      }
      if (form.location.trim()) formData.append('location', form.location.trim());
      if (form.availability.trim()) formData.append('availability', form.availability.trim());
      if (form.tags.trim()) {
        const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
        tags.forEach((t) => formData.append('tags', t));
      }

      if (isEdit) {
        await serviceAPI.update(id, formData);
        toast.success('Service updated');
        navigate(`/services/${id}`);
      } else {
        const { data } = await serviceAPI.create(formData);
        toast.success('Service created');
        navigate(`/services/${data.data._id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} service`);
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
        <h1 className="page-title">{isEdit ? 'Edit Service' : 'Post New Service'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="form-card">
        <div className="form-group">
          <label className="form-label" htmlFor="title">Title *</label>
          <input
            id="title"
            name="title"
            type="text"
            className="form-input"
            placeholder="What service are you offering or looking for?"
            value={form.title}
            onChange={handleChange}
            required
            maxLength={100}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="description">Description *</label>
          <textarea
            id="description"
            name="description"
            className="form-textarea"
            placeholder="Describe the service in detail..."
            value={form.description}
            onChange={handleChange}
            required
            rows={5}
            maxLength={2000}
          />
        </div>

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
            <label className="form-label" htmlFor="serviceType">Type</label>
            <select id="serviceType" name="serviceType" className="form-select" value={form.serviceType} onChange={handleChange}>
              <option value="offering">Offering</option>
              <option value="requesting">Requesting</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="pricingType">Pricing Type</label>
            <select id="pricingType" name="pricingType" className="form-select" value={form.pricingType} onChange={handleChange}>
              {PRICING_TYPES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          {(form.pricingType === 'fixed' || form.pricingType === 'hourly') && (
            <div className="form-group">
              <label className="form-label" htmlFor="pricingAmount">
                Amount (₹){form.pricingType === 'hourly' ? ' /hr' : ''}
              </label>
              <input
                id="pricingAmount"
                name="pricingAmount"
                type="number"
                className="form-input"
                placeholder="0"
                value={form.pricingAmount}
                onChange={handleChange}
                min="0"
              />
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="location">Location</label>
          <input
            id="location"
            name="location"
            type="text"
            className="form-input"
            placeholder="e.g., Online, Library, Campus Gate"
            value={form.location}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="availability">Availability</label>
          <input
            id="availability"
            name="availability"
            type="text"
            className="form-input"
            placeholder="e.g., Weekdays 5-8 PM, Weekends"
            value={form.availability}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="tags">Tags (comma separated)</label>
          <input
            id="tags"
            name="tags"
            type="text"
            className="form-input"
            placeholder="e.g., math, calculus, exam-prep"
            value={form.tags}
            onChange={handleChange}
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update Service' : 'Post Service'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateService;
