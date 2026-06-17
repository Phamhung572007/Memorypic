let currentUser = null;
let conversations = [];
let activeConversation = null;
let activeFilter = 'all';
let userSearchTimer = null;

function requireLogin() {
  currentUser = DB.getCurrentUser();
  if (!currentUser || !APIService.getToken()) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadConversations() {
  const result = await APIService.getConversations();
  conversations = result.success && Array.isArray(result.data) ? result.data : [];
  renderConvList();
  const requestedId = new URLSearchParams(location.search).get('conversation');
  const requested = conversations.find((conversation) => String(conversation.id) === String(requestedId));
  if (requested) {
    openConv(requested);
  } else if (conversations.length) {
    openConv(conversations[0]);
  }
}

function getFilteredConversations() {
  if (activeFilter === 'unread') return conversations.filter((conversation) => conversation.unread > 0);
  if (activeFilter === 'empty') return conversations.filter((conversation) => !conversation.last_message);
  return conversations;
}

function renderConvList(listData = getFilteredConversations()) {
  const list = document.getElementById('convList');
  if (!list) return;

  list.innerHTML = '';
  if (!listData.length) {
    list.innerHTML = '<div class="no-conv"><i class="fas fa-comment-dots"></i><p>Chưa có cuộc trò chuyện</p><span>Nhắn tin sẽ xuất hiện tại đây</span></div>';
    return;
  }

  listData.forEach((conversation) => {
    const item = document.createElement('div');
    item.className = `conv-item${String(activeConversation?.id) === String(conversation.id) ? ' on' : ''}`;
    item.innerHTML = `
      <div class="ci-av">
        <img src="${escapeHtml(conversation.avatar_url || 'https://i.pravatar.cc/48?img=1')}" alt="">
        ${conversation.online ? '<div class="ci-online"></div>' : ''}
      </div>
      <div class="ci-body">
        <div class="ci-top">
          <span class="ci-name">${escapeHtml(conversation.name || 'User')}</span>
          <span class="ci-time">${escapeHtml(formatTime(conversation.last_message_at))}</span>
        </div>
        <div class="ci-msg">${escapeHtml(conversation.last_message || 'Chưa có tin nhắn')}</div>
      </div>
      ${conversation.unread ? `<div class="ci-unread">${conversation.unread}</div>` : ''}
    `;
    item.addEventListener('click', () => openConv(conversation));
    list.appendChild(item);
  });
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

async function openConv(conversation) {
  activeConversation = conversation;
  renderConvList();

  document.getElementById('chatAvatar').src = conversation.avatar_url || 'https://i.pravatar.cc/42?img=1';
  document.getElementById('chatName').textContent = conversation.name || 'User';
  document.getElementById('chatStatus').textContent = conversation.online ? 'Đang hoạt động' : 'Không hoạt động';
  document.getElementById('chatStatus').style.color = conversation.online ? '#22c55e' : '#aaa';

  const result = await APIService.getMessages(conversation.id);
  const messages = result.success && Array.isArray(result.data) ? result.data : [];
  renderMessages(messages);
}

function renderMessages(messages) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  container.innerHTML = '<div class="msg-day">Hôm nay</div>';
  messages.forEach((message) => renderMsg(message));
  container.scrollTop = container.scrollHeight;
}

function renderMsg(message) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const row = document.createElement('div');
  row.className = `msg-row${message.mine ? ' mine' : ''}`;

  const avatar = activeConversation?.avatar_url || 'https://i.pravatar.cc/32?img=1';
  const text = escapeHtml(message.text || message.message_text || '');
  const time = escapeHtml(formatTime(message.created_at));

  row.innerHTML = `
    ${message.mine ? '' : `<div class="msg-av"><img src="${escapeHtml(avatar)}" alt=""></div>`}
    <div>
      <div class="msg-bubble ${message.mine ? 'mine' : 'them'}">${text}</div>
      <div class="msg-time">${time}</div>
    </div>
  `;

  container.appendChild(row);
}

async function sendMsg() {
  const input = document.getElementById('chatInp');
  const text = input?.value.trim();
  if (!text || !activeConversation) return;

  input.value = '';
  const optimistic = {
    text,
    mine: true,
    created_at: new Date().toISOString()
  };
  renderMsg(optimistic);
  document.getElementById('chatMessages').scrollTop = 99999;

  const result = await APIService.sendMessage(activeConversation.id, {
    text,
    message_type: 'text'
  });

  if (!result.success) {
    alert(result.message || 'Không thể gửi tin nhắn');
    return;
  }

  activeConversation.last_message = text;
  activeConversation.last_message_at = optimistic.created_at;
  renderConvList();
}

function setupSearch() {
  const searchInput = document.querySelector('.conv-search input');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = getFilteredConversations().filter((conversation) => {
      return String(conversation.name || '').toLowerCase().includes(query);
    });
    renderConvList(filtered);
  });
}

async function loadUsers(query = '') {
  const result = await APIService.getUsers(query);
  const users = result.success ? result.data : [];
  const wrap = document.getElementById('userResults');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!users.length) {
    wrap.innerHTML = '<div class="no-conv">Không tìm thấy người dùng</div>';
    return;
  }

  users.forEach((user) => {
    const row = document.createElement('button');
    row.className = 'user-row';
    row.innerHTML = `
      <img src="${escapeHtml(user.avatar_url || 'https://i.pravatar.cc/48?img=1')}" alt="">
      <div>
        <strong>${escapeHtml(user.display_name || user.username)}</strong>
        <span>@${escapeHtml(user.username)}</span>
      </div>
    `;
    row.addEventListener('click', () => startConversation(user.id));
    wrap.appendChild(row);
  });
}

async function startConversation(userId) {
  const result = await APIService.createConversation(userId);
  if (!result.success) {
    alert(result.message || 'Không thể tạo cuộc trò chuyện');
    return;
  }

  const existing = conversations.find((conversation) => conversation.id === result.data.id);
  if (!existing) conversations.unshift(result.data);
  document.getElementById('newChatPanel')?.classList.remove('open');
  renderConvList();
  openConv(existing || result.data);
}

function setupConversationTabs() {
  document.querySelectorAll('.ctab[data-filter]').forEach((tab) => {
    tab.addEventListener('click', () => {
      activeFilter = tab.dataset.filter;
      document.querySelectorAll('.ctab').forEach((item) => item.classList.remove('on'));
      tab.classList.add('on');
      renderConvList();
    });
  });
}

function setupNewChat() {
  document.querySelector('[data-action="toggle-new-chat"]')?.addEventListener('click', () => {
    const panel = document.getElementById('newChatPanel');
    panel?.classList.toggle('open');
    if (panel?.classList.contains('open')) loadUsers();
  });

  document.getElementById('userSearch')?.addEventListener('input', (event) => {
    clearTimeout(userSearchTimer);
    userSearchTimer = setTimeout(() => loadUsers(event.target.value.trim()), 250);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!requireLogin()) return;
  setupSearch();
  setupConversationTabs();
  setupNewChat();
  document.querySelector('[data-action="send-message"]')?.addEventListener('click', sendMsg);
  document.getElementById('chatInp')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') sendMsg();
  });
  loadConversations();
});

window.sendMsg = sendMsg;
