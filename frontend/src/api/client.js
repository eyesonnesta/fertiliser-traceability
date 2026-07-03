// =====================================================================
// API client
// One axios instance for the whole app. It points at the backend and,
// before every request, attaches the logged-in user's JWT token (if any)
// so protected endpoints accept the call.
// =====================================================================

import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Runs before each request leaves the app.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
