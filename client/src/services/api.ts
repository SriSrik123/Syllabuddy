import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  firebaseGoogleLogin: (idToken: string) =>
    api.post('/auth/firebase-google', { idToken }),
};

// Syllabus
export const syllabusAPI = {
  upload: (file: File, className: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('className', className);
    return api.post('/syllabus/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: () => api.get('/syllabus'),
  get: (id: string) => api.get(`/syllabus/${id}`),
  delete: (id: string) => api.delete(`/syllabus/${id}`),
};

// AI Chat
export const aiAPI = {
  chat: (question: string, chatHistory: Array<{ role: string; content: string }> = []) =>
    api.post('/ai/chat', { question, chatHistory }),
  extractAssignments: (text: string) =>
    api.post('/ai/extract-assignments', { text }),
};

// Calendar
export const calendarAPI = {
  createEvent: (data: {
    title: string;
    className: string;
    date: string;
    time?: string;
    eventType?: string;
    description?: string;
    source?: string;
  }) => api.post('/calendar/events', data),
  createBulk: (events: Array<{
    title: string;
    className: string;
    date: string;
    time?: string;
    eventType?: string;
    description?: string;
    source?: string;
  }>) => api.post('/calendar/events/bulk', { events }),
  getEvents: (params?: { className?: string; upcoming?: boolean }) =>
    api.get('/calendar/events', { params: { ...params, upcoming: params?.upcoming?.toString() } }),
  getEventsBySyllabus: (syllabusId: string) =>
    api.get(`/calendar/events/by-syllabus/${syllabusId}`),
  exportICS: (className?: string) =>
    api.get('/calendar/export/ics', {
      params: className ? { className } : {},
      responseType: 'blob',
    }),
  getGoogleCalUrl: (eventId: string) =>
    api.get(`/calendar/google-url/${eventId}`),
  deleteEvent: (eventId: string) =>
    api.delete(`/calendar/events/${eventId}`),
  updateEventStatus: (eventId: string, status: 'todo' | 'in_progress' | 'done') =>
    api.patch(`/calendar/events/${eventId}/status`, { status }),

  // Google Calendar API
  googleStatus: () => api.get('/calendar/google/status'),
  googleConnect: () => api.get('/calendar/google/connect'),
  googleDisconnect: () => api.post('/calendar/google/disconnect'),
  googleAddEvent: (eventId: string) => api.post(`/calendar/google/add/${eventId}`),
  googleAddAll: (className?: string) => api.post('/calendar/google/add-all', { className }),
};

// Friends
export const friendsAPI = {
  list: () => api.get('/friends'),
  search: (q: string) => api.get('/friends/search', { params: { q } }),
  sendRequest: (data: { email?: string; userId?: string }) => api.post('/friends/request', data),
  getRequests: () => api.get('/friends/requests'),
  acceptRequest: (id: string) => api.post(`/friends/accept/${id}`),
  rejectRequest: (id: string) => api.post(`/friends/reject/${id}`),
  removeFriend: (id: string) => api.delete(`/friends/${id}`),
  getProgress: () => api.get('/friends/progress'),
  getClassOverlap: () => api.get('/friends/class-overlap'),
};

export default api;
