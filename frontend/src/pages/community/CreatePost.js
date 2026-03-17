import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { postAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../components/ui/Toast';

const POST_TYPES = [
  { value: 'discussion', label: 'Discussion' },
  { value: 'question', label: 'Question' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'lost-found', label: 'Lost & Found' },
  { value: 'campus-update', label: 'Campus Update' },
];

const CreatePost = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const isEdit = !!id;

  const [form, setForm] = useState({
    title: '',
    content: '',
    type: 'discussion',
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
      const fetchPost = async () => {
        try {
          const { data } = await postAPI.getById(id);
          const p = data.data;
          setForm({
            title: p.title || '',
            content: p.content || '',
            type: p.type || 'discussion',
            tags: p.tags?.join(', ') || '',
          });
        } catch (err) {
          toast.error('Failed to load post');
          navigate('/community');
        } finally {
          setFetchLoading(false);
        }
      };
      fetchPost();
    }
  }, [id, isEdit, isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
      };
      if (form.tags.trim()) {
        payload.tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      }

      if (isEdit) {
        await postAPI.update(id, payload);
        toast.success('Post updated');
        navigate(`/community/${id}`);
      } else {
        const { data } = await postAPI.create(payload);
        toast.success('Post created');
        navigate(`/community/${data.data._id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} post`);
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
        <h1 className="page-title">{isEdit ? 'Edit Post' : 'Create New Post'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="form-card">
        <div className="form-group">
          <label className="form-label" htmlFor="type">Post Type</label>
          <select id="type" name="type" className="form-select" value={form.type} onChange={handleChange}>
            {POST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="title">Title *</label>
          <input
            id="title"
            name="title"
            type="text"
            className="form-input"
            placeholder="What's on your mind?"
            value={form.title}
            onChange={handleChange}
            required
            maxLength={200}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="content">Content *</label>
          <textarea
            id="content"
            name="content"
            className="form-textarea"
            placeholder="Write your post content here..."
            value={form.content}
            onChange={handleChange}
            required
            rows={8}
            maxLength={5000}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="tags">Tags (comma separated)</label>
          <input
            id="tags"
            name="tags"
            type="text"
            className="form-input"
            placeholder="e.g., campus-life, exam, hostel"
            value={form.tags}
            onChange={handleChange}
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update Post' : 'Publish Post'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePost;
