// ===== 数据层 =====
const DB_KEY = 'store_inspector_data';
const SETTINGS_KEY = 'store_inspector_settings';

let state = {
  stores: [],       // 所有门店记录
  currentStoreId: null,
};

let settings = {
  defaultParentId: '',
};

function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) state.stores = JSON.parse(raw);
  } catch(e) { state.stores = []; }
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (s) settings = { ...settings, ...JSON.parse(s) };
  } catch(e) {}
}

function saveData() {
  localStorage.setItem(DB_KEY, JSON.stringify(state.stores));
}

function saveSettings() {
  settings.defaultParentId = document.getElementById('settingsParentId').value.trim();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  showToast('设置已保存');
}

function getCurrentStore() {
  return state.stores.find(s => s.id === state.currentStoreId);
}

// ===== 页面切换 =====
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  window.scrollTo(0, 0);
}

function goHome() {
  saveData();
  renderStoreList();
  showPage('page-home');
}

function showSettings() {
  document.getElementById('settingsParentId').value = settings.defaultParentId;
  showPage('page-settings');
}

// ===== 首页 =====
function renderStoreList() {
  const list = document.getElementById('storeList');
  if (state.stores.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="emoji">🏪</div><p>还没有巡检记录<br>点击上方按钮开始</p></div>`;
    return;
  }
  // 按时间倒序
  const sorted = [...state.stores].sort((a, b) => b.createdAt - a.createdAt);
  list.innerHTML = sorted.map(store => `
    <div class="store-card" onclick="openStore('${store.id}')">
      <div class="store-card-icon">🏪</div>
      <div class="store-card-info">
        <div class="store-card-name">${escHtml(store.name)}</div>
        <div class="store-card-meta">${store.address ? escHtml(store.address) + ' · ' : ''}${formatDate(store.createdAt)}</div>
      </div>
      <div class="store-card-count">${store.photos.length} 张</div>
    </div>
  `).join('');
}

// ===== 新建门店 =====
function showNewStoreModal() {
  document.getElementById('newStoreName').value = '';
  document.getElementById('newStoreAddr').value = '';
  document.getElementById('newStoreInspector').value = '';
  document.getElementById('newStoreModal').classList.add('show');
  setTimeout(() => document.getElementById('newStoreName').focus(), 300);
}

function closeNewStoreModal(e) {
  if (!e || e.target === document.getElementById('newStoreModal')) {
    document.getElementById('newStoreModal').classList.remove('show');
  }
}

function createStore() {
  const name = document.getElementById('newStoreName').value.trim();
  if (!name) { showToast('请输入门店名称'); return; }

  const store = {
    id: 'store_' + Date.now(),
    name,
    address: document.getElementById('newStoreAddr').value.trim(),
    inspector: document.getElementById('newStoreInspector').value.trim(),
    createdAt: Date.now(),
    photos: [],
  };
  state.stores.push(store);
  saveData();
  closeNewStoreModal();
  openStore(store.id);
}

function openStore(storeId) {
  state.currentStoreId = storeId;
  const store = getCurrentStore();
  document.getElementById('inspectTitle').textContent = store.name;
  document.getElementById('inspectStoreName').textContent = store.name + (store.address ? ' · ' + store.address : '');
  document.getElementById('inspectStoreDate').textContent =
    (store.inspector ? store.inspector + ' · ' : '') + formatDate(store.createdAt);
  renderPhotoList();
  showPage('page-inspect');
}

// ===== 照片管理 =====
function triggerCamera() {
  document.getElementById('cameraInput').click();
}
function triggerAlbum() {
  document.getElementById('albumInput').click();
}

document.getElementById('cameraInput').addEventListener('change', handleFileInput);
document.getElementById('albumInput').addEventListener('change', handleFileInput);

async function handleFileInput(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  showLoading('正在处理照片...', true);
  const store = getCurrentStore();
  for (let i = 0; i < files.length; i++) {
    updateProgress(Math.round((i / files.length) * 100));
    const dataUrl = await readFileAsDataURL(files[i]);
    const compressed = await compressImage(dataUrl, 1200, 0.82);
    store.photos.push({
      id: 'photo_' + Date.now() + '_' + i,
      dataUrl: compressed,
      desc: '',
      addedAt: Date.now(),
    });
  }
  updateProgress(100);
  saveData();
  hideLoading();
  renderPhotoList();
  e.target.value = '';
  // 滚动到最新照片
  setTimeout(() => {
    const list = document.getElementById('photoList');
    list.lastElementChild && list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function readFileAsDataURL(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl, maxWidth, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

function renderPhotoList() {
  const store = getCurrentStore();
  const list = document.getElementById('photoList');
  const empty = document.getElementById('photoEmptyState');

  if (!store.photos.length) {
    empty.style.display = 'block';
    // 清除旧的照片卡片
    list.querySelectorAll('.photo-item').forEach(el => el.remove());
    return;
  }
  empty.style.display = 'none';

  // 重新渲染所有照片
  list.querySelectorAll('.photo-item').forEach(el => el.remove());
  store.photos.forEach((photo, idx) => {
    const item = document.createElement('div');
    item.className = 'photo-item';
    item.dataset.photoId = photo.id;
    item.innerHTML = `
      <div class="photo-item-header">
        <div class="photo-num">${idx + 1}</div>
        <span>照片 ${idx + 1}</span>
        <button class="photo-delete-btn" onclick="deletePhoto('${photo.id}')">🗑</button>
      </div>
      <div class="photo-img-wrap">
        <img class="photo-img" src="${photo.dataUrl}" loading="lazy">
      </div>
      <div class="photo-desc-wrap">
        <textarea class="photo-desc" placeholder="添加描述（问题、建议、备注...）" data-photo-id="${photo.id}">${escHtml(photo.desc)}</textarea>
      </div>
    `;
    list.appendChild(item);
  });

  // 绑定描述输入事件（防抖保存）
  list.querySelectorAll('.photo-desc').forEach(ta => {
    ta.addEventListener('input', debounce(function() {
      const photoId = this.dataset.photoId;
      const store = getCurrentStore();
      const photo = store.photos.find(p => p.id === photoId);
      if (photo) { photo.desc = this.value; saveData(); }
    }, 500));
  });
}

function deletePhoto(photoId) {
  if (!confirm('确认删除这张照片？')) return;
  const store = getCurrentStore();
  store.photos = store.photos.filter(p => p.id !== photoId);
  saveData();
  renderPhotoList();
}

// ===== 导出页面 =====
function goExport() {
  // 先保存所有描述
  document.querySelectorAll('.photo-desc').forEach(ta => {
    const photoId = ta.dataset.photoId;
    const store = getCurrentStore();
    const photo = store.photos.find(p => p.id === photoId);
    if (photo) photo.desc = ta.value;
  });
  saveData();

  const store = getCurrentStore();
  document.getElementById('exportPreviewTitle').textContent = store.name;
  document.getElementById('exportPreviewMeta').textContent =
    `${store.photos.length} 张照片 · ${formatDate(store.createdAt)}` +
    (store.inspector ? ` · ${store.inspector}` : '');

  const thumbRow = document.getElementById('exportPreviewThumbs');
  thumbRow.innerHTML = store.photos.slice(0, 8).map(p =>
    `<img class="preview-thumb" src="${p.dataUrl}">`
  ).join('') + (store.photos.length > 8 ? `<div style="width:60px;height:60px;border-radius:6px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:13px;color:#999">+${store.photos.length - 8}</div>` : '');

  // 填入默认父页面ID
  document.getElementById('wikiParentId').value = settings.defaultParentId;

  showPage('page-export');
}

// ===== 导出 Word =====
async function exportWord() {
  const store = getCurrentStore();
  if (!store.photos.length) { showToast('还没有照片，无法导出'); return; }

  showLoading('正在生成 Word 文档...', true);

  try {
    // 动态加载 docx.js
    await loadScript('https://unpkg.com/docx@8.5.0/build/index.js');
    const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = docx;

    const children = [];

    // 标题
    children.push(new Paragraph({
      text: `门店巡检报告 - ${store.name}`,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }));

    // 基本信息
    const infoLines = [
      `门店名称：${store.name}`,
      store.address ? `门店地址：${store.address}` : null,
      store.inspector ? `巡检人员：${store.inspector}` : null,
      `巡检时间：${formatDate(store.createdAt)}`,
      `照片数量：${store.photos.length} 张`,
    ].filter(Boolean);

    infoLines.forEach(line => {
      children.push(new Paragraph({
        children: [new TextRun({ text: line, size: 22 })],
        spacing: { after: 100 },
      }));
    });

    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

    // 每张照片
    for (let i = 0; i < store.photos.length; i++) {
      updateProgress(Math.round((i / store.photos.length) * 100));

      const photo = store.photos[i];

      // 照片编号标题
      children.push(new Paragraph({
        text: `照片 ${i + 1}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      }));

      // 图片
      try {
        const imgData = base64ToUint8Array(photo.dataUrl.split(',')[1]);
        const dims = await getImageDimensions(photo.dataUrl);
        const maxW = 500; // 最大宽度 pt
        const ratio = dims.height / dims.width;
        const w = Math.min(maxW, dims.width);
        const h = Math.round(w * ratio);

        children.push(new Paragraph({
          children: [new ImageRun({
            data: imgData,
            transformation: { width: w, height: h },
            type: 'jpg',
          })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }));
      } catch(e) {
        children.push(new Paragraph({ text: '[图片加载失败]' }));
      }

      // 描述
      if (photo.desc) {
        children.push(new Paragraph({
          children: [new TextRun({ text: photo.desc, size: 22 })],
          spacing: { after: 200 },
          indent: { left: 200 },
        }));
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: '（无描述）', size: 22, color: '999999', italics: true })],
          spacing: { after: 200 },
        }));
      }
    }

    const doc = new Document({
      sections: [{ properties: {}, children }],
    });

    updateProgress(95);
    const blob = await Packer.toBlob(doc);
    updateProgress(100);
    hideLoading();

    const filename = `巡检报告_${store.name}_${formatDateShort(store.createdAt)}.docx`;
    downloadBlob(blob, filename);
    showToast('Word 文档已生成');

  } catch(e) {
    hideLoading();
    console.error(e);
    showToast('生成失败：' + e.message);
  }
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getImageDimensions(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.src = dataUrl;
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== 发布到学城 Wiki =====
async function fetchSSOToken() {
  showLoading('正在获取 Token...');
  try {
    // 调用 catdesk 学城 skill 获取 SSO token
    const resp = await fetch('https://oa.sankuai.com/api/sso/token', {
      credentials: 'include',
    });
    if (resp.ok) {
      const data = await resp.json();
      const token = data.token || data.data?.token || '';
      document.getElementById('wikiToken').value = token;
      hideLoading();
      showToast('Token 获取成功');
    } else {
      throw new Error('请先登录美团内网');
    }
  } catch(e) {
    hideLoading();
    showToast('请在美团内网环境下使用');
  }
}

async function publishToWiki() {
  const store = getCurrentStore();
  if (!store.photos.length) { showToast('还没有照片，无法发布'); return; }

  const parentId = document.getElementById('wikiParentId').value.trim();
  if (!parentId) { showToast('请填写父页面 ID'); return; }

  const token = document.getElementById('wikiToken').value.trim();
  if (!token) {
    showToast('请先点击"获取 Token"');
    return;
  }

  showLoading('正在上传图片...', true);

  try {
    // 1. 上传所有图片，获取图片 URL
    const imageUrls = [];
    for (let i = 0; i < store.photos.length; i++) {
      updateProgress(Math.round((i / store.photos.length) * 70));
      const photo = store.photos[i];
      const url = await uploadImageToWiki(photo.dataUrl, token);
      imageUrls.push(url);
    }

    updateProgress(80);
    document.getElementById('loadingText').textContent = '正在创建文档...';

    // 2. 构建 Wiki 内容（HTML 格式）
    const content = buildWikiContent(store, imageUrls);

    // 3. 创建学城文档
    const pageTitle = `门店巡检 - ${store.name} - ${formatDateShort(store.createdAt)}`;
    const result = await createWikiPage(parentId, pageTitle, content, token);

    updateProgress(100);
    hideLoading();

    if (result.pageId || result.contentId) {
      const pageId = result.pageId || result.contentId;
      showToast('发布成功！');
      setTimeout(() => {
        if (confirm(`发布成功！\n\n是否打开学城页面查看？`)) {
          window.open(`https://km.sankuai.com/collabpage/${pageId}`, '_blank');
        }
      }, 500);
    } else {
      showToast('发布成功');
    }

  } catch(e) {
    hideLoading();
    console.error(e);
    showToast('发布失败：' + (e.message || '请检查网络和 Token'));
  }
}

async function uploadImageToWiki(dataUrl, token) {
  // 将 base64 转为 Blob
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  const blob = new Blob([u8arr], { type: mime });

  const formData = new FormData();
  formData.append('file', blob, 'photo.jpg');
  formData.append('type', 'image');

  const resp = await fetch('https://km.sankuai.com/api/file/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
    credentials: 'include',
  });

  if (!resp.ok) throw new Error(`图片上传失败 (${resp.status})`);
  const data = await resp.json();
  return data.data?.url || data.url || '';
}

function buildWikiContent(store, imageUrls) {
  const infoRows = [
    ['门店名称', store.name],
    store.address ? ['门店地址', store.address] : null,
    store.inspector ? ['巡检人员', store.inspector] : null,
    ['巡检时间', formatDate(store.createdAt)],
    ['照片数量', `${store.photos.length} 张`],
  ].filter(Boolean);

  const infoTable = `
    <table>
      <tbody>
        ${infoRows.map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`).join('')}
      </tbody>
    </table>
  `;

  const photoSections = store.photos.map((photo, i) => {
    const imgUrl = imageUrls[i];
    const imgTag = imgUrl ? `<img src="${imgUrl}" style="max-width:600px;width:100%">` : '';
    return `
      <h3>照片 ${i + 1}</h3>
      ${imgTag}
      <p>${photo.desc ? escHtml(photo.desc) : '<em>（无描述）</em>'}</p>
      <hr>
    `;
  }).join('');

  return `
    <h2>基本信息</h2>
    ${infoTable}
    <h2>巡检照片</h2>
    ${photoSections}
  `;
}

async function createWikiPage(parentId, title, content, token) {
  const resp = await fetch('https://km.sankuai.com/api/pages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    credentials: 'include',
    body: JSON.stringify({
      parentId: parseInt(parentId),
      title,
      content,
      type: 'doc',
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`创建文档失败 (${resp.status}): ${err}`);
  }
  return await resp.json();
}

// ===== 工具函数 =====
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateShort(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function showLoading(text, showProgress) {
  document.getElementById('loadingText').textContent = text || '处理中...';
  document.getElementById('progressWrap').style.display = showProgress ? 'block' : 'none';
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('loading').classList.add('show');
}

function hideLoading() {
  document.getElementById('loading').classList.remove('show');
}

function updateProgress(pct) {
  document.getElementById('progressFill').style.width = pct + '%';
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function clearAllData() {
  if (!confirm('确认清除所有巡检记录？此操作不可恢复。')) return;
  state.stores = [];
  saveData();
  renderStoreList();
  showPage('page-home');
  showToast('已清除所有记录');
}

// ===== 初始化 =====
loadData();
renderStoreList();

// 注册 Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
