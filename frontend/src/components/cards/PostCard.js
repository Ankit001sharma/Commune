import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ThumbsUpIcon, CommentIcon, EyeIcon, ClockIcon } from '../Icons';

const typeColors = {
  'announcement': 'badge-primary',
  'lost-found': 'badge-warning',
  'discussion': 'badge-info',
  'campus-update': 'badge-success',
  'question': 'badge-danger',
};

const typeLabels = {
  'announcement': 'Announcement',
  'lost-found': 'Lost & Found',
  'discussion': 'Discussion',
  'campus-update': 'Campus Update',
  'question': 'Question',
};

const PostCard = ({ post, onLike }) => {
  const navigate = useNavigate();

  const getInitials = (author) => {
    if (!author) return '??';
    return `${author.firstName?.[0] || ''}${author.lastName?.[0] || ''}`.toUpperCase();
  };

  const timeAgo = (dateStr) => {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="post-card" onClick={() => navigate(`/community/${post._id}`)} style={{ cursor: 'pointer' }}>
      <div className="post-header">
        <div className="post-avatar">{getInitials(post.author)}</div>
        <div>
          <div className="post-author">{post.author?.firstName} {post.author?.lastName}</div>
          <div className="post-time">
            <ClockIcon size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            {timeAgo(post.createdAt)}
          </div>
        </div>
        <span className={`post-type-badge badge ${typeColors[post.type] || 'badge-primary'}`}>
          {typeLabels[post.type] || post.type}
        </span>
      </div>

      <div className="post-title">{post.title}</div>
      <div className="post-content">
        {post.content?.length > 300 ? `${post.content.substring(0, 300)}...` : post.content}
      </div>

      {post.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {post.tags.map((tag, i) => <span key={i} className="tag">#{tag}</span>)}
        </div>
      )}

      <div className="post-actions">
        <button
          className={`post-action-btn ${post.isLiked ? 'liked' : ''}`}
          onClick={(e) => { e.stopPropagation(); onLike?.(post._id); }}
        >
          <ThumbsUpIcon size={18} />
          <span>{post.likes?.length || 0}</span>
        </button>
        <button className="post-action-btn">
          <CommentIcon size={18} />
          <span>{post.comments?.length || 0}</span>
        </button>
        <span className="post-action-btn" style={{ cursor: 'default' }}>
          <EyeIcon size={18} />
          <span>{post.views || 0}</span>
        </span>
      </div>
    </div>
  );
};

export default PostCard;
