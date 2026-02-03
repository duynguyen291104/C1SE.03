import axios from 'axios';

// HARDCODED for debugging - will use this if env var fails
const HARDCODED_API_URL = 'http://localhost:5000/api';

// Ensure we always have a valid API URL
const API_URL = process.env.REACT_APP_API_URL || HARDCODED_API_URL;

// Validate and fix API URL if needed
const getValidApiUrl = (url) => {
  if (!url) return HARDCODED_API_URL;
  // If url doesn't start with http, it's invalid
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.error('❌ Invalid API URL:', url, '- Using hardcoded URL');
    return HARDCODED_API_URL;
  }
  return url;
};

const FINAL_API_URL = getValidApiUrl(API_URL);

console.log('🔌 FINAL API URL:', FINAL_API_URL);
console.log('🔌 REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
console.log('🔌 All env vars:', Object.keys(process.env).filter(k => k.startsWith('REACT_APP_')));

const api = axios.create({
  baseURL: FINAL_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor - attach access token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Try to refresh the token
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken } = response.data;
        localStorage.setItem('accessToken', accessToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
