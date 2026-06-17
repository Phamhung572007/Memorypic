const API_BASE_URL = (() => {
  if (typeof window !== 'undefined' && window.location?.origin?.startsWith('http')) {
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:3000/api';
})();

class APIService {
  static getToken() {
    return localStorage.getItem('token');
  }

  static getCurrentUser() {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }

  static setSession(data) {
    if (data?.token) localStorage.setItem('token', data.token);
    if (data?.user) localStorage.setItem('user', JSON.stringify(data.user));
  }

  static logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('cache_currentUser');
  }

  static headers(json = false) {
    const headers = {};
    if (json) headers['Content-Type'] = 'application/json';
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  static async request(path, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, options);
      const data = await response.json().catch(() => ({}));
      if (!response.ok && data.success !== false) {
        return { success: false, message: data.message || `HTTP ${response.status}` };
      }
      return data;
    } catch (error) {
      console.error('API error:', error);
      return { success: false, message: 'Không thể kết nối backend' };
    }
  }

  static async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ email, password })
    });
    if (data.success) this.setSession(data);
    return data;
  }

  static async signup(userData) {
    const data = await this.request('/auth/signup', {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify(userData)
    });
    if (data.success) this.setSession(data);
    return data;
  }

  static getPins(page = 1, limit = 20, category = '') {
    const params = new URLSearchParams({ page, limit });
    if (category && category !== 'all') params.set('category', category);
    return this.request(`/pins?${params}`, { headers: this.headers() });
  }

  static getPinById(pinId) {
    return this.request(`/pins/${encodeURIComponent(pinId)}`, { headers: this.headers() });
  }

  static createPin(pinData) {
    return this.request('/pins', {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify(pinData)
    });
  }

  static updatePin(pinId, pinData) {
    return this.request(`/pins/${encodeURIComponent(pinId)}`, {
      method: 'PUT',
      headers: this.headers(true),
      body: JSON.stringify(pinData)
    });
  }

  static deletePin(pinId) {
    return this.request(`/pins/${encodeURIComponent(pinId)}`, {
      method: 'DELETE',
      headers: this.headers()
    });
  }

  static getBoards(userId = '') {
    const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    return this.request(`/boards${query}`, { headers: this.headers() });
  }

  static createBoard(boardData) {
    return this.request('/boards', {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify(boardData)
    });
  }

  static likePin(pinId) {
    return this.request(`/pins/${encodeURIComponent(pinId)}/like`, {
      method: 'POST',
      headers: this.headers()
    });
  }

  static savePin(pinId, boardId = null) {
    return this.request(`/pins/${encodeURIComponent(pinId)}/save`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ board_id: boardId })
    });
  }

  static getComments(pinId) {
    return this.request(`/pins/${encodeURIComponent(pinId)}/comments`);
  }

  static addComment(pinId, commentText) {
    return this.request(`/pins/${encodeURIComponent(pinId)}/comments`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ text: commentText })
    });
  }

  static getConversations() {
    return this.request('/messages/conversations', { headers: this.headers() });
  }

  static createConversation(userId) {
    return this.request('/messages/conversations', {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ user_id: userId })
    });
  }

  static getMessages(conversationId) {
    return this.request(`/messages/conversations/${encodeURIComponent(conversationId)}`, {
      headers: this.headers()
    });
  }

  static sendMessage(conversationId, messageData) {
    return this.request('/messages', {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ conversationId, ...messageData })
    });
  }

  static getNotifications() {
    return this.request('/notifications', { headers: this.headers() });
  }

  static markNotificationAsRead(notificationId) {
    return this.request(`/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PUT',
      headers: this.headers()
    });
  }

  static markAllNotificationsAsRead() {
    return this.request('/notifications/read-all', {
      method: 'PUT',
      headers: this.headers()
    });
  }

  static getUserProfile(userId) {
    return this.request(`/users/${encodeURIComponent(userId)}`, { headers: this.headers() });
  }

  static getUsers(query = '') {
    const suffix = query ? `?q=${encodeURIComponent(query)}` : '';
    return this.request(`/users${suffix}`, { headers: this.headers() });
  }

  static getUserPins(userId) {
    return this.request(`/users/${encodeURIComponent(userId)}/pins`, { headers: this.headers() });
  }

  static getUserSavedPins(userId) {
    return this.request(`/users/${encodeURIComponent(userId)}/saved`, { headers: this.headers() });
  }

  static getUserLikedPins(userId) {
    return this.request(`/users/${encodeURIComponent(userId)}/liked`, { headers: this.headers() });
  }

  static followUser(userId) {
    return this.request(`/users/${encodeURIComponent(userId)}/follow`, {
      method: 'POST',
      headers: this.headers()
    });
  }

  static updateProfile(userData) {
    return this.request('/users/profile', {
      method: 'PUT',
      headers: this.headers(true),
      body: JSON.stringify(userData)
    });
  }

  static searchPins(query) {
    return this.request(`/pins/search?q=${encodeURIComponent(query)}`, { headers: this.headers() });
  }

  static filterByCategory(categoryId) {
    return this.getPins(1, 50, categoryId);
  }
}

if (typeof window !== 'undefined') {
  window.APIService = APIService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = APIService;
}
