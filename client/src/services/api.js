import axios from 'axios';

const host = window.location.hostname;
const defaultApiUrl = host.includes('vercel.app')
  ? 'https://chatverse-w6fc.onrender.com'
  : `${window.location.protocol}//${host}:5001`;
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultApiUrl,
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
