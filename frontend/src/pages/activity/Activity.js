import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../../services/api';
import { CommentIcon, ThumbsUpIcon } from '../../components/Icons';

const Activity = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('like');
  const [likes, setLikes] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const tabParam = useMemo(() => (activeTab === 'like' ? 'likes' : 'comments'), [activeTab]);

  useEffect(() => {
    const fetchActivity = async () => {
      setLoading(true);
      try {
        const res = await userAPI.getActivity({ type: tabParam });
        const data = res?.data?.data || {};
        setLikes(Array.isArray(data.likes) ? data.likes : []);
        setComments(Array.isArray(data.comments) ? data.comments : []);
      } catch (err) {
        console.error('Failed to load activity:', err);
        setLikes([]);
        setComments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [tabParam]);

  const list = activeTab === 'like' ? likes : comments;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Your Activities</h1>
          <p className="page-subtitle">Track your likes and comments</p>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button
          className={`tab ${activeTab === 'like' ? 'active' : ''}`}
          onClick={() => setActiveTab('like')}
        >
          Likes ({likes.length})
        </button>
        <button
          className={`tab ${activeTab === 'comment' ? 'active' : ''}`}
          onClick={() => setActiveTab('comment')}
        >
          Comments ({comments.length})
        </button>
      </div>

      <div className="form-card">
        {loading ? (
          <p style={{ color: 'var(--cx-text-muted)' }}>Loading activity...</p>
        ) : list.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            {activeTab === 'like' ? <ThumbsUpIcon size={48} /> : <CommentIcon size={48} />}
            <h3 style={{ marginTop: 10 }}>
              No {activeTab === 'like' ? 'likes' : 'comments'} yet
            </h3>
            <p>Activity will appear here once you engage with posts.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map((entry) => (
              <div
                key={`${entry.type}-${entry.post?._id}-${entry.comment?._id || entry.createdAt}`}
                onClick={() => entry.post?._id && navigate(`/community/${entry.post._id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 12,
                  border: '1px solid var(--cx-border)',
                  borderRadius: 10,
                  background: 'var(--cx-bg)',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: entry.type === 'like' ? 'var(--cx-primary)' : 'var(--cx-accent)',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {entry.type === 'like' ? <ThumbsUpIcon size={15} /> : <CommentIcon size={15} />}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {entry.type === 'like' ? 'Liked a post' : 'Commented on a post'}
                  </div>
                  <div style={{ color: 'var(--cx-text-secondary)', fontSize: '0.88rem' }}>
                    {entry.post?.title || 'Untitled post'}
                  </div>
                  {entry.type === 'comment' && entry.comment?.content && (
                    <div
                      style={{
                        marginTop: 4,
                        color: 'var(--cx-text-muted)',
                        fontSize: '0.82rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {entry.comment.content}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Activity;
