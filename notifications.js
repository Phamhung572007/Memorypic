let notifications = [];

const ICON_MAP = {
  like: 'fa-heart',
  follow: 'fa-user-plus',
  comment: 'fa-comment',
  save: 'fa-bookmark',
  system: 'fa-bell'
};

function requireLogin() {
  if (!DB.getCurrentUser() || !APIService.getToken()) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

async function loadNotifications() {
  const result = await APIService.getNotifications();
  notifications = result.success && Array.isArray(result.data) ? result.data : [];
  render();
}

function render() {
  const main = document.getElementById('mainContent');
  if (!main) return;

  main.innerHTML = '';
  if (!notifications.length) {
    main.innerHTML = '<div class="notif-section"><div class="notif-item"><div class="ni-body"><div class="ni-text">Chưa có thông báo</div><div class="ni-time">Các tương tác mới sẽ hiển thị ở đây</div></div></div></div>';
    return;
  }

  const groups = {
    'Mới nhất': notifications.filter((item) => item.unread || item.is_read === false),
    'Trước đây': notifications.filter((item) => !(item.unread || item.is_read === false))
  };

  Object.entries(groups).forEach(([label, items]) => {
    if (!items.length) return;

    const section = document.createElement('div');
    section.className = 'notif-section';
    section.innerHTML = `<div class="notif-label">${label}</div>`;

    items.forEach((notification) => {
      section.appendChild(buildNotification(notification));
    });

    main.appendChild(section);
  });
}

function buildNotification(notification) {
  const item = document.createElement('div');
  const unread = notification.unread || notification.is_read === false;
  const type = notification.type || 'system';
  item.className = `notif-item${unread ? ' unread' : ''}`;

  const avatar = notification.avatar_url
    ? `<div class="ni-av"><img src="${notification.avatar_url}" alt=""><div class="ni-icon ${type}"><i class="fas ${ICON_MAP[type] || ICON_MAP.system}"></i></div></div>`
    : `<div class="ni-av"><div class="ni-icon system"><i class="fas fa-bell"></i></div></div>`;
  const thumb = notification.pin_image
    ? `<img class="ni-thumb" src="${notification.pin_image}" alt="">`
    : '';

  item.innerHTML = `
    ${avatar}
    <div class="ni-body">
      <div class="ni-text">${notification.text || 'Thông báo mới'}</div>
      <div class="ni-time">${formatTime(notification.created_at)}</div>
    </div>
    ${thumb}
  `;

  item.addEventListener('click', () => markAsRead(notification.id));
  return item;
}

async function markAsRead(notificationId) {
  const notification = notifications.find((item) => item.id === notificationId);
  if (!notification || notification.is_read) return;

  notification.is_read = true;
  notification.unread = false;
  render();
  await APIService.markNotificationAsRead(notificationId);
}

async function markAllRead() {
  const unread = notifications.filter((item) => item.unread || item.is_read === false);
  unread.forEach((item) => {
    item.unread = false;
    item.is_read = true;
  });
  render();
  await APIService.markAllNotificationsAsRead();
}

document.addEventListener('DOMContentLoaded', () => {
  if (!requireLogin()) return;
  document.querySelector('[data-action="mark-all-read"]')?.addEventListener('click', markAllRead);
  loadNotifications();
});

window.markAllRead = markAllRead;
