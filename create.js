const DEMO_IMGS = [
  'photo-1555041469-a586c61ea9bc',
  'photo-1506905925346-21bda4d32df4',
  'photo-1569718212165-3a8278d5f624',
  'photo-1528360983277-13d401cdc186',
  'photo-1514888286974-6c03e2ca1dba',
  'photo-1499002238440-d264edd596ec'
];

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
const MAX_DRAFT_IMAGE_LENGTH = 2 * 1024 * 1024;
const DRAFT_KEY_PREFIX = 'memorypic:create:draft:';

let demoIdx = 0;
let tags = [];
let currentUser = null;
let boards = [];
let currentMode = 'pin';
let toastTimer = null;

const PIN_CATEGORIES = new Set([
  'interior',
  'nature',
  'food',
  'travel',
  'fashion',
  'pets',
  'art',
  'fitness'
]);

function requireLogin() {
  currentUser = DB.getCurrentUser();
  if (!currentUser || !APIService.getToken()) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

function getDraftKey() {
  return `${DRAFT_KEY_PREFIX}${currentUser?.id || 'guest'}`;
}

function showToast(message, type = 'ok') {
  const toast = document.getElementById('formToast');
  if (!toast) return;

  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle('error', type === 'error');
  toast.classList.add('show');
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

async function loadBoards() {
  const selectedBoard = document.getElementById('pinBoard')?.value || '';
  const result = await APIService.getBoards(currentUser.id);
  boards = result.success && Array.isArray(result.data) ? result.data : [];
  updateBoardSelect(selectedBoard);
}

function updateBoardSelect(selectedBoard = '') {
  const select = document.getElementById('pinBoard');
  if (!select) return;

  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Chọn một bảng';
  select.appendChild(placeholder);

  boards.forEach((board) => {
    const option = document.createElement('option');
    option.value = board.id;
    option.textContent = board.name;
    select.appendChild(option);
  });

  const createOption = document.createElement('option');
  createOption.value = '__new__';
  createOption.textContent = '+ Tạo bảng mới';
  select.appendChild(createOption);

  if ([...select.options].some((option) => option.value === selectedBoard)) {
    select.value = selectedBoard;
  }
}

function useDemo(event) {
  event?.stopPropagation?.();
  const id = DEMO_IMGS[demoIdx++ % DEMO_IMGS.length];
  setPreviewImage(`https://images.unsplash.com/${id}?auto=format&fit=crop&w=720&h=960&q=85`);
}

function chooseImageUrl(event) {
  event?.stopPropagation?.();
  const url = prompt('Dán URL ảnh:');
  if (url) setPreviewImage(url.trim());
}

function triggerUpload(event) {
  event?.stopPropagation?.();
  document.getElementById('fileInput')?.click();
}

function getPreviewImage() {
  const zone = document.getElementById('uploadZone');
  const img = document.getElementById('previewImg');
  if (!zone?.classList.contains('has-img') || !img) return '';
  return img.src || '';
}

function setPreviewImage(src) {
  const img = document.getElementById('previewImg');
  const zone = document.getElementById('uploadZone');
  const content = document.getElementById('uploadContent');
  const cleanSrc = String(src || '').trim();
  if (!img || !zone || !cleanSrc) return;

  img.src = cleanSrc;
  img.style.display = 'block';
  img.classList.remove('is-hidden');
  zone.classList.add('has-img');
  content?.setAttribute('aria-hidden', 'true');
}

function handleFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Vui lòng chọn file ảnh', 'error');
    event.target.value = '';
    return;
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    showToast('Ảnh vượt quá 20MB', 'error');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (readerEvent) => setPreviewImage(readerEvent.target.result);
  reader.readAsDataURL(file);
}

function removeImg(event) {
  event?.stopPropagation?.();
  const img = document.getElementById('previewImg');
  const zone = document.getElementById('uploadZone');
  const content = document.getElementById('uploadContent');
  const fileInput = document.getElementById('fileInput');
  if (!img || !zone) return;

  img.removeAttribute('src');
  img.style.display = 'none';
  img.classList.add('is-hidden');
  zone.classList.remove('has-img');
  content?.removeAttribute('aria-hidden');
  if (fileInput) fileInput.value = '';
}

function bindTagInput(input) {
  if (!input) return;

  input.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ',') && event.target.value.trim()) {
      event.preventDefault();
      addTag(event.target.value.trim().replace(',', ''));
      event.target.value = '';
    }

    if (event.key === 'Backspace' && !event.target.value && tags.length) {
      removeTag(tags.length - 1);
    }
  });
}

function addTag(text) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return;
  if (tags.includes(normalized)) {
    showToast('Tag này đã tồn tại');
    return;
  }
  if (tags.length >= 10) {
    showToast('Tối đa 10 tag cho mỗi pin', 'error');
    return;
  }

  tags.push(normalized);
  renderTags();
}

function removeTag(index) {
  tags.splice(index, 1);
  renderTags();
}

function renderTags() {
  const wrap = document.getElementById('tagsWrap');
  if (!wrap) return;

  wrap.innerHTML = '';
  tags.forEach((tag, index) => {
    const item = document.createElement('div');
    item.className = 'tag';

    const label = document.createElement('span');
    label.textContent = tag;
    item.appendChild(label);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tag-del';
    button.setAttribute('aria-label', `Xóa tag ${tag}`);
    button.innerHTML = '<i class="fas fa-times"></i>';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      removeTag(index);
    });
    item.appendChild(button);

    wrap.appendChild(item);
  });

  const input = document.createElement('input');
  input.className = 'tag-input';
  input.id = 'tagInp';
  input.placeholder = tags.length ? 'Thêm tag...' : 'Tìm kiếm hoặc tạo thẻ...';
  bindTagInput(input);
  wrap.appendChild(input);
}

function updateCount(inputId, countId) {
  const input = document.getElementById(inputId);
  const counter = document.getElementById(countId);
  if (input && counter) counter.textContent = input.value.length;
}

function toggleAdvanced() {
  const toggle = document.getElementById('advToggle');
  const section = document.getElementById('advSection');
  if (!toggle || !section) return;

  const isOpen = section.classList.toggle('open');
  toggle.classList.toggle('open', isOpen);
  toggle.setAttribute('aria-expanded', String(isOpen));
}

function switchMode(mode, element) {
  currentMode = mode === 'board' ? 'board' : 'pin';
  const isBoard = currentMode === 'board';

  document.querySelectorAll('.htab').forEach((tab) => {
    const isCurrent = tab.dataset.mode === currentMode;
    tab.classList.toggle('on', isCurrent);
    tab.setAttribute('aria-selected', String(isCurrent));
  });

  element?.classList.add('on');
  document.getElementById('mainContent')?.classList.toggle('board-mode', isBoard);
  document.getElementById('uploadPanel')?.classList.toggle('is-hidden', isBoard);
  document.querySelectorAll('.pin-only').forEach((node) => {
    node.classList.toggle('is-hidden', isBoard);
  });

  const publishButton = document.querySelector('.btn-publish[data-action="publish-pin"]');
  const pageTitle = document.getElementById('pageTitle');
  const titleInput = document.getElementById('pinTitle');
  const descInput = document.getElementById('pinDesc');

  if (publishButton) publishButton.textContent = isBoard ? 'Tạo bảng' : 'Đăng';
  if (pageTitle) pageTitle.textContent = isBoard ? 'Tạo Bảng' : 'Tạo Ghim';
  if (titleInput) titleInput.placeholder = isBoard ? 'Tên bảng mới' : 'Thêm tiêu đề';
  if (descInput) {
    descInput.placeholder = isBoard
      ? 'Mô tả bảng để bạn dễ sắp xếp các pin sau này'
      : 'Thêm mô tả chi tiết để mọi người biết pin này giới thiệu về điều gì';
  }
}

function normalizeOptionalUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).href;
  } catch (_err) {
    return false;
  }
}

function getSwitchState(option, fallback = false) {
  const node = document.querySelector(`[data-option="${option}"]`);
  if (!node) return fallback;
  return node.classList.contains('on');
}

function setPublishLoading(isLoading, text) {
  const publishButton = document.querySelector('.btn-publish[data-action="publish-pin"]');
  if (!publishButton) return;

  publishButton.disabled = isLoading;
  publishButton.textContent = isLoading ? text : (currentMode === 'board' ? 'Tạo bảng' : 'Đăng');
}

function collectDraftData() {
  let imageUrl = getPreviewImage();
  let skippedLargeImage = false;
  if (imageUrl.startsWith('data:') && imageUrl.length > MAX_DRAFT_IMAGE_LENGTH) {
    imageUrl = '';
    skippedLargeImage = true;
  }

  return {
    mode: currentMode,
    title: document.getElementById('pinTitle')?.value || '',
    description: document.getElementById('pinDesc')?.value || '',
    linkUrl: document.getElementById('pinLink')?.value || '',
    category: document.getElementById('pinCategory')?.value || '',
    boardId: document.getElementById('pinBoard')?.value || '',
    tags,
    imageUrl,
    skippedLargeImage,
    savedAt: new Date().toISOString()
  };
}

function saveDraft() {
  if (!requireLogin()) return;

  const draft = collectDraftData();
  if (draft.boardId === '__new__') draft.boardId = '';

  try {
    localStorage.setItem(getDraftKey(), JSON.stringify(draft));
    showToast(draft.skippedLargeImage ? 'Đã lưu nháp, ảnh tải lên quá lớn nên không lưu kèm' : 'Đã lưu nháp');
  } catch (_err) {
    showToast('Không thể lưu nháp vì bộ nhớ trình duyệt đã đầy', 'error');
  }
}

function loadDraft() {
  const raw = localStorage.getItem(getDraftKey());
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== 'object') return;

    switchMode(draft.mode || 'pin', document.querySelector(`[data-mode="${draft.mode || 'pin'}"]`));

    const titleInput = document.getElementById('pinTitle');
    const descInput = document.getElementById('pinDesc');
    const linkInput = document.getElementById('pinLink');
    const categoryInput = document.getElementById('pinCategory');
    const boardInput = document.getElementById('pinBoard');

    if (titleInput) titleInput.value = draft.title || '';
    if (descInput) descInput.value = draft.description || '';
    if (linkInput) linkInput.value = draft.linkUrl || '';
    if (categoryInput) categoryInput.value = draft.category || '';
    if (boardInput && draft.boardId && [...boardInput.options].some((option) => option.value === draft.boardId)) {
      boardInput.value = draft.boardId;
    }
    if (draft.imageUrl) setPreviewImage(draft.imageUrl);

    tags = Array.isArray(draft.tags) ? draft.tags.slice(0, 10) : [];
    renderTags();
    updateCount('pinTitle', 'titleCount');
    updateCount('pinDesc', 'descCount');
  } catch (_err) {
    localStorage.removeItem(getDraftKey());
  }
}

function clearDraft() {
  localStorage.removeItem(getDraftKey());
}

async function publishPin() {
  if (!requireLogin()) return;
  if (currentMode === 'board') {
    await publishBoard();
    return;
  }

  const title = document.getElementById('pinTitle')?.value.trim();
  const description = document.getElementById('pinDesc')?.value.trim();
  const imageUrl = getPreviewImage();
  const category = document.getElementById('pinCategory')?.value || '';
  const selectedBoard = document.getElementById('pinBoard')?.value || '';
  const boardId = selectedBoard && selectedBoard !== '__new__' ? selectedBoard : null;
  const linkUrl = normalizeOptionalUrl(document.getElementById('pinLink')?.value);

  if (!title) {
    showToast('Vui lòng nhập tiêu đề', 'error');
    document.getElementById('pinTitle')?.focus();
    return;
  }

  if (!imageUrl) {
    showToast('Vui lòng chọn ảnh cho pin', 'error');
    return;
  }

  if (!PIN_CATEGORIES.has(category)) {
    showToast('Vui lòng chọn danh mục', 'error');
    document.getElementById('pinCategory')?.focus();
    return;
  }

  if (linkUrl === false) {
    showToast('Liên kết không hợp lệ', 'error');
    document.getElementById('pinLink')?.focus();
    return;
  }

  setPublishLoading(true, 'Đang đăng...');

  const result = await APIService.createPin({
    title,
    description,
    image_url: imageUrl,
    image_height: 560,
    category,
    board_id: boardId,
    link_url: linkUrl,
    tags,
    allow_comments: getSwitchState('allow-comments', true),
    is_hidden: getSwitchState('hide-search', false),
    source_credit: getSwitchState('source-credit', true) ? 'MemoryPic upload' : null
  });

  setPublishLoading(false);

  if (!result.success) {
    showToast(result.message || 'Không thể đăng pin', 'error');
    return;
  }

  clearDraft();
  showSuccessScreen();
}

async function publishBoard() {
  const name = document.getElementById('pinTitle')?.value.trim();
  const description = document.getElementById('pinDesc')?.value.trim();

  if (!name) {
    showToast('Vui lòng nhập tên bảng', 'error');
    document.getElementById('pinTitle')?.focus();
    return;
  }

  setPublishLoading(true, 'Đang tạo...');
  const result = await APIService.createBoard({ name, description });
  setPublishLoading(false);

  if (!result.success) {
    showToast(result.message || 'Không thể tạo bảng', 'error');
    return;
  }

  await loadBoards();
  clearDraft();
  showSuccessScreen();
}

function showSuccessScreen() {
  const title = document.querySelector('.success-title');
  const copy = document.querySelector('.success-copy');
  const primary = document.querySelector('.success-actions .btn-publish');
  const secondary = document.querySelector('.success-actions .btn-draft');
  const success = document.getElementById('successScreen');
  const main = document.getElementById('mainContent');

  if (title) title.textContent = currentMode === 'board' ? 'Đã tạo Bảng!' : 'Đã tạo Ghim!';
  if (copy) {
    copy.textContent = currentMode === 'board'
      ? 'Bảng mới đã sẵn sàng để bạn lưu và sắp xếp pin.'
      : 'Tuyệt vời! Pin của bạn hiện đã có mặt trên hệ thống và sẵn sàng chia sẻ nguồn cảm hứng.';
  }
  if (primary) primary.textContent = currentMode === 'board' ? 'Xem hồ sơ' : 'Xem hồ sơ';
  if (secondary) secondary.textContent = currentMode === 'board' ? 'Tạo bảng khác' : 'Tạo ghim khác';

  if (main) main.style.display = 'none';
  if (success) {
    success.style.display = 'flex';
    window.setTimeout(() => success.classList.add('show'), 40);
  }
}

function resetCreate() {
  const main = document.getElementById('mainContent');
  const success = document.getElementById('successScreen');
  const titleInput = document.getElementById('pinTitle');
  const descInput = document.getElementById('pinDesc');
  const linkInput = document.getElementById('pinLink');
  const boardInput = document.getElementById('pinBoard');
  const categoryInput = document.getElementById('pinCategory');

  success?.classList.remove('show');
  window.setTimeout(() => {
    if (success) success.style.display = 'none';
    if (main) main.style.display = 'flex';

    if (titleInput) titleInput.value = '';
    if (descInput) descInput.value = '';
    if (linkInput) linkInput.value = '';
    if (boardInput) boardInput.value = '';
    if (categoryInput) categoryInput.value = '';
    removeImg();
    tags = [];
    renderTags();
    updateCount('pinTitle', 'titleCount');
    updateCount('pinDesc', 'descCount');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 220);
}

function setupUploadZone() {
  const zone = document.getElementById('uploadZone');
  if (!zone) return;

  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      triggerUpload(event);
    }
  });

  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('drag');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));

  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('drag');
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile({ target: { files: [file], value: '' } });
  });
}

function setupActions() {
  document.addEventListener('click', (event) => {
    const actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) return;

    const action = actionTarget.dataset.action;
    if (action === 'publish-pin') publishPin();
    if (action === 'save-draft') saveDraft();
    if (action === 'trigger-upload') triggerUpload(event);
    if (action === 'choose-url') chooseImageUrl(event);
    if (action === 'use-demo') useDemo(event);
    if (action === 'remove-image') removeImg(event);
    if (action === 'focus-tags') document.getElementById('tagInp')?.focus();
    if (action === 'toggle-advanced') toggleAdvanced();
    if (action === 'toggle-switch') actionTarget.classList.toggle('on');
    if (action === 'reset-create') resetCreate();
  });

  document.querySelectorAll('[data-mode]').forEach((tab) => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode, tab));
  });

  document.querySelectorAll('[data-count-target]').forEach((input) => {
    input.addEventListener('input', () => updateCount(input.id, input.dataset.countTarget));
  });

  document.getElementById('fileInput')?.addEventListener('change', handleFile);
  document.getElementById('pinBoard')?.addEventListener('change', (event) => {
    if (event.target.value === '__new__') {
      event.target.value = '';
      switchMode('board', document.querySelector('[data-mode="board"]'));
      document.getElementById('pinTitle')?.focus();
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireLogin()) return;

  bindTagInput(document.getElementById('tagInp'));
  setupActions();
  setupUploadZone();
  await loadBoards();
  loadDraft();
});

window.useDemo = useDemo;
window.chooseImageUrl = chooseImageUrl;
window.triggerUpload = triggerUpload;
window.handleFile = handleFile;
window.removeImg = removeImg;
window.addTag = addTag;
window.removeTag = removeTag;
window.updateCount = updateCount;
window.toggleAdvanced = toggleAdvanced;
window.switchMode = switchMode;
window.publishPin = publishPin;
window.resetCreate = resetCreate;
