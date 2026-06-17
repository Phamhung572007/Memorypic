let currentUser = null;
let profileUser = null;
let createdPins = [];
let savedPins = [];
let likedPins = [];
let userBoards = [];
let activeTab = 'pins';

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

function getProfileUserId() {
  const params = new URLSearchParams(location.search);
  return params.get('id') || currentUser.id;
}

async function loadProfile() {
  const userId = getProfileUserId();
  const profileResult = await APIService.getUserProfile(userId);
  if (!profileResult.success) {
    alert(profileResult.message || 'Không thể tải hồ sơ');
    location.href = 'index.html';
    return;
  }

  profileUser = profileResult.data;
  updateProfileHeader();
  await Promise.all([loadPins(), loadBoards()]);
  switchTab(activeTab, document.querySelector(`.tab[data-tab="${activeTab}"]`) || document.querySelector('.tab.on'));
}

function updateProfileHeader() {
  const displayName = profileUser.display_name || `${profileUser.first_name || ''} ${profileUser.last_name || ''}`.trim() || profileUser.username;

  document.querySelector('.cover-img').src = profileUser.cover_url || 'https://picsum.photos/1200/360?random=101';
  document.querySelector('.profile-av img').src = profileUser.avatar_url || 'https://i.pravatar.cc/96?img=1';
  document.querySelector('.profile-name').textContent = displayName;
  document.querySelector('.profile-handle').textContent = `@${profileUser.username} · memorypic.vn/${profileUser.username}`;
  window.updateGlobalUserChrome?.();
  document.getElementById('profileBio').textContent = profileUser.bio || 'Người dùng này chưa thêm giới thiệu.';
  document.getElementById('profileLocation').innerHTML = `<i class="fas fa-location-dot"></i> ${escapeHtml(profileUser.location || 'Chưa cập nhật vị trí')}`;
  document.getElementById('profileWebsite').innerHTML = `<i class="fas fa-link"></i> ${escapeHtml(profileUser.website || 'Chưa có website')}`;

  const stats = document.querySelectorAll('.pstat strong');
  if (stats[0]) stats[0].textContent = profileUser.pins_count ?? 0;
  if (stats[1]) stats[1].textContent = profileUser.boards_count ?? 0;
  if (stats[2]) stats[2].textContent = profileUser.followers_count ?? 0;
  if (stats[3]) stats[3].textContent = profileUser.following_count ?? 0;

  const editButton = document.querySelector('.btn-edit');
  const messageButton = document.querySelector('[data-action="message-profile"]');
  if (messageButton) {
    messageButton.classList.toggle('is-hidden', profileUser.id === currentUser.id);
  }

  if (editButton && profileUser.id !== currentUser.id) {
    editButton.innerHTML = '<i class="fas fa-user-plus"></i> Theo dõi';
    editButton.onclick = () => followUser(profileUser.id);
  } else if (editButton) {
    editButton.innerHTML = '<i class="fas fa-pen"></i> Chỉnh sửa';
    editButton.onclick = editProfile;
  }
}

async function loadPins() {
  const [createdResult, savedResult, likedResult] = await Promise.all([
    APIService.getUserPins(profileUser.id),
    APIService.getUserSavedPins(profileUser.id),
    APIService.getUserLikedPins(profileUser.id)
  ]);
  createdPins = createdResult.success && Array.isArray(createdResult.data) ? createdResult.data : [];
  savedPins = savedResult.success && Array.isArray(savedResult.data) ? savedResult.data : [];
  likedPins = likedResult.success && Array.isArray(likedResult.data) ? likedResult.data : [];
}

async function loadBoards() {
  const result = await APIService.getBoards(profileUser.id);
  userBoards = result.success && Array.isArray(result.data) ? result.data : [];
}

function renderPins(pins, containerId) {
  const grid = document.getElementById(containerId);
  if (!grid) return;

  grid.innerHTML = '';
  if (!pins.length) {
    grid.innerHTML = '<div style="break-inside:avoid;padding:40px 0;color:#888">Chưa có pin để hiển thị</div>';
    return;
  }

  pins.forEach((pin) => {
    const card = document.createElement('div');
    card.className = 'pin-card';
    card.innerHTML = `
      <img src="${escapeHtml(pin.image_url)}" alt="${escapeHtml(pin.title)}" loading="lazy" style="height:${Number(pin.image_height) || 520}px;object-fit:cover">
      <div class="pin-ov">
        <div class="pin-top"><button class="pin-save">Lưu</button></div>
        <div class="pin-bot">
          <div class="pin-title">${escapeHtml(pin.title)}</div>
          <button class="pin-del"><i class="fas fa-ellipsis-h"></i></button>
        </div>
      </div>
    `;
    card.querySelector('.pin-save')?.addEventListener('click', (event) => savePin(event, pin.id));
    grid.appendChild(card);
  });
}

function renderBoards() {
  const grid = document.getElementById('boardsGrid');
  if (!grid) return;

  grid.innerHTML = '';

  if (profileUser.id === currentUser.id) {
    const newButton = document.createElement('div');
    newButton.className = 'board-new';
    newButton.innerHTML = '<i class="fas fa-plus"></i><span style="font-size:14px;font-weight:600">Tạo bảng mới</span>';
    newButton.addEventListener('click', createNewBoard);
    grid.appendChild(newButton);
  }

  userBoards.forEach((board) => {
    const cover = board.cover_image || 'https://picsum.photos/seed/board/360/240';
    const card = document.createElement('div');
    card.className = 'board-card';
    card.innerHTML = `
      <div class="board-cover">
        <img src="${escapeHtml(cover)}" alt="">
        <img src="${escapeHtml(cover)}" alt="">
        <img src="${escapeHtml(cover)}" alt="">
      </div>
      <div class="board-info">
        <div class="board-name">${escapeHtml(board.name)}</div>
        <div class="board-count">${board.pins_count || 0} pins</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderCreatedTab() {
  const tab = document.getElementById('tab-created');
  if (!tab) return;
  tab.innerHTML = '<div class="masonry" id="createdGrid"></div>';
  renderPins(createdPins, 'createdGrid');
}

function switchTab(tab, element) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach((item) => item.classList.remove('on'));
  element?.classList.add('on');

  ['pins', 'boards', 'created', 'liked'].forEach((name) => {
    const node = document.getElementById(`tab-${name}`);
    if (node) node.style.display = name === tab ? 'block' : 'none';
  });

  if (tab === 'pins') renderPins(savedPins.length ? savedPins : createdPins, 'pinsGrid');
  if (tab === 'boards') renderBoards();
  if (tab === 'created') renderCreatedTab();
  if (tab === 'liked') renderPins(likedPins, 'likedGrid');
}

async function createNewBoard() {
  const name = prompt('Tên bảng mới:');
  if (!name) return;

  const result = await APIService.createBoard({ name });
  if (!result.success) {
    alert(result.message || 'Không thể tạo bảng');
    return;
  }

  await loadBoards();
  renderBoards();
}

async function followUser(userId) {
  const result = await APIService.followUser(userId);
  alert(result.success ? 'Đã theo dõi người dùng này' : (result.message || 'Không thể theo dõi'));
}

async function messageProfileUser() {
  if (!profileUser || profileUser.id === currentUser.id) {
    location.href = 'messages.html';
    return;
  }

  const result = await APIService.createConversation(profileUser.id);
  if (!result.success) {
    alert(result.message || 'Không thể mở tin nhắn');
    return;
  }
  location.href = `messages.html?conversation=${encodeURIComponent(result.data.id)}`;
}

async function editProfile() {
  if (profileUser.id !== currentUser.id) return;

  const bio = prompt('Giới thiệu ngắn:', profileUser.bio || '');
  if (bio === null) return;
  const location = prompt('Vị trí:', profileUser.location || '');
  if (location === null) return;
  const website = prompt('Website:', profileUser.website || '');
  if (website === null) return;

  const result = await APIService.updateProfile({ bio, location, website });
  if (!result.success) {
    alert(result.message || 'Không thể cập nhật hồ sơ');
    return;
  }

  profileUser = result.data;
  currentUser = result.data;
  localStorage.setItem('user', JSON.stringify(result.data));
  DB.setCurrentUser(result.data);
  updateProfileHeader();
}

async function savePin(event, pinId) {
  event?.stopPropagation?.();
  const boardId = userBoards[0]?.id || null;
  const result = await APIService.savePin(pinId, boardId);
  alert(result.success ? 'Đã lưu pin' : (result.message || 'Không thể lưu pin'));
}

document.addEventListener('DOMContentLoaded', () => {
  if (!requireLogin()) return;

  document.querySelectorAll('.tab').forEach((tab) => {
    const label = tab.textContent.trim().toLowerCase();
    if (label.includes('bảng')) tab.dataset.tab = 'boards';
    else if (label.includes('tạo')) tab.dataset.tab = 'created';
    else if (label.includes('thích')) tab.dataset.tab = 'liked';
    else tab.dataset.tab = 'pins';

    tab.addEventListener('click', () => switchTab(tab.dataset.tab, tab));
  });

  loadProfile();
  document.querySelector('[data-action="edit-profile"]')?.addEventListener('click', editProfile);
  document.querySelector('[data-action="message-profile"]')?.addEventListener('click', messageProfileUser);
});

window.switchTab = switchTab;
window.savePin = savePin;
window.messageProfileUser = messageProfileUser;
