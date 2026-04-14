import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { serviceAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { XIcon, PlusIcon } from '../../components/Icons';
import { toast } from '../../components/ui/Toast';

const CATEGORIES = [
  { value: 'tutoring', label: 'Tutoring' },
  { value: 'freelancing', label: 'Freelancing' },
  { value: 'coding-help', label: 'Coding Help' },
  { value: 'room-rental', label: 'Room Rental' },
  { value: 'mess-info', label: 'Mess Info' },
  { value: 'transport', label: 'Transport' },
  { value: 'photography', label: 'Photography' },
  { value: 'event-planning', label: 'Event Planning' },
  { value: 'design', label: 'Design' },
  { value: 'writing', label: 'Writing' },
  { value: 'other', label: 'Other' },
];

const PRICING_TYPES = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'hourly', label: 'Hourly Rate' },
  { value: 'negotiable', label: 'Negotiable' },
  { value: 'free', label: 'Free' },
];

const VALID_CATEGORIES = new Set(CATEGORIES.map((c) => c.value));
const VALID_SERVICE_TYPES = new Set(['offering', 'requesting']);
const VALID_PRICING_TYPES = new Set(PRICING_TYPES.map((p) => p.value));

const DAY_NAME_TO_CODE = {
  monday: 'mon',
  mon: 'mon',
  tuesday: 'tue',
  tue: 'tue',
  wednesday: 'wed',
  wed: 'wed',
  thursday: 'thu',
  thu: 'thu',
  friday: 'fri',
  fri: 'fri',
  saturday: 'sat',
  sat: 'sat',
  sunday: 'sun',
  sun: 'sun',
};

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const WEEKENDS = ['sat', 'sun'];
const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const normalizeCategory = (value) => {
  const raw = (value || '').toString().trim().toLowerCase();
  if (!raw) return 'other';

  const slug = raw.replace(/\s+/g, '-');
  if (VALID_CATEGORIES.has(slug)) return slug;

  if (slug === 'coding') return 'coding-help';
  if (slug === 'event-help') return 'event-planning';
  return 'other';
};

const normalizeServiceType = (value) => {
  const normalized = (value || '').toString().trim().toLowerCase();
  if (VALID_SERVICE_TYPES.has(normalized)) return normalized;
  return 'offering';
};

const normalizePricingType = (value) => {
  const normalized = (value || '').toString().trim().toLowerCase().replace(/\s+/g, '-');
  const aliasMap = {
    'fixed-price': 'fixed',
    fixedprice: 'fixed',
    'hourly-rate': 'hourly',
    hourlyrate: 'hourly',
  };
  const mapped = aliasMap[normalized] || normalized;
  if (VALID_PRICING_TYPES.has(mapped)) return mapped;
  return 'fixed';
};

const parseAvailabilityInput = (value) => {
  const raw = (value || '').toString().trim();
  if (!raw) return { days: [] };

  const lowered = raw.toLowerCase();
  if (lowered === 'weekends' || lowered === 'weekend') return { days: WEEKENDS };
  if (lowered === 'weekdays' || lowered === 'weekday') return { days: WEEKDAYS };
  if (lowered === 'daily' || lowered === 'all days' || lowered === 'everyday') return { days: ALL_DAYS };

  const tokens = lowered.split(/[,\s]+/).filter(Boolean);
  const days = [...new Set(tokens.map((t) => DAY_NAME_TO_CODE[t]).filter(Boolean))];
  return { days };
};

const getAvailabilityInputValue = (availability) => {
  if (!availability) return '';
  if (typeof availability === 'string') return availability;

  const days = Array.isArray(availability.days) ? availability.days : [];
  const sortedDays = [...days].sort();
  const isWeekdays = WEEKDAYS.every((d) => sortedDays.includes(d)) && sortedDays.length === WEEKDAYS.length;
  const isWeekends = WEEKENDS.every((d) => sortedDays.includes(d)) && sortedDays.length === WEEKENDS.length;
  const isAllDays = ALL_DAYS.every((d) => sortedDays.includes(d)) && sortedDays.length === ALL_DAYS.length;

  if (isAllDays) return 'Daily';
  if (isWeekdays) return 'Weekdays';
  if (isWeekends) return 'Weekends';
  return days.join(', ');
};

const buildServiceFormData = (form, images = []) => {
  const normalizedPricingType = normalizePricingType(form.pricingType);
  const normalizedAmount =
    normalizedPricingType === 'fixed' || normalizedPricingType === 'hourly'
      ? Number(form.pricingAmount || 0)
      : 0;

  const payload = {
    title: form.title.trim(),
    description: form.description.trim(),
    category: normalizeCategory(form.category),
    serviceType: normalizeServiceType(form.serviceType),
    pricing: {
      type: normalizedPricingType,
      amount: Number.isFinite(normalizedAmount) ? Math.max(0, normalizedAmount) : 0,
      currency: 'INR',
    },
    availability: parseAvailabilityInput(form.availability),
    location: form.location.trim() || 'Campus',
    tags: form.tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  };

  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('description', payload.description);
  formData.append('category', payload.category);
  formData.append('serviceType', payload.serviceType);
  formData.append('pricing', JSON.stringify(payload.pricing));
  formData.append('availability', JSON.stringify(payload.availability));
  formData.append('location', payload.location);
  if (payload.tags.length > 0) formData.append('tags', payload.tags.join(','));
  images.forEach((img) => formData.append('images', img));

  return formData;
};

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
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

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
            availability: getAvailabilityInputValue(s.availability),
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

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length + images.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }

    setImages((prev) => [...prev, ...files]);
    const nextPreviews = files.map((file) => URL.createObjectURL(file));
    setPreviews((prev) => [...prev, ...nextPreviews]);
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
      const formData = buildServiceFormData(form, images);

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
