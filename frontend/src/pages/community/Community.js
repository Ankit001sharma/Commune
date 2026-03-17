import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { postAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PostCard from '../../components/cards/PostCard';
import { SearchIcon, PlusIcon, XIcon, UsersIcon } from '../../components/Icons';
import { toast } from '../../components/ui/Toast';

const POST_TYPES = [
  { value: '', label: 'All Posts' },
  { value: 'discussion', label: 'Discussion' },
  { value: 'question', label: 'Question' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'lost-found', label: 'Lost & Found' },
  { value: 'campus-update', label: 'Campus Update' },
];

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest First' },
  { value: 'createdAt', label: 'Oldest First' },
  { value: '-likes', label: 'Most Liked' },
  { value: '-views', label: 'Most Viewed' },
];

const Community = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [type, setType] = useState(searchParams.get('type') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || '-createdAt');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10, sort };
      if (search) params.search = search;
      if (type) params.type = type;
      const { data } = await postAPI.getAll(params);
      setPosts(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  }, [page, sort, search, type]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (type) params.type = type;
    if (sort !== '-createdAt') params.sort = sort;
    setSearchParams(params, { replace: true });
  }, [search, type, sort, setSearchParams]);

  const handleLike = async (postId) => {
    if (!isAuthenticated) return navigate('/login');
    try {
      await postAPI.toggleLike(postId);
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id !== postId) return p;
          const userId = JSON.parse(atob(localStorage.getItem('cx_token').split('.')[1])).id;
          const alreadyLiked = p.likes?.includes(userId);
          return {
            ...p,
            isLiked: !alreadyLiked,
            likes: alreadyLiked
              ? p.likes.filter((l) => l !== userId)
              : [...(p.likes || []), userId],
          };
        })
      );
    } catch (err) {
      toast.error('Failed to like post');
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchPosts();
  };

  const clearFilters = () => {
    setSearch('');
    setType('');
    setSort('-createdAt');
    setPage(1);
  };

  const hasActiveFilters = search || type || sort !== '-createdAt';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Community</h1>
          <p className="page-subtitle">
            {total} {total === 1 ? 'post' : 'posts'} in the community
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/community/create')}>
          <PlusIcon size={18} /> New Post
        </button>
      </div>

      {/* Type Tabs */}
      <div className="tabs">
        {POST_TYPES.map((t) => (
          <button
            key={t.value}
            className={`tab ${type === t.value ? 'active' : ''}`}
            onClick={() => { setType(t.value); setPage(1); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <form onSubmit={handleSearch} className="search-input-wrapper" style={{ flex: 1 }}>
          <SearchIcon size={18} className="search-input-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        <select className="form-select" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} style={{ width: 180 }}>
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button className="btn btn-ghost" onClick={clearFilters}>
            <XIcon size={16} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading community...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <UsersIcon size={64} />
          <h3>No posts yet</h3>
          <p>Be the first to start a conversation</p>
          <button className="btn btn-primary" onClick={() => navigate('/community/create')}>
            <PlusIcon size={18} /> Create Post
          </button>
        </div>
      ) : (
        <>
          <div className="post-list">
            {posts.map((post) => (
              <PostCard key={post._id} post={post} onLike={handleLike} />
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

export default Community;
