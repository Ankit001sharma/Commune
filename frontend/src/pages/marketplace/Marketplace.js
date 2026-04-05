import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listingAPI } from '../../services/api';
import ListingCard from '../../components/cards/ListingCard';
import { SearchIcon, PlusIcon, GridIcon, ListIcon, XIcon, PackageIcon } from '../../components/Icons';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'books', label: 'Books' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'sports', label: 'Sports' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'food', label: 'Food' },
  { value: 'other', label: 'Other' },
];

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest First' },
  { value: 'createdAt', label: 'Oldest First' },
  { value: 'price', label: 'Price: Low to High' },
  { value: '-price', label: 'Price: High to Low' },
  { value: '-views', label: 'Most Viewed' },
];

const Marketplace = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || '-createdAt');
  const [viewMode, setViewMode] = useState('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  
  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 12, sort };
      if (search) params.search = search;
      if (category) params.category = category;
      const { data } = await listingAPI.getAll(params);
      setListings(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch listings:', err);
    } finally {
      setLoading(false);
    }
  }, [page, sort, search, category]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (category) params.category = category;
    if (sort !== '-createdAt') params.sort = sort;
    setSearchParams(params, { replace: true });
  }, [search, category, sort, setSearchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchListings();
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setSort('-createdAt');
    setPage(1);
  };

  const hasActiveFilters = search || category || sort !== '-createdAt';

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Marketplace</h1>
          <p className="page-subtitle">
            {total} {total === 1 ? 'item' : 'items'} available on campus
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/marketplace/create')}>
          <PlusIcon size={18} /> Post Item
        </button>
      </div>

      {/* Search & Filters Bar */}
      <div className="filter-bar">
        <form onSubmit={handleSearch} className="search-input-wrapper" style={{ flex: 1 }}>
          <SearchIcon size={18} className="search-input-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search items..."
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
          <button className="btn btn-ghost" onClick={clearFilters} title="Clear filters">
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

      {/* Listings Grid */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading marketplace...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="empty-state">
          <PackageIcon size={64} />
          <h3>No items found</h3>
          <p>Try adjusting your filters or search terms</p>
          {hasActiveFilters && (
            <button className="btn btn-secondary" onClick={clearFilters}>Clear Filters</button>
          )}
        </div>
      ) : (
        <>
          <div className={viewMode === 'grid' ? 'card-grid' : 'card-list'}>
            {listings.map((listing) => (
              <ListingCard key={listing._id} listing={listing} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};


export default Marketplace;
