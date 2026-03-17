import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor – attach JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cx_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor – handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('cx_refresh_token');
        if (refreshToken) {
          const { data } = await axios.post(`${API_BASE}/auth/refresh-token`, { refreshToken });
          localStorage.setItem('cx_token', data.data.token);
          localStorage.setItem('cx_refresh_token', data.data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.data.token}`;
          return api(originalRequest);
        }
      } catch (_) {
        localStorage.removeItem('cx_token');
        localStorage.removeItem('cx_refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ===== Auth =====
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => {
    const config = data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    return api.put('/auth/me', data, config);
  },
  changePassword: (data) => api.put('/auth/change-password', data),
  toggleFavorite: (listingId) => api.put(`/auth/favorites/${listingId}`),
  getUserProfile: (id) => api.get(`/auth/profile/${id}`),
};

// ===== Listings =====
export const listingAPI = {
  getAll: (params) => api.get('/listings', { params }),
  getById: (id) => api.get(`/listings/${id}`),
  create: (data) => api.post('/listings', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => api.put(`/listings/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/listings/${id}`),
  getMy: () => api.get('/listings/my'),
  getByCategory: (cat) => api.get(`/listings/category/${cat}`),
};

// ===== Services =====
export const serviceAPI = {
  getAll: (params) => api.get('/services', { params }),
  getById: (id) => api.get(`/services/${id}`),
  create: (data) => api.post('/services', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => api.put(`/services/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/services/${id}`),
  getMy: () => api.get('/services/my'),
};

// ===== Community Posts =====
export const postAPI = {
  getAll: (params) => api.get('/posts', { params }),
  getById: (id) => api.get(`/posts/${id}`),
  create: (data) => api.post('/posts', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => api.put(`/posts/${id}`, data),
  delete: (id) => api.delete(`/posts/${id}`),
  addComment: (id, data) => api.post(`/posts/${id}/comments`, data),
  deleteComment: (id, commentId) => api.delete(`/posts/${id}/comments/${commentId}`),
  toggleLike: (id) => api.put(`/posts/${id}/like`),
};

// ===== Chat =====
export const chatAPI = {
  getConversations: () => api.get('/chat'),
  getConversation: (id) => api.get(`/chat/${id}`),
  createConversation: (data) => api.post('/chat', data),
  sendMessage: (id, data) => api.post(`/chat/${id}/messages`, data),
  getUnreadCount: () => api.get('/chat/unread'),
};

// ===== Transactions =====
export const transactionAPI = {
  getAll: () => api.get('/transactions'),
  getById: (id) => api.get(`/transactions/${id}`),
  initiate: (data) => api.post('/transactions', data),
  holdEscrow: (id) => api.put(`/transactions/${id}/escrow`),
  complete: (id) => api.put(`/transactions/${id}/complete`),
  cancel: (id) => api.put(`/transactions/${id}/cancel`),
};

// ===== AI =====
export const aiAPI = {
  getRecommendations: (params) => api.get('/ai/recommendations', { params }),
  search: (q, type) => api.get('/ai/search', { params: { q, type } }),
  chatbot: (message) => api.post('/ai/chatbot', { message }),
};

export default api;
