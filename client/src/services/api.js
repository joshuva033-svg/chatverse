import axios from 'axios';

const defaultApiUrl = 'https://chatverse-w6fc.onrender.com';
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.API_URL || defaultApiUrl,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
