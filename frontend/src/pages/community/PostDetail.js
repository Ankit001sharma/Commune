import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { postAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  ThumbsUpIcon, CommentIcon, EyeIcon, ClockIcon, TagIcon,
  TrashIcon, ChevronRightIcon, SendIcon, EditIcon, HeartIcon, HeartFilledIcon,
} from '../../components/Icons';
import { toast } from '../../components/ui/Toast';

const typeColors = {
  announcement: 'badge-primary',
  'lost-found': 'badge-warning',
  discussion: 'badge-info',
  'campus-update': 'badge-success',
  question: 'badge-danger',
};

const typeLabels = {
  announcement: 'Announcement',
  'lost-found': 'Lost & Found',
  discussion: 'Discussion',
  'campus-update': 'Campus Update',
  question: 'Question',
};

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, toggleSavedItem, isItemSaved } = useAuth();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const { data } = await postAPI.getById(id);
        setPost(data.data);
      } catch (err) {
        toast.error('Post not found');
        navigate('/community');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id, navigate]);

  const isOwner = user?._id === post?.author?._id;

  const getInitials = (u) => {
    if (!u) return '??';
    return `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase();
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

  const handleLike = async () => {
    if (!isAuthenticated) return navigate('/login');
    try {
      const { data } = await postAPI.toggleLike(id);
      setPost((prev) => ({ ...prev, likes: data.data.likes }));
    } catch (err) {
      toast.error('Failed to like post');
    }
  };

  const handleSave = async () => {
    if (!isAuthenticated) return navigate('/login');
    try {
      await toggleSavedItem(id, 'post');
    } catch (err) {
      toast.error(err.message || 'Failed to update saved state');
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    if (!isAuthenticated) return navigate('/login');
    setCommenting(true);
    try {
      const { data } = await postAPI.addComment(id, { content: comment.trim() });
      setPost((prev) => ({ ...prev, comments: data.data.comments }));
      setComment('');
    } catch (err) {
      toast.error('Failed to add comment');
    } finally {
      setCommenting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      const { data } = await postAPI.deleteComment(id, commentId);
      setPost((prev) => ({ ...prev, comments: data.data.comments }));
      toast.success('Comment deleted');
    } catch (err) {
      toast.error('Failed to delete comment');
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    setDeleting(true);
    try {
      await postAPI.delete(id);
      toast.success('Post deleted');
      navigate('/community');
    } catch (err) {
      toast.error('Failed to delete post');
    } finally {
      setDeleting(false);
    }
  };

  const isLiked = user && post?.likes?.some((l) => (typeof l === 'string' ? l : l._id) === user._id);
  const isSaved = post ? isItemSaved(post._id, 'post') : false;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading post...</p>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/community">Community</Link>
        <ChevronRightIcon size={14} />
        <span>{typeLabels[post.type] || post.type}</span>
        <ChevronRightIcon size={14} />
        <span>{post.title}</span>
      </div>

      {/* Post Content */}
      <div className="form-card" style={{ marginBottom: 24 }}>
        <div className="post-header" style={{ marginBottom: 16 }}>
          <div className="post-avatar" style={{ width: 48, height: 48, fontSize: '1rem' }}>{getInitials(post.author)}</div>
          <div>
            <div className="post-author" style={{ fontSize: '1rem' }}>
              {post.author?.firstName} {post.author?.lastName}
            </div>
            <div className="post-time">
              <ClockIcon size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              {timeAgo(post.createdAt)}
              {post.author?.department && <span style={{ marginLeft: 8 }}>{post.author.department}</span>}
            </div>
          </div>
          <span className={`post-type-badge badge ${typeColors[post.type] || 'badge-primary'}`}>
            {typeLabels[post.type] || post.type}
          </span>
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 16, color: 'var(--cx-text)' }}>
          {post.title}
        </h1>

        <div style={{ fontSize: '0.95rem', lineHeight: 1.8, color: 'var(--cx-text-secondary)', whiteSpace: 'pre-wrap', marginBottom: 16 }}>
          {post.content}
        </div>

        {post.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {post.tags.map((tag, i) => (
              <span key={i} className="tag"><TagIcon size={12} /> #{tag}</span>
            ))}
          </div>
        )}

        {/* Post Actions */}
        <div className="post-actions" style={{ borderTop: '1px solid var(--cx-border)', paddingTop: 16 }}>
          <button className={`post-action-btn ${isLiked ? 'liked' : ''}`} onClick={handleLike}>
            <ThumbsUpIcon size={18} />
            <span>{post.likes?.length || 0} {post.likes?.length === 1 ? 'Like' : 'Likes'}</span>
          </button>
          <button className={`post-action-btn ${isSaved ? 'liked' : ''}`} onClick={handleSave}>
            {isSaved ? <HeartFilledIcon size={18} /> : <HeartIcon size={18} />}
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
          <span className="post-action-btn" style={{ cursor: 'default' }}>
            <CommentIcon size={18} />
            <span>{post.comments?.length || 0} Comments</span>
          </span>
          <span className="post-action-btn" style={{ cursor: 'default' }}>
            <EyeIcon size={18} />
            <span>{post.views || 0} Views</span>
          </span>
          {isOwner && (
            <>
              <button className="post-action-btn" onClick={() => navigate(`/community/edit/${post._id}`)}>
                <EditIcon size={18} />
                <span>Edit</span>
              </button>
              <button className="post-action-btn" onClick={handleDeletePost} disabled={deleting} style={{ color: 'var(--cx-danger)' }}>
                <TrashIcon size={18} />
                <span>{deleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Comments Section */}
      <div className="form-card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>
          Comments ({post.comments?.length || 0})
        </h3>

        {/* Comment Form */}
        {isAuthenticated ? (
          <form onSubmit={handleComment} style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <div className="post-avatar" style={{ flexShrink: 0 }}>{getInitials(user)}</div>
            <div style={{ flex: 1, display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Write a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
              />
              <button type="submit" className="btn btn-primary" disabled={commenting || !comment.trim()}>
                <SendIcon size={18} />
              </button>
            </div>
          </form>
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--cx-text-muted)', marginBottom: 16 }}>
            <Link to="/login" style={{ color: 'var(--cx-primary)' }}>Sign in</Link> to join the conversation
          </p>
        )}

        {/* Comments List */}
        {post.comments?.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <CommentIcon size={40} />
            <p>No comments yet. Be the first!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {post.comments?.map((c) => (
              <div key={c._id} style={{
                display: 'flex', gap: 12, padding: 12,
                borderRadius: 8, background: 'var(--cx-bg)',
              }}>
                <div className="post-avatar" style={{ flexShrink: 0 }}>{getInitials(c.user)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {c.user?.firstName} {c.user?.lastName}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--cx-text-muted)' }}>
                        {timeAgo(c.createdAt)}
                      </span>
                      {(user?._id === c.user?._id || isOwner) && (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '2px 6px', minHeight: 'auto' }}
                          onClick={() => handleDeleteComment(c._id)}
                        >
                          <TrashIcon size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--cx-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    {c.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PostDetail;
