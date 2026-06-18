const DEMO_IMGS = [
  'photo-1555041469-a586c61ea9bc',
  'photo-1506905925346-21bda4d32df4',
  'photo-1569718212165-3a8278d5f624',
  'photo-1528360983277-13d401cdc186',
  'photo-1514888286974-6c03e2ca1dba',
  'photo-1499002238440-d264edd596ec'
];

let demoIdx = 0;
let tags = [];
let currentUser = null;
let boards = [];
let currentMode = 'pin';

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

async function loadBoards() {
  const result = await APIService.getBoards(currentUser.id);
  boards = result.success && Array.isArray(result.data) ? result.data : [];
  updateBoardSelect();
}

function updateBoardSelect() {
  const select = document.getElementById('pinBoard');
  if (!select) return;

  select.innerHTML = '<option value="">Chọn bảng hoặc tạo mới...</option>';
  boards.forEach((board) => {
    const option = document.createElement('option');
    option.value = board.id;
    option.textContent = board.name;
    select.appendChild(option);
  });
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

function triggerUpload() {
  document.getElementById('fileInput')?.click();
}

function setPreviewImage(src) {
  const img = document.getElementById('previewImg');
  if (!img) return;
  img.src = src;
  img.style.display = 'block';
  img.classList.remove('is-hidden');
  document.getElementById('uploadZone')?.classList.add('has-img');
}

function handleFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Vui lòng chọn file ảnh');
    return;
  }

  const reader = new FileReader();
  reader.onload = (readerEvent) => setPreviewImage(readerEvent.target.result);
  reader.readAsDataURL(file);
}

function removeImg(event) {
  event?.stopPropagation?.();
  const img = document.getElementById('previewImg');
  if (!img) return;
  img.src = '';
  img.style.display = 'none';
  img.classList.add('is-hidden');
  document.getElementById('uploadZone')?.classList.remove('has-img');
}

function bindTagInput(input) {
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
  if (!normalized || tags.includes(normalized) || tags.length >= 10) return;
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
    item.innerHTML = `${tag}<span class="tag-del" onclick="removeTag(${index})"><i class="fas fa-times"></i></span>`;
    wrap.appendChild(item);
  });

  const input = document.createElement('input');
  input.className = 'tag-input';
  input.id = 'tagInp';
  input.placeholder = 'Nhập tag rồi nhấn Enter...';
  bindTagInput(input);
  wrap.appendChild(input);
}

function updateCount(inputId, countId) {
  const input = document.getElementById(inputId);
  const counter = document.getElementById(countId);
  if (input && counter) counter.textContent = input.value.length;
}

function toggleAdvanced() {
  document.getElementById('advToggle')?.classList.toggle('open');
  document.getElementById('advSection')?.classList.toggle('open');
}

function switchMode(mode, element) {
  currentMode = mode;
  document.querySelectorAll('.htab').forEach((tab) => tab.classList.remove('on'));
  element?.classList.add('on');

  const publishButton = document.querySelector('.btn-publish');
  const titleInput = document.getElementById('pinTitle');
  const descInput = document.getElementById('pinDesc');
  const uploadPanel = document.querySelector('.upload-panel');
  const categoryGroup = document.querySelector('.category-group');
  const boardSelectGroup = document.getElementById('pinBoard')?.closest('.form-group');
  const tagsGroup = document.getElementById('tagsWrap')?.closest('.form-group');
  const advancedToggle = document.getElementById('advToggle');
  const advancedSection = document.getElementById('advSection');

  const isBoard = currentMode === 'board';
  if (publishButton) publishButton.textContent = isBoard ? 'Tạo bảng' : 'Đăng pin';
  if (titleInput) titleInput.placeholder = isBoard ? 'Tên bảng mới...' : 'Thêm tiêu đề hấp dẫn...';
  if (descInput) descInput.placeholder = isBoard ? 'Mô tả bảng...' : 'Kể câu chuyện đằng sau bức ảnh này...';
  uploadPanel?.classList.toggle('is-hidden', isBoard);
  categoryGroup?.classList.toggle('is-hidden', isBoard);
  boardSelectGroup?.classList.toggle('is-hidden', isBoard);
  tagsGroup?.classList.toggle('is-hidden', isBoard);
  advancedToggle?.classList.toggle('is-hidden', isBoard);
  advancedSection?.classList.toggle('is-hidden', isBoard);
}

async function publishPin() {
  if (!requireLogin()) return;
  if (currentMode === 'board') {
    await publishBoard();
    return;
  }

  const title = document.getElementById('pinTitle')?.value.trim();
  const description = document.getElementById('pinDesc')?.value.trim();
  const imageUrl = document.getElementById('previewImg')?.src || '';
  const category = document.getElementById('pinCategory')?.value || '';
  const boardId = document.getElementById('pinBoard')?.value || null;
  const linkUrl = document.querySelector('.url-input')?.value.trim() || null;
  const toggles = document.querySelectorAll('.toggle-row .toggle');
  const publishButton = document.querySelector('.btn-publish');

  if (!title || !imageUrl || !PIN_CATEGORIES.has(category)) {
    alert('Vui lòng nhập tiêu đề, chọn ảnh và chọn danh mục');
    return;
  }

  publishButton.disabled = true;
  publishButton.textContent = 'Đang đăng...';

  const result = await APIService.createPin({
    title,
    description,
    image_url: imageUrl,
    image_height: 560,
    category,
    board_id: boardId,
    link_url: linkUrl,
    tags,
    allow_comments: toggles[0]?.classList.contains('on') ?? true,
    is_hidden: toggles[1]?.classList.contains('on') ?? false,
    source_credit: toggles[2]?.classList.contains('on') ? 'MemoryPic upload' : null
  });

  publishButton.disabled = false;
  publishButton.textContent = 'Đăng pin';

  if (!result.success) {
    alert(result.message || 'Không thể đăng pin');
    return;
  }

  showSuccessScreen();
}

async function publishBoard() {
  const name = document.getElementById('pinTitle')?.value.trim();
  const description = document.getElementById('pinDesc')?.value.trim();
  const publishButton = document.querySelector('.btn-publish');

  if (!name) {
    alert('Vui lòng nhập tên bảng');
    return;
  }

  publishButton.disabled = true;
  publishButton.textContent = 'Đang tạo...';
  const result = await APIService.createBoard({ name, description });
  publishButton.disabled = false;
  publishButton.textContent = 'Tạo bảng';

  if (!result.success) {
    alert(result.message || 'Không thể tạo bảng');
    return;
  }

  await loadBoards();
  showSuccessScreen();
}

function showSuccessScreen() {
  const title = document.querySelector('.success-title');
  const copy = document.querySelector('.success-copy');
  if (title) title.textContent = currentMode === 'board' ? 'Bảng đã được tạo!' : 'Pin đã được đăng!';
  if (copy) {
    copy.textContent = currentMode === 'board'
      ? 'Bảng mới đã sẵn sàng để bạn lưu và sắp xếp pin.'
      : 'Pin của bạn đang được chia sẻ với cộng đồng MemoryPic';
  }
  document.getElementById('mainContent').style.display = 'none';
  document.getElementById('successScreen').style.display = 'flex';
}

function resetCreate() {
  document.getElementById('mainContent').style.display = 'flex';
  document.getElementById('successScreen').style.display = 'none';
  document.getElementById('pinTitle').value = '';
  document.getElementById('pinDesc').value = '';
  document.querySelector('.url-input').value = '';
  document.getElementById('pinBoard').value = '';
  document.getElementById('pinCategory').value = '';
  removeImg();
  tags = [];
  renderTags();
  updateCount('pinTitle', 'titleCount');
  updateCount('pinDesc', 'descCount');
}

function setupUploadZone() {
  const zone = document.getElementById('uploadZone');
  if (!zone) return;

  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('drag');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('drag');
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile({ target: { files: [file] } });
  });
}

function setupActions() {
  document.addEventListener('click', (event) => {
    const actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) return;

    const action = actionTarget.dataset.action;
    if (action === 'publish-pin') publishPin();
    if (action === 'trigger-upload') triggerUpload();
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
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireLogin()) return;

  bindTagInput(document.getElementById('tagInp'));
  setupActions();
  setupUploadZone();
  await loadBoards();
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
