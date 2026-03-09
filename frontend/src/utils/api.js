import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies in requests
});

// Remove the request interceptor that adds Authorization header
// Since we're using HTTP-only cookies, the browser handles this automatically

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear any local auth state and redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Projects endpoints
export const projectAPI = {
  create: (projectData) => api.post('/projects', projectData),
  getAll: () => api.get('/projects'),
  getById: (id) => api.get(`/projects/${id}`),
  delete: (id) => api.delete(`/projects/${id}`),
};

// Services endpoints
export const serviceAPI = {
  getAll: () => api.get('/services'),
  deploy: (serviceData) => api.post('/services/deploy', serviceData),
  getById: (id) => api.get(`/services/${id}`),
  redeploy: (id) => api.post(`/services/${id}/redeploy`),
  delete: (id) => api.delete(`/services/${id}`),
  getLogs: (id) => api.get(`/services/${id}/logs`),
  setEnv: (id, envData) => api.post(`/services/${id}/env`, envData),
  deleteEnv: (id, key) => api.delete(`/services/${id}/env/${key}`),
  validateRepo: (repoUrl) => api.post('/services/validate-repo', { repo: repoUrl }),
};

export default api;
