import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { aiAPI } from '../../services/api';
import ListingCard from '../../components/cards/ListingCard';
import ServiceCard from '../../components/cards/ServiceCard';
import { SearchIcon, ZapIcon, PackageIcon, BriefcaseIcon } from '../../components/Icons';

const AISearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [type, setType] = useState(searchParams.get('type') || 'all');
  const [results, setResults] = useState({ listings: [], services: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recommendations, setRecommendations] = useState({ listings: [], services: [] });
  const [recLoading, setRecLoading] = useState(true);

  // Fetch recommendations on mount
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const { data } = await aiAPI.getRecommendations({ limit: 6 });
        setRecommendations({
          listings: data.data?.listings || [],
          services: data.data?.services || [],
        });
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
      } finally {
        setRecLoading(false);
      }
    };
    fetchRecommendations();
  }, []);

  // Auto-search from URL params
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      performSearch(q, searchParams.get('type') || 'all');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const performSearch = async (q, searchType) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await aiAPI.search(q.trim(), searchType !== 'all' ? searchType : undefined);
      setResults({
        listings: data.data?.listings || [],
        services: data.data?.services || [],
      });
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchParams({ q: query.trim(), type });
    performSearch(query.trim(), type);
  };

  const totalResults = results.listings.length + results.services.length;

  return (
    <div className="page-container">
      <div className="page-header" style={{ textAlign: 'center', display: 'block' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <ZapIcon size={28} style={{ color: 'var(--cx-primary)' }} />
          <h1 className="page-title" style={{ margin: 0 }}>Smart Search</h1>
        </div>
        <p className="page-subtitle">Search using natural language across marketplace and services</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} style={{ maxWidth: 700, margin: '0 auto 32px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <SearchIcon size={20} className="search-input-icon" />
            <input
              type="text"
              className="search-input"
              placeholder='Try "cheap textbooks for engineering" or "someone to help with web development"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ fontSize: '1rem', padding: '14px 14px 14px 44px' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '0 24px', whiteSpace: 'nowrap' }}>
            <SearchIcon size={18} /> Search
          </button>
        </div>
        <div className="tabs" style={{ justifyContent: 'center' }}>
          <button type="button" className={`tab ${type === 'all' ? 'active' : ''}`} onClick={() => setType('all')}>All</button>
          <button type="button" className={`tab ${type === 'listing' ? 'active' : ''}`} onClick={() => setType('listing')}>Items</button>
          <button type="button" className={`tab ${type === 'service' ? 'active' : ''}`} onClick={() => setType('service')}>Services</button>
        </div>
      </form>

      {/* Loading */}
      {loading && (
        <div className="loading-container">
          <div className="spinner" />
          <p>Searching with AI...</p>
        </div>
      )}

      {/* Search Results */}
      {!loading && searched && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16, color: 'var(--cx-text-secondary)' }}>
            {totalResults} result{totalResults !== 1 ? 's' : ''} for "{searchParams.get('q')}"
          </h2>

          {totalResults === 0 ? (
            <div className="empty-state">
              <SearchIcon size={64} />
              <h3>No results found</h3>
              <p>Try different keywords or check your spelling</p>
            </div>
          ) : (
            <>
              {results.listings.length > 0 && (type === 'all' || type === 'listing') && (
                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PackageIcon size={20} /> Marketplace Items ({results.listings.length})
                  </h3>
                  <div className="card-grid">
                    {results.listings.map((listing) => (
                      <ListingCard key={listing._id} listing={listing} />
                    ))}
                  </div>
                </div>
              )}

              {results.services.length > 0 && (type === 'all' || type === 'service') && (
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BriefcaseIcon size={20} /> Services ({results.services.length})
                  </h3>
                  <div className="card-grid">
                    {results.services.map((service) => (
                      <ServiceCard key={service._id} service={service} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Recommendations (when no search) */}
      {!searched && !loading && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ZapIcon size={20} style={{ color: 'var(--cx-primary)' }} /> Recommended for You
          </h2>

          {recLoading ? (
            <div className="loading-container"><div className="spinner" /></div>
          ) : (
            <>
              {recommendations.listings.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12, color: 'var(--cx-text-secondary)' }}>
                    Marketplace Items
                  </h3>
                  <div className="card-grid">
                    {recommendations.listings.map((listing) => (
                      <ListingCard key={listing._id} listing={listing} />
                    ))}
                  </div>
                </div>
              )}

              {recommendations.services.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12, color: 'var(--cx-text-secondary)' }}>
                    Services
                  </h3>
                  <div className="card-grid">
                    {recommendations.services.map((service) => (
                      <ServiceCard key={service._id} service={service} />
                    ))}
                  </div>
                </div>
              )}

              {recommendations.listings.length === 0 && recommendations.services.length === 0 && (
                <div className="empty-state">
                  <ZapIcon size={64} />
                  <h3>No recommendations yet</h3>
                  <p>Start browsing to get personalized recommendations</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AISearch;
