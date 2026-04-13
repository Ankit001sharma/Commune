import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { serviceAPI } from '../../services/api';
import ServiceCard from '../../components/cards/ServiceCard';
import { SearchIcon, PlusIcon, GridIcon, ListIcon, XIcon, BriefcaseIcon } from '../../components/Icons';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
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

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest First' },
  { value: 'createdAt', label: 'Oldest First' },
  { value: '-rating.average', label: 'Highest Rated' },
  { value: '-views', label: 'Most Viewed' },
];

const Services = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [serviceType, setServiceType] = useState(searchParams.get('type') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || '-createdAt');
  const [viewMode, setViewMode] = useState('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 12, sort, status: 'active' };
      if (search) params.search = search;
      if (category) params.category = category;
      if (serviceType) params.serviceType = serviceType;
      const { data } = await serviceAPI.getAll(params);
      setServices(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch services:', err);
    } finally {
      setLoading(false);
    }
  }, [page, sort, search, category, serviceType]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (category) params.category = category;
    if (serviceType) params.type = serviceType;
    if (sort !== '-createdAt') params.sort = sort;
    setSearchParams(params, { replace: true });
  }, [search, category, serviceType, sort, setSearchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchServices();
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setServiceType('');
    setSort('-createdAt');
    setPage(1);
  };

  const hasActiveFilters = search || category || serviceType || sort !== '-createdAt';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Services</h1>
          <p className="page-subtitle">
            {total} {total === 1 ? 'service' : 'services'} on campus
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/services/create')}>
          <PlusIcon size={18} /> Post Service
        </button>
      </div>

      {/* Type Toggle */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab ${serviceType === '' ? 'active' : ''}`} onClick={() => { setServiceType(''); setPage(1); }}>All</button>
        <button className={`tab ${serviceType === 'offering' ? 'active' : ''}`} onClick={() => { setServiceType('offering'); setPage(1); }}>Offering</button>
        <button className={`tab ${serviceType === 'requesting' ? 'active' : ''}`} onClick={() => { setServiceType('requesting'); setPage(1); }}>Requesting</button>
      </div>

      <div className="filter-bar">
        <form onSubmit={handleSearch} className="search-input-wrapper" style={{ flex: 1 }}>
          <SearchIcon size={18} className="search-input-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        <select className="form-select" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} style={{ width: 180 }}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <select className="form-select" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} style={{ width: 180 }}>
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <div className="view-toggle">
          <button className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
            <GridIcon size={18} />
          </button>
          <button className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
            <ListIcon size={18} />
          </button>
        </div>

        {hasActiveFilters && (
          <button className="btn btn-ghost" onClick={clearFilters}>
            <XIcon size={16} /> Clear
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            className={`tab ${category === c.value ? 'active' : ''}`}
            onClick={() => { setCategory(c.value); setPage(1); }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading services...</p>
        </div>
      ) : services.length === 0 ? (
        <div className="empty-state">
          <BriefcaseIcon size={64} />
          <h3>No services found</h3>
          <p>Try adjusting your filters or be the first to offer a service</p>
          {hasActiveFilters && (
            <button className="btn btn-secondary" onClick={clearFilters}>Clear Filters</button>
          )}
        </div>
      ) : (
        <>
          <div className={viewMode === 'grid' ? 'card-grid' : 'card-list'}>
            {services.map((service) => (
              <ServiceCard key={service._id} service={service} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span className="pagination-info">Page {page} of {totalPages}</span>
              <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Services;
