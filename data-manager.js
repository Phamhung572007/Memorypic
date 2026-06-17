// ==========================================
// Local Data Management
// Handles localStorage and offline caching
// ==========================================

class DataManager {
  constructor() {
    this.cache = {};
    this.loadFromStorage();
  }

  // ========== STORAGE OPERATIONS ==========
  loadFromStorage() {
    const keys = ['currentUser', 'pins', 'boards', 'conversations', 'notifications'];
    keys.forEach(key => {
      const data = localStorage.getItem(`cache_${key}`);
      if (data) this.cache[key] = JSON.parse(data);
    });
  }

  saveToStorage(key, data) {
    localStorage.setItem(`cache_${key}`, JSON.stringify(data));
    this.cache[key] = data;
  }

  // ========== AUTHENTICATION ==========
  setCurrentUser(user) {
    this.saveToStorage('currentUser', user);
  }

  getCurrentUser() {
    return this.cache.currentUser || APIService.getCurrentUser();
  }

  isLoggedIn() {
    return !!this.getCurrentUser();
  }

  // ========== PINS MANAGEMENT ==========
  getAllPins() {
    return this.cache.pins || [];
  }

  setPins(pins) {
    this.saveToStorage('pins', pins);
  }

  addPin(pin) {
    const pins = this.getAllPins();
    pins.unshift({ ...pin, id: Date.now() });
    this.setPins(pins);
    return pin;
  }

  updatePin(pinId, updates) {
    const pins = this.getAllPins();
    const index = pins.findIndex(p => p.id === pinId);
    if (index > -1) {
      pins[index] = { ...pins[index], ...updates };
      this.setPins(pins);
      return pins[index];
    }
    return null;
  }

  deletePin(pinId) {
    const pins = this.getAllPins().filter(p => p.id !== pinId);
    this.setPins(pins);
  }

  getPinById(pinId) {
    return this.getAllPins().find(p => p.id === pinId);
  }

  searchPins(query) {
    const pins = this.getAllPins();
    return pins.filter(p => 
      p.title.toLowerCase().includes(query.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(query.toLowerCase())) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(query.toLowerCase())))
    );
  }

  // ========== BOARDS MANAGEMENT ==========
  getAllBoards() {
    return this.cache.boards || [];
  }

  setBoards(boards) {
    this.saveToStorage('boards', boards);
  }

  addBoard(board) {
    const boards = this.getAllBoards();
    boards.push({ ...board, id: Date.now(), pins_count: 0 });
    this.setBoards(boards);
    return board;
  }

  updateBoard(boardId, updates) {
    const boards = this.getAllBoards();
    const index = boards.findIndex(b => b.id === boardId);
    if (index > -1) {
      boards[index] = { ...boards[index], ...updates };
      this.setBoards(boards);
      return boards[index];
    }
    return null;
  }

  deleteBoard(boardId) {
    const boards = this.getAllBoards().filter(b => b.id !== boardId);
    this.setBoards(boards);
  }

  // ========== LIKES & SAVES ==========
  likePins(pinId) {
    const pin = this.getPinById(pinId);
    if (pin) {
      pin.likes_count = (pin.likes_count || 0) + 1;
      pin.isLiked = true;
      this.updatePin(pinId, pin);
    }
  }

  unlikePin(pinId) {
    const pin = this.getPinById(pinId);
    if (pin && pin.likes_count > 0) {
      pin.likes_count--;
      pin.isLiked = false;
      this.updatePin(pinId, pin);
    }
  }

  savePin(pinId, boardId) {
    const pin = this.getPinById(pinId);
    if (pin) {
      pin.saves_count = (pin.saves_count || 0) + 1;
      pin.isSaved = true;
      pin.saved_board_id = boardId;
      this.updatePin(pinId, pin);
    }
  }

  unsavePin(pinId) {
    const pin = this.getPinById(pinId);
    if (pin && pin.saves_count > 0) {
      pin.saves_count--;
      pin.isSaved = false;
      this.updatePin(pinId, pin);
    }
  }

  // ========== COMMENTS MANAGEMENT ==========
  getComments(pinId) {
    const pin = this.getPinById(pinId);
    return pin ? (pin.comments || []) : [];
  }

  addComment(pinId, commentText) {
    const pin = this.getPinById(pinId);
    if (pin) {
      if (!pin.comments) pin.comments = [];
      const comment = {
        id: Date.now(),
        user_id: this.getCurrentUser()?.id,
        user: this.getCurrentUser(),
        text: commentText,
        created_at: new Date().toISOString()
      };
      pin.comments.push(comment);
      pin.comments_count = pin.comments.length;
      this.updatePin(pinId, pin);
      return comment;
    }
    return null;
  }

  deleteComment(pinId, commentId) {
    const pin = this.getPinById(pinId);
    if (pin && pin.comments) {
      pin.comments = pin.comments.filter(c => c.id !== commentId);
      pin.comments_count = pin.comments.length;
      this.updatePin(pinId, pin);
    }
  }

  // ========== CONVERSATIONS MANAGEMENT ==========
  getConversations() {
    return this.cache.conversations || [];
  }

  setConversations(conversations) {
    this.saveToStorage('conversations', conversations);
  }

  addMessage(conversationId, message) {
    const conversations = this.getConversations();
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
      if (!conv.messages) conv.messages = [];
      message.id = Date.now();
      message.created_at = new Date().toISOString();
      conv.messages.push(message);
      conv.last_message = message.text || `[${message.type}]`;
      conv.last_message_at = new Date();
      this.setConversations(conversations);
      return message;
    }
    return null;
  }

  getMessages(conversationId) {
    const conversations = this.getConversations();
    const conv = conversations.find(c => c.id === conversationId);
    return conv ? (conv.messages || []) : [];
  }

  // ========== NOTIFICATIONS MANAGEMENT ==========
  getNotifications() {
    return this.cache.notifications || [];
  }

  setNotifications(notifications) {
    this.saveToStorage('notifications', notifications);
  }

  addNotification(notification) {
    const notifications = this.getNotifications();
    notifications.unshift({
      ...notification,
      id: Date.now(),
      is_read: false,
      created_at: new Date().toISOString()
    });
    this.setNotifications(notifications);
  }

  markNotificationAsRead(notificationId) {
    const notifications = this.getNotifications();
    const notif = notifications.find(n => n.id === notificationId);
    if (notif) {
      notif.is_read = true;
      this.setNotifications(notifications);
    }
  }

  getUnreadCount() {
    return this.getNotifications().filter(n => !n.is_read).length;
  }

  // ========== UTILITY METHODS ==========
  clear() {
    localStorage.removeItem('cache_currentUser');
    localStorage.removeItem('cache_pins');
    localStorage.removeItem('cache_boards');
    localStorage.removeItem('cache_conversations');
    localStorage.removeItem('cache_notifications');
    this.cache = {};
  }

  exportData() {
    return {
      pins: this.getAllPins(),
      boards: this.getAllBoards(),
      conversations: this.getConversations(),
      notifications: this.getNotifications()
    };
  }

  importData(data) {
    if (data.pins) this.setPins(data.pins);
    if (data.boards) this.setBoards(data.boards);
    if (data.conversations) this.setConversations(data.conversations);
    if (data.notifications) this.setNotifications(data.notifications);
  }
}

// Create global instance
const DB = new DataManager();

function getCurrentUserDisplayName(user) {
  if (!user) return 'MemoryPic';
  return user.display_name ||
    `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
    user.username ||
    user.email ||
    'MemoryPic';
}

function getCurrentUserAvatarText(user) {
  const displayName = getCurrentUserDisplayName(user).trim();
  if (!displayName) return 'MP';

  const words = displayName.split(/\s+/).filter(Boolean);
  const lastWord = words[words.length - 1] || displayName;

  if (lastWord.length <= 4) return lastWord;
  if (words.length > 1) {
    return `${words[0][0] || ''}${lastWord[0] || ''}`.toUpperCase();
  }

  return displayName.slice(0, 2).toUpperCase();
}

function formatCompactNumber(value) {
  const number = Number(value) || 0;
  if (number >= 1000000) return `${(number / 1000000).toFixed(1).replace('.0', '')}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1).replace('.0', '')}K`;
  return String(number);
}

function ensureAccountMenu() {
  if (document.getElementById('accountMenu')) return document.getElementById('accountMenu');

  const menu = document.createElement('div');
  menu.className = 'account-menu';
  menu.id = 'accountMenu';
  menu.setAttribute('aria-hidden', 'true');
  menu.innerHTML = `
    <div class="am-label">Đang dùng tài khoản</div>
    <a class="am-user" data-href="profile.html">
      <div class="am-avatar" id="amAvatar">
        <img id="amAvatarImg" alt="">
        <span id="amAvatarText">MP</span>
      </div>
      <div>
        <div class="am-name" id="amName">MemoryPic</div>
        <div class="am-email" id="amEmail"></div>
      </div>
    </a>
    <div class="am-stats">
      <div class="am-stat"><strong id="amPins">0</strong><span>Pin</span></div>
      <div class="am-stat"><strong id="amBoards">0</strong><span>Bảng</span></div>
      <div class="am-stat"><strong id="amFollowers">0</strong><span>Theo dõi</span></div>
    </div>
    <div class="am-sep"></div>
    <a class="am-item" data-href="profile.html"><i class="fas fa-user"></i><span>Trang cá nhân</span></a>
    <a class="am-item" data-href="create.html"><i class="fas fa-plus-circle"></i><span>Tạo pin mới</span></a>
    <a class="am-item" data-href="messages.html"><i class="fas fa-comment-dots"></i><span>Tin nhắn</span></a>
    <a class="am-item" data-href="notifications.html"><i class="fas fa-bell"></i><span>Thông báo</span></a>
    <div class="am-sep"></div>
    <button class="am-item" type="button" data-account-action="settings"><i class="fas fa-gear"></i><span>Cài đặt tài khoản</span></button>
    <button class="am-item danger" type="button" data-account-action="logout"><i class="fas fa-right-from-bracket"></i><span>Đăng xuất</span></button>
  `;
  document.body.appendChild(menu);
  return menu;
}

function closeAccountMenu() {
  const menu = document.getElementById('accountMenu');
  if (!menu) return;
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.side-avatar').forEach((node) => {
    node.setAttribute('aria-expanded', 'false');
  });
}

function toggleAccountMenu() {
  const menu = ensureAccountMenu();
  const isOpen = menu.classList.toggle('open');
  menu.setAttribute('aria-hidden', String(!isOpen));
  document.querySelectorAll('.side-avatar').forEach((node) => {
    node.setAttribute('aria-expanded', String(isOpen));
  });
  updateGlobalUserChrome();
}

function updateGlobalUserChrome() {
  ensureAccountMenu();
  const user = DB.getCurrentUser();
  const displayName = getCurrentUserDisplayName(user);
  const avatarText = getCurrentUserAvatarText(user);

  document.querySelectorAll('.side-avatar, .pd-av').forEach((node) => {
    node.textContent = avatarText;
    node.title = displayName;
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('aria-haspopup', 'menu');
  });

  document.querySelectorAll('.pd-name').forEach((node) => {
    node.textContent = displayName;
  });

  document.querySelectorAll('.pd-email').forEach((node) => {
    node.textContent = user?.email || '';
  });

  const accountAvatar = document.getElementById('amAvatar');
  const accountImage = document.getElementById('amAvatarImg');
  const accountAvatarText = document.getElementById('amAvatarText');
  const accountName = document.getElementById('amName');
  const accountEmail = document.getElementById('amEmail');

  if (accountAvatarText) accountAvatarText.textContent = avatarText;
  if (accountName) accountName.textContent = displayName;
  if (accountEmail) accountEmail.textContent = user?.email || user?.username || 'memorypic.vn';
  if (accountImage && accountAvatar) {
    if (user?.avatar_url) {
      accountImage.src = user.avatar_url;
      accountAvatar.classList.add('has-image');
    } else {
      accountImage.removeAttribute('src');
      accountAvatar.classList.remove('has-image');
    }
  }

  const pins = document.getElementById('amPins');
  const boards = document.getElementById('amBoards');
  const followers = document.getElementById('amFollowers');
  if (pins) pins.textContent = formatCompactNumber(user?.pins_count);
  if (boards) boards.textContent = formatCompactNumber(user?.boards_count);
  if (followers) followers.textContent = formatCompactNumber(user?.followers_count);
}

// Browser: attach to window
if (typeof window !== 'undefined') {
  window.DB = DB;
  window.updateGlobalUserChrome = updateGlobalUserChrome;
  window.getCurrentUserDisplayName = getCurrentUserDisplayName;
  window.getCurrentUserAvatarText = getCurrentUserAvatarText;

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-href]');
    if (!target) return;
    event.preventDefault();
    location.href = target.dataset.href;
  });

  document.addEventListener('click', (event) => {
    const avatar = event.target.closest('.side-avatar');
    const menu = event.target.closest('#accountMenu');
    const accountAction = event.target.closest('[data-account-action]');

    if (avatar) {
      event.preventDefault();
      event.stopPropagation();
      toggleAccountMenu();
      return;
    }

    if (accountAction?.dataset.accountAction === 'logout') {
      event.preventDefault();
      APIService.logout();
      DB.clear();
      location.href = 'login.html';
      return;
    }

    if (accountAction?.dataset.accountAction === 'settings') {
      event.preventDefault();
      location.href = 'profile.html';
      return;
    }

    if (!menu) closeAccountMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAccountMenu();
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && event.target.closest?.('.side-avatar')) {
      event.preventDefault();
      toggleAccountMenu();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateGlobalUserChrome);
  } else {
    updateGlobalUserChrome();
  }

  window.addEventListener('storage', updateGlobalUserChrome);
}

// Export for use (Node/CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataManager;
}

