const TOPICS = [
  { key: 'interior', label: 'Nội thất' },
  { key: 'travel', label: 'Du lịch' },
  { key: 'food', label: 'Ẩm thực' },
  { key: 'nature', label: 'Thiên nhiên' },
  { key: 'art', label: 'Nghệ thuật' },
  { key: 'fitness', label: 'Sức khỏe' }
];

let allPins = [];
let visiblePins = [];
let activeCategory = 'all';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function scorePin(pin) {
  return (pin.likes_count || 0) * 3 + (pin.saves_count || 0) * 2 + (pin.comments_count || 0);
}

function toast(message) {
  const node = document.getElementById('toast');
  node.textContent = message;
  node.classList.add('show');
  setTimeout(() => node.classList.remove('show'), 2000);
}

function updateAvatar() {
  const user = DB.getCurrentUser();
  const badge = document.getElementById('avatarBadge');
  if (!badge) return;
  const name = window.getCurrentUserDisplayName?.(user) || user?.display_name || user?.username || 'MemoryPic';
  badge.textContent = window.getCurrentUserAvatarText?.(user) || 'MP';
  badge.title = name;
}

function renderTopics() {
  const wrap = document.getElementById('topicBand');
  wrap.innerHTML = '';
  TOPICS.forEach((topic) => {
    const pin = allPins.find((item) => item.tags?.includes(topic.key)) || allPins[0];
    const card = document.createElement('button');
    card.className = 'topic-card';
    card.innerHTML = `
      <img src="${escapeHtml(pin?.image_url || 'https://picsum.photos/400/300')}" alt="">
      <span>${escapeHtml(topic.label)}</span>
    `;
    card.addEventListener('click', () => setCategory(topic.key));
    wrap.appendChild(card);
  });
}

function renderTabs() {
  const tabs = document.getElementById('categoryTabs');
  tabs.innerHTML = '';
  [{ key: 'all', label: 'Tất cả' }, ...TOPICS].forEach((topic) => {
    const button = document.createElement('button');
    button.className = topic.key === activeCategory ? 'on' : '';
    button.textContent = topic.label;
    button.addEventListener('click', () => setCategory(topic.key));
    tabs.appendChild(button);
  });
}

function renderFeatured() {
  const wrap = document.getElementById('featuredGrid');
  wrap.innerHTML = '';
  const featured = [...visiblePins].sort((a, b) => scorePin(b) - scorePin(a)).slice(0, 5);
  featured.forEach((pin) => {
    const card = document.createElement('button');
    card.className = 'feature-pin';
    card.innerHTML = `
      <img src="${escapeHtml(pin.image_url)}" alt="${escapeHtml(pin.title)}">
      <div class="feature-meta">
        <h3>${escapeHtml(pin.title)}</h3>
        <p>${pin.likes_count || 0} thích · ${pin.saves_count || 0} lưu · ${pin.comments_count || 0} bình luận</p>
      </div>
    `;
    card.addEventListener('click', () => location.href = `index.html?pin=${encodeURIComponent(pin.id)}`);
    wrap.appendChild(card);
  });
}

async function renderCreators() {
  const wrap = document.getElementById('creatorStrip');
  wrap.innerHTML = '';

  if (!APIService.getToken()) {
    wrap.innerHTML = '<div class="empty">Đăng nhập để xem gợi ý creator và theo dõi.</div>';
    return;
  }

  const result = await APIService.getUsers();
  const users = result.success ? result.data.slice(0, 8) : [];
  users.forEach((user) => {
    const card = document.createElement('div');
    card.className = 'creator-card';
    card.innerHTML = `
      <img src="${escapeHtml(user.avatar_url)}" alt="">
      <div class="creator-info">
        <div class="creator-name">${escapeHtml(user.display_name || user.username)}</div>
        <div class="creator-handle">@${escapeHtml(user.username)} · ${user.pins_count || 0} pins</div>
      </div>
      <button>Theo dõi</button>
    `;
    card.querySelector('button').addEventListener('click', async () => {
      const follow = await APIService.followUser(user.id);
      toast(follow.success ? 'Đã theo dõi' : (follow.message || 'Không thể theo dõi'));
    });
    wrap.appendChild(card);
  });
}

function renderGrid() {
  const grid = document.getElementById('exploreGrid');
  const count = document.getElementById('resultCount');
  grid.innerHTML = '';
  count.textContent = `${visiblePins.length} pin`;

  if (!visiblePins.length) {
    grid.innerHTML = '<div class="empty">Không tìm thấy pin phù hợp.</div>';
    return;
  }

  visiblePins.forEach((pin) => {
    const card = document.createElement('div');
    card.className = 'pin-card';
    card.innerHTML = `
      <img src="${escapeHtml(pin.image_url)}" alt="${escapeHtml(pin.title)}">
      <div class="pin-overlay">
        <button class="save-btn">Lưu</button>
        <div class="pin-title">${escapeHtml(pin.title)}</div>
      </div>
    `;
    card.querySelector('.save-btn').addEventListener('click', async (event) => {
      event.stopPropagation();
      if (!APIService.getToken()) {
        toast('Bạn cần đăng nhập để lưu pin');
        return;
      }
      const boards = await APIService.getBoards(DB.getCurrentUser()?.id);
      const boardId = boards.success ? boards.data?.[0]?.id : null;
      const saved = await APIService.savePin(pin.id, boardId);
      toast(saved.success ? 'Đã lưu pin' : (saved.message || 'Không thể lưu'));
    });
    card.addEventListener('click', () => location.href = `index.html?pin=${encodeURIComponent(pin.id)}`);
    grid.appendChild(card);
  });
}

function applyFilters(query = '') {
  const q = query.trim().toLowerCase();
  visiblePins = allPins.filter((pin) => {
    const categoryMatch = activeCategory === 'all' || pin.tags?.includes(activeCategory);
    const searchMatch = !q || [pin.title, pin.description, pin.user?.display_name, pin.user?.username, ...(pin.tags || [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
    return categoryMatch && searchMatch;
  });
  renderTabs();
  renderFeatured();
  renderGrid();
}

function setCategory(category) {
  activeCategory = category;
  applyFilters(document.getElementById('exploreSearch').value);
}

async function loadExplore() {
  const result = await APIService.getPins(1, 100);
  allPins = result.success ? result.data : [];
  visiblePins = [...allPins];
  renderTopics();
  applyFilters();
  renderCreators();
}

document.addEventListener('DOMContentLoaded', () => {
  updateAvatar();
  loadExplore();
  document.getElementById('exploreSearch').addEventListener('input', (event) => {
    applyFilters(event.target.value);
  });
});
