const CATEGORIES = [
  { key: 'all', label: 'Tất cả' },
  { key: 'interior', label: 'Nội thất' },
  { key: 'nature', label: 'Thiên nhiên' },
  { key: 'food', label: 'Ẩm thực' },
  { key: 'travel', label: 'Du lịch' },
  { key: 'fashion', label: 'Thời trang' },
  { key: 'pets', label: 'Thú cưng' },
  { key: 'art', label: 'Nghệ thuật' },
  { key: 'fitness', label: 'Sức khỏe' }
];

let currentUser = DB.getCurrentUser();
let allPins = [];
let currentCategory = 'all';
let activePin = null;
let shareSearchTimer = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showToast(message = 'Đã lưu vào bộ sưu tập') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  toast.style.display = 'block';
  setTimeout(() => {
    toast.classList.remove('show');
    toast.style.display = '';
  }, 2200);
}

function closePinPopovers(exceptId = '') {
  ['sharePopover', 'morePopover', 'savePanel'].forEach((id) => {
    if (id !== exceptId) document.getElementById(id)?.classList.remove('open');
  });
}

function activePinUrl() {
  const pinId = activePin?.id || '';
  return `${location.origin}${location.pathname}?pin=${encodeURIComponent(pinId)}`;
}

function updateActiveLikeUI() {
  const liked = !!activePin?.isLiked;
  const count = activePin?.likes_count || 0;
  const top = document.getElementById('mLikeTop');
  const topIcon = top?.querySelector('i');
  const statIcon = document.querySelector('#mLikeBtn i');
  document.getElementById('mLikesTop').textContent = count;
  document.getElementById('mLikes').textContent = count;
  top?.classList.toggle('liked', liked);
  if (topIcon) topIcon.className = `${liked ? 'fas' : 'far'} fa-heart`;
  if (statIcon) statIcon.className = `${liked ? 'fas' : 'far'} fa-heart`;
}

function updateActiveSaveUI() {
  const button = document.querySelector('.m-save');
  if (!button) return;
  button.textContent = activePin?.isSaved ? 'Đã lưu' : 'Lưu';
  button.classList.toggle('saved', !!activePin?.isSaved);
}

function renderPills() {
  const wrap = document.getElementById('pills');
  if (!wrap) return;
  wrap.innerHTML = '';
  CATEGORIES.forEach((category) => {
    const button = document.createElement('button');
    button.className = `pill${category.key === currentCategory ? ' on' : ''}`;
    button.textContent = category.label;
    button.addEventListener('click', () => filterCat(category.key));
    wrap.appendChild(button);
  });
}

function updateUserChrome() {
  currentUser = DB.getCurrentUser();
  const display = window.getCurrentUserDisplayName?.(currentUser) ||
    currentUser?.display_name ||
    `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() ||
    currentUser?.username ||
    'MemoryPic';
  const avatarText = window.getCurrentUserAvatarText?.(currentUser) || display.trim().slice(0, 2) || 'MP';

  document.querySelectorAll('.side-avatar, .pd-av').forEach((node) => {
    node.textContent = avatarText;
    node.title = display;
  });

  const name = document.querySelector('.pd-name');
  const email = document.querySelector('.pd-email');
  if (name) name.textContent = display;
  if (email) email.textContent = currentUser?.email || '';
}

async function loadPins() {
  const grid = document.getElementById('grid');
  if (grid) {
    grid.innerHTML = '<div class="empty"><i class="fas fa-spinner fa-spin"></i><p>Đang tải pin...</p></div>';
  }

  const result = await APIService.getPins(1, 80, currentCategory);
  allPins = result.success && Array.isArray(result.data) ? result.data : [];
  renderMasonry();
  openPinFromUrl();
}

function renderMasonry(pins = allPins) {
  const grid = document.getElementById('grid');
  if (!grid) return;

  grid.innerHTML = '';

  if (!pins.length) {
    grid.innerHTML = '<div class="empty"><i class="fas fa-image"></i><p>Chưa có pin phù hợp</p></div>';
    return;
  }

  pins.forEach((pin) => grid.appendChild(buildCard(pin)));
}

function buildCard(pin) {
  const card = document.createElement('div');
  card.className = 'card';
  card.addEventListener('click', () => openModal(pin));

  const img = document.createElement('img');
  img.src = pin.image_url;
  img.alt = pin.title || 'Pin';
  img.loading = 'lazy';
  img.onerror = () => {
    img.src = `https://picsum.photos/seed/${encodeURIComponent(pin.id)}/500/650`;
  };

  const overlay = document.createElement('div');
  overlay.className = 'card-ov';

  const top = document.createElement('div');
  top.className = 'card-top';

  const boardButton = document.createElement('button');
  boardButton.className = 'board-btn';
  boardButton.innerHTML = '<i class="fas fa-bookmark"></i>';
  boardButton.title = 'Lưu vào bảng';
  boardButton.addEventListener('click', (event) => savePin(event, pin.id));

  const saveButton = document.createElement('button');
  saveButton.className = 'save-btn';
  saveButton.textContent = pin.isSaved ? 'Đã lưu' : 'Lưu';
  saveButton.addEventListener('click', (event) => savePin(event, pin.id));

  top.append(boardButton, saveButton);

  const bottom = document.createElement('div');
  bottom.className = 'card-bot';
  bottom.innerHTML = `
    <div class="card-tag">${escapeHtml(pin.tags?.[0] || pin.board?.name || 'MemoryPic')}</div>
    <div class="card-icons">
      <button class="cic" title="Thích"><i class="${pin.isLiked ? 'fas' : 'far'} fa-heart"></i></button>
      <button class="cic" title="Chia sẻ"><i class="fas fa-share"></i></button>
    </div>
  `;
  bottom.querySelector('.cic')?.addEventListener('click', (event) => {
    event.stopPropagation();
    likePin(pin.id);
  });

  overlay.append(top, bottom);
  card.append(img, overlay);
  return card;
}

function filterCat(category) {
  currentCategory = category;
  renderPills();

  const secHead = document.getElementById('secHead');
  if (category === 'all') {
    secHead.style.display = 'none';
  } else {
    const label = CATEGORIES.find((item) => item.key === category)?.label || category;
    document.getElementById('secTitle').textContent = label;
    secHead.style.display = 'flex';
  }

  loadPins().then(() => {
    if (category !== 'all') {
      document.getElementById('secCount').textContent = `${allPins.length} pins`;
    }
  });
}

function setupSearch() {
  const searchInput = document.getElementById('searchInp');
  if (!searchInput) return;

  let timer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    const query = searchInput.value.trim();
    timer = setTimeout(async () => {
      if (!query) {
        loadPins();
        return;
      }

      const result = await APIService.searchPins(query);
      const pins = result.success && Array.isArray(result.data) ? result.data : [];
      renderMasonry(pins);
    }, 250);
  });
}

function logout() {
  APIService.logout();
  DB.clear();
  location.href = 'login.html';
}

function openModal(pin) {
  activePin = pin;
  closePinPopovers();

  document.getElementById('mImg').src = pin.image_url;
  document.getElementById('mTitle').textContent = pin.title || 'Untitled';
  document.getElementById('mDesc').textContent = pin.description || '';
  document.getElementById('mBoard').textContent = 'Hồ sơ';
  document.getElementById('mUser').textContent = pin.user?.display_name || pin.user?.username || 'User';
  document.getElementById('mFollowers').textContent = `${pin.user?.followers_count || 0} người theo dõi`;
  document.getElementById('mAvatar').src = pin.user?.avatar_url || 'https://i.pravatar.cc/80?img=1';
  document.getElementById('mSource').textContent = pin.link_url || pin.source_credit || 'memorypic.vn';
  document.getElementById('mComments').textContent = pin.comments_count || 0;
  document.getElementById('mSaves').textContent = pin.saves_count || 0;

  document.getElementById('mLikeBtn').onclick = () => likePin(pin.id);
  updateActiveLikeUI();
  updateActiveSaveUI();
  loadShareUsers();
  loadSaveBoards();

  const input = document.querySelector('.cmt-input');
  const send = document.querySelector('.cmt-send');
  if (input && send) {
    input.value = '';
    send.onclick = () => addComment(pin.id);
    input.onkeydown = (event) => {
      if (event.key === 'Enter') addComment(pin.id);
    };
  }

  renderRelated(pin);
  loadComments(pin.id);

  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

async function openPinFromUrl() {
  const pinId = new URLSearchParams(location.search).get('pin');
  if (!pinId || activePin?.id === pinId) return;
  const existing = allPins.find((pin) => pin.id === pinId);
  if (existing) {
    openModal(existing);
    return;
  }
  const result = await APIService.getPinById(pinId);
  if (result.success) openModal(result.data);
}

function togglePopover(id) {
  const node = document.getElementById(id);
  if (!node) return;
  const willOpen = !node.classList.contains('open');
  closePinPopovers(willOpen ? id : '');
  node.classList.toggle('open', willOpen);
}

async function loadShareUsers(query = '') {
  const wrap = document.getElementById('shareUsers');
  if (!wrap || !activePin) return;
  const result = await APIService.getUsers(query);
  const currentId = DB.getCurrentUser()?.id;
  const users = result.success && Array.isArray(result.data)
    ? result.data.filter((user) => user.id !== currentId).slice(0, 5)
    : [];

  if (!users.length) {
    wrap.innerHTML = '<div class="empty">Không tìm thấy người dùng</div>';
    return;
  }

  wrap.innerHTML = '';
  users.forEach((user) => {
    const row = document.createElement('button');
    row.className = 'share-user';
    row.innerHTML = `
      <img src="${escapeHtml(user.avatar_url || 'https://i.pravatar.cc/48?img=1')}" alt="">
      <div><strong>${escapeHtml(user.display_name || user.username)}</strong><span>@${escapeHtml(user.username || '')}</span></div>
      <span class="send-mini">Gửi</span>
    `;
    row.addEventListener('click', () => sendPinToUser(user.id));
    wrap.appendChild(row);
  });
}

async function sendPinToUser(userId) {
  if (!activePin) return;
  const conversation = await APIService.createConversation(userId);
  if (!conversation.success) {
    showToast(conversation.message || 'Không thể tạo cuộc trò chuyện');
    return;
  }

  const text = `${activePin.title || 'Pin MemoryPic'} ${activePinUrl()}`;
  const sent = await APIService.sendMessage(conversation.data.id, { text, message_type: 'pin' });
  showToast(sent.success ? 'Đã gửi pin' : (sent.message || 'Không thể gửi pin'));
  if (sent.success) closePinPopovers();
}

async function sharePin(target) {
  if (!activePin) return;
  const url = activePinUrl();
  const title = activePin.title || 'MemoryPic';

  if (target === 'copy') {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Đã sao chép liên kết');
    } catch (_err) {
      prompt('Sao chép liên kết:', url);
    }
    return;
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const links = {
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    messenger: `https://www.messenger.com/t/?link=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`
  };
  if (links[target]) window.open(links[target], '_blank', 'noopener,noreferrer');
}

async function loadSaveBoards(query = '') {
  const wrap = document.getElementById('saveBoardList');
  if (!wrap || !activePin) return;
  const current = DB.getCurrentUser();
  const result = await APIService.getBoards(current?.id);
  const boards = result.success && Array.isArray(result.data) ? result.data : [];
  const filtered = boards.filter((board) => String(board.name || '').toLowerCase().includes(query.toLowerCase()));

  wrap.innerHTML = '';
  const profileRow = document.createElement('button');
  profileRow.className = 'save-board-row';
  profileRow.innerHTML = '<i class="fas fa-clock-rotate-left"></i><div><strong>Hồ sơ</strong><span>Lưu nhanh vào mục đã lưu</span></div><span class="save-mini">Lưu</span>';
  profileRow.addEventListener('click', (event) => savePin(event, activePin.id, null));
  wrap.appendChild(profileRow);

  filtered.forEach((board) => {
    const row = document.createElement('button');
    row.className = 'save-board-row';
    row.innerHTML = `<i class="fas fa-folder"></i><div><strong>${escapeHtml(board.name)}</strong><span>${board.pins_count || 0} pin</span></div><span class="save-mini">Lưu</span>`;
    row.addEventListener('click', (event) => savePin(event, activePin.id, board.id));
    wrap.appendChild(row);
  });
}

async function createBoardFromPin() {
  const name = prompt('Tên bảng mới:');
  if (!name) return;
  const result = await APIService.createBoard({ name });
  if (!result.success) {
    showToast(result.message || 'Không thể tạo bảng');
    return;
  }
  await loadSaveBoards();
  showToast('Đã tạo bảng');
}

function handleMoreAction(action) {
  if (!activePin) return;
  if (action === 'download') {
    window.open(activePin.image_url, '_blank', 'noopener,noreferrer');
  } else if (action === 'report') {
    showToast('Đã ghi nhận báo cáo');
  } else if (action === 'similar-less') {
    showToast('Sẽ hiển thị ít pin tương tự hơn');
  } else {
    filterCat(activePin.tags?.[0] || 'all');
    closeModal();
  }
  closePinPopovers();
}

function openPinUserProfile() {
  const userId = activePin?.user?.id || activePin?.user_id;
  if (userId) location.href = `profile.html?id=${encodeURIComponent(userId)}`;
}

async function messagePinUser() {
  const userId = activePin?.user?.id || activePin?.user_id;
  if (!userId) return;
  if (userId === DB.getCurrentUser()?.id) {
    location.href = 'messages.html';
    return;
  }
  const result = await APIService.createConversation(userId);
  if (!result.success) {
    showToast(result.message || 'Không thể mở tin nhắn');
    return;
  }
  location.href = `messages.html?conversation=${encodeURIComponent(result.data.id)}`;
}

async function followPinUser() {
  const userId = activePin?.user?.id || activePin?.user_id;
  if (!userId || userId === DB.getCurrentUser()?.id) return;
  const result = await APIService.followUser(userId);
  showToast(result.success ? 'Đã theo dõi người dùng này' : (result.message || 'Không thể theo dõi'));
}

function renderRelated(pin) {
  const related = document.getElementById('mRel');
  if (!related) return;

  const currentTags = new Set(pin.tags || []);
  const pins = allPins
    .filter((item) => item.id !== pin.id && (item.tags || []).some((tag) => currentTags.has(tag)))
    .slice(0, 6);

  related.innerHTML = '';
  pins.forEach((item) => {
    const img = document.createElement('img');
    img.src = item.image_url;
    img.alt = item.title || 'Related pin';
    img.addEventListener('click', () => openModal(item));
    related.appendChild(img);
  });
}

function closeModal() {
  document.getElementById('modal')?.classList.remove('open');
  document.body.style.overflow = '';
}

function closeModalBg(event) {
  if (event.target === document.getElementById('modal')) closeModal();
}

async function loadComments(pinId) {
  const result = await APIService.getComments(pinId);
  const comments = result.success && Array.isArray(result.data) ? result.data : [];
  const container = document.getElementById('mCmts');
  if (!container) return;

  container.innerHTML = comments.map((comment) => `
    <div class="cmt">
      <div class="cmt-av"><img src="${escapeHtml(comment.user?.avatar_url || 'https://i.pravatar.cc/40?img=1')}" alt=""></div>
      <div class="cmt-bubble">
        <div class="cmt-name">${escapeHtml(comment.user?.display_name || comment.user?.username || 'User')}</div>
        ${escapeHtml(comment.text || comment.comment_text || '')}
      </div>
    </div>
  `).join('');
}

async function addComment(pinId) {
  if (!APIService.getToken()) {
    showToast('Bạn cần đăng nhập để bình luận');
    return;
  }

  const input = document.querySelector('.cmt-input');
  const text = input?.value.trim();
  if (!text) return;

  const result = await APIService.addComment(pinId, text);
  if (!result.success) {
    showToast(result.message || 'Không thể thêm bình luận');
    return;
  }

  input.value = '';
  const pin = allPins.find((item) => item.id === pinId);
  if (pin) pin.comments_count = (pin.comments_count || 0) + 1;
  if (activePin?.id === pinId) {
    document.getElementById('mComments').textContent = pin?.comments_count || Number(document.getElementById('mComments').textContent || 0) + 1;
  }
  await loadComments(pinId);
}

async function likePin(pinId) {
  if (!APIService.getToken()) {
    showToast('Bạn cần đăng nhập để thích pin');
    return;
  }

  const result = await APIService.likePin(pinId);
  if (!result.success) {
    showToast(result.message || 'Không thể thích pin');
    return;
  }

  const pin = allPins.find((item) => item.id === pinId);
  if (pin) {
    pin.isLiked = true;
    pin.likes_count = result.likes_count ?? pin.likes_count;
  }

  if (activePin?.id === pinId) {
    activePin.isLiked = true;
    activePin.likes_count = result.likes_count ?? activePin.likes_count ?? 0;
    updateActiveLikeUI();
  }
}

async function savePin(event, pinId, boardId = undefined) {
  event?.stopPropagation?.();

  if (!APIService.getToken()) {
    showToast('Bạn cần đăng nhập để lưu pin');
    return;
  }

  const result = await APIService.savePin(pinId, boardId === undefined ? null : boardId);

  if (!result.success) {
    showToast(result.message || 'Không thể lưu pin');
    return;
  }

  const pin = allPins.find((item) => item.id === pinId);
  if (pin) {
    pin.isSaved = true;
    pin.saves_count = result.saves_count ?? pin.saves_count;
  }
  if (activePin?.id === pinId) {
    activePin.isSaved = true;
    activePin.saves_count = result.saves_count ?? activePin.saves_count ?? 0;
    document.getElementById('mSaves').textContent = activePin.saves_count;
    updateActiveSaveUI();
  }
  closePinPopovers();
  showToast('Đã lưu vào hồ sơ của bạn');
}

document.addEventListener('DOMContentLoaded', () => {
  renderPills();
  updateUserChrome();
  setupSearch();
  loadPins();

  document.addEventListener('click', (event) => {
    const categoryTarget = event.target.closest('[data-category]');
    if (categoryTarget) {
      event.preventDefault();
      filterCat(categoryTarget.dataset.category);
      return;
    }

    const actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) return;

    const action = actionTarget.dataset.action;
    if (action === 'logout') logout();
    if (action === 'close-modal') closeModal();
    if (action === 'save-active-pin' && activePin) savePin(event, activePin.id);
    if (action === 'like-active-pin' && activePin) likePin(activePin.id);
    if (action === 'focus-comment') document.querySelector('.cmt-input')?.focus();
    if (action === 'toggle-share') togglePopover('sharePopover');
    if (action === 'toggle-more') togglePopover('morePopover');
    if (action === 'toggle-save-panel') togglePopover('savePanel');
    if (action === 'create-board-from-pin') createBoardFromPin();
    if (action === 'open-pin-user') openPinUserProfile();
    if (action === 'message-pin-user') messagePinUser();
    if (action === 'follow-pin-user') followPinUser();
  });

  document.addEventListener('click', (event) => {
    const shareTarget = event.target.closest('[data-share]');
    if (shareTarget) {
      event.preventDefault();
      sharePin(shareTarget.dataset.share);
      return;
    }

    const moreTarget = event.target.closest('[data-more]');
    if (moreTarget) {
      event.preventDefault();
      handleMoreAction(moreTarget.dataset.more);
      return;
    }

    if (!event.target.closest('.pin-pop') && !event.target.closest('.m-topbar') && !event.target.closest('.board-sel')) {
      closePinPopovers();
    }
  });

  document.getElementById('shareUserSearch')?.addEventListener('input', (event) => {
    clearTimeout(shareSearchTimer);
    shareSearchTimer = setTimeout(() => loadShareUsers(event.target.value.trim()), 250);
  });

  document.getElementById('boardSearch')?.addEventListener('input', (event) => {
    loadSaveBoards(event.target.value.trim());
  });

  document.getElementById('notifBtn')?.addEventListener('click', (event) => {
    event.preventDefault();
    location.href = 'notifications.html';
  });

  document.getElementById('modal')?.addEventListener('click', closeModalBg);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
});

window.filterCat = filterCat;
window.logout = logout;
window.openModal = openModal;
window.closeModal = closeModal;
window.closeModalBg = closeModalBg;
window.showToast = showToast;
window.likePin = likePin;
window.savePin = savePin;
