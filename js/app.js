/* ============================================
   All · 应用核心 v2
   深色玻璃拟态 · 移动端仪表盘
   ============================================ */

// ===== 工具函数 =====
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => p.querySelectorAll(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function fmtDate(d) {
  if (typeof d === 'string') d = new Date(d);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function todayStr() { return fmtDate(new Date()); }
function getWeekday(date) {
  if (typeof date === 'string') date = parseDate(date);
  return ['周日','周一','周二','周三','周四','周五','周六'][date.getDay()];
}
function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
function calcDuration(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
function fmtDuration(min) {
  if (min <= 0) return '0分钟';
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m}分钟`;
  if (m === 0) return `${h}小时`;
  return `${h}h${m}m`;
}
function fmtMoney(n) {
  return parseFloat(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtInt(n) {
  return Math.round(n || 0).toLocaleString('zh-CN');
}
// ===== 拼豆相关辅助 =====
function getAllBeads() {
  const deleted = Store.getBeadDeleted();
  const cat = BEAD_CATALOG.filter(b => deleted.indexOf(b.num) === -1);
  return cat.concat(Store.getBeadCustom());
}
function getBeadByNum(num) { return getAllBeads().find(b => b.num === num); }
// 取色号对应的展示颜色：优先用户导入覆盖 → 文件颜色 → 目录默认 hex
function getBeadColor(num, fallback) {
  try {
    const ov = Store.getBeadColors();
    if (ov && ov[num]) return ov[num];
  } catch (e) {}
  if (typeof BEAD_FILE_COLORS !== 'undefined' && BEAD_FILE_COLORS[num]) return BEAD_FILE_COLORS[num];
  return fallback;
}
// 解析颜色文本：支持 #rrggbb / R/G/B / rgb(...)
function parseColor(str) {
  if (!str) return null;
  str = String(str).trim();
  let m = str.match(/^#([0-9a-fA-F]{6})$/);
  if (m) return '#' + m[1].toUpperCase();
  m = str.match(/R\s*(\d+)\s*\/\s*G\s*(\d+)\s*\/\s*B\s*(\d+)/i);
  if (m) { const r = Math.min(255, +m[1]), g = Math.min(255, +m[2]), b = Math.min(255, +m[3]); return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0').toUpperCase()).join(''); }
  m = str.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (m) { const r = Math.min(255, +m[1]), g = Math.min(255, +m[2]), b = Math.min(255, +m[3]); return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0').toUpperCase()).join(''); }
  return null;
}
function beadStatus(stock, threshold) {
  if (stock <= 0) return 'out';
  if (stock <= threshold) return 'low';
  return 'ok';
}
const BEAD_STATUS = {
  ok: { label: '充足', cls: 'status-ok', color: '#2ecc71' },
  low: { label: '偏低', cls: 'status-low', color: '#f9ca24' },
  out: { label: '缺货', cls: 'status-out', color: '#eb4d4b' }
};
function csvCell(v) {
  v = v == null ? '' : String(v);
  if (/[",\r\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
function monthKey(s) { return s.slice(0, 7); }
function yearKey(s) { return s.slice(0, 4); }
const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

// 统一的经期结论：首页（沙漏 + 迷你日历）与健康板块经期页共用同一套推算，保证各处结论一致
function computePeriodConclusion(periods, today) {
  const t = parseDate(today);
  if (!periods || periods.length === 0) {
    return { hasData: false, avgCycle: 28, avgPeriod: 5, latest: null, dayOfCycle: 0, inPeriod: false, nextStart: null, daysUntilNext: 0, nextDateStr: '--' };
  }
  const sorted = periods.slice().sort((a, b) => a.startDate.localeCompare(b.startDate)); // 升序
  const latest = sorted[sorted.length - 1];
  let avgCycle = 28, avgPeriod = 5;
  if (sorted.length >= 2) {
    const cycles = [];
    for (let i = 1; i < sorted.length; i++) {
      cycles.push(Math.round((parseDate(sorted[i].startDate) - parseDate(sorted[i - 1].startDate)) / 86400000));
    }
    avgCycle = Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length);
  }
  const completed = sorted.filter(p => p.endDate);
  if (completed.length > 0) {
    const durs = completed.map(p => Math.floor((parseDate(p.endDate) - parseDate(p.startDate)) / 86400000) + 1);
    avgPeriod = Math.round(durs.reduce((a, b) => a + b, 0) / durs.length);
  }
  const latestStart = parseDate(latest.startDate);
  const latestEnd = latest.endDate ? parseDate(latest.endDate) : null;
  const inPeriod = !latestEnd || t <= latestEnd;
  const dayOfCycle = Math.floor((t - latestStart) / 86400000) + 1;
  const nextStart = new Date(latestStart.getTime() + avgCycle * 86400000);
  const daysUntilNext = Math.ceil((nextStart - t) / 86400000);
  const nextDateStr = (nextStart.getMonth() + 1) + '月' + nextStart.getDate() + '日';
  return { hasData: true, avgCycle, avgPeriod, latest, dayOfCycle, inPeriod, nextStart, daysUntilNext, nextDateStr };
}

// 环形进度SVG
let ringGradId = 0;
function ringSVG(percent, size = 100, stroke = 7) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - percent / 100);
  const gid = `ringGrad_${++ringGradId}`;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ff3d7f"/>
          <stop offset="100%" stop-color="#ff6ba0"/>
        </linearGradient>
        <filter id="glow_${gid}">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none"
              stroke="rgba(255,255,255,0.06)" stroke-width="${stroke}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none"
              stroke="url(#${gid})" stroke-width="${stroke}"
              stroke-linecap="round" stroke-dasharray="${circ}"
              stroke-dashoffset="${offset}"
              filter="url(#glow_${gid})"
              style="transition: stroke-dashoffset 0.8s ease"/>
    </svg>
  `;
}

// ===== 存储 =====
const KEYS = {
  weight: 'weight',
  account: 'account',
  period: 'period',
  hideAmount: 'hide_amount',
  accountOrder: 'account_order',
  customAccounts: 'custom_accounts',
  customExpenseCats: 'custom_expense_cats',
  customIncomeCats: 'custom_income_cats',
  seeded: 'seeded_v3',
  notes: 'notes',
  todos: 'todos',
  beadStock: 'bead_stock',
  beadThreshold: 'bead_threshold',
  beadCustom: 'bead_custom',
  beadSeeded: 'bead_seeded_v1',
  beadSeedVer: 'bead_seed_ver',
  beadColors: 'bead_colors',
  beadLogs: 'bead_logs',
  beadDeleted: 'bead_deleted'
};
const Store = {
  _prefix: 'cc_',
  _init() {
    // 单账号模式：统一前缀 cc_
  },
  _k(k) { return this._prefix + k; },
  get(k, def = []) { try { const v = localStorage.getItem(this._k(k)); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { localStorage.setItem(this._k(k), JSON.stringify(v)); },
  getWeights() { return this.get(KEYS.weight); },
  saveWeights(v) { this.set(KEYS.weight, v); },
  addWeight(w) { const a = this.getWeights(); a.push({ id: uid(), ...w }); this.saveWeights(a); },
  updateWeight(id, u) { const a = this.getWeights(); const i = a.findIndex(x => x.id === id); if (i >= 0) { a[i] = { ...a[i], ...u }; this.saveWeights(a); } },
  deleteWeight(id) { this.saveWeights(this.getWeights().filter(x => x.id !== id)); },
  getAccounts() { return this.get(KEYS.account); },
  saveAccounts(v) { this.set(KEYS.account, v); },
  addAccount(e) { const a = this.getAccounts(); a.push({ id: uid(), ...e }); this.saveAccounts(a); },
  updateAccount(id, u) { const a = this.getAccounts(); const i = a.findIndex(x => x.id === id); if (i >= 0) { a[i] = { ...a[i], ...u }; this.saveAccounts(a); } },
  deleteAccount(id) { this.saveAccounts(this.getAccounts().filter(x => x.id !== id)); },
  getAccountOrder() { return this.get(KEYS.accountOrder, []); },
  saveAccountOrder(v) { this.set(KEYS.accountOrder, v); },
  getPeriods() { return this.get(KEYS.period); },
  savePeriods(v) { this.set(KEYS.period, v); },
  addPeriod(p) { const a = this.getPeriods(); a.push({ id: uid(), ...p }); this.savePeriods(a); },
  updatePeriod(id, u) { const a = this.getPeriods(); const i = a.findIndex(x => x.id === id); if (i >= 0) { a[i] = { ...a[i], ...u }; this.savePeriods(a); } },
  deletePeriod(id) { this.savePeriods(this.getPeriods().filter(x => x.id !== id)); },
  getCustomAccounts() { return this.get(KEYS.customAccounts, []); },
  saveCustomAccounts(v) { this.set(KEYS.customAccounts, v); },
  addCustomAccount(a) { const list = this.getCustomAccounts(); list.push(a); this.saveCustomAccounts(list); },
  removeCustomAccount(name) { this.saveCustomAccounts(this.getCustomAccounts().filter(a => a.name !== name)); },
  getCustomExpenseCats() { return this.get(KEYS.customExpenseCats, []); },
  saveCustomExpenseCats(v) { this.set(KEYS.customExpenseCats, v); },
  addCustomExpenseCat(c) { const list = this.getCustomExpenseCats(); list.push(c); this.saveCustomExpenseCats(list); },
  removeCustomExpenseCat(name) { this.saveCustomExpenseCats(this.getCustomExpenseCats().filter(c => c.name !== name)); },
  getCustomIncomeCats() { return this.get(KEYS.customIncomeCats, []); },
  saveCustomIncomeCats(v) { this.set(KEYS.customIncomeCats, v); },
  addCustomIncomeCat(c) { const list = this.getCustomIncomeCats(); list.push(c); this.saveCustomIncomeCats(list); },
  removeCustomIncomeCat(name) { this.saveCustomIncomeCats(this.getCustomIncomeCats().filter(c => c.name !== name)); },
  clearAllData() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(this._k(k)));
  },
  // 笔记
  getNotes() { return this.get(KEYS.notes); },
  saveNotes(v) { this.set(KEYS.notes, v); },
  addNote(n) { const a = this.getNotes(); a.push({ id: uid(), ...n }); this.saveNotes(a); },
  updateNote(id, u) { const a = this.getNotes(); const i = a.findIndex(x => x.id === id); if (i >= 0) { a[i] = { ...a[i], ...u }; this.saveNotes(a); } },
  deleteNote(id) { this.saveNotes(this.getNotes().filter(x => x.id !== id)); },
  // 待办
  getTodos() { return this.get(KEYS.todos); },
  saveTodos(v) { this.set(KEYS.todos, v); },
  addTodo(t) { const a = this.getTodos(); a.push({ id: uid(), ...t }); this.saveTodos(a); },
  updateTodo(id, u) { const a = this.getTodos(); const i = a.findIndex(x => x.id === id); if (i >= 0) { a[i] = { ...a[i], ...u }; this.saveTodos(a); } },
  deleteTodo(id) { this.saveTodos(this.getTodos().filter(x => x.id !== id)); },
  // 拼豆库存
  getBeadStock() { return this.get(KEYS.beadStock, {}); },
  saveBeadStock(v) { this.set(KEYS.beadStock, v); },
  setBeadStockNum(num, stock, note) {
    const m = this.getBeadStock();
    const cur = m[num] || { stock: 0, note: '' };
    m[num] = { stock: Math.max(0, Math.round(stock)), note: note !== undefined ? (note || '') : (cur.note || '') };
    this.saveBeadStock(m);
  },
  getBeadThreshold() { return this.get(KEYS.beadThreshold, 100); },
  setBeadThreshold(v) { this.set(KEYS.beadThreshold, v); },
  getBeadCustom() { return this.get(KEYS.beadCustom, []); },
  saveBeadCustom(v) { this.set(KEYS.beadCustom, v); },
  getBeadColors() { return this.get(KEYS.beadColors, {}); },
  saveBeadColors(v) { this.set(KEYS.beadColors, v); },
  getBeadLogs() { return this.get(KEYS.beadLogs, []); },
  saveBeadLogs(v) { this.set(KEYS.beadLogs, v); },
  getBeadDeleted() { return this.get(KEYS.beadDeleted, []); },
  saveBeadDeleted(v) { this.set(KEYS.beadDeleted, v); },
  // 云端备份：导出/导入全部数据
  exportAll() {
    const data = { __app: 'All', __version: 1, __exportedAt: new Date().toISOString() };
    Object.keys(KEYS).forEach(k => { data[k] = this.get(KEYS[k]); });
    return data;
  },
  importAll(obj) {
    if (!obj || typeof obj !== 'object') return false;
    let n = 0;
    Object.keys(KEYS).forEach(k => {
      if (k in obj) { this.set(KEYS[k], obj[k]); n++; }
    });
    return n > 0;
  },
  clearAllData() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(this._k(k)));
  }
};

// ===== 配置（动态合并默认+自定义） =====
const DEFAULTS = {
  expenseCategories: ['餐饮','交通','购物','娱乐','居住','医疗','教育','其他'],
  incomeCategories: ['工资','奖金','投资','兼职','其他'],
  accounts: ['微信1','微信2','支付宝','浦发1','浦发2','农村信用社','中国银行','中国农业','浙江农信','中国工商'],
  accountIcons: { '微信1':'💚','微信2':'💚','支付宝':'💙','浦发1':'🏛️','浦发2':'🏛️','农村信用社':'🌾','中国银行':'🏦','中国农业':'🌾','浙江农信':'🏘️','中国工商':'🏦' },
  categoryIcons: { '餐饮':'🍽️','交通':'🚗','购物':'🛍️','娱乐':'🎮','居住':'🏠','医疗':'💊','教育':'📚','其他':'📌','工资':'💰','奖金':'🎁','投资':'📈','兼职':'💼' },
  categoryColors: { '餐饮':'#ff6b6b','交通':'#4ecdc4','购物':'#45b7d1','娱乐':'#f9ca24','居住':'#a55eea','医疗':'#eb4d4b','教育':'#22a6b3','其他':'#95a5a6','工资':'#2ecc71','奖金':'#27ae60','投资':'#3498db','兼职':'#e67e22' },
  accIconPool: ['💚','💙','🏛️','🏦','🌾','🏘️','💳','💵','💎','🎁','📱','💰','🪙','🏧','👜'],
  catIconPool: ['🍽️','🚗','🛍️','🎮','🏠','💊','📚','✈️','🎬','☕','🍰','🎵','💼','💰','🎁','📈','🛒','⛽','💄','🐾','👕','📱','🏋️','🎨'],
  catColorPool: ['#ff6b6b','#4ecdc4','#45b7d1','#f9ca24','#a55eea','#eb4d4b','#22a6b3','#95a5a6','#2ecc71','#27ae60','#3498db','#e67e22','#fd79a8','#fdcb6e','#6c5ce7','#00b894','#e84393','#74b9ff']
};
const CONFIG = {
  get expenseCategories() {
    return [...DEFAULTS.expenseCategories, ...Store.getCustomExpenseCats().map(c => c.name)];
  },
  get incomeCategories() {
    return [...DEFAULTS.incomeCategories, ...Store.getCustomIncomeCats().map(c => c.name)];
  },
  get accounts() {
    return [...DEFAULTS.accounts, ...Store.getCustomAccounts().map(a => a.name)];
  },
  get accountIcons() {
    const map = { ...DEFAULTS.accountIcons };
    Store.getCustomAccounts().forEach(a => { map[a.name] = a.icon; });
    return map;
  },
  get categoryIcons() {
    const map = { ...DEFAULTS.categoryIcons };
    [...Store.getCustomExpenseCats(), ...Store.getCustomIncomeCats()].forEach(c => { map[c.name] = c.icon; });
    return map;
  },
  get categoryColors() {
    const map = { ...DEFAULTS.categoryColors };
    [...Store.getCustomExpenseCats(), ...Store.getCustomIncomeCats()].forEach(c => { map[c.name] = c.color; });
    return map;
  }
};

// ===== Toast =====
const Toast = {
  show(msg, type = 'success') {
    const c = $('#toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    t.innerHTML = `<span>${icons[type]||''}</span><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(-10px)'; t.style.transition = 'all 0.3s'; setTimeout(() => t.remove(), 300); }, 2200);
  }
};

// ===== 模态框 =====
const Modal = {
  open(title, body) {
    $('#modalHeader').innerHTML = `<span>${title}</span><span class="modal-close" onclick="Modal.close()">✕</span>`;
    $('#modalBody').innerHTML = body;
    $('#modalOverlay').classList.add('active');
  },
  close() { $('#modalOverlay').classList.remove('active'); }
};
document.addEventListener('click', e => { if (e.target.id === 'modalOverlay') Modal.close(); });

// ===== 确认弹窗（替代原生confirm） =====
const ConfirmDialog = {
  _cb: null,
  show(message, callback, opts = {}) {
    this._cb = callback;
    const icon = opts.icon || '⚠️';
    const title = opts.title || '确认操作';
    const confirmText = opts.confirmText || '确认删除';
    const body = `
      <div class="confirm-dialog">
        <div class="confirm-icon">${icon}</div>
        <div class="confirm-message">${message}</div>
        <div class="confirm-actions">
          <button class="btn btn-glass" onclick="Modal.close()">取消</button>
          <button class="btn btn-danger" onclick="ConfirmDialog._do()">${confirmText}</button>
        </div>
      </div>
    `;
    Modal.open(title, body);
  },
  _do() { Modal.close(); if (this._cb) { this._cb(); this._cb = null; } }
};

// ===== 日历 =====
const Calendar = {
  render(container, year, month, opts = {}) {
    const { hasData, selectedDate, counts, dayHtml } = opts;
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startW = first.getDay();
    const days = last.getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const names = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
    const today = todayStr();
    let html = `<div class="calendar-header"><div class="calendar-title">${year}年 ${names[month]}</div><div class="calendar-nav">
      <button class="btn-icon" onclick="CalNav.prev()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      <button class="btn-icon" onclick="CalNav.today()" style="font-size:11px;font-weight:600">今</button>
      <button class="btn-icon" onclick="CalNav.next()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></button>
    </div></div><div class="calendar-grid">`;
    ['日','一','二','三','四','五','六'].forEach(w => html += `<div class="calendar-weekday">${w}</div>`);
    for (let i = startW - 1; i >= 0; i--) html += `<div class="calendar-day other-month">${prevDays - i}</div>`;
    for (let d = 1; d <= days; d++) {
      const ds = fmtDate(new Date(year, month, d));
      const cls = ['calendar-day'];
      if (ds === today) cls.push('today');
      if (ds === selectedDate) cls.push('selected');
      if (hasData && hasData(ds)) cls.push('has-tasks');
      const cnt = counts ? counts[ds] : '';
      const dayContent = dayHtml ? dayHtml(ds) : (cnt ? `<span class="day-count">${cnt}</span>` : '');
      html += `<div class="${cls.join(' ')}" data-date="${ds}" onclick="CalNav.select('${ds}')"><span>${d}</span>${dayContent}</div>`;
    }
    const total = startW + days;
    const rem = (7 - (total % 7)) % 7;
    for (let d = 1; d <= rem; d++) html += `<div class="calendar-day other-month">${d}</div>`;
    html += '</div>';
    container.innerHTML = html;
  }
};
const CalNav = {
  _s: {},
  init(view, y, m, sel) { this._s = { view, y, m, sel }; },
  prev() { this._s.m--; if (this._s.m < 0) { this._s.m = 11; this._s.y--; } this._refresh(); },
  next() { this._s.m++; if (this._s.m > 11) { this._s.m = 0; this._s.y++; } this._refresh(); },
  today() {
    const n = new Date();
    this._s.y = n.getFullYear();
    this._s.m = n.getMonth();
    this._s.sel = todayStr();
    if (this._s.view === 'datepicker') { DatePicker.select(todayStr()); return; }
    this._refresh();
  },
  select(d) {
    this._s.sel = d;
    if (this._s.view === 'datepicker') { DatePicker.select(d); return; }
    this._refresh();
  },
  _refresh() {
    const { view } = this._s;
    if (view === 'health') HealthView.renderCal();
    else if (view === 'datepicker') DatePicker._render();
    else if (view === 'notebook') { NotebookView.renderCal(); NotebookView.renderDay(); }
    else if (view === 'account') { AccountView.renderCal(); AccountView.renderDay(); }
  }
};

// ===== 自定义日期选择器（玻璃拟态日历） =====
function dateFieldHTML(id, value, placeholder = '选择日期', allowClear = false) {
  const v = value || '';
  const call = allowClear ? `DatePicker.open('${id}','${v}',true)` : `DatePicker.open('${id}','${v}')`;
  return `<div class="date-field" onclick="${call}">
    <span class="date-field-text ${v?'':'placeholder'}" id="${id}_display">${v || placeholder}</span>
    <svg class="date-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    <input type="hidden" id="${id}" value="${v}">
  </div>`;
}
const DatePicker = {
  _fieldId: null,
  _allowClear: false,
  _prevHeader: '',
  _prevBody: '',
  open(fieldId, currentValue, allowClear = false) {
    this._fieldId = fieldId;
    this._allowClear = allowClear;
    // 保存当前模态框内容，选完日期后恢复
    this._prevHeader = $('#modalHeader').innerHTML;
    this._prevBody = $('#modalBody').innerHTML;
    // 保存表单中已填写的实时值（如金额），避免选日期后被静态 innerHTML 覆盖清空
    this._prevValues = {};
    const mb = $('#modalBody');
    if (mb) mb.querySelectorAll('input, select, textarea').forEach(el => { if (el.id) this._prevValues[el.id] = el.value; });
    const d = currentValue ? parseDate(currentValue) : new Date();
    CalNav.init('datepicker', d.getFullYear(), d.getMonth(), currentValue || todayStr());
    this._render();
  },
  _render() {
    const { y, m, sel } = CalNav._s;
    let body = '<div id="dpCalendar"></div>';
    if (this._allowClear) {
      body += '<div style="text-align:center;padding:12px 0 4px"><button class="btn btn-glass btn-sm" onclick="DatePicker.clear()">清除日期</button></div>';
    }
    Modal.open('选择日期', body);
    const container = $('#dpCalendar');
    if (container) Calendar.render(container, y, m, { selectedDate: sel });
  },
  select(date) {
    this._restoreForm();
    // 更新日期字段
    const input = $(`#${this._fieldId}`);
    if (input) input.value = date;
    const display = $(`#${this._fieldId}_display`);
    if (display) { display.textContent = date; display.classList.remove('placeholder'); }
  },
  clear() {
    this._restoreForm();
    const input = $(`#${this._fieldId}`);
    if (input) input.value = '';
    const display = $(`#${this._fieldId}_display`);
    if (display) { display.textContent = '留空表示进行中'; display.classList.add('placeholder'); }
  },
  _restoreForm() {
    // 恢复原始表单 HTML
    $('#modalHeader').innerHTML = this._prevHeader;
    $('#modalBody').innerHTML = this._prevBody;
    // 回填选日期前已填写的实时值（金额、备注、隐藏字段等）
    if (this._prevValues) {
      Object.keys(this._prevValues).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = this._prevValues[id];
      });
    }
    // 重新同步 chip / 按钮的选中态（基于隐藏字段的值）
    this._syncFormChips();
  },
  _syncFormChips() {
    const body = $('#modalBody');
    if (!body) return;
    const t = body.querySelector('#ac-type');
    if (t) body.querySelectorAll('.type-btn[data-type]').forEach(b => b.classList.toggle('active', b.dataset.type === t.value));
    const sync = (fieldId, attr) => {
      const f = body.querySelector('#' + fieldId);
      if (!f) return;
      body.querySelectorAll('[data-' + attr + ']').forEach(c => c.classList.toggle('active', c.getAttribute('data-' + attr) === f.value));
    };
    sync('ac-account', 'account');
    sync('ac-tf-from', 'account');
    sync('ac-tf-to', 'account');
    sync('ac-category', 'cat');
    const r = body.querySelector('#ac-reimbursable');
    const tag = body.querySelector('#ac-reimbursable-tag');
    if (r && tag) { const v = r.value === 'true'; tag.classList.toggle('active', v); tag.classList.toggle('tag-reimburse', v); }
    const trG = body.querySelector('#ac-transfer-group');
    if (trG && t) trG.style.display = (t.value === 'transfer') ? '' : 'none';
    const acR = body.querySelector('#ac-account-row'); if (acR && t) acR.style.display = (t.value === 'transfer') ? 'none' : '';
    const catR = body.querySelector('#ac-category-row'); if (catR && t) catR.style.display = (t.value === 'transfer') ? 'none' : '';
    const rr = body.querySelector('#ac-reimbursable-row');
    if (rr && t) { const sub = body.querySelector('#ac-expense-sub'); const s = sub ? sub.value : 'normal'; rr.style.display = (t.value === 'expense' && s !== 'refund') ? '' : 'none'; }
  }
};

// ===== 图表管理 =====
const ChartMgr = {
  charts: {},
  destroy(k) { if (this.charts[k]) { this.charts[k].destroy(); delete this.charts[k]; } },
  destroyAll() { Object.values(this.charts).forEach(c => c.destroy()); this.charts = {}; },
  darkOpts() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 0 },
      plugins: {
        legend: { labels: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } } },
        tooltip: { backgroundColor: 'rgba(20,20,30,0.9)', titleColor: '#fff', bodyColor: '#fff', cornerRadius: 10, padding: 10, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } } }
      }
    };
  }
};

/* ============================================
   首页仪表盘
   ============================================ */
const HomeView = {
  _clockTimer: null,

  render() {
    if (this._clockTimer) { clearInterval(this._clockTimer); this._clockTimer = null; }

    const today = todayStr();
    const todayExpense = Store.getAccounts().filter(e => e.date === today && e.type === 'expense')
      .reduce((s, e) => s + parseFloat(e.amount || 0), 0).toFixed(2);
    const monthExpense = Store.getAccounts().filter(e => monthKey(e.date) === monthKey(today) && e.type === 'expense')
      .reduce((s, e) => s + parseFloat(e.amount || 0), 0).toFixed(2);
    const ws = Store.getWeights().sort((a, b) => a.date.localeCompare(b.date));
    const latestWeight = ws.length ? parseFloat(ws[ws.length - 1].weight).toFixed(2) : '--';

    let html = `
    <div class="fan-home v3">
      <div class="live-clock">
        <div class="live-clock-time" id="liveClockTime">00:00:00</div>
        <div class="live-clock-date" id="liveClockDate"></div>
      </div>

      <div class="info-card" onclick="App.navigate('account')">
        <div class="info-header"><span class="info-icon">✨</span> 今日工作台</div>
        <div class="info-grid">
          <div class="info-item"><div class="info-val">${todayExpense}</div><div class="info-label">今日支出</div></div>
          <div class="info-item"><div class="info-val">${monthExpense}</div><div class="info-label">本月支出</div></div>
          <div class="info-item"><div class="info-val">${latestWeight}</div><div class="info-label">当前体重</div></div>
          <div class="info-item" style="cursor:pointer" onclick="event.stopPropagation();CloudBackup.open()">
            <div class="info-val">☁️</div><div class="info-label">导出 / 导入</div>
          </div>
        </div>
      </div>

      <div class="tool-row">
        <div class="tool-mini" onclick="App.navigate('account')"><span>💰</span>记账</div>
        <div class="tool-mini" onclick="App.navigate('health','weight')"><span>⚖️</span>健康</div>
        <div class="tool-mini" onclick="App.navigate('notebook')"><span>📝</span>记事</div>
        <div class="tool-mini" onclick="App.navigate('bead')"><span>🎨</span>拼豆</div>
      </div>

      <div style="height:28px"></div>
    </div>
    `;

    $('#view-home').innerHTML = html;
    this._startClock();
  },

  _startClock() {
    const daysCN = ['周日','周一','周二','周三','周四','周五','周六'];
    const pad = n => String(n).padStart(2, '0');
    const update = () => {
      const now = new Date();
      const tEl = $('#liveClockTime');
      if (tEl) tEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const dEl = $('#liveClockDate');
      if (dEl) dEl.textContent = `${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())} · ${daysCN[now.getDay()]}`;
    };
    update();
    this._clockTimer = setInterval(update, 1000);
  },

  _periodCardHTML(periodInfo, periods, today) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    // 计算日历需要的经期日期集合
    const periodDates = new Set(); // 实际经期
    const predictDates = new Set(); // 预测经期
    periods.forEach(p => {
      const start = parseDate(p.startDate);
      const end = p.endDate ? parseDate(p.endDate) : parseDate(today);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        periodDates.add(fmtDate(d));
      }
      // 预测下次经期
      if (p.endDate && periodInfo.avgCycle > 0) {
        const nextStart = new Date(parseDate(p.startDate).getTime() + periodInfo.avgCycle * 86400000);
        for (let i = 0; i < (periodInfo.avgPeriod || 5); i++) {
          const pd = new Date(nextStart.getTime() + i * 86400000);
          predictDates.add(fmtDate(pd));
        }
      }
    });

    return `
      <div class="glass dash-card" style="margin-bottom:16px;overflow:visible">
        <!-- 沙漏卡片 -->
        <div class="hourglass-card">
          <div class="hourglass-icon">⏳</div>
          <div class="hourglass-info">
            <div class="hourglass-title">${periodInfo.hourglassTitle || '经期记录'}</div>
            <div class="hourglass-desc">${periodInfo.hourglassDesc || ''}</div>
            <div class="hourglass-stats">
              <div class="hg-stat">
                <div class="hg-stat-num">${periodInfo.daysUntilNext !== undefined ? (periodInfo.daysUntilNext > 0 ? periodInfo.daysUntilNext : '?') : '--'}</div>
                <div class="hg-stat-label">天后预计</div>
              </div>
              <div class="hg-divider"></div>
              <div class="hg-stat">
                <div class="hg-stat-num">${periodInfo.nextDateStr || '--'}</div>
                <div class="hg-stat-label">预计日期</div>
              </div>
              <div class="hg-divider"></div>
              <div class="hg-stat">
                <div class="hg-stat-num">${periodInfo.cycleLen || '--'}</div>
                <div class="hg-stat-label">平均周期</div>
              </div>
            </div>
          </div>
        </div>
        <!-- 迷你经期日历 -->
        <div class="period-cal-section">
          <div class="period-cal-header">
            <span class="period-cal-title">${y}年${m+1}月</span>
            <span class="period-cal-legend">
              <span class="cal-legend"><i style="background:var(--pink)"></i>经期</span>
              <span class="cal-legend"><i style="background:#a78bfa"></i>预测</span>
            </span>
          </div>
          <div class="period-cal-grid" id="homePeriodCal"></div>
        </div>
      </div>
    `;
  },
  _bindPeriodCal(periods, today) {
    const container = $('#homePeriodCal');
    if (!container) return;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startW = first.getDay();
    const days = last.getDate();
    const prevDays = new Date(y, m, 0).getDate();

    // 计算经期和预测日期（与健康板块经期页、首页沙漏共用同一结论）
    const c = computePeriodConclusion(periods, today);
    const periodSet = new Set();
    const predictSet = new Set();
    periods.forEach(p => {
      const start = parseDate(p.startDate);
      const end = p.endDate ? parseDate(p.endDate) : parseDate(today);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        periodSet.add(fmtDate(d));
      }
    });
    // 预测：仅基于"下次经期起点"（latestStart + avgCycle），与健康页"预计日期"完全一致
    if (c.hasData && c.nextStart) {
      for (let i = 0; i < c.avgPeriod; i++) {
        predictSet.add(fmtDate(new Date(c.nextStart.getTime() + i * 86400000)));
      }
    }

    let html = '';
    ['日','一','二','三','四','五','六'].forEach(w => html += `<div class="pc-weekday">${w}</div>`);
    for (let i = startW - 1; i >= 0; i--) html += `<div class="pc-day other">${prevDays - i}</div>`;
    for (let d = 1; d <= days; d++) {
      const ds = fmtDate(new Date(y, m, d));
      const cls = ['pc-day'];
      if (ds === today) cls.push('today');
      if (periodSet.has(ds)) cls.push('period');
      if (predictSet.has(ds)) cls.push('predict');
      html += `<div class="${cls.join(' ')}">${d}</div>`;
    }
    const total = startW + days;
    const rem = (7 - (total % 7)) % 7;
    for (let d = 1; d <= rem; d++) html += `<div class="pc-day other">${d}</div>`;
    container.innerHTML = html;
  },
  _getPeriodInfo(periods, today) {
    const c = computePeriodConclusion(periods, today);
    if (!c.hasData) {
      return { cyclePercent:0, ringText:'—', ringLabel:'暂无记录', title:'经期记录', desc:'点击健康页面记录经期', dayNum:'--', dayLabel:'周期日', cycleLen:'--', periodLen:'--', avgCycle:0, avgPeriod:0, quickNum:'--', quickUnit:'', quickLabel:'经期', cardTitle:'暂无经期记录', cardDesc:'去健康页面记录首次经期', cardNum:'—', cardUnit:'', hourglassTitle:'暂无记录', hourglassDesc:'点击健康页面记录经期', daysUntilNext:undefined, nextDateStr:'--' };
    }
    const dayOfCycle = c.dayOfCycle;
    const inPeriod = c.inPeriod;
    const dun = c.daysUntilNext;
    const nmon = c.nextStart.getMonth() + 1, nday = c.nextStart.getDate();
    if (inPeriod && dayOfCycle <= c.avgPeriod) {
      return { cyclePercent:Math.min(dayOfCycle/c.avgCycle*100,100), ringText:'D'+dayOfCycle, ringLabel:'经期中', title:'经期中', desc:'第'+dayOfCycle+'天', dayNum:dayOfCycle, dayLabel:'第几天', cycleLen:c.avgCycle, periodLen:c.avgPeriod, avgCycle:c.avgCycle, avgPeriod:c.avgPeriod, quickNum:dayOfCycle, quickUnit:'天', quickLabel:'经期中', cardTitle:'经期进行中', cardNum:dayOfCycle, cardUnit:'天', hourglassTitle:'经期中', daysUntilNext:undefined, nextDateStr:nmon+'.'+String(nday).padStart(2,'0') };
    }
    return { cyclePercent:Math.min(dayOfCycle/c.avgCycle*100,100), ringText:dun>0?String(dun):'?', ringLabel:'天后预计', title:dun>0?'预计经期':'可能已推迟', desc:dun>0?'约'+dun+'天后':'建议记录', dayNum:dayOfCycle, dayLabel:'周期日', cycleLen:c.avgCycle, periodLen:c.avgPeriod, avgCycle:c.avgCycle, avgPeriod:c.avgPeriod, quickNum:dun>0?dun:'!', quickUnit:dun>0?'天':'', quickLabel:'距下次', cardTitle:dun>0?'预计下次':'经期可能推迟', cardNum:dun>0?dun:'!', cardUnit:dun>0?'天后':'', hourglassTitle:dun>0?'距下次经期':'注意观察', daysUntilNext:dun>0?dun:-1, nextDateStr:nmon+'.'+String(nday).padStart(2,'0') };
  }
};

/* ============================================
   健康管理（体重 + 经期）
   ============================================ */
const HealthView = {
  activeTab: 'weight',
  render() {
    const now = new Date();
    CalNav.init('health', now.getFullYear(), now.getMonth(), todayStr());
    this.renderPage();
  },
  renderPage() {
    const view = $('#view-health');
    view.innerHTML = `
      <div class="tab-bar">
        <div class="tab-item ${this.activeTab==='weight'?'active':''}" onclick="HealthView.switchTab('weight')">体重记录</div>
        <div class="tab-item ${this.activeTab==='period'?'active':''}" onclick="HealthView.switchTab('period')">经期记录</div>
      </div>
      <div id="healthContent"></div>
    `;
    if (this.activeTab === 'weight') this.renderWeight(); else this.renderPeriod();
  },
  switchTab(tab) { this.activeTab = tab; this.renderPage(); },

  // === 体重 ===
  renderWeight() {
    const ws = Store.getWeights().sort((a,b) => a.date.localeCompare(b.date));
    const latest = ws[ws.length-1];
    const prev = ws[ws.length-2];
    const content = $('#healthContent'); if (!content) return;

    let html = '';

    // Hero
    html += `<div class="glass glass-pink weight-hero">
      <div class="weight-hero-left">
        <div class="weight-hero-label">当前体重</div>
        <div class="weight-hero-value"><span class="weight-hero-num">${latest ? Number(latest.weight).toFixed(2) : '--'}</span><span class="weight-hero-unit">kg</span></div>`;
    if (latest && prev) {
      const d = (latest.weight - prev.weight);
      html += `<div class="weight-change ${d<0?'down':'up'}">${d>0?'↑':'↓'} ${Math.abs(d).toFixed(2)} kg ${d<0?'🎉 减重成功':'继续努力'}</div>`;
    } else {
      html += `<div class="text-xs text-tertiary">${latest?'首次记录':'暂无记录'}</div>`;
    }
    html += `</div>
      <div class="ring-container" style="width:80px;height:80px">
        ${ringSVG(ws.length > 0 ? Math.min(ws.length / 30 * 100, 100) : 0, 80, 6)}
        <div class="ring-center"><div class="ring-percent" style="font-size:20px">${ws.length}</div><div class="ring-label">天</div></div>
      </div>
    </div>`;

    // Mini stats
    html += `<div class="weight-mini-stats">
      <div class="glass weight-mini-stat">
        <div class="weight-mini-label">记录天数</div>
        <div class="weight-mini-value">${ws.length}<span class="unit"> 天</span></div>
      </div>
      <div class="glass weight-mini-stat">
        <div class="weight-mini-label">平均体重</div>
        <div class="weight-mini-value">${ws.length?(ws.reduce((s,w)=>s+w.weight,0)/ws.length).toFixed(2):'--'}<span class="unit"> kg</span></div>
      </div>
    </div>`;

    // Chart
    html += `<div class="glass chart-card">
      <div class="dash-card-header"><div class="dash-card-title">📈 体重趋势</div>
        <button class="btn btn-primary btn-sm" onclick="HealthView.openWeightAdd()">+ 记录</button></div>
      <div class="chart-wrapper"><canvas id="weightChart"></canvas></div>
    </div>`;

    // History
    html += `<div class="glass"><div class="section-title" style="padding:18px 18px 0">📝 历史记录</div><div class="history-list">`;
    if (ws.length === 0) {
      html += '<div class="empty-state">暂无记录</div>';
    } else {
      [...ws].reverse().forEach(w => {
        html += `<div class="history-item">
          <div class="history-info">
            <div class="history-date">${w.date} ${getWeekday(w.date)}</div>
          </div>
          <div class="flex items-center gap-10" style="gap:10px">
            <div class="history-weight">${Number(w.weight).toFixed(2)} <span style="font-size:12px;color:var(--text-secondary)">kg</span></div>
            <div class="task-actions">
              <button class="btn-icon" onclick="HealthView.openWeightEdit('${w.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="btn-icon" onclick="HealthView.delWeight('${w.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
            </div>
          </div>
        </div>`;
      });
    }
    html += '</div></div>';

    content.innerHTML = html;
    this.renderWeightChart(ws);
  },
  renderWeightChart(ws) {
    ChartMgr.destroy('weight');
    if (ws.length === 0) return;
    const ctx = $('#weightChart'); if (!ctx) return;
    const opts = ChartMgr.darkOpts();
    ChartMgr.charts.weight = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ws.map(w => w.date.slice(5)),
        datasets: [{
          label: '体重 (kg)', data: ws.map(w => w.weight),
          borderColor: '#ff3d7f', backgroundColor: 'rgba(255,61,127,0.08)',
          fill: true, tension: 0.35, borderWidth: 2,
          pointBackgroundColor: '#ff3d7f', pointRadius: 3, pointHoverRadius: 6
        }]
      },
      options: { ...opts, plugins: { ...opts.plugins, legend: { display: false } }, scales: { ...opts.scales, y: { ...opts.scales.y, ticks: { ...opts.scales.y.ticks, callback: (v) => Number(v).toFixed(2) } } } }
    });
  },
  openWeightAdd() { Modal.open('记录体重', this._weightForm()); },
  openWeightEdit(id) { const w = Store.getWeights().find(x => x.id === id); if (!w) return; Modal.open('编辑记录', this._weightForm(w)); },
  _weightForm(w = null) {
    return `
      <div class="form-row">
        <div class="form-group"><label class="form-label">日期</label>${dateFieldHTML('w-date', w?w.date:todayStr())}</div>
        <div class="form-group"><label class="form-label">体重 (kg)</label><input class="form-input" type="number" step="0.01" id="w-weight" placeholder="如 65.50" value="${w?w.weight:''}" autofocus></div>
      </div>
      <div class="form-actions"><button class="btn btn-glass" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="HealthView.saveWeight('${w?w.id:''}')">保存</button></div>
    `;
  },
  saveWeight(id) {
    const wt = parseFloat($('#w-weight').value);
    if (!wt) { Toast.show('请输入体重', 'error'); return; }
    const data = {
      date: $('#w-date').value, weight: wt
    };
    if (id) { Store.updateWeight(id, data); Toast.show('已更新'); }
    else { Store.addWeight(data); Toast.show('已添加'); }
    Modal.close(); this.renderWeight();
  },
  delWeight(id) { ConfirmDialog.show('确认删除这条体重记录？', () => { Store.deleteWeight(id); this.renderWeight(); Toast.show('已删除'); }); },

  // === 经期 ===
  renderPeriod() {
    const periods = Store.getPeriods().sort((a,b) => b.startDate.localeCompare(a.startDate));
    const today = todayStr();
    const content = $('#healthContent'); if (!content) return;

    let html = '';

    // 计算统计（与健康页、首页共用同一结论）
    const pc = computePeriodConclusion(periods, today);
    const avgCycle = pc.avgCycle, avgPeriod = pc.avgPeriod;

    // Hero - 当前状态
    const latest = periods[0];
    if (latest) {
      const dayOfCycle = pc.dayOfCycle;
      const inPeriod = pc.inPeriod;
      const nextDate = pc.nextStart;
      const daysUntil = pc.daysUntilNext;

      html += `<div class="glass glass-pink weight-hero">
        <div class="weight-hero-left">
          <div class="weight-hero-label">${inPeriod ? '经期中' : '经期记录'}</div>
          <div class="weight-hero-value"><span class="weight-hero-num" style="font-size:36px">${inPeriod ? 'D'+dayOfCycle : (daysUntil>0?daysUntil:'?')}</span><span class="weight-hero-unit">${inPeriod?'':'天后'}</span></div>
          <div class="text-xs" style="color:var(--pink-light);margin-top:4px">${inPeriod ? `第${dayOfCycle}天 · 注意休息` : (daysUntil>0 ? `预计${nextDate.getMonth()+1}月${nextDate.getDate()}日` : '可能推迟')}</div>
        </div>
        <div class="ring-container" style="width:80px;height:80px">
          ${ringSVG(avgCycle > 0 ? Math.min(dayOfCycle / avgCycle * 100, 100) : 0, 80, 6)}
          <div class="ring-center"><div class="ring-percent" style="font-size:18px">${dayOfCycle}</div><div class="ring-label">天</div></div>
        </div>
      </div>`;
    } else {
      html += `<div class="glass glass-pink weight-hero">
        <div class="weight-hero-left">
          <div class="weight-hero-label">经期记录</div>
          <div class="weight-hero-value"><span class="weight-hero-num" style="font-size:28px">暂无记录</span></div>
          <div class="text-xs text-tertiary" style="margin-top:4px">点击下方按钮记录首次经期</div>
        </div>
      </div>`;
    }

    // Mini stats
    html += `<div class="weight-mini-stats">
      <div class="glass weight-mini-stat">
        <div class="weight-mini-label">平均周期</div>
        <div class="weight-mini-value">${avgCycle||'--'}<span class="unit"> 天</span></div>
      </div>
      <div class="glass weight-mini-stat">
        <div class="weight-mini-label">平均经期</div>
        <div class="weight-mini-value">${avgPeriod||'--'}<span class="unit"> 天</span></div>
      </div>
      <div class="glass weight-mini-stat">
        <div class="weight-mini-label">记录次数</div>
        <div class="weight-mini-value">${periods.length}<span class="unit"> 次</span></div>
      </div>
    </div>`;

    // Add button
    html += `<div style="text-align:right;margin-bottom:14px"><button class="btn btn-primary btn-sm" onclick="HealthView.openPeriodAdd()">+ 记录经期</button></div>`;

    // History
    html += `<div class="glass"><div class="section-title" style="padding:18px 18px 0">🌸 经期记录</div><div class="history-list">`;
    if (periods.length === 0) {
      html += '<div class="empty-state"><div class="empty-state-icon">🌸</div>暂无经期记录</div>';
    } else {
      periods.forEach((p, i) => {
        const startD = parseDate(p.startDate);
        let duration = '--';
        if (p.endDate) {
          duration = Math.floor((parseDate(p.endDate) - startD) / 86400000) + 1;
        }
        let cycleGap = '';
        if (i < periods.length - 1) {
          const prev = parseDate(periods[i+1].startDate);
          cycleGap = ` · 间隔${Math.round((startD - prev) / 86400000)}天`;
        }
        html += `<div class="history-item">
          <div class="history-info">
            <div class="history-date">${p.startDate} ~ ${p.endDate||'进行中'} ${getWeekday(p.startDate)}</div>
            <div class="history-extra">时长 ${duration} 天${cycleGap}${p.note?' · '+p.note:''}</div>
          </div>
          <div class="flex items-center gap-10" style="gap:10px">
            <div class="history-weight" style="color:var(--pink-light)">${duration}${duration!=='--'?'<span style="font-size:12px;color:var(--text-secondary)">天</span>':''}</div>
            <div class="task-actions">
              <button class="btn-icon" onclick="HealthView.openPeriodEdit('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="btn-icon" onclick="HealthView.delPeriod('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
            </div>
          </div>
        </div>`;
      });
    }
    html += '</div></div>';

    content.innerHTML = html;
  },
  openPeriodAdd() { Modal.open('记录经期', this._periodForm()); },
  openPeriodEdit(id) { const p = Store.getPeriods().find(x => x.id === id); if (!p) return; Modal.open('编辑经期', this._periodForm(p)); },
  _periodForm(p = null) {
    const today = todayStr();
    return `
      <div class="form-group"><label class="form-label">开始日期</label>${dateFieldHTML('p-start', p?p.startDate:today)}</div>
      <div class="form-group"><label class="form-label">结束日期</label>${dateFieldHTML('p-end', p?p.endDate||'':'', '留空表示进行中', true)}<div class="text-xs text-tertiary" style="margin-top:4px">不填则表示经期进行中，时长自动计算</div></div>
      <div class="form-group"><label class="form-label">备注（可选）</label><input class="form-input" id="p-note" placeholder="如 经量/症状等" value="${p?p.note||'':''}"></div>
      <div class="form-actions"><button class="btn btn-glass" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="HealthView.savePeriod('${p?p.id:''}')">保存</button></div>
    `;
  },
  savePeriod(id) {
    const startDate = $('#p-start').value;
    if (!startDate) { Toast.show('请选择开始日期', 'error'); return; }
    const endDate = $('#p-end').value || null;
    if (endDate && endDate < startDate) { Toast.show('结束日期不能早于开始日期', 'error'); return; }
    const note = $('#p-note').value.trim();
    const data = { startDate, endDate, note };
    if (id) { Store.updatePeriod(id, data); Toast.show('已更新'); }
    else { Store.addPeriod(data); Toast.show('已添加'); }
    Modal.close(); this.renderPeriod();
  },
  delPeriod(id) { ConfirmDialog.show('确认删除这条经期记录？', () => { Store.deletePeriod(id); this.renderPeriod(); Toast.show('已删除'); }); },

  // === 日历（预留） ===
  renderCal() { this.renderPage(); }
};

/* ============================================
   记账本
   ============================================ */
const AccountView = {
  viewMode: 'account',
  curYear: new Date().getFullYear(),
  curMonth: new Date().getMonth(),
  selAccount: 'all',
  filterType: 'all',
  filterCat: 'all',
  filterYear: new Date().getFullYear(),
  filterMonth: new Date().getMonth() + 1,
  reimburseTab: 'pending',
  reimbursePeriod: 'month',
  reimburseSelYear: new Date().getFullYear(),
  reimburseSelMonth: new Date().getMonth() + 1,
  selectedReimIds: [],
  hideAmount: Store.get(KEYS.hideAmount, false),
  reorderMode: false,
  toggleHide() {
    this.hideAmount = !this.hideAmount;
    Store.set(KEYS.hideAmount, this.hideAmount);
    this.render();
  },
  _fmtAmt(n, prefix = '') {
    return `${prefix}${fmtMoney(n)}`;
  },
  _balanceOf(accAll) {
    const inc = accAll.filter(e => e.type === 'income').reduce((s,e) => s + parseFloat(e.amount), 0);
    const exp = accAll.filter(e => e.type === 'expense').reduce((s,e) => s + parseFloat(e.amount), 0);
    const tin = accAll.filter(e => e.type === 'transfer' && e.transferDir === 'in').reduce((s,e) => s + parseFloat(e.amount), 0);
    const tout = accAll.filter(e => e.type === 'transfer' && e.transferDir === 'out').reduce((s,e) => s + parseFloat(e.amount), 0);
    const rin = accAll.filter(e => e.type === 'refund' || e.type === 'reimburse').reduce((s,e) => s + parseFloat(e.amount), 0);
    return inc - exp + tin - tout + rin;
  },
  _balanceText(bal, hide) {
    if (hide) return '∗∗∗∗';
    if (bal < 0) return '<span class="bal-error">【该笔记账有误】</span>';
    return `${bal>=0?'':'-'}${fmtMoney(Math.abs(bal))}`;
  },
  _txAmtHTML(e) {
    let sign, cls;
    if (e.type === 'income') { sign = '+'; cls = 'income'; }
    else if (e.type === 'expense') { sign = '-'; cls = 'expense'; }
    else if (e.type === 'refund') { sign = '+'; cls = 'refund'; }
    else if (e.type === 'reimburse') { sign = '+'; cls = 'reimburse'; }
    else { sign = e.transferDir === 'in' ? '+' : '-'; cls = 'transfer'; }
    return `<div class="transaction-amount ${cls}">${this._fmtAmt(e.amount, sign)}</div>`;
  },
  _poolEntries() {
    let pool = Store.getAccounts();
    if (this.selAccount !== 'all') pool = pool.filter(e => e.account === this.selAccount);
    if (this.filterYear !== 'all') pool = pool.filter(e => yearKey(e.date) === String(this.filterYear));
    if (this.filterMonth !== 'all') pool = pool.filter(e => parseInt(e.date.slice(5, 7), 10) === this.filterMonth);
    return pool;
  },
  // 统一的类型筛选匹配：退款/报销为"业务口径"，包含原账单 + 对应的资金流水记录
  _matchFilterType(e, t) {
    if (!t || t === 'all') return true;
    if (t === 'refund') {
      // 退款 = 发生过退款的支出账单 + 退款到账的收入流水（含历史 type:'refund'）
      return e.type === 'refund' || !!e.refundId || (e.type === 'expense' && (e.refunds || []).length > 0);
    }
    if (t === 'reimburse') {
      // 报销 = 标记为可报销的支出（待报销/已报销）+ 报销到账的收入流水（含历史 type:'reimburse'）
      return e.type === 'reimburse' || !!e.reimbursementId || (e.type === 'expense' && !!e.reimbursable);
    }
    // 收入/支出/转账保持原口径（退款、报销到账本身就是收入，仍计入"收入"）
    return e.type === t;
  },
  _getFilteredEntries() {
    let filtered = this._poolEntries().filter(e => this._matchFilterType(e, this.filterType));
    if (this.filterCat !== 'all') filtered = filtered.filter(e => e.category === this.filterCat);
    return filtered;
  },
  _isFiltered() {
    const defaultMonth = (this.filterYear === this.curYear && this.filterMonth === this.curMonth + 1);
    return this.filterType !== 'all' || this.filterCat !== 'all' || !defaultMonth;
  },
  _summaryHTML(filtered) {
    const fInc = filtered.filter(e => e.type === 'income').reduce((s,e) => s + parseFloat(e.amount), 0);
    const fExp = filtered.filter(e => e.type === 'expense').reduce((s,e) => s + parseFloat(e.amount), 0);
    const fBal = fInc - fExp;
    const isF = this._isFiltered();
    const prevExp = isF ? 0 : this._prevMonthExp || 0;
    const expChange = prevExp > 0 ? Math.round((fExp - prevExp) / prevExp * 100) : 0;
    const incExtra = `${filtered.filter(e=>e.type==='income').length} 笔`;
    const expExtra = isF ? `${filtered.filter(e=>e.type==='expense').length} 笔`
      : (prevExp > 0 ? `较上月 ${expChange>=0?'↑':'↓'} ${Math.abs(expChange)}%` : '暂无对比');
    return `<div class="account-summary" id="accountSummary">
      <div class="glass summary-card income">
        <div class="summary-label">${isF?'筛选收入':'收入'}</div>
        <div class="summary-amount income">${this._fmtAmt(fInc)}</div>
        <div class="summary-extra">${incExtra}</div>
      </div>
      <div class="glass summary-card expense">
        <div class="summary-label">${isF?'筛选支出':'支出'}</div>
        <div class="summary-amount expense">${this._fmtAmt(fExp)}</div>
        <div class="summary-extra">${expExtra}</div>
      </div>
      <div class="glass summary-card balance">
        <div class="summary-label">结余</div>
        <div class="summary-amount" style="color:${fBal>=0?'var(--success)':'var(--danger)'}">${this._fmtAmt(Math.abs(fBal), fBal>=0?'':'-')}</div>
        <div class="summary-extra">${fBal>=0?'收支健康':'注意支出'}</div>
      </div>
    </div>`;
  },
  getOrderedAccounts() {
    const order = Store.getAccountOrder();
    if (!order || order.length === 0) return CONFIG.accounts;
    const ordered = order.filter(a => CONFIG.accounts.includes(a));
    const missing = CONFIG.accounts.filter(a => !order.includes(a));
    return [...ordered, ...missing];
  },
  toggleReorder() {
    this.reorderMode = !this.reorderMode;
    this.render();
  },
  moveAccount(idx, dir) {
    const accounts = this.getOrderedAccounts();
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= accounts.length) return;
    [accounts[idx], accounts[newIdx]] = [accounts[newIdx], accounts[idx]];
    Store.saveAccountOrder(accounts);
    this.render();
  },
  openAccountDetail(accName) {
    const all = Store.getAccounts().filter(e => e.account === accName);
    const inc = all.filter(e=>e.type==='income').reduce((s,e)=>s+parseFloat(e.amount),0);
    const exp = all.filter(e=>e.type==='expense').reduce((s,e)=>s+parseFloat(e.amount),0);
    const bal = this._balanceOf(all);
    const sorted = [...all].sort((a,b)=>b.date.localeCompare(a.date));
    let body = `
      <div class="account-detail-header">
        <div class="account-detail-icon">${CONFIG.accountIcons[accName]||'💳'}</div>
        <div class="account-detail-name">${accName}</div>
        <div class="account-detail-balance tabular" style="color:${bal<0?'var(--danger)':(bal>=0?'var(--success)':'var(--text)')}">${this._balanceText(bal, this.hideAmount)}</div>
      </div>
      <div class="account-detail-summary">
        <div class="glass summary-card income"><div class="summary-label">收入</div><div class="summary-amount income">${this._fmtAmt(inc)}</div><div class="summary-extra">${all.filter(e=>e.type==='income').length} 笔</div></div>
        <div class="glass summary-card expense"><div class="summary-label">支出</div><div class="summary-amount expense">${this._fmtAmt(exp)}</div><div class="summary-extra">${all.filter(e=>e.type==='expense').length} 笔</div></div>
        <div class="glass summary-card balance"><div class="summary-label">结余</div><div class="summary-amount" style="color:${bal<0?'var(--danger)':(bal>=0?'var(--success)':'var(--text)')}">${this._balanceText(bal, this.hideAmount)}</div><div class="summary-extra">${bal>=0?'收支健康':'该笔记账有误'}</div></div>
      </div>
      <div class="section-title" style="margin:16px 0 8px">📜 交易明细 (${all.length}笔)</div>
      <div class="transaction-list" style="padding:0">
    `;
    if (sorted.length === 0) {
      body += '<div class="empty-state">该账户暂无记录</div>';
    } else {
      sorted.forEach(e => {
        const icon = CONFIG.categoryIcons[e.category] || '📌';
        const color = CONFIG.categoryColors[e.category] || '#95a5a6';
        const refunded = this._refundedTotal(e);
        const netTag = (e.type === 'expense' && refunded > 0)
          ? `<span class="tx-refund-tag">已退 ${fmtMoney(refunded)}</span>` : '';
        body += `<div class="transaction-item" onclick="AccountView.openExpenseDetail('${e.id}')">
          <div class="transaction-icon" style="background:${color}22">${icon}</div>
          <div class="transaction-info">
            <div class="transaction-category">${e.category} ${netTag}</div>
            <div class="transaction-note">${e.note||'无备注'}</div>
            <div class="transaction-meta">${e.date} · ${getWeekday(e.date)}</div>
          </div>
          ${this._txAmtHTML(e)}
          <div class="transaction-actions" onclick="event.stopPropagation()">
            ${e.type === 'expense' ? `<button class="btn-icon btn-icon-refund" title="退款" onclick="AccountView.openRefundForm('${e.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></button>` : ''}
            <button class="btn-icon" title="编辑" onclick="AccountView.openEdit('${e.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="btn-icon" title="删除" onclick="AccountView.del('${e.id}','${accName}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
          </div>
        </div>`;
      });
    }
    body += '</div>';
    // 纠正按钮
    body += `<div style="padding:16px 0 0;text-align:center">
      <button class="btn btn-glass btn-sm" onclick="AccountView.openCorrection('${accName}',${inc},${exp},${bal})">🔧 纠正余额</button>
    </div>`;
    Modal.open(`${CONFIG.accountIcons[accName]||'💳'} ${accName}`, body);
  },
  openCorrection(accName, inc, exp, bal) {
    const calculated = (bal === undefined ? inc - exp : bal);
    const body = `
      <div class="correction-form">
        <div class="correction-info">
          <div class="correction-info-item">
            <span class="correction-info-label">收入</span>
            <span class="correction-info-value text-success tabular">${fmtMoney(inc)}</span>
          </div>
          <div class="correction-info-item">
            <span class="correction-info-label">支出</span>
            <span class="correction-info-value text-danger tabular">${fmtMoney(exp)}</span>
          </div>
          <div class="correction-info-item highlight">
            <span class="correction-info-label">当前结余</span>
            <span class="correction-info-value tabular" style="color:${calculated>=0?'var(--success)':'var(--danger)'}">${calculated>=0?'':'-'}${fmtMoney(Math.abs(calculated))}</span>
          </div>
        </div>
        <div class="correction-divider">收入 − 支出 = 结余</div>
        <div class="form-group">
          <label class="form-label">实际余额</label>
          <input class="form-input" type="number" step="0.01" id="cor-actual" placeholder="输入账户实际余额" autofocus>
          <div class="text-xs text-tertiary" style="margin-top:4px">输入实际余额后，系统自动生成一笔纠正记录使结余与实际一致</div>
        </div>
        <div class="correction-preview" id="cor-preview" style="display:none">
          <div class="correction-preview-row">
            <span class="text-sm text-secondary">差额</span>
            <span class="font-bold tabular" id="cor-diff"></span>
          </div>
          <div class="correction-preview-row">
            <span class="text-sm text-secondary">将自动记录</span>
            <span class="font-bold tabular" id="cor-action"></span>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-glass" onclick="AccountView.openAccountDetail('${accName}')">取消</button>
          <button class="btn btn-primary" onclick="AccountView.saveCorrection('${accName}',${inc},${exp})">确认纠正</button>
        </div>
      </div>
    `;
    Modal.open('🔧 纠正余额', body);
    // 实时预览差额
    setTimeout(() => {
      const input = $('#cor-actual');
      if (input) input.addEventListener('input', () => {
        const actual = parseFloat(input.value);
        const preview = $('#cor-preview');
        if (isNaN(actual)) { preview.style.display = 'none'; return; }
        const diff = actual - calculated;
        preview.style.display = 'block';
        $('#cor-diff').textContent = `${diff>=0?'+':'-'}${fmtMoney(Math.abs(diff))}`;
        $('#cor-diff').style.color = diff >= 0 ? 'var(--success)' : 'var(--danger)';
        if (Math.abs(diff) < 0.01) {
          $('#cor-action').textContent = '无需纠正';
          $('#cor-action').style.color = 'var(--text-secondary)';
        } else if (diff > 0) {
          $('#cor-action').textContent = `+${fmtMoney(diff)}（收入 · 其他）`;
          $('#cor-action').style.color = 'var(--success)';
        } else {
          $('#cor-action').textContent = `-${fmtMoney(Math.abs(diff))}（支出 · 其他）`;
          $('#cor-action').style.color = 'var(--danger)';
        }
      });
    }, 50);
  },
  saveCorrection(accName, inc, exp, bal) {
    const actual = parseFloat($('#cor-actual').value);
    if (isNaN(actual)) { Toast.show('请输入实际余额', 'error'); return; }
    const calculated = (bal === undefined ? inc - exp : bal);
    const diff = actual - calculated;
    if (Math.abs(diff) < 0.01) { Toast.show('余额已正确，无需纠正', 'info'); return; }
    const entry = {
      type: diff > 0 ? 'income' : 'expense',
      amount: Math.abs(diff),
      date: todayStr(),
      account: accName,
      category: '其他',
      note: '余额纠正'
    };
    Store.addAccount(entry);
    Toast.show(`已纠正 ${diff>0?'+':''}${fmtMoney(Math.abs(diff))}`);
    Modal.close();
    this.openAccountDetail(accName);
    this.render();
  },
  render() {
    const view = $('#view-account');
    if (this.viewMode === 'reimburse') { view.innerHTML = this._renderReimburseView(); return; }
    const all = Store.getAccounts();
    const years = [...new Set(all.map(e => yearKey(e.date)))].sort();
    if (!years.includes(String(this.curYear))) years.push(String(this.curYear));
    years.sort();

    const monthStr = `${this.curYear}-${String(this.curMonth+1).padStart(2,'0')}`;
    const monthAll = all.filter(e => monthKey(e.date) === monthStr);
    const entries = this.selAccount === 'all' ? monthAll : monthAll.filter(e => e.account === this.selAccount);
    this._curEntries = entries;

    // 上月对比
    const prevD = new Date(this.curYear, this.curMonth - 1, 1);
    const prevStr = `${prevD.getFullYear()}-${String(prevD.getMonth()+1).padStart(2,'0')}`;
    this._prevMonthExp = all.filter(e => monthKey(e.date) === prevStr && e.type === 'expense').reduce((s,e) => s + parseFloat(e.amount), 0);

    let html = `<div class="page-header page-header-row">
      <div class="page-header-actions" style="margin-left:auto">
        <button class="btn btn-glass btn-sm btn-clear-data" onclick="AccountView.clearAllData()" title="清除数据">🗑</button>
        <button class="btn btn-glass btn-sm" style="color:var(--info)" onclick="AccountView.switchViewMode('reimburse')">💰 报销</button>
        <button class="btn btn-glass btn-sm" style="color:var(--info)" onclick="AccountView.exportAllData()" title="导出全部记账数据（CSV）">📤 导出</button>
        <button class="btn btn-primary btn-sm" onclick="AccountView.openAdd()">+ 记一笔</button>
      </div>
    </div>`;

    // 账户总览
    const hidden = this.hideAmount;
    const orderedAccounts = this.getOrderedAccounts();
    const accountBalances = orderedAccounts.map(acc => {
      const accAll = all.filter(e => e.account === acc);
      const balance = this._balanceOf(accAll);
      return { name: acc, balance };
    });
    const totalBalance = accountBalances.reduce((s, a) => s + a.balance, 0);
    const eyeSvg = hidden
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

    html += `<div class="glass account-balance-card">
      <div class="dash-card-header" style="margin-bottom:0">
        <div class="dash-card-title">
          <div class="dash-card-title-icon" style="background:var(--info-bg)">🏦</div>
          国库
        </div>
        <div class="flex items-center" style="gap:8px">
          <button class="btn btn-glass btn-sm" onclick="AccountView.toggleReorder()">${this.reorderMode?'✓ 完成':'↕ 排序'}</button>
          <button class="btn-icon" onclick="AccountView.toggleHide()" title="${hidden?'显示金额':'隐藏金额'}">${eyeSvg}</button>
        </div>
      </div>
      <div class="account-balance-total">
        <span class="account-balance-label">总资产</span>
        <span class="account-balance-value tabular" style="color:${totalBalance>=0?'var(--success)':'var(--danger)'}">${hidden?'∗∗∗∗':`${totalBalance>=0?'':'-'}${fmtMoney(Math.abs(totalBalance))}`}</span>
      </div>
      <div class="account-balance-list">
        ${accountBalances.map((a, idx) => this.reorderMode ? `
          <div class="account-balance-item reorder-mode">
            <div class="account-balance-left">
              <div class="account-balance-icon">${CONFIG.accountIcons[a.name]||'💳'}</div>
              <span class="account-balance-name">${a.name}</span>
            </div>
            <div class="account-reorder-actions">
              <button class="btn-icon" onclick="AccountView.moveAccount(${idx},-1)" ${idx===0?'disabled':''} title="上移"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg></button>
              <button class="btn-icon" onclick="AccountView.moveAccount(${idx},1)" ${idx===accountBalances.length-1?'disabled':''} title="下移"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></button>
            </div>
          </div>
        ` : `
          <div class="account-balance-item" onclick="AccountView.openAccountDetail('${a.name}')">
            <div class="account-balance-left">
              <div class="account-balance-icon">${CONFIG.accountIcons[a.name]||'💳'}</div>
              <span class="account-balance-name">${a.name}</span>
            </div>
            <div class="account-balance-right">
              <button class="btn-migrate-account" onclick="event.stopPropagation();AccountView.openMigrate('${a.name}')" title="迁移账单"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
              <button class="btn-del-account" onclick="event.stopPropagation();AccountView.deleteAcc('${a.name}')" title="删除账户"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              <span class="account-balance-amount tabular" style="color:${a.balance<0?'var(--danger)':'var(--text)'}">${this._balanceText(a.balance, hidden)}</span>
              <svg class="account-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="add-account-row">
        <button class="btn-add-account" onclick="AccountView.openAddAccount()">
          <span class="add-icon">+</span>
          <span>新增账户</span>
        </button>
      </div>
    </div>`;

    // Year tabs
    html += '<div class="year-tabs">';
    years.forEach(y => html += `<div class="year-tab ${parseInt(y)===this.curYear?'active':''}" onclick="AccountView.selYear(${y})">${y}年</div>`);
    html += '</div>';

    // Month pills bar
    html += `<div class="month-bar">
      <button class="month-arrow" onclick="AccountView.prevMonth()" aria-label="上个月">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="month-pills">
        ${MONTH_NAMES.map((m,i) => `<div class="month-pill ${i===this.curMonth?'active':''}" onclick="AccountView.selMonth(${i})">${m}</div>`).join('')}
      </div>
      <button class="month-arrow" onclick="AccountView.nextMonth()" aria-label="下个月">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>`;

    // Summary — reacts to filter state
    html += this._summaryHTML(this._getFilteredEntries());

    // Account chips
    html += '<div class="account-chips">';
    html += `<div class="account-chip ${this.selAccount==='all'?'active':''}" onclick="AccountView.selAcc('all')">全部</div>`;
    this.getOrderedAccounts().forEach(acc => {
      const t = monthAll.filter(e => e.account === acc).reduce((s,e) => {
        if (e.type === 'expense') return s - parseFloat(e.amount);
        if (e.type === 'income') return s + parseFloat(e.amount);
        if (e.type === 'transfer') return s + (e.transferDir === 'in' ? parseFloat(e.amount) : -parseFloat(e.amount));
        if (e.type === 'refund' || e.type === 'reimburse') return s + parseFloat(e.amount);
        return s;
      }, 0);
      html += `<div class="account-chip ${this.selAccount===acc?'active':''}" onclick="AccountView.selAcc('${acc}')">${acc}<span class="chip-amount">${t>=0?'+':''}${t.toFixed(0)}</span></div>`;
    });
    html += '</div>';

    // 收支日历
    html += `<div class="glass chart-card">
      <div class="section-title">📅 收支日历</div>
      <div id="accCal"></div>
      <div id="accDayContent"></div>
    </div>`;

    // （已移除：月度收支图表与年度对比）

    view.innerHTML = html;
    this._scrollMonth();
    // 收支日历
    if (this.calYear === undefined) { const nd = new Date(); this.calYear = nd.getFullYear(); this.calMonth = nd.getMonth(); }
    if (!this.calSel) this.calSel = todayStr();
    CalNav.init('account', this.calYear, this.calMonth, this.calSel);
    this.renderCal();
    this.renderDay();
  },
  _scrollMonth() {
    const bar = $('.month-pills');
    const active = bar && bar.querySelector('.month-pill.active');
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  },
  renderCharts(all) {
    // 已移除年度图表（月度收支 / 年度对比）
  },
  renderCal() {
    const all = Store.getAccounts();
    const dayMap = {};
    all.forEach(e => {
      if (!dayMap[e.date]) dayMap[e.date] = { inc: 0, exp: 0, n: 0 };
      dayMap[e.date].n++;
      if (e.type === 'income') dayMap[e.date].inc += parseFloat(e.amount);
      else if (e.type === 'expense') dayMap[e.date].exp += parseFloat(e.amount);
    });
    Calendar.render($('#accCal'), CalNav._s.y, CalNav._s.m, {
      selectedDate: CalNav._s.sel,
      hasData: ds => !!(dayMap[ds] && dayMap[ds].n > 0),
      dayHtml: ds => {
        const d = dayMap[ds];
        if (!d || d.n === 0) return '';
        let s = '';
        if (d.inc > 0) s += `<span class="acc-day-inc">+${fmtMoney(d.inc)}</span>`;
        if (d.exp > 0) s += `<span class="acc-day-exp">-${fmtMoney(d.exp)}</span>`;
        return s ? `<span class="acc-day-amts">${s}</span>` : '';
      }
    });
  },
  renderDay() {
    const ds = CalNav._s.sel;
    const all = Store.getAccounts();
    const dayEntries = all.filter(e => e.date === ds);
    const inc = dayEntries.filter(e => e.type === 'income').reduce((s, e) => s + parseFloat(e.amount), 0);
    const exp = dayEntries.filter(e => e.type === 'expense').reduce((s, e) => s + parseFloat(e.amount), 0);
    let html = `<div class="acc-day-header"><span>${ds}</span><span class="acc-day-sum">收 <b style="color:var(--success)">${this._fmtAmt(inc)}</b> · 支 <b style="color:var(--danger)">${this._fmtAmt(exp)}</b></span></div>`;
    if (dayEntries.length === 0) {
      html += '<div class="empty-state" style="padding:20px">当日无收支记录</div>';
    } else {
      html += '<div class="transaction-list">';
      dayEntries.forEach(e => {
        const icon = CONFIG.categoryIcons[e.category] || '📌';
        const color = CONFIG.categoryColors[e.category] || '#95a5a6';
        html += `<div class="transaction-item" onclick="AccountView.openExpenseDetail('${e.id}')">
          <div class="transaction-icon" style="background:${color}22">${icon}</div>
          <div class="transaction-info">
            <div class="transaction-category">${e.category}</div>
            <div class="transaction-note">${e.account} · ${e.note || '无备注'}</div>
          </div>
          ${this._txAmtHTML(e)}
        </div>`;
      });
      html += '</div>';
    }
    const el = $('#accDayContent'); if (el) el.innerHTML = html;
  },
  selYear(y) { this.curYear = y; this.filterYear = y; this.render(); },
  selMonth(m) { this.curMonth = m; this.filterMonth = m + 1; this.render(); },
  prevMonth() { this.curMonth--; if (this.curMonth < 0) { this.curMonth = 11; this.curYear--; } this.filterYear = this.curYear; this.filterMonth = this.curMonth + 1; this.render(); },
  nextMonth() { this.curMonth++; if (this.curMonth > 11) { this.curMonth = 0; this.curYear++; } this.filterYear = this.curYear; this.filterMonth = this.curMonth + 1; this.render(); },
  selAcc(a) { this.selAccount = a; this.filterCat = 'all'; this.render(); },
  clearAllData() {
    ConfirmDialog.show('⚠️ 确认清除全部数据？（包括记账记录、体重记录、经期记录、自定义账户和分类，此操作不可恢复。）', () => {
      Store.clearAllData();
      this.curYear = new Date().getFullYear();
      this.curMonth = new Date().getMonth();
      this.filterType = 'all';
      this.filterCat = 'all';
      this.filterYear = new Date().getFullYear();
      this.filterMonth = new Date().getMonth() + 1;
      this.selAccount = 'all';
      Toast.show('全部数据已清除');
      this.render();
      if (typeof HealthView !== 'undefined') HealthView.renderWeight();
    });
  },
  exportAllData() {
    const entries = Store.getAccounts().slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (entries.length === 0) { Toast.show('暂无记账数据'); return; }
    const TYPE_LABEL = { income: '收入', expense: '支出', transfer: '转账', refund: '退款', reimburse: '报销' };
    const header = ['日期', '类型', '账户', '分类', '金额', '备注', '可报销', '报销状态', '创建时间'];
    const lines = [header.map(csvCell).join(',')];
    entries.forEach(e => {
      const type = e.type === 'reimburse' ? 'reimburse' : (e.type || '');
      let reimStatus = '否';
      if (e.reimbursable) {
        if (e.reimbursementClosed) reimStatus = '已报销完成';
        else if ((e.reimbursements || []).length) reimStatus = '报销中';
        else reimStatus = '待报销';
      }
      const account = e.account || (e.transferDir === 'out' ? '转出账户' : (e.transferDir === 'in' ? '转入账户' : ''));
      lines.push([
        e.date || '',
        TYPE_LABEL[type] || type,
        account,
        e.category || '',
        e.amount != null ? e.amount : '',
        e.note || '',
        e.reimbursable ? '是' : '否',
        reimStatus,
        e.createdAt || ''
      ].map(csvCell).join(','));
    });
    const csv = '﻿' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fn = `记账数据_全部_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`;
    a.href = url; a.download = fn; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    Toast.show('已导出 ' + entries.length + ' 条记账');
  },
  openAdd() { Modal.open('记一笔', this._form()); },
  openEdit(id) { const e = Store.getAccounts().find(x=>x.id===id); if (!e) return; Modal.open('编辑记录', this._form(e)); },
  _form(e = null) {
    const rawType = e ? e.type : 'expense';
    const selType = (rawType === 'refund' || rawType === 'reimburse') ? 'expense' : rawType;
    const expenseSub = rawType === 'refund' ? 'refund' : rawType === 'reimburse' ? 'reimburse' : 'normal';
    const isReimbursable = e ? !!e.reimbursable : false;
    const cats = selType === 'income' ? CONFIG.incomeCategories : CONFIG.expenseCategories;
    const selCat = e ? e.category : cats[0];
    // 互转（转账）配对：编辑时从 transferGroup 解析出转出/转入账户；新建时默认取前两个账户
    const _accs = this.getOrderedAccounts();
    let tfFrom = _accs[0] || '', tfTo = _accs.length > 1 ? _accs[1] : '';
    if (e && selType === 'transfer') {
      const grp = e.transferGroup;
      const pair = grp ? Store.getAccounts().filter(x => x.transferGroup === grp) : [e];
      const outE = pair.find(x => x.transferDir === 'out') || e;
      const inE = pair.find(x => x.transferDir === 'in');
      tfFrom = outE.account;
      tfTo = inE ? inE.account : (e.transferDir === 'in' ? e.account : '');
    }
    return `
      <div class="form-row">
        <div class="form-group" style="flex:0 0 130px"><label class="form-label">类型</label>
          <div class="type-toggle">
            <div class="type-btn ${selType==='expense'?'active':''}" data-type="expense" onclick="AccountView.selType('expense')">支出</div>
            <div class="type-btn ${selType==='income'?'active':''}" data-type="income" onclick="AccountView.selType('income')">收入</div>
            <div class="type-btn ${selType==='transfer'?'active':''}" data-type="transfer" onclick="AccountView.selType('transfer')">互转</div>
          </div>
          <input type="hidden" id="ac-type" value="${selType}">
          <input type="hidden" id="ac-expense-sub" value="${expenseSub}">
        </div>
        <div class="form-group"><label class="form-label">金额</label><input class="form-input" type="number" step="0.01" id="ac-amount" placeholder="0.00" value="${e?e.amount:''}" autofocus></div>
      </div>
      <div class="form-group"><label class="form-label">日期</label>${dateFieldHTML('ac-date', e?e.date:todayStr())}</div>
      <div class="form-group" id="ac-transfer-group" style="${selType==='transfer'?'':'display:none'}">
        <div class="transfer-account-card">
          <label class="form-label transfer-label-from">转出账户 · A</label>
          <div class="account-field" id="ac-tf-from-field">
            <div class="account-field-scroll">
              ${this.getOrderedAccounts().map(a=>`<div class="account-field-chip ${a===tfFrom?'active':''}" data-account="${a}" onclick="AccountView.selTransferFormAcc('from','${a}')"><span class="af-icon">${CONFIG.accountIcons[a]||'💳'}</span><span class="af-name">${a}</span></div>`).join('')}
            </div>
            <input type="hidden" id="ac-tf-from" value="${tfFrom}">
          </div>
        </div>
        <div class="transfer-arrow-row">
          <div class="transfer-arrow">→</div>
          <button type="button" class="transfer-swap" onclick="AccountView.swapFormTransfer()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            <span>交换</span>
          </button>
        </div>
        <div class="transfer-account-card">
          <label class="form-label transfer-label-to">转入账户 · B</label>
          <div class="account-field" id="ac-tf-to-field">
            <div class="account-field-scroll">
              ${this.getOrderedAccounts().map(a=>`<div class="account-field-chip ${a===tfTo?'active':''}" data-account="${a}" onclick="AccountView.selTransferFormAcc('to','${a}')"><span class="af-icon">${CONFIG.accountIcons[a]||'💳'}</span><span class="af-name">${a}</span></div>`).join('')}
            </div>
            <input type="hidden" id="ac-tf-to" value="${tfTo}">
          </div>
        </div>
        <div class="transfer-note">转账不改变总金额，也不计入收入 / 支出</div>
      </div>
      <div class="form-group" id="ac-account-row" style="${selType==='transfer'?'display:none':''}"><label class="form-label">账户</label>
        <div class="account-field" id="ac-account-field">
          <div class="account-field-scroll">
            ${this.getOrderedAccounts().map(a=>`<div class="account-field-chip ${(e?e.account:this.getOrderedAccounts()[0])===a?'active':''}" data-account="${a}" onclick="AccountView.selFormAccount('${a}')"><span class="af-icon">${CONFIG.accountIcons[a]||'💳'}</span><span class="af-name">${a}</span></div>`).join('')}
          </div>
          <input type="hidden" id="ac-account" value="${e?e.account:this.getOrderedAccounts()[0]}">
        </div>
      </div>
      <div class="form-group" id="ac-category-row" style="${selType==='transfer'?'display:none':''}"><label class="form-label">分类</label>
        <div class="category-grid" id="ac-category-grid">
          ${cats.map(c=>`<div class="category-chip ${c===selCat?'active':''}" data-cat="${c}" onclick="AccountView.selCat('${c}')"><span class="cat-icon">${CONFIG.categoryIcons[c]||'📌'}</span><span class="cat-name">${c}</span></div>`).join('')}
          <div class="category-chip add-category-chip" onclick="AccountView.openAddCategory('${selType}')">
            <span class="cat-icon add-icon">+</span>
            <span class="cat-name">新增</span>
          </div>
        </div>
        <input type="hidden" id="ac-category" value="${selCat}">
      </div>
      <div class="form-group" id="ac-reimbursable-row" style="${(selType==='expense'&&expenseSub!=='refund')?'':'display:none'}">
        <label class="form-label">标记</label>
        <div class="tag-row">
          <div class="tag-chip ${isReimbursable||expenseSub==='reimburse'?'active tag-reimburse':''}" id="ac-reimbursable-tag" onclick="AccountView.toggleReimbursable()">报销</div>
        </div>
        <input type="hidden" id="ac-reimbursable" value="${isReimbursable||expenseSub==='reimburse'}">
      </div>
      <div class="form-group"><label class="form-label">备注</label><input class="form-input" id="ac-note" placeholder="可选备注" value="${e?e.note||'':''}"></div>
      <div class="form-actions"><button class="btn btn-glass" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="AccountView.save('${e?e.id:''}')">保存</button></div>
    `;
  },
  selType(t) {
    $('#ac-type').value = t;
    $$('.type-btn').forEach(b => { if (b.dataset.type) b.classList.toggle('active', b.dataset.type === t); });
    const rr = $('#ac-reimbursable-row');
    if (rr) {
      const sub = $('#ac-expense-sub') ? $('#ac-expense-sub').value : 'normal';
      rr.style.display = (t === 'expense' && sub !== 'refund') ? '' : 'none';
    }
    const cats = t === 'income' ? CONFIG.incomeCategories : CONFIG.expenseCategories;
    const grid = $('#ac-category-grid');
    if (grid) {
      grid.innerHTML = cats.map(c=>`<div class="category-chip" data-cat="${c}" onclick="AccountView.selCat('${c}')"><span class="cat-icon">${CONFIG.categoryIcons[c]||'📌'}</span><span class="cat-name">${c}</span></div>`).join('') +
        `<div class="category-chip add-category-chip" onclick="AccountView.openAddCategory('${t}')"><span class="cat-icon add-icon">+</span><span class="cat-name">新增</span></div>`;
      $('#ac-category').value = cats[0];
    }
    const isT = (t === 'transfer');
    const trG = $('#ac-transfer-group'); if (trG) trG.style.display = isT ? '' : 'none';
    const acR = $('#ac-account-row'); if (acR) acR.style.display = isT ? 'none' : '';
    const catR = $('#ac-category-row'); if (catR) catR.style.display = isT ? 'none' : '';
  },
  toggleReimbursable() {
    const el = $('#ac-reimbursable'); if (!el) return;
    const v = el.value !== 'true';
    el.value = String(v);
    const tag = $('#ac-reimbursable-tag');
    if (tag) { tag.classList.toggle('active', v); tag.classList.toggle('tag-reimburse', v); }
  },
  selTransferDir(d) {
    const el = $('#ac-transfer-dir'); if (el) el.value = d;
    $$('#ac-transfer-dir-group .type-btn').forEach(b => b.classList.toggle('active', b.dataset.dir === d));
  },
  selTransferFormAcc(dir, a) {
    const id = dir === 'from' ? 'ac-tf-from' : 'ac-tf-to';
    const fieldId = dir === 'from' ? 'ac-tf-from-field' : 'ac-tf-to-field';
    const el = $('#' + id); if (el) el.value = a;
    $$('#' + fieldId + ' .account-field-chip').forEach(c => c.classList.toggle('active', c.dataset.account === a));
  },
  swapFormTransfer() {
    const from = $('#ac-tf-from').value;
    const to = $('#ac-tf-to').value;
    this.selTransferFormAcc('from', to);
    this.selTransferFormAcc('to', from);
  },
  selCat(c) {
    $('#ac-category').value = c;
    $$('#ac-category-grid .category-chip').forEach(ch => ch.classList.toggle('active', ch.dataset.cat === c));
  },
  selFormAccount(a) {
    $('#ac-account').value = a;
    $$('#ac-account-field .account-field-chip').forEach(c => c.classList.toggle('active', c.dataset.account === a));
  },
  /** 通用账户选择器（与「记一笔」表单同一视觉风格） */
  _accountFieldHTML(id, selected) {
    const accs = this.getOrderedAccounts();
    const sel = accs.includes(selected) ? selected : (accs[0] || '');
    return `<div class="account-field" id="${id}-field">
      <div class="account-field-scroll">
        ${accs.map(a => `<div class="account-field-chip ${a === sel ? 'active' : ''}" data-account="${a}" onclick="AccountView.selPickAccount('${id}','${a}')"><span class="af-icon">${CONFIG.accountIcons[a] || '💳'}</span><span class="af-name">${a}</span></div>`).join('')}
      </div>
      <input type="hidden" id="${id}" value="${sel}">
    </div>`;
  },
  selPickAccount(id, a) {
    const el = $('#' + id);
    if (el) el.value = a;
    $$('#' + id + '-field .account-field-chip').forEach(c => c.classList.toggle('active', c.dataset.account === a));
  },
  save(id) {
    const amt = parseFloat($('#ac-amount').value);
    if (!amt || amt <= 0) { Toast.show('请输入有效金额', 'error'); return; }
    let type = $('#ac-type').value;
    // expenseSub 仅用于兼容历史数据（旧的 refund / reimburse 记录），表单已不再提供该选项
    const expenseSub = $('#ac-expense-sub') ? $('#ac-expense-sub').value : 'normal';
    if (type === 'expense' && expenseSub === 'refund') type = 'refund';
    const date = $('#ac-date').value;
    const note = $('#ac-note').value.trim();
    // 互转：生成配对的转出 + 转入两笔记录（不计入收支）
    if (type === 'transfer') {
      const from = $('#ac-tf-from').value;
      const to = $('#ac-tf-to').value;
      if (from === to) { Toast.show('转出和转入账户不能相同', 'error'); return; }
      const outNote = note ? `${note} · 转出至${to}` : `转出至${to}`;
      const inNote = note ? `${note} · 转入自${from}` : `转入自${from}`;
      if (id) {
        const e0 = Store.getAccounts().find(x => x.id === id);
        const grp = e0 ? e0.transferGroup : null;
        const pair = grp ? Store.getAccounts().filter(x => x.transferGroup === grp) : [e0];
        const outE = pair.find(x => x.transferDir === 'out') || e0;
        const inE = pair.find(x => x.transferDir === 'in');
        Store.updateAccount(outE.id, { account: from, amount: amt, date, note: outNote });
        if (inE) Store.updateAccount(inE.id, { account: to, amount: amt, date, note: inNote });
        Toast.show('已更新');
      } else {
        const gid = uid();
        Store.addAccount({ type: 'transfer', transferDir: 'out', amount: amt, date, account: from, category: '转账', transferGroup: gid, note: outNote });
        Store.addAccount({ type: 'transfer', transferDir: 'in', amount: amt, date, account: to, category: '转账', transferGroup: gid, note: inNote });
        Toast.show('已添加');
      }
      Modal.close(); this.render(); return;
    }
    const data = { type, amount: amt, date, account: $('#ac-account').value, category: $('#ac-category').value, note };
    if (data.type === 'expense') {
      // 勾选「标记 → 报销」即进入"待报销"，不直接增加收入
      if ($('#ac-reimbursable')) data.reimbursable = $('#ac-reimbursable').value === 'true';
      else if (expenseSub === 'reimburse') data.reimbursable = true;
    }
    if (id) { Store.updateAccount(id, data); Toast.show('已更新'); }
    else { Store.addAccount(data); Toast.show('已添加'); }
    Modal.close(); this.render();
  },
  del(id, accName) {
    ConfirmDialog.show('确认删除这条记录？删除互转将同时删除对应转入/转出', () => {
      const e = Store.getAccounts().find(x => x.id === id);
      let ids = [id];
      if (e) {
        if (e.transferGroup) {
          ids = Store.getAccounts().filter(x => x.transferGroup === e.transferGroup).map(x => x.id);
        } else if (e.type === 'transfer') {
          const partner = Store.getAccounts().find(x =>
            x.id !== id && x.type === 'transfer' && x.amount === e.amount && x.date === e.date &&
            ((e.transferDir === 'out' && x.transferDir === 'in' && e.note.includes('转出至' + x.account) && x.note.includes('转入自' + e.account)) ||
             (e.transferDir === 'in' && x.transferDir === 'out' && e.note.includes('转入自' + x.account) && x.note.includes('转出至' + e.account)))
          );
          if (partner) ids.push(partner.id);
        } else if (e.type === 'expense') {
          // 删除已报销的支出 → 连带删除报销收入
          if (e.reimbursable && (e.reimbursements || []).length) {
            const reimIds = Store.getAccounts().filter(x => x.sourceExpenseId === id && x.reimbursementId).map(x => x.id);
            ids = ids.concat(reimIds);
          }
          // 删除已退款的支出 → 连带删除退款收入
          if ((e.refunds || []).length) {
            const refIds = Store.getAccounts().filter(x => x.sourceExpenseId === id && x.refundId).map(x => x.id);
            ids = ids.concat(refIds);
          }
        } else if (e.sourceExpenseId) {
          // 删除"报销/退款收入"记录时，从原支出里移除对应记录
          const parent = Store.getAccounts().find(x => x.id === e.sourceExpenseId);
          if (parent) {
            if (e.reimbursementId && parent.reimbursements) {
              parent.reimbursements = parent.reimbursements.filter(r => r.id !== e.reimbursementId);
              Store.updateAccount(parent.id, { reimbursements: parent.reimbursements });
            }
            if (e.refundId && parent.refunds) {
              parent.refunds = parent.refunds.filter(r => r.id !== e.refundId);
              Store.updateAccount(parent.id, { refunds: parent.refunds });
            }
          }
        }
      }
      ids.forEach(did => Store.deleteAccount(did));
      this.render();
      if (accName) this.openAccountDetail(accName);
      const extra = ids.length > 1 ? (e && e.type === 'transfer' ? `（含互转配对 ${ids.length} 笔）` : `（含关联 ${ids.length} 笔）`) : '';
      Toast.show('已删除' + extra);
    });
  },

  // ===== 报销管理 =====
  _reimbursableExpenses() {
    return Store.getAccounts().filter(e => e.type === 'expense' && e.reimbursable);
  },
  // 周期判定：月度 = 年+月，年度 = 仅年（两者逻辑完全一致，只是粒度不同）
  _inReimPeriod(dateStr) {
    if (!dateStr) return false;
    if (yearKey(dateStr) !== String(this.reimburseSelYear)) return false;
    if (this.reimbursePeriod === 'month') return parseInt(dateStr.slice(5, 7), 10) === this.reimburseSelMonth;
    return true;
  },
  // 全部报销记录（拍平成一条条流水，附带来源账单）
  _allReimRecords() {
    const out = [];
    this._reimbursableExpenses().forEach(e => {
      (e.reimbursements || []).forEach(r => out.push({ r, e }));
    });
    return out;
  },
  // 待报销：按【账单日期】归属周期，且尚未报销完
  _reimPendingList() {
    return this._reimbursableExpenses()
      .filter(e => this._inReimPeriod(e.date) && !this._isFullyReimbursed(e) && !e.reimbursementClosed)
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  // 已报销：按【报销日期】归属周期，逐条报销记录
  _reimDoneRecords() {
    return this._allReimRecords()
      .filter(x => this._inReimPeriod(x.r.date))
      .sort((a, b) => b.r.date.localeCompare(a.r.date));
  },
  _reimSummary() {
    // 总报销 = 本周期所有"可报销"账单的全额之和（含已关闭/已全额报销的账单）
    const bills = this._reimbursableExpenses().filter(e => this._inReimPeriod(e.date));
    const total = bills.reduce((s, e) => s + parseFloat(e.amount), 0);
    // 已报销 = 本周期报销记录金额（不超过总报销，保证恒等式成立）
    const rawDone = this._reimDoneRecords().reduce((s, x) => s + parseFloat(x.r.amount), 0);
    const done = Math.min(rawDone, total);
    // 待报销（未报销）= 总报销 − 已报销，保证 总报销 = 已报销 + 待报销
    const pending = Math.max(0, total - done);
    return { pending, done, total };
  },
  _reimPeriodLabel() {
    return this.reimbursePeriod === 'month'
      ? `${this.reimburseSelYear}/${String(this.reimburseSelMonth).padStart(2, '0')}`
      : `${this.reimburseSelYear}年`;
  },
  _pendingRemain(e) {
    const total = parseFloat(e.amount);
    const done = (e.reimbursements || []).reduce((s,r) => s + parseFloat(r.amount), 0);
    return Math.max(0, total - done);
  },
  _isFullyReimbursed(e) { return this._pendingRemain(e) < 0.005; },
  _reimStatusTag(e) {
    if (e.reimbursementClosed) return `<span class="reim-tag closed" title="已完成报销，点击可重新开启" style="cursor:pointer" onclick="AccountView.reopenReim('${e.id}')">已完成报销 · 点击重开</span>`;
    const remain = this._pendingRemain(e);
    const done = (e.reimbursements || []).reduce((s,r) => s + parseFloat(r.amount), 0);
    if (remain > 0.005) return `<span class="reim-tag pending">待报销 ${fmtMoney(remain)}</span>`;
    if (done > 0.005) return `<span class="reim-tag done">已报销 ${fmtMoney(done)}</span>`;
    return '';
  },
  switchViewMode(m) {
    this.viewMode = m;
    this.selectedReimIds = [];
    // 日历与记账页保持一致
    if (m === 'reimburse') {
      this.reimburseSelYear = this.curYear;
      this.reimburseSelMonth = this.curMonth + 1;
    }
    this.render();
  },
  selReimTab(t) { this.reimburseTab = t; this.selectedReimIds = []; this.render(); },
  selReimPeriod(p) { this.reimbursePeriod = p; this.render(); },
  selReimYear(y) { this.reimburseSelYear = y; this.render(); },
  selReimMonth(m) { this.reimburseSelMonth = m; this.render(); },
  toggleReimSelect(id) {
    if (this.selectedReimIds.includes(id)) this.selectedReimIds = this.selectedReimIds.filter(x => x !== id);
    else this.selectedReimIds.push(id);
    this.render();
  },
  _reimSelectedTotal() {
    return this.selectedReimIds.reduce((s, id) => {
      const e = Store.getAccounts().find(x => x.id === id);
      return s + (e ? this._pendingRemain(e) : 0);
    }, 0);
  },
  openReimAccountPicker() {
    const total = this._reimSelectedTotal();
    if (total < 0.005) { Toast.show('请先选择待报销记录', 'error'); return; }
    const accounts = this.getOrderedAccounts();
    Modal.open('选择账户', `
      <div class="account-picker-list">
        ${accounts.map(a => `
          <div class="account-picker-item" onclick="AccountView.doBatchReimburse('${a}')">
            <span class="af-icon">${CONFIG.accountIcons[a]||'💳'}</span>
            <span class="af-name">${a}</span>
          </div>
        `).join('')}
      </div>
    `);
  },
  doBatchReimburse(toAccount) {
    const ids = [...this.selectedReimIds];
    ConfirmDialog.show(`确定要报销选中的 ${ids.length} 笔账单到「${toAccount}」账户吗？`, () => {
      ids.forEach(id => {
        const e = Store.getAccounts().find(x => x.id === id);
        if (!e || !e.reimbursable) return;
        const remain = this._pendingRemain(e);
        if (remain < 0.005) return;
        const reim = { id: uid(), amount: remain.toFixed(2), toAccount, date: todayStr(), note: '' };
        if (!e.reimbursements) e.reimbursements = [];
        e.reimbursements.push(reim);
        Store.updateAccount(id, { reimbursements: e.reimbursements });
        this._addReimIncome(e, reim);   // 报销到账 → 记一笔收入
      });
      this.selectedReimIds = [];
      Modal.close();
      this.render();
      Toast.show(`已报销 ${ids.length} 笔`);
    });
    Modal.close();
  },
  openReimForm(id) {
    const e = Store.getAccounts().find(x => x.id === id);
    if (!e) return;
    const remain = this._pendingRemain(e);
    const defaultAcc = this.getOrderedAccounts()[0] || '微信1';
    Modal.open('报销', `
      <div class="reim-form-header">
        <div class="reim-form-source">
          <span class="cat-icon-sm">${CONFIG.categoryIcons[e.category]||'📌'}</span>
          <span>${e.category}</span>
          <span class="reim-form-amt">-${fmtMoney(parseFloat(e.amount))}</span>
        </div>
        ${this._reimStatusTag(e)}
        <div class="reim-form-meta">${e.account}</div>
      </div>
      ${remain < 0.005 ? '<div class="reim-form-note">该账单已全额报销，可继续记录额外或分期报销。</div>' : ''}
      <div class="form-group"><label class="form-label">报销金额</label><input class="form-input" type="number" step="0.01" id="reim-amount" placeholder="请输入报销金额（不超过 ${fmtMoney(parseFloat(e.amount))}）"></div>
      <div class="form-group"><label class="form-label">报销时间</label>${dateFieldHTML('reim-date', todayStr())}</div>
      <div class="form-group"><label class="form-label">报销账户</label>
        ${this._accountFieldHTML('reim-account', defaultAcc)}
      </div>
      <div class="form-group"><label class="form-label">备注</label><input class="form-input" id="reim-note" placeholder="请输入备注信息"></div>
      <label class="checkbox-label"><input type="checkbox" id="reim-complete"> 完成报销（勾选后该账单不再可报销）</label>
      <div class="form-actions">
        <button class="btn btn-glass" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="AccountView.saveReim('${id}')">💾 报销</button>
      </div>
    `);
  },
  saveReim(id) {
    const e = Store.getAccounts().find(x => x.id === id);
    if (!e) return;
    const amt = parseFloat($('#reim-amount').value);
    if (!amt || amt <= 0) { Toast.show('请输入有效金额', 'error'); return; }
    if (amt > parseFloat(e.amount) + 0.005) { Toast.show('报销金额不能超过账单金额 ' + fmtMoney(parseFloat(e.amount)), 'error'); return; }
    const reim = { id: uid(), amount: amt.toFixed(2), toAccount: $('#reim-account').value, date: $('#reim-date').value, note: $('#reim-note').value.trim() };
    if (!e.reimbursements) e.reimbursements = [];
    e.reimbursements.push(reim);
    const closed = document.getElementById('reim-complete') && document.getElementById('reim-complete').checked;
    const upd = { reimbursements: e.reimbursements };
    if (closed) upd.reimbursementClosed = true;
    Store.updateAccount(id, upd);
    this._addReimIncome(e, reim);   // 报销到账 → 记一笔收入
    Modal.close();
    this.render();
    Toast.show(closed ? '报销成功，已标记完成报销' : '报销成功');
  },
  markReimClosed(id) {
    const e = Store.getAccounts().find(x => x.id === id);
    if (!e) return;
    const hasReim = (e.reimbursements || []).length > 0;
    ConfirmDialog.show(hasReim ? '确认将该账单标记为「已完成报销」？之后将不能再报销。' : '该账单尚未报销，确认直接标记为「已完成报销」？', () => {
      Store.updateAccount(id, { reimbursementClosed: true });
      this.render();
      Toast.show('已标记完成报销，后续不可再报销');
    });
  },
  reopenReim(id) {
    const e = Store.getAccounts().find(x => x.id === id);
    if (!e) return;
    ConfirmDialog.show('重新开启该账单的报销？可继续记录报销。', () => {
      Store.updateAccount(id, { reimbursementClosed: false });
      this.render();
      Toast.show('已重新开启报销');
    });
  },
  _addReimIncome(e, reim) {
    Store.addAccount({
      type: 'income',
      category: '报销',
      account: reim.toAccount,
      amount: parseFloat(reim.amount),
      date: reim.date,
      note: '报销：' + (e.category || '') + (reim.note ? ' · ' + reim.note : ''),
      reimbursementId: reim.id,
      sourceExpenseId: e.id
    });
  },

  // ===== 报销记录：编辑 / 删除 =====
  _findReim(expId, reimId) {
    const e = Store.getAccounts().find(x => x.id === expId);
    if (!e) return {};
    const r = (e.reimbursements || []).find(x => x.id === reimId);
    return { e, r };
  },
  openReimEdit(expId, reimId, fromDetail) {
    const { e, r } = this._findReim(expId, reimId);
    if (!e || !r) { Toast.show('未找到报销记录', 'error'); return; }
    // 可填最大金额 = 账单金额 - 其他报销记录合计
    const others = (e.reimbursements || []).filter(x => x.id !== reimId)
      .reduce((s, x) => s + parseFloat(x.amount), 0);
    const maxAmt = Math.max(0, parseFloat(e.amount) - others);
    Modal.open('✏️ 编辑报销记录', `
      <div class="reim-form-header">
        <div class="reim-form-source">
          <span class="cat-icon-sm">${CONFIG.categoryIcons[e.category]||'📌'}</span>
          <span>${e.category}</span>
          <span class="reim-form-amt">账单 ${fmtMoney(parseFloat(e.amount))}</span>
        </div>
        <div class="reim-form-meta">原账户 ${e.account} · 可报销上限 ${fmtMoney(maxAmt)}</div>
      </div>
      <div class="form-group"><label class="form-label">报销金额</label>
        <input class="form-input" type="number" step="0.01" id="reim-e-amount" value="${parseFloat(r.amount).toFixed(2)}">
      </div>
      <div class="form-group"><label class="form-label">报销时间</label>${dateFieldHTML('reim-e-date', r.date.slice(0,10))}</div>
      <div class="form-group"><label class="form-label">报销账户</label>
        ${this._accountFieldHTML('reim-e-account', r.toAccount)}
      </div>
      <div class="form-group"><label class="form-label">备注</label>
        <input class="form-input" id="reim-e-note" value="${escHtml(r.note||'')}" placeholder="请输入备注信息">
      </div>
      <div class="form-actions">
        <button class="btn btn-glass" onclick="${fromDetail?`Modal.close();AccountView.openReimDetail('${expId}')`:'Modal.close()'}">取消</button>
        <button class="btn btn-primary" onclick="AccountView.saveReimEdit('${expId}','${reimId}',${fromDetail?1:0},${maxAmt})">保存</button>
      </div>
    `);
  },
  saveReimEdit(expId, reimId, fromDetail, maxAmt) {
    const { e, r } = this._findReim(expId, reimId);
    if (!e || !r) return;
    const amt = parseFloat($('#reim-e-amount').value);
    if (!amt || amt <= 0) { Toast.show('请输入有效金额', 'error'); return; }
    if (amt > parseFloat(maxAmt) + 0.005) { Toast.show(`报销金额不能超过 ${fmtMoney(parseFloat(maxAmt))}`, 'error'); return; }
    const date = $('#reim-e-date').value || r.date;
    const toAccount = $('#reim-e-account').value;
    const note = $('#reim-e-note').value.trim();

    const list = (e.reimbursements || []).map(x => x.id === reimId
      ? { ...x, amount: amt.toFixed(2), date, toAccount, note } : x);
    Store.updateAccount(expId, { reimbursements: list });

    // 同步对应的「报销收入」记录，保证账户余额一致
    const inc = Store.getAccounts().find(x => x.reimbursementId === reimId);
    const noteTxt = '报销：' + (e.category || '') + (note ? ' · ' + note : '');
    if (inc) Store.updateAccount(inc.id, { amount: amt, date, account: toAccount, note: noteTxt });
    else this._addReimIncome(e, { id: reimId, amount: amt.toFixed(2), date, toAccount, note });

    Modal.close();
    this.render();
    if (fromDetail) this.openReimDetail(expId);
    Toast.show('已更新报销记录');
  },
  delReim(expId, reimId, fromDetail) {
    if (fromDetail) Modal.close();
    ConfirmDialog.show('确认删除这条报销记录？对应的报销收入将一并删除，账单将退回待报销。', () => {
      const { e } = this._findReim(expId, reimId);
      if (!e) return;
      const list = (e.reimbursements || []).filter(x => x.id !== reimId);
      Store.updateAccount(expId, { reimbursements: list });
      Store.getAccounts().filter(x => x.reimbursementId === reimId).forEach(x => Store.deleteAccount(x.id));
      this.render();
      if (fromDetail) this.openReimDetail(expId);
      Toast.show('已删除报销记录');
    });
  },

  // ===== 退款功能（参考视频：支出详情 → 退款按钮 → 退款表单） =====
  _refundedTotal(e) {
    return (e.refunds || []).reduce((s, r) => s + parseFloat(r.amount), 0);
  },
  _refundRemain(e) {
    return Math.max(0, parseFloat(e.amount) - this._refundedTotal(e));
  },
  _hasRefunds(e) {
    return (e.refunds || []).length > 0;
  },
  _findRefund(expId, refId) {
    const e = Store.getAccounts().find(x => x.id === expId);
    if (!e) return {};
    const r = (e.refunds || []).find(x => x.id === refId);
    return { e, r };
  },

  /** 通用支出账单详情（含退款 + 报销） */
  openExpenseDetail(id, fromTab) {
    let e = Store.getAccounts().find(x => x.id === id);
    if (!e) return;
    // 点击"退款到账/报销到账"的收入流水时，跳转到其来源支出账单
    if (e.sourceExpenseId) {
      const src = Store.getAccounts().find(x => x.id === e.sourceExpenseId);
      if (src) e = src;
    }
    const icon = CONFIG.categoryIcons[e.category] || '📌';
    const refundedAmt = this._refundedTotal(e);
    const remain = this._refundRemain(e);
    const netAmt = parseFloat(e.amount) - refundedAmt;

    let html = `<div class="view-header"><button class="back-btn" onclick="Modal.close()">‹</button><h2>账单详情</h2></div>`;
    html += `<div class="detail-card glass">
      <div class="detail-head">
        <span class="cat-icon-lg">${icon}</span>
        <div class="detail-head-info">
          <div class="detail-cat">${e.category} ${e.note?'📝':''}</div>
          <div class="detail-amt">${fmtMoney(parseFloat(e.amount))} ${refundedAmt > 0 ? `<span style="color:var(--success);font-size:0.85em">${netAmt >= 0 ? '-' + fmtMoney(netAmt) : fmtMoney(netAmt)}</span>` : ''}</div>
          <div class="detail-account">${e.account}</div>
        </div>
        ${refundedAmt > 0 ? `<span class="reim-tag done" style="background:linear-gradient(135deg,#10b981,#059669)">已退款 ${fmtMoney(refundedAmt)}</span>` : ''}
        ${e.reimbursable ? this._reimStatusTag(e) : ''}
      </div>
      <div class="detail-fields">
        <div class="df-row"><span class="df-label">账单日期</span><span class="df-value">${(e.date||'').replace(/T/,' ').slice(0,16)}</span></div>
        <div class="df-row"><span class="df-label">资产账户</span><span class="df-value">${e.account}</span></div>
        <div class="df-row"><span class="df-label">账本</span><span class="df-value">日常</span></div>
        <div class="df-row"><span class="df-label">备注</span><span class="df-value">${e.note||'无'}</span></div>
        <div class="df-row"><span class="df-label">记账方式</span><span class="df-value">手动</span></div>
      </div>`;

    // 退款记录区
    if (this._hasRefunds(e)) {
      html += `<details class="reim-history" open>
        <summary>退款记录 (${e.refunds.length})</summary>`;
      e.refunds.slice().sort((a,b)=>b.date.localeCompare(a.date)).forEach(r => {
        html += `<div class="reim-hist-item">
          <span>${r.date.slice(0,10)} ${getWeekday(r.date.slice(0,10))}</span>
          <span class="reim-hist-amt" style="color:var(--success)">${fmtMoney(parseFloat(r.amount))}</span>
          <span class="reim-hist-acc">→${r.toAccount}</span>
          <span class="icon-btn" title="编辑" onclick="AccountView.openRefundEdit('${e.id}','${r.id}')">✏️</span>
          <span class="icon-btn" title="删除" onclick="AccountView.delRefund('${e.id}','${r.id}')">🗑</span>
        </div>`;
      });
      html += `</details>`;
    }

    // 报销记录区（兼容）
    if (e.reimbursable && (e.reimbursements || []).length > 0) {
      html += `<details class="reim-history" open>
        <summary>报销记录 (${e.reimbursements.length})</summary>`;
      e.reimbursements.slice().sort((a,b)=>b.date.localeCompare(a.date)).forEach(r => {
        html += `<div class="reim-hist-item">
          <span>${r.date.slice(0,10)} ${getWeekday(r.date.slice(0,10))}</span>
          <span class="reim-hist-amt">${fmtMoney(parseFloat(r.amount))}</span>
          <span class="reim-hist-acc">→${r.toAccount}</span>
          <span class="icon-btn" title="编辑" onclick="AccountView.openReimEdit('${e.id}','${r.id}',1)">✏️</span>
          <span class="icon-btn" title="删除" onclick="AccountView.delReim('${e.id}','${r.id}',1)">🗑</span>
        </div>`;
      });
      html += `</details>`;
    }

    html += `</div>`;
    const reimClosed = !!e.reimbursementClosed;
    const fromDone = fromTab === 'done';
    const hasReim = (e.reimbursements || []).length > 0;
    html += `<div class="detail-actions-row">
      <button class="btn btn-glass btn-sm" onclick="Modal.close();AccountView.openEdit('${e.id}')">✏️ 编辑</button>
      ${e.type === 'expense' ? `<button class="btn btn-glass btn-sm" style="color:var(--success)" onclick="Modal.close();AccountView.openRefundForm('${e.id}')">${this._hasRefunds(e) ? '💰 再退款' : '💰 退款'}</button>` : ''}
      ${e.reimbursable && !reimClosed ? `<button class="btn btn-glass btn-sm" onclick="Modal.close();AccountView.openReimForm('${e.id}')">📋 ${hasReim ? '再报销' : '报销'}</button>` : ''}
      ${e.reimbursable && reimClosed && !fromDone ? `<button class="btn btn-glass btn-sm" style="color:var(--warning)" onclick="Modal.close();AccountView.reopenReim('${e.id}')">🔓 删除完成报销</button>` : ''}
      <button class="btn btn-glass btn-sm" style="color:var(--danger)" onclick="Modal.close();AccountView.del('${e.id}')">🗑 删除</button>
    </div>`;
    Modal.open('', html);
  },

  /** 退款表单 */
  openRefundForm(id) {
    const e = Store.getAccounts().find(x => x.id === id);
    if (!e) return;
    if (e.type !== 'expense') { Toast.show('只有支出记录可以退款', 'error'); return; }
    const remain = this._refundRemain(e);
    if (remain < 0.005) { Toast.show('该笔已全额退款', 'warn'); return; }
    const icon = CONFIG.categoryIcons[e.category] || '📌';
    const today = todayStr();

    Modal.open('退款', `
      <div class="reim-form-header">
        <div class="reim-form-source">
          <span class="cat-icon-sm">${icon}</span>
          <span>${e.category}</span>
          <span class="reim-form-amt">${fmtMoney(parseFloat(e.amount))}</span>
        </div>
        <div class="reim-form-meta">${(e.date||'').slice(5,16).replace('T',' ')} · ${e.account}</div>
      </div>
      <div class="form-group"><label class="form-label">退款金额</label>
        <input class="form-input" type="number" step="0.01" min="0.01" max="${remain.toFixed(2)}" id="refund-amount" value="${remain.toFixed(2)}" placeholder="退款金额">
      </div>
      <div class="form-group"><label class="form-label">退款时间</label>${dateFieldHTML('refund-date', today)}</div>
      <div class="form-group"><label class="form-label">退款账户</label>
        ${this._accountFieldHTML('refund-account', e.account)}
      </div>
      <div class="form-group"><label class="form-label">备注</label>
        <input class="form-input" id="refund-note" placeholder="请输入备注信息">
      </div>
      <div class="form-actions">
        <button class="btn btn-glass" onclick="Modal.close();AccountView.openExpenseDetail('${id}')">取消</button>
        <button class="btn btn-primary" onclick="AccountView.saveRefund('${id}')">✓ 保存</button>
      </div>
    `);
  },

  /** 保存新退款 */
  saveRefund(id) {
    const e = Store.getAccounts().find(x => x.id === id);
    if (!e) return;
    const amt = parseFloat($('#refund-amount').value);
    if (!amt || amt <= 0) { Toast.show('请输入有效金额', 'error'); return; }
    const remain = this._refundRemain(e);
    if (amt > remain + 0.005) { Toast.show(`退款金额不能超过剩余可退金额 ${fmtMoney(remain)}`, 'error'); return; }
    const date = $('#refund-date').value || todayStr();
    const toAccount = $('#refund-account').value;
    const note = $('#refund-note').value.trim();

    const refId = uid();
    const refRecord = { id: refId, amount: amt.toFixed(2), date, toAccount, note };
    const refunds = [...(e.refunds || []), refRecord];
    Store.updateAccount(id, { refunds });

    // 写入一笔「收入 / 类别=退款」到所选账户，余额增加
    const noteTxt = '退款：' + (e.category || '') + (note ? ' · ' + note : '');
    Store.addAccount({
      type: 'income', category: '退款',
      account: toAccount, amount: amt,
      date, note: noteTxt,
      refundId: refId,
      sourceExpenseId: id
    });

    Modal.close();
    this.render();
    this.openExpenseDetail(id);
    Toast.show('新增成功');
  },

  /** 编辑退款 */
  openRefundEdit(expId, refId) {
    const { e, r } = this._findRefund(expId, refId);
    if (!e || !r) { Toast.show('未找到退款记录', 'error'); return; }
    const others = (e.refunds || []).filter(x => x.id !== refId)
      .reduce((s, x) => s + parseFloat(x.amount), 0);
    const maxAmt = Math.max(0, parseFloat(e.amount) - others);

    Modal.open('✏️ 编辑退款记录', `
      <div class="reim-form-header">
        <div class="reim-form-source">
          <span class="cat-icon-sm">${CONFIG.categoryIcons[e.category]||'📌'}</span>
          <span>${e.category}</span>
          <span class="reim-form-amt">账单 ${fmtMoney(parseFloat(e.amount))}</span>
        </div>
        <div class="reim-form-meta">原账户 ${e.account} · 可退上限 ${fmtMoney(maxAmt)}</div>
      </div>
      <div class="form-group"><label class="form-label">退款金额</label>
        <input class="form-input" type="number" step="0.01" id="ref-e-amount" value="${parseFloat(r.amount).toFixed(2)}">
      </div>
      <div class="form-group"><label class="form-label">退款时间</label>${dateFieldHTML('ref-e-date', r.date.slice(0,10))}</div>
      <div class="form-group"><label class="form-label">退款账户</label>
        ${this._accountFieldHTML('ref-e-account', r.toAccount)}
      </div>
      <div class="form-group"><label class="form-label">备注</label>
        <input class="form-input" id="ref-e-note" value="${escHtml(r.note||'')}" placeholder="请输入备注信息">
      </div>
      <div class="form-actions">
        <button class="btn btn-glass" onclick="Modal.close();AccountView.openExpenseDetail('${expId}')">取消</button>
        <button class="btn btn-primary" onclick="AccountView.saveRefundEdit('${expId}','${refId}',${maxAmt})">保存</button>
      </div>
    `);
  },

  /** 保存编辑后的退款 */
  saveRefundEdit(expId, refId, maxAmt) {
    const { e, r } = this._findRefund(expId, refId);
    if (!e || !r) return;
    const amt = parseFloat($('#ref-e-amount').value);
    if (!amt || amt <= 0) { Toast.show('请输入有效金额', 'error'); return; }
    if (amt > maxAmt + 0.005) { Toast.show(`退款金额不能超过 ${fmtMoney(maxAmt)}`, 'error'); return; }
    const date = $('#ref-e-date').value || r.date;
    const toAccount = $('#ref-e-account').value;
    const note = $('#ref-e-note').value.trim();

    const list = (e.refunds || []).map(x => x.id === refId
      ? { ...x, amount: amt.toFixed(2), date, toAccount, note } : x);
    Store.updateAccount(expId, { refunds: list });

    // 同步对应的「退款收入」记录
    const inc = Store.getAccounts().find(x => x.refundId === refId);
    const noteTxt = '退款：' + (e.category || '') + (note ? ' · ' + note : '');
    if (inc) Store.updateAccount(inc.id, { amount: amt, date, account: toAccount, note: noteTxt });
    else {
      Store.addAccount({ type:'income', category:'退款', account:toAccount, amount:amt, date, note:noteTxt, refundId:refId, sourceExpenseId:expId });
    }

    Modal.close();
    this.render();
    this.openExpenseDetail(expId);
    Toast.show('已更新退款记录');
  },

  /** 删除退款 */
  delRefund(expId, refId) {
    ConfirmDialog.show('确认删除这条退款记录？对应的退款收入将一并删除。', () => {
      const { e } = this._findRefund(expId, refId);
      if (!e) return;
      const list = (e.refunds || []).filter(x => x.id !== refId);
      Store.updateAccount(expId, { refunds: list });
      Store.getAccounts().filter(x => x.refundId === refId).forEach(x => Store.deleteAccount(x.id));
      this.render();
      this.openExpenseDetail(expId);
      Toast.show('已删除退款记录');
    });
  },
  _renderReimburseView() {
    const summary = this._reimSummary();
    const pendingList = this._reimPendingList();
    const doneRecords = this._reimDoneRecords();
    const selTotal = this._reimSelectedTotal();

    let html = `<div class="view-header">
      <button class="back-btn" onclick="AccountView.switchViewMode('account')">‹</button>
      <h2 class="view-title">报销</h2>
    </div>`;

    // Period tabs
    html += `<div class="reim-period-tabs">
      <div class="period-tab ${this.reimbursePeriod==='month'?'active':''}" onclick="AccountView.selReimPeriod('month')">✓ 月度</div>
      <div class="period-tab ${this.reimbursePeriod==='year'?'active':''}" onclick="AccountView.selReimPeriod('year')">年度</div>
    </div>`;

    // Summary cards
    html += `<div class="reim-summary-cards">
      <div class="glass reim-card">
        <div class="reim-card-label">待报销</div>
        <div class="reim-card-val pending">${fmtMoney(summary.pending)}</div>
      </div>
      <div class="glass reim-card">
        <div class="reim-card-label">已报销</div>
        <div class="reim-card-val done">${fmtMoney(summary.done)}</div>
      </div>
      <div class="glass reim-card">
        <div class="reim-card-label">总报销</div>
        <div class="reim-card-val total">${fmtMoney(summary.total)}</div>
      </div>
    </div>`;

    // Sub-tabs + 日历（月度 = 年/月，年度 = 年，切换逻辑一致）
    html += `<div class="reim-subtabs">
      <div class="reim-subtab ${this.reimburseTab==='pending'?'active':''}" onclick="AccountView.selReimTab('pending')">待报销</div>
      <div class="reim-subtab ${this.reimburseTab==='done'?'active':''}" onclick="AccountView.selReimTab('done')">已报销</div>
      <div class="reim-month-picker">
        <span onclick="AccountView._reimPrevPeriod()">‹</span>
        <span>${this._reimPeriodLabel()}</span>
        <span onclick="AccountView._reimNextPeriod()">›</span>
      </div>
    </div>`;

    // ===== 待报销：按账单日期分组 =====
    if (this.reimburseTab === 'pending') {
      if (pendingList.length === 0) {
        html += `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">暂无待报销账单</div></div>`;
      } else {
        const dayGroups = {};
        pendingList.forEach(e => { (dayGroups[e.date] = dayGroups[e.date] || []).push(e); });
        Object.keys(dayGroups).sort().reverse().forEach(d => {
          const items = dayGroups[d];
          const dayTotal = items.reduce((s, e) => s + this._pendingRemain(e), 0);
          html += `<div class="reim-day-group">
            <div class="reim-day-header">
              <span class="reim-day-bar"></span>
              <span class="reim-day-date">${this._reimDayLabel(d)}</span>
              <span class="reim-day-amt">待报:${fmtMoney(dayTotal)}</span>
            </div>`;
          items.forEach(e => {
            const isSelected = this.selectedReimIds.includes(e.id);
            const icon = CONFIG.categoryIcons[e.category] || '📌';
            html += `<div class="reim-item" onclick="AccountView.openReimDetail('${e.id}','pending')">
              <div class="reim-check ${isSelected?'checked':''}" onclick="event.stopPropagation();AccountView.toggleReimSelect('${e.id}')"></div>
              <div class="reim-item-body">
                <div class="reim-item-top">
                  <span class="cat-icon-sm">${icon}</span>
                  <span class="reim-cat">${e.category}</span>
                  ${e.note?`<span class="reim-note-icon">📝</span>`:''}
                </div>
                <div class="reim-item-mid">
                  <span class="reim-time">${e.date.slice(5,10)}</span>
                  ${this._reimStatusTag(e)}
                </div>
                <div class="reim-item-bot"><span class="reim-account">${e.account}</span></div>
              </div>
              <div class="reim-item-amt neg">${fmtMoney(this._pendingRemain(e))}</div>
            </div>`;
          });
          html += `</div>`;
        });
      }
    } else {
      // ===== 已报销：逐条报销记录，按报销日期分组 =====
      if (doneRecords.length === 0) {
        html += `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">暂无报销记录</div></div>`;
      } else {
        const dayGroups = {};
        doneRecords.forEach(x => { (dayGroups[x.r.date] = dayGroups[x.r.date] || []).push(x); });
        Object.keys(dayGroups).sort().reverse().forEach(d => {
          const items = dayGroups[d];
          const dayTotal = items.reduce((s, x) => s + parseFloat(x.r.amount), 0);
          html += `<div class="reim-day-group">
            <div class="reim-day-header">
              <span class="reim-day-bar"></span>
              <span class="reim-day-date">${this._reimDayLabel(d)}</span>
              <span class="reim-day-amt">已报:${fmtMoney(dayTotal)}</span>
            </div>`;
          items.forEach(({ r, e }) => {
            const icon = CONFIG.categoryIcons[e.category] || '📌';
            html += `<div class="reim-item" onclick="AccountView.openReimDetail('${e.id}','done')">
              <div class="reim-item-body">
                <div class="reim-item-top">
                  <span class="cat-icon-sm">${icon}</span>
                  <span class="reim-cat">${e.category}</span>
                  ${r.note?`<span class="reim-note-icon">📝</span>`:''}
                </div>
                <div class="reim-item-mid">
                  <span class="reim-time">${r.date.slice(5,10)}</span>
                  <span class="reim-tag done">已报销</span>
                </div>
                <div class="reim-item-bot"><span class="reim-account">${e.account} → ${r.toAccount}</span></div>
              </div>
              <div class="reim-item-amt pos">+${fmtMoney(parseFloat(r.amount))}</div>
              <div class="reim-item-ops">
                <span class="icon-btn" title="编辑" onclick="event.stopPropagation();AccountView.openReimEdit('${e.id}','${r.id}')">✏️</span>
                <span class="icon-btn" title="删除" onclick="event.stopPropagation();AccountView.delReim('${e.id}','${r.id}')">🗑</span>
              </div>
            </div>`;
          });
          html += `</div>`;
        });
      }
    }

    // Bottom action bar
    if (this.reimburseTab === 'pending') {
      html += `<div class="reim-bottom-bar">
        <div class="reim-bottom-inner">
          <div class="reim-check ${selTotal>0.005?'checked':''}" onclick="AccountView._toggleSelectAllPending()"></div>
          <button class="btn btn-reim-action ${selTotal<0.005?'disabled':''}" onclick="${selTotal>0.005?'AccountView.openReimAccountPicker()':'void(0)'}">报销(${fmtMoney(selTotal)})</button>
        </div>
      </div>`;
    }

    return html;
  },
  _reimDayLabel(d) {
    return `${parseInt(d.slice(5,7),10)}月${parseInt(d.slice(8,10),10)}日 ${getWeekday(d.slice(0,10))}`;
  },
  _toggleSelectAllPending() {
    const pending = this._reimPendingList();
    if (this.selectedReimIds.length >= pending.length) { this.selectedReimIds = []; }
    else { this.selectedReimIds = pending.map(e => e.id); }
    this.render();
  },
  _reimPrevPeriod() {
    if (this.reimbursePeriod === 'month') {
      this.reimburseSelMonth--;
      if (this.reimburseSelMonth < 1) { this.reimburseSelMonth = 12; this.reimburseSelYear--; }
    } else { this.reimburseSelYear--; }
    this.selectedReimIds = [];
    this.render();
  },
  _reimNextPeriod() {
    if (this.reimbursePeriod === 'month') {
      this.reimburseSelMonth++;
      if (this.reimburseSelMonth > 12) { this.reimburseSelMonth = 1; this.reimburseSelYear++; }
    } else { this.reimburseSelYear++; }
    this.selectedReimIds = [];
    this.render();
  },
  openReimDetail(id, fromTab) {
    // 复用通用详情（含退款 + 报销）；fromTab='done' 表示来自"已报销"
    this.openExpenseDetail(id, fromTab);
  },

  // === 新增账户 ===
  openAddAccount() {
    const allIcons = DEFAULTS.accIconPool;
    const body = `
      <div class="add-acc-form">
        <div class="form-group">
          <label class="form-label">账户名称</label>
          <input class="form-input" id="new-acc-name" placeholder="如 建设银行" autofocus maxlength="10">
        </div>
        <div class="form-group">
          <label class="form-label">选择图标</label>
          <div class="icon-picker" id="new-acc-icons">
            ${allIcons.map((ic, i) => `<div class="icon-pick ${i===0?'active':''}" data-icon="${ic}" onclick="AccountView._pickAccIcon(this)">${ic}</div>`).join('')}
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-glass" onclick="AccountView.openAdd()">取消</button>
          <button class="btn btn-primary" onclick="AccountView.saveNewAccount()">添加</button>
        </div>
      </div>
    `;
    Modal.open('🏦 新增账户', body);
  },
  _pickAccIcon(el) {
    $$('#new-acc-icons .icon-pick').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
  },
  saveNewAccount() {
    const name = $('#new-acc-name').value.trim();
    if (!name) { Toast.show('请输入账户名称', 'error'); return; }
    const all = [...DEFAULTS.accounts, ...Store.getCustomAccounts().map(a => a.name)];
    if (all.includes(name)) { Toast.show('账户名已存在', 'error'); return; }
    const icon = $('#new-acc-icons .icon-pick.active')?.dataset.icon || '💳';
    Store.addCustomAccount({ name, icon });
    Toast.show('已添加账户');
    Modal.close();
    this.openAdd();
    this.render();
  },
  deleteAcc(name) {
    ConfirmDialog.show(`确认删除账户「${name}」？该账户下的所有收支记录将被一并删除。`, () => {
      // 删除该账户下的所有交易
      const allTx = Store.getAccounts();
      allTx.forEach(tx => { if (tx.account === name) Store.deleteAccount(tx.id); });
      // 移除自定义账户（默认账户无需从配置中移除）
      if (!DEFAULTS.accounts.includes(name)) Store.removeCustomAccount(name);
      // 如果当前选中该账户，切回全部
      if (this.selAccount === name) this.selAccount = 'all';
      Toast.show(`已删除账户「${name}」`);
      this.render();
    });
  },
  openMigrate(fromAcc) {
    const otherAccounts = this.getOrderedAccounts().filter(a => a !== fromAcc);
    let html = `
      <div class="migrate-form">
        <p class="migrate-desc">将 <strong>「${fromAcc}」</strong> 的账单迁移至</p>
        <div class="migrate-acc-list">
          ${otherAccounts.map(a => `
            <div class="migrate-acc-item" onclick="AccountView.execMigrate('${fromAcc}','${a}')">
              <span class="migrate-acc-icon">${CONFIG.accountIcons[a]||'💳'}</span>
              <span class="migrate-acc-name">${a}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    Modal.open(`📦 迁移账单 · ${fromAcc}`, html);
  },
  execMigrate(from, to) {
    const allTx = Store.getAccounts();
    let count = 0;
    allTx.forEach(tx => {
      if (tx.account === from) {
        Store.updateAccount(tx.id, { account: to });
        count++;
      }
    });
    Toast.show(`已迁移 ${count} 条记录至「${to}」`);
    Modal.close();
    this.render();
  },

  // === 新增分类 ===
  openAddCategory(type) {
    // 暂存当前表单的数据
    this._pendingType = type;
    const allIcons = DEFAULTS.catIconPool;
    const allColors = DEFAULTS.catColorPool;
    const body = `
      <div class="add-cat-form">
        <div class="form-group">
          <label class="form-label">分类名称</label>
          <input class="form-input" id="new-cat-name" placeholder="${type==='income'?'如 副业':'如 零食'}" autofocus maxlength="6">
        </div>
        <div class="form-group">
          <label class="form-label">选择图标</label>
          <div class="icon-picker" id="new-cat-icons">
            ${allIcons.map((ic, i) => `<div class="icon-pick ${i===0?'active':''}" data-icon="${ic}" onclick="AccountView._pickCatIcon(this)">${ic}</div>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">选择颜色</label>
          <div class="color-picker" id="new-cat-colors">
            ${allColors.map((c, i) => `<div class="color-pick ${i===0?'active':''}" data-color="${c}" style="background:${c}" onclick="AccountView._pickCatColor(this)"></div>`).join('')}
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-glass" onclick="AccountView.openAdd()">取消</button>
          <button class="btn btn-primary" onclick="AccountView.saveNewCategory()">添加</button>
        </div>
      </div>
    `;
    Modal.open(type==='income'?'💰 新增收入分类':'🛒 新增支出分类', body);
  },
  _pickCatIcon(el) {
    $$('#new-cat-icons .icon-pick').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
  },
  _pickCatColor(el) {
    $$('#new-cat-colors .color-pick').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
  },
  saveNewCategory() {
    const name = $('#new-cat-name').value.trim();
    if (!name) { Toast.show('请输入分类名称', 'error'); return; }
    const type = this._pendingType || 'expense';
    const all = type === 'expense' ? CONFIG.expenseCategories : CONFIG.incomeCategories;
    if (all.includes(name)) { Toast.show('分类名已存在', 'error'); return; }
    const icon = $('#new-cat-icons .icon-pick.active')?.dataset.icon || '📌';
    const color = $('#new-cat-colors .color-pick.active')?.dataset.color || '#95a5a6';
    if (type === 'expense') Store.addCustomExpenseCat({ name, icon, color });
    else Store.addCustomIncomeCat({ name, icon, color });
    Toast.show('已添加分类');
    Modal.close();
    this.openAdd();
  },

  // === 账户互转 ===
  openTransfer() {
    const accounts = this.getOrderedAccounts();
    Modal.open('⇅ 账户互转', this._transferForm(accounts));
  },
  _transferForm(accounts) {
    const from = accounts[0];
    const to = accounts.length > 1 ? accounts[1] : accounts[0];
    const accChips = (sel, dir) => accounts.map(a => `<div class="account-field-chip ${a===sel?'active':''}" data-account="${a}" onclick="AccountView.selTransferAcc('${dir}','${a}')"><span class="af-icon">${CONFIG.accountIcons[a]||'💳'}</span><span class="af-name">${a}</span></div>`).join('');
    return `
      <div class="transfer-form">
        <div class="transfer-info-banner">
          <span class="text-xs text-tertiary">从 A 账户转出，转入 B 账户，总金额不变</span>
        </div>
        <div class="form-group">
          <label class="form-label">转出账户</label>
          <div class="account-field" id="tf-from-field">
            <div class="account-field-scroll">${accChips(from, 'from')}</div>
            <input type="hidden" id="tf-from" value="${from}">
          </div>
        </div>
        <div class="transfer-swap" onclick="AccountView.swapTransfer()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          <span>交换</span>
        </div>
        <div class="form-group">
          <label class="form-label">转入账户</label>
          <div class="account-field" id="tf-to-field">
            <div class="account-field-scroll">${accChips(to, 'to')}</div>
            <input type="hidden" id="tf-to" value="${to}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">金额</label><input class="form-input" type="number" step="0.01" id="tf-amount" placeholder="0.00" autofocus></div>
          <div class="form-group"><label class="form-label">日期</label>${dateFieldHTML('tf-date', todayStr())}</div>
        </div>
        <div class="form-group"><label class="form-label">备注（可选）</label><input class="form-input" id="tf-note" placeholder="如 还款/转账"></div>
        <div class="form-actions"><button class="btn btn-glass" onclick="Modal.close()">取消</button><button class="btn btn-primary" onclick="AccountView.saveTransfer()">确认互转</button></div>
      </div>
    `;
  },
  selTransferAcc(dir, a) {
    const id = dir === 'from' ? 'tf-from' : 'tf-to';
    const fieldId = dir === 'from' ? 'tf-from-field' : 'tf-to-field';
    $('#' + id).value = a;
    $$('#' + fieldId + ' .account-field-chip').forEach(c => c.classList.toggle('active', c.dataset.account === a));
  },
  swapTransfer() {
    const from = $('#tf-from').value;
    const to = $('#tf-to').value;
    this.selTransferAcc('from', to);
    this.selTransferAcc('to', from);
  },
  saveTransfer() {
    const from = $('#tf-from').value;
    const to = $('#tf-to').value;
    const amount = parseFloat($('#tf-amount').value);
    const date = $('#tf-date').value;
    const note = $('#tf-note').value.trim();
    if (from === to) { Toast.show('转出和转入账户不能相同', 'error'); return; }
    if (!amount || amount <= 0) { Toast.show('请输入有效金额', 'error'); return; }
    const gid = uid();
    Store.addAccount({ type: 'transfer', transferDir: 'out', amount, date, account: from, category: '转账', transferGroup: gid, note: note ? `${note} · 转出至${to}` : `转出至${to}` });
    Store.addAccount({ type: 'transfer', transferDir: 'in', amount, date, account: to, category: '转账', transferGroup: gid, note: note ? `${note} · 转入自${from}` : `转入自${from}` });
    Toast.show(`已互转 ${fmtMoney(amount)}`);
    Modal.close();
    this.render();
  }
};

/* ============================================
   记事本 — 日历驱动笔记与待办
   ============================================ */
const NotebookView = {
  selDate: todayStr(),
  render() {
    const now = new Date();
    CalNav.init('notebook', now.getFullYear(), now.getMonth(), this.selDate);
    const view = $('#view-notebook');
    view.innerHTML = `
      <div class="glass dash-card" style="margin-bottom:16px;overflow:visible">
        <div id="nbCal"></div>
      </div>
      <div id="nbDayContent"></div>
    `;
    this.renderCal();
    this.renderDay();
  },
  renderCal() {
    const { y, m, sel } = CalNav._s;
    const allNotes = Store.getNotes(), allTodos = Store.getTodos();
    const hasData = (ds) => {
      return allNotes.some(n => (n.date || n.createdAt) === ds) ||
             allTodos.some(t => (t.date || t.createdAt) === ds);
    };
    Calendar.render($('#nbCal'), y, m, { selectedDate: sel, hasData });
  },
  renderDay() {
    this.selDate = CalNav._s.sel || todayStr();
    const date = this.selDate;
    const d = parseDate(date);
    const dateLabel = `${d.getMonth()+1}月${d.getDate()}日 ${getWeekday(date)}`;
    const notes = Store.getNotes().filter(n => (n.date || n.createdAt) === date).sort((a,b) => (b.id).localeCompare(a.id));
    const todos = Store.getTodos().filter(t => (t.date || t.createdAt) === date);

    let html = `<div class="nb-day-header">
      <div class="nb-day-title">${dateLabel}</div>
      <div class="nb-day-count">${notes.length} 条笔记 · ${todos.length} 个待办</div>
    </div>`;

    // 笔记区
    html += `<div class="nb-section">
      <div class="nb-section-title">📝 笔记</div>`;
    if (notes.length === 0) {
      html += '<div class="empty-state"><div class="empty-state-icon">📝</div>当天暂无笔记</div>';
    } else {
      html += '<div class="nb-list">';
      notes.forEach(n => {
        html += `<div class="nb-item" onclick="NotebookView.viewNote('${n.id}')">
          <div class="nb-item-title">${escHtml(n.title) || '无标题'}</div>
          <div class="nb-item-preview">${escHtml((n.content||'').slice(0,50))}${(n.content||'').length>50?'...':''}</div>
        </div>`;
      });
      html += '</div>';
    }
    html += `<div style="text-align:right;padding:8px 0 4px">
      <button class="btn btn-primary btn-sm" onclick="NotebookView.openNoteAdd()">+ 新建笔记</button></div></div>`;

    // 待办区
    html += `<div class="nb-section">
      <div class="nb-section-title">✅ 待办</div>`;
    if (todos.length === 0 && !notes.length) {
      // already showed empty for notes, show empty for todos too if both empty
    }
    if (todos.length === 0) {
      html += '<div class="empty-state"><div class="empty-state-icon">✅</div>当天暂无待办</div>';
    } else {
      html += '<div class="nb-list">';
      todos.forEach(t => {
        html += `<div class="nb-todo-item ${t.done?'done':''}">
          <button class="nb-todo-check-btn ${t.done?'checked':''}" onclick="NotebookView.toggleTodo('${t.id}')"
            aria-label="${t.done?'标记未完成':'标记完成'}">${t.done?'✓':''}</button>
          <div class="nb-todo-info" onclick="NotebookView.editTodo('${t.id}')">
            <div class="nb-todo-text ${t.done?'done':''}">${escHtml(t.text)}</div>
          </div>
          <button class="btn-icon nb-todo-del" style="width:24px;height:24px;flex-shrink:0;opacity:0.4"
            onclick="event.stopPropagation();NotebookView.delTodo('${t.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>
        </div>`;
      });
      html += '</div>';
    }
    html += `<div class="nb-todo-add-row">
      <input class="form-input" id="nbNewTodoInput" placeholder="添加待办..." style="font-size:13px"
        onkeydown="if(event.key==='Enter')NotebookView.addTodo()">
      <button class="btn btn-primary btn-sm" onclick="NotebookView.addTodo()">+</button>
    </div></div>`;

    $('#nbDayContent').innerHTML = html;
  },

  // ===== 笔记操作 =====
  openNoteAdd(editId) {
    const title = '', content = '';
    Modal.open(editId ? '编辑笔记' : '新建笔记', `
      <div class="form-group"><label class="form-label">标题</label><input class="form-input" id="nbTitle" placeholder="笔记标题" autofocus value=""></div>
      <div class="form-group"><label class="form-label">内容</label><textarea class="form-textarea" id="nbContent" rows="5" placeholder="写下你的想法..."></textarea></div>
      <div class="form-actions">
        <button class="btn btn-glass" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="NotebookView.saveNote(${editId ? "'"+editId+"'" : ''})">保存</button>
      </div>
    `);
    if (editId) {
      const n = Store.getNotes().find(x => x.id === editId);
      if (n) { $('#nbTitle').value = n.title||''; $('#nbContent').value = n.content||''; }
    }
  },
  saveNote(editId) {
    const title = $('#nbTitle').value.trim();
    const content = $('#nbContent').value.trim();
    if (!title && !content) { Toast.show('请输入内容', 'error'); return; }
    if (editId) {
      Store.updateNote(editId, { title, content });
      Toast.show('已更新');
    } else {
      Store.addNote({ title, content, date: this.selDate });
      Toast.show('已保存');
    }
    Modal.close(); this.renderCal(); this.renderDay();
  },
  viewNote(id) {
    const n = Store.getNotes().find(x => x.id === id); if (!n) return;
    Modal.open(n.title || '笔记', `
      <div style="font-size:13px;color:var(--text-secondary);line-height:1.8;white-space:pre-wrap">${escHtml(n.content)||'（空内容）'}</div>
      <div style="font-size:11px;color:var(--text-tertiary);margin-top:12px;text-align:right">${n.date || n.createdAt || ''}</div>
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
        <button class="btn btn-glass btn-sm" onclick="Modal.close();NotebookView.openNoteAdd('${id}')">编辑</button>
        <button class="btn btn-danger btn-sm" onclick="Modal.close();NotebookView.delNote('${id}')">删除</button>
      </div>
    `);
  },
  delNote(id) { ConfirmDialog.show('确认删除这条笔记？', () => { Store.deleteNote(id); this.renderCal(); this.renderDay(); Toast.show('已删除'); }); },

  // ===== 待办操作 =====
  addTodo() {
    const input = $('#nbNewTodoInput'); if (!input) return;
    const text = input.value.trim(); if (!text) return;
    Store.addTodo({ text, done: false, date: this.selDate });
    input.value = ''; this.renderCal(); this.renderDay(); Toast.show('已添加');
  },
  toggleTodo(id) {
    const todos = Store.getTodos();
    const t = todos.find(x => x.id === id); if (!t) return;
    t.done = !t.done; Store.saveTodos(todos); this.renderDay();
  },
  editTodo(id) {
    const t = Store.getTodos().find(x => x.id === id); if (!t) return;
    const newText = prompt('编辑待办：', t.text);
    if (newText !== null && newText.trim()) { Store.updateTodo(id, { text: newText.trim() }); this.renderDay(); }
  },
  delTodo(id) { ConfirmDialog.show('确认删除？', () => { Store.deleteTodo(id); this.renderCal(); this.renderDay(); Toast.show('已删除'); }); }
};

/* ============================================
   拼豆库存管理
   ============================================ */
const BeadView = {
  _expanded: new Set(),
  _importMatched: [],
  _adjSign: {},
  render() {
    const content = document.querySelector('.content');
    const prevScroll = content ? content.scrollTop : 0;
    const beads = getAllBeads();
    const stock = Store.getBeadStock();
    const threshold = Store.getBeadThreshold();

    const totalColors = beads.length;
    const inStock = beads.filter(b => (stock[b.num]?.stock || 0) > 0).length;
    const totalBeads = beads.reduce((s, b) => s + (stock[b.num]?.stock || 0), 0);
    const lowCount = beads.filter(b => (stock[b.num]?.stock || 0) < threshold).length;

    const html = `
      <div class="bead-overview">
        <div class="glass bead-ov-card"><div class="bead-ov-value" id="ovTotalColors">${totalColors}</div><div class="bead-ov-label">总色数</div></div>
        <div class="glass bead-ov-card"><div class="bead-ov-value" id="ovInStock">${inStock}</div><div class="bead-ov-label">已有色</div></div>
        <div class="glass bead-ov-card"><div class="bead-ov-value" id="ovTotalBeads">${fmtInt(totalBeads)}</div><div class="bead-ov-label">总豆数</div></div>
        <div class="glass bead-ov-card warn bead-ov-clickable" onclick="BeadView.openLowStock()"><div class="bead-ov-value" id="ovLow">${lowCount}</div><div class="bead-ov-label">低库存 ›</div></div>
      </div>

      <div class="bead-threshold glass" onclick="BeadView.editThreshold()">
        ⚠️ 低库存阈值 <b id="ovThreshold">${threshold}</b> 颗（点击修改）
      </div>

      <div class="bead-family-grid">
        ${BEAD_FAMILIES.map(f => this._familyCardHTML(f, beads, stock, threshold)).join('')}
      </div>

      <div class="bead-actionbar">
        <button class="btn btn-glass" onclick="BeadView.openImport()">📥 导入</button>
        <button class="btn btn-glass" onclick="BeadView.openExport()">📤 导出</button>
        <button class="btn btn-primary" onclick="BeadView.openAdd()">＋ 新增</button>
      </div>

      <div class="glass bead-log-card">
        <div class="bead-log-head">
          <span class="bead-log-title">📝 修改记录</span>
          <button class="bead-log-clear" onclick="BeadView.clearLogs()">清空</button>
        </div>
        <div class="bead-log-list" id="beadLogList"></div>
      </div>
    `;
    $('#view-bead').innerHTML = html;
    if (content) content.scrollTop = prevScroll;
    this._renderLogs();
  },

  // ===== 修改记录 =====
  _log(type, title, detail) {
    const logs = Store.getBeadLogs();
    logs.unshift({ id: uid(), time: Date.now(), type, title, detail: detail || '' });
    if (logs.length > 50) logs.length = 50;
    Store.saveBeadLogs(logs);
  },
  _renderLogs() {
    const el = document.getElementById('beadLogList');
    if (!el) return;
    const logs = Store.getBeadLogs();
    if (logs.length === 0) { el.innerHTML = '<div class="bead-log-empty">暂无修改记录</div>'; return; }
    const icon = { adjust: '📦', edit: '✎', add: '➕', threshold: '⚙️', import: '📥' };
    el.innerHTML = logs.slice(0, 20).map(l => {
      const d = new Date(l.time);
      const ts = `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `<div class="bead-log-item">
        <span class="bead-log-ic">${icon[l.type] || '•'}</span>
        <div class="bead-log-body">
          <div class="bead-log-line"><b>${escHtml(l.title)}</b><span class="bead-log-time">${ts}</span></div>
          ${l.detail ? `<div class="bead-log-detail">${escHtml(l.detail)}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  },
  clearLogs() {
    ConfirmDialog.show('确认清空全部修改记录？', () => {
      Store.saveBeadLogs([]);
      this.render();
      Toast.show('已清空');
    });
  },

  _familyCardHTML(f, beads, stock, threshold) {
    const famBeads = beads.filter(b => b.family === f.code);
    const famTotal = famBeads.reduce((s, b) => s + (stock[b.num]?.stock || 0), 0);
    const famIn = famBeads.filter(b => (stock[b.num]?.stock || 0) > 0).length;
    const open = this._expanded.has(f.code);
    return `
      <div class="glass bead-family-card">
        <div class="bfc-head" onclick="BeadView.toggleFamily('${f.code}')">
          <span class="bfc-dot" style="background:${f.color}"></span>
          <div class="bfc-title">
            <div class="bfc-name">${f.code}系</div>
            <div class="bfc-sub">${famBeads.length} 色</div>
          </div>
          <span class="bfc-chevron ${open ? 'open' : ''}">${open ? '▾' : '▸'}</span>
        </div>
        <div class="bfc-stats">
          <div><b>${fmtInt(famTotal)}</b><span>总库存</span></div>
          <div><b>${famIn}</b><span>已有色</span></div>
        </div>
        <div class="bead-detail ${open ? 'open' : ''}" id="beadDetail_${f.code}">
          ${famBeads.map(b => this._rowHTML(b, stock[b.num]?.stock || 0, stock[b.num]?.note || '', threshold)).join('')}
        </div>
      </div>`;
  },

  _rowHTML(b, stockVal, note, threshold) {
    const st = beadStatus(stockVal, threshold);
    const s = BEAD_STATUS[st];
    return `
      <div class="bead-row" id="beadRow_${b.num}">
        <span class="bead-swatch" style="background:${getBeadColor(b.num, b.hex)}" title="${getBeadColor(b.num, b.hex)}"></span>
        <div class="bead-info">
          <div class="bead-num">${b.num}</div>
          <div class="bead-name">${escHtml(b.name)}</div>
        </div>
        <div class="bead-stock">
          <span class="bead-qty" id="beadQty_${b.num}">${fmtInt(stockVal)}</span>
          <span class="bead-status ${s.cls}" id="beadStatus_${b.num}">${s.label}</span>
        </div>
        <div class="bead-actions">
          <button class="bead-step" onclick="BeadView.openAdjust('${b.num}',-1)">−</button>
          <button class="bead-step" onclick="BeadView.openAdjust('${b.num}',1)">+</button>
          <button class="bead-edit" onclick="BeadView.editBead('${b.num}')">✎</button>
          <button class="bead-del" onclick="BeadView.delBead('${b.num}')" title="删除色号">🗑</button>
          <div class="bead-adj-pop" id="beadAdj_${b.num}" style="display:none">
            <span class="bead-adj-sign" id="beadAdjSign_${b.num}"></span>
            <input class="form-input bead-adj-input" type="number" min="1" step="1" id="beadAdjInput_${b.num}" inputmode="numeric" placeholder="数量" onkeydown="if(event.key==='Enter'){event.preventDefault();BeadView.confirmAdjust('${b.num}')}">
            <button class="bead-adj-ok" onclick="BeadView.confirmAdjust('${b.num}')">确定</button>
            <button class="bead-adj-cancel" onclick="BeadView.closeAdjust('${b.num}')">✕</button>
          </div>
        </div>
      </div>`;
  },

  toggleFamily(code) {
    if (this._expanded.has(code)) this._expanded.delete(code); else this._expanded.add(code);
    const detail = document.getElementById('beadDetail_' + code);
    if (detail) detail.classList.toggle('open');
    const card = detail ? detail.closest('.bead-family-card') : null;
    if (card) { const ch = card.querySelector('.bfc-chevron'); if (ch) ch.classList.toggle('open'); }
  },

  openLowStock() {
    const beads = getAllBeads();
    const stock = Store.getBeadStock();
    const threshold = Store.getBeadThreshold();
    const low = beads
      .filter(b => (stock[b.num]?.stock || 0) < threshold)
      .map(b => ({ b, q: stock[b.num]?.stock || 0 }))
      .sort((a, b) => a.q - b.q);
    if (low.length === 0) { Toast.show('暂无低库存色号 🎉'); return; }
    let body = `<div class="bead-low-list">`;
    low.forEach(({ b, q }) => {
      const st = beadStatus(q, threshold);
      const s = BEAD_STATUS[st];
      body += `<div class="bead-low-item" onclick="BeadView.jumpToBead('${b.num}')">
        <span class="bead-swatch" style="background:${getBeadColor(b.num, b.hex)}" title="${getBeadColor(b.num, b.hex)}"></span>
        <div class="bead-low-info">
          <div class="bead-num">${b.num}</div>
          <div class="bead-name">${escHtml(b.name)}</div>
        </div>
        <div class="bead-stock">
          <span class="bead-qty">${fmtInt(q)}</span>
          <span class="bead-status ${s.cls}">${s.label}</span>
        </div>
      </div>`;
    });
    body += '</div>';
    Modal.open(`⚠️ 低库存色号 (${low.length})`, body);
  },

  jumpToBead(num) {
    const b = getBeadByNum(num);
    if (!b) return;
    Modal.close();
    this._expanded.add(b.family);
    this.render();
    setTimeout(() => {
      const row = document.getElementById('beadRow_' + num);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.add('bead-flash');
        setTimeout(() => row.classList.remove('bead-flash'), 1400);
      }
    }, 80);
  },

  adjust(num, delta) {
    const stock = Store.getBeadStock();
    const cur = stock[num] ? stock[num].stock : 0;
    const nv = Math.max(0, cur + delta);
    const note = stock[num] ? (stock[num].note || '') : '';
    Store.setBeadStockNum(num, nv, note);
    this._log('adjust', '库存调整', `${num}：${cur} → ${nv}（${delta > 0 ? '+' : ''}${delta} 颗）`);
    const qtyEl = document.getElementById('beadQty_' + num);
    if (qtyEl) qtyEl.textContent = fmtInt(nv);
    const row = document.getElementById('beadRow_' + num);
    if (row) {
      const st = beadStatus(nv, Store.getBeadThreshold());
      const badge = document.getElementById('beadStatus_' + num);
      if (badge) { badge.className = 'bead-status ' + BEAD_STATUS[st].cls; badge.textContent = BEAD_STATUS[st].label; }
    }
    this._updateOverview();
    this._renderLogs();
  },

  openAdjust(num, sign) {
    this._adjSign = this._adjSign || {};
    this._adjSign[num] = sign;
    const pop = document.getElementById('beadAdj_' + num);
    if (!pop) return;
    pop.style.display = 'flex';
    const signEl = document.getElementById('beadAdjSign_' + num);
    if (signEl) signEl.textContent = sign > 0 ? '＋' : '－';
    const inp = document.getElementById('beadAdjInput_' + num);
    if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 0); }
  },

  confirmAdjust(num) {
    const pop = document.getElementById('beadAdj_' + num);
    const inp = document.getElementById('beadAdjInput_' + num);
    let v = parseInt(inp ? inp.value : '', 10);
    if (!v || v < 1) { if (inp) inp.focus(); Toast.show('请输入有效数量', 'error'); return; }
    const sign = (this._adjSign && this._adjSign[num]) || 1;
    if (pop) pop.style.display = 'none';
    this.adjust(num, sign * v);
  },

  closeAdjust(num) {
    const pop = document.getElementById('beadAdj_' + num);
    if (pop) pop.style.display = 'none';
  },

  _updateOverview() {
    const beads = getAllBeads();
    const stock = Store.getBeadStock();
    const threshold = Store.getBeadThreshold();
    const inStock = beads.filter(b => (stock[b.num]?.stock || 0) > 0).length;
    const totalBeads = beads.reduce((s, b) => s + (stock[b.num]?.stock || 0), 0);
    const lowCount = beads.filter(b => (stock[b.num]?.stock || 0) < threshold).length;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('ovInStock', inStock);
    set('ovTotalBeads', fmtInt(totalBeads));
    set('ovLow', lowCount);
  },

  // ===== 编辑单色 =====
  editBead(num) {
    const b = getBeadByNum(num); if (!b) return;
    const stock = Store.getBeadStock();
    const cur = stock[num] || { stock: 0, note: '' };
    const custom = Store.getBeadCustom().find(x => x.num === num);
    const nameField = custom ? `
      <div class="form-group"><label class="form-label">颜色名称</label><input class="form-input" id="beadEditName" value="${escHtml(b.name)}"></div>
      <div class="form-group"><label class="form-label">HEX 色值</label><input class="form-input" id="beadEditHex" value="${getBeadColor(b.num, b.hex)}"></div>` : '';
    Modal.open('编辑 · ' + b.num, `
      ${nameField}
      <div class="form-group"><label class="form-label">库存数量（颗）</label><input class="form-input" id="beadEditStock" type="number" min="0" value="${cur.stock}"></div>
      <div class="form-group"><label class="form-label">备注</label><input class="form-input" id="beadEditNote" value="${escHtml(cur.note || '')}" placeholder="选填"></div>
      <div class="form-actions">
        <button class="btn btn-glass" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="BeadView.saveEdit('${num}')">保存</button>
      </div>
    `);
  },
  saveEdit(num) {
    const stockVal = parseInt($('#beadEditStock').value, 10);
    const note = $('#beadEditNote').value.trim();
    const custom = Store.getBeadCustom().find(x => x.num === num);
    if (custom) {
      const nameEl = $('#beadEditName'); const hexEl = $('#beadEditHex');
      if (nameEl) custom.name = nameEl.value.trim() || custom.name;
      if (hexEl) custom.hex = hexEl.value.trim() || custom.hex;
      Store.saveBeadCustom(Store.getBeadCustom());
    }
    Store.setBeadStockNum(num, isNaN(stockVal) ? 0 : stockVal, note);
    this._log('edit', '编辑色号', `${num}：库存设为 ${isNaN(stockVal) ? 0 : stockVal}${note ? ' · 备注：' + note : ''}`);
    Modal.close();
    this.render();
    Toast.show('已保存');
  },

  // ===== 删除单色 =====
  delBead(num) {
    const custom = Store.getBeadCustom().find(x => x.num === num);
    ConfirmDialog.show(`确认删除色号「${num}」？${custom ? '该自定义色号将被彻底移除。' : '该目录色号将从列表中隐藏（重新导入文件可恢复）。'}`, () => {
      const stock = Store.getBeadStock();
      const qty = stock[num] ? stock[num].stock : 0;
      if (custom) {
        Store.saveBeadCustom(Store.getBeadCustom().filter(x => x.num !== num));
      } else {
        const del = Store.getBeadDeleted();
        if (del.indexOf(num) === -1) { del.push(num); Store.saveBeadDeleted(del); }
      }
      // 移除该色号的库存 / 颜色覆盖记录
      if (stock[num]) { delete stock[num]; Store.saveBeadStock(stock); }
      const colors = Store.getBeadColors();
      if (colors[num]) { delete colors[num]; Store.saveBeadColors(colors); }
      this._log('delete', '删除色号', `${num}（${custom ? '自定义' : '目录'}）· 原库存 ${qty} 颗`);
      this.render();
      Toast.show('已删除 ' + num);
    });
  },

  // ===== 新增 =====
  openAdd() {
    const famOpts = BEAD_FAMILIES.map((f, i) => `
      <button type="button" class="fam-chip ${i === 0 ? 'active' : ''}" data-code="${f.code}" onclick="BeadView._pickFam('${f.code}')">
        <span class="fam-dot" style="background:${f.color}"></span>
        <span class="fam-chip-txt"><b>${f.code}系</b><i>${f.name}</i></span>
      </button>`).join('');
    Modal.open('新增色号', `
      <div class="form-group">
        <label class="form-label">色系</label>
        <input type="hidden" id="beadAddFam" value="${BEAD_FAMILIES[0].code}">
        <div class="fam-picker" id="beadAddFamPicker">${famOpts}</div>
      </div>
      <div class="form-group"><label class="form-label">色号</label><input class="form-input" id="beadAddNum" placeholder="如 A99"></div>
      <div class="form-group"><label class="form-label">颜色名称</label><input class="form-input" id="beadAddName" placeholder="如 薄荷绿"></div>
      <div class="form-group"><label class="form-label">HEX 色值</label><div style="display:flex;gap:8px;align-items:center"><input class="form-input" id="beadAddHex" placeholder="#52C41A" style="flex:1"><input type="color" id="beadAddColor" value="#52C41A" style="width:42px;height:38px;border:none;background:none;border-radius:8px" oninput="document.getElementById('beadAddHex').value=this.value"></div></div>
      <div class="form-group"><label class="form-label">库存数量（颗）</label><input class="form-input" id="beadAddQty" type="number" min="0" value="0"></div>
      <div class="form-group"><label class="form-label">备注</label><input class="form-input" id="beadAddNote" placeholder="选填"></div>
      <div class="form-actions">
        <button class="btn btn-glass" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="BeadView.saveAdd()">添加</button>
      </div>
    `);
  },
  _pickFam(code) {
    const picker = document.getElementById('beadAddFamPicker');
    if (picker) picker.querySelectorAll('.fam-chip').forEach(c => c.classList.toggle('active', c.dataset.code === code));
    const hid = document.getElementById('beadAddFam');
    if (hid) hid.value = code;
  },
  saveAdd() {
    const fam = $('#beadAddFam').value;
    const num = ($('#beadAddNum').value || '').trim().toUpperCase();
    const name = ($('#beadAddName').value || '').trim() || num;
    const hexRaw = ($('#beadAddHex').value || '').trim();
    const qty = parseInt($('#beadAddQty').value, 10) || 0;
    const note = ($('#beadAddNote').value || '').trim();
    if (!num) { Toast.show('请填写色号', 'error'); return; }
    if (getAllBeads().some(b => b.num === num)) { Toast.show('色号已存在', 'error'); return; }
    let hex = /^#[0-9a-fA-F]{6}$/.test(hexRaw) ? hexRaw : (BEAD_FAMILIES.find(x => x.code === fam) || {}).color || '#cccccc';
    const custom = Store.getBeadCustom();
    custom.push({ family: fam, num, name, hex });
    Store.saveBeadCustom(custom);
    Store.setBeadStockNum(num, qty, note);
    this._log('add', '新增色号', `${num}（${name}）· 库存 ${qty}`);
    Modal.close();
    this.render();
    Toast.show('已新增 ' + num);
  },

  // ===== 阈值 =====
  editThreshold() {
    const cur = Store.getBeadThreshold();
    Modal.open('低库存阈值', `
      <div class="form-group"><label class="form-label">库存低于该数值即标记为「偏低 / 缺货」（颗）</label><input class="form-input" id="beadThInput" type="number" min="0" value="${cur}"></div>
      <div class="form-actions">
        <button class="btn btn-glass" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="BeadView.saveThreshold()">保存</button>
      </div>
    `);
  },
  saveThreshold() {
    const v = parseInt($('#beadThInput').value, 10);
    if (isNaN(v) || v < 0) { Toast.show('请输入有效数值', 'error'); return; }
    Store.setBeadThreshold(v);
    this._log('threshold', '修改阈值', `低库存阈值 → ${v} 颗`);
    Modal.close();
    this.render();
    Toast.show('阈值已更新');
  },

  // ===== 导入 =====
  openImport() {
    Modal.open('导入库存', `
      <div class="form-group">
        <label class="form-label">选择 CSV / Excel 文件</label>
        <input type="file" id="beadImportFile" accept=".csv,.xlsx,.xls" class="form-input" onchange="BeadView._onImportFile(event)">
      </div>
      <p class="form-hint">标准模板：<b>色号,存量(粒)</b>（首行为表头）。按色号匹配并更新库存，未在文件中的色号保持不变。可点下方按钮下载空模板。</p>
      <div style="margin:6px 0 10px"><button class="btn btn-glass btn-sm" onclick="BeadView.downloadTemplate()">⬇ 下载导入模板</button></div>
      <div id="beadImportPreview"></div>
      <div class="form-actions" id="beadImportActions" style="display:none">
        <button class="btn btn-glass" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="BeadView._confirmImport()">确认导入</button>
      </div>
    `);
  },
  downloadTemplate() {
    const cats = getAllBeads();
    let csv = '﻿色号,颜色,存量(粒)\n';
    cats.forEach(b => { csv += b.num + ',' + getBeadColor(b.num, b.hex) + ',0\n'; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '仓库导入模板_' + todayStr() + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Toast.show('模板已下载');
  },
  _onImportFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = () => this._processImportRows(this._csvToRows(this._decodeBytes(reader.result)));
      reader.readAsArrayBuffer(file);
    } else {
      this._loadXlsx(() => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = new Uint8Array(ev.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
            this._processImportRows(json.map(r => r.map(c => c == null ? '' : String(c))));
          } catch (err) { Toast.show('Excel 解析失败', 'error'); }
        };
        reader.readAsArrayBuffer(file);
      });
    }
  },
  _decodeBytes(buf) {
    const bytes = new Uint8Array(buf);
    // UTF-8 BOM → 直接按 UTF-8 解码（跳过 BOM）
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return new TextDecoder('utf-8').decode(bytes.subarray(3));
    }
    let utf8 = '', gbk = '';
    try { utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes); } catch (e) {}
    try { gbk = new TextDecoder('gbk', { fatal: false }).decode(bytes); } catch (e) {}
    const utf8Bad = (utf8.match(/�/g) || []).length;
    const gbkBad = (gbk.match(/�/g) || []).length;
    // 替换字符越少说明编码越正确；平局优先 UTF-8（含纯 ASCII 场景）
    return gbkBad < utf8Bad ? gbk : utf8;
  },
  _loadXlsx(cb) {
    if (typeof XLSX !== 'undefined') { cb(); return; }
    Toast.show('正在加载 Excel 解析库...');
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = cb;
    s.onerror = () => Toast.show('Excel 解析库加载失败，请改用 CSV', 'error');
    document.head.appendChild(s);
  },
  _csvToRows(text) {
    text = text.replace(/^﻿/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    return lines.map(l => this._splitCSVLine(l));
  },
  _splitCSVLine(line) {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else {
        if (c === ',') { out.push(cur); cur = ''; }
        else if (c === '"') q = true;
        else cur += c;
      }
    }
    out.push(cur);
    return out;
  },
  _processImportRows(rows) {
    if (!rows.length) { Toast.show('文件为空', 'error'); return; }
    let header = null, dataRows = rows;
    const first = rows[0].map(c => c.trim());
    const hasHeader = first.some(c => /色号|色码|编号|code|num|数量|库存|quantity|stock|颜色|名称|name|备注|note/i.test(c));
    if (hasHeader) { header = first; dataRows = rows.slice(1); }
    const findIdx = (keys) => {
      if (!header) return -1;
      return header.findIndex(h => keys.some(k => new RegExp(k, 'i').test(h)));
    };
    const idxOr = (keys, fallback) => { const i = findIdx(keys); return i >= 0 ? i : fallback; };
    const iNum = header ? idxOr(['色号', '色码', '编号', 'code', 'num', 'number'], 0) : 0;
    const iName = header ? idxOr(['颜色名称', '名称', '名字', 'name'], -1) : -1;
    const iQty = header ? idxOr(['存量', '数量', '库存', 'quantity', 'stock', 'qty'], 1) : 2;
    const iNote = header ? idxOr(['备注', 'note', 'remark'], 3) : 3;
    const iColor = header ? idxOr(['色值', 'rgb', 'hex', '颜色$'], -1) : -1;
    const catalog = getAllBeads();
    const matched = []; const unrecognized = [];
    dataRows.forEach(r => {
      const num = (r[iNum] || '').trim().toUpperCase();
      if (!num) return;
      const qty = parseInt((r[iQty] || '').toString().replace(/[^\d-]/g, ''), 10);
      if (isNaN(qty)) return;
      const name = iName >= 0 ? (r[iName] || '').trim() : '';
      const note = iNote >= 0 ? (r[iNote] || '').trim() : '';
      const colorRaw = iColor >= 0 ? (r[iColor] || '').trim() : '';
      const color = colorRaw ? parseColor(colorRaw) : null;
      const bead = catalog.find(b => b.num.toUpperCase() === num);
      if (bead) matched.push({ num, qty, name, note, color });
      else unrecognized.push(num);
    });
    this._importMatched = matched;
    let preview = `
      <div class="import-summary">
        <div class="import-stat ok">可更新 <b>${matched.length}</b> 项</div>
        <div class="import-stat warn">无法识别 <b>${unrecognized.length}</b> 项</div>
      </div>`;
    if (matched.length) {
      preview += `<div class="import-preview-list">${matched.slice(0, 8).map(m => `<div>${m.color ? `<span class="bead-swatch sm" style="background:${m.color}"></span>` : ''}${m.num} → ${fmtInt(m.qty)} 颗${m.name ? '（' + escHtml(m.name) + '）' : ''}</div>`).join('')}${matched.length > 8 ? '<div>…</div>' : ''}</div>`;
    }
    if (unrecognized.length) {
      preview += `<div class="import-unrec">未识别：${unrecognized.slice(0, 20).map(u => escHtml(u)).join('、')}${unrecognized.length > 20 ? '…' : ''}</div>`;
    }
    $('#beadImportPreview').innerHTML = preview;
    $('#beadImportActions').style.display = matched.length ? 'flex' : 'none';
    if (!matched.length) Toast.show('没有可匹配的色号', 'error');
  },
  _confirmImport() {
    const stock = Store.getBeadStock();
    const colors = Store.getBeadColors();
    let updated = 0, colorUpdated = 0;
    this._importMatched.forEach(m => {
      const cur = stock[m.num] || { stock: 0, note: '' };
      stock[m.num] = { stock: Math.max(0, m.qty), note: m.note || cur.note || '' };
      updated++;
      if (m.color) { colors[m.num] = m.color; colorUpdated++; }
    });
    Store.saveBeadStock(stock);
    this._log('import', '导入库存', `更新 ${updated} 项${colorUpdated ? ' · 颜色 ' + colorUpdated : ''}`);
    if (colorUpdated) Store.saveBeadColors(colors);
    Modal.close();
    this.render();
    Toast.show(`已导入 ${updated} 项` + (colorUpdated ? ` · 更新 ${colorUpdated} 个颜色` : ''));
  },

  // ===== 导出 =====
  openExport() {
    const fams = BEAD_FAMILIES;
    Modal.open('导出库存', `
      <div class="form-group">
        <label class="form-label">导出范围</label>
        <div class="filter-chips" id="beadExpRange">
          <div class="filter-chip active" data-range="all">全部色号</div>
          <div class="filter-chip" data-range="instock">仅含库存</div>
          <div class="filter-chip" data-range="low">低库存 / 缺货</div>
          <div class="filter-chip" data-range="family">按色系</div>
        </div>
      </div>
      <div class="form-group" id="beadExpFamWrap" style="display:none">
        <label class="form-label">选择色系</label>
        <div class="filter-chips" id="beadExpFam">
          ${fams.map((f,i) => `<div class="filter-chip${i===0?' active':''}" data-fam="${f.code}"><span class="bead-swatch sm" style="background:${f.color}"></span>${f.code}系</div>`).join('')}
        </div>
      </div>
      <div class="glass bead-exp-preview">
        <div class="bead-exp-preview-head">
          <span class="bead-exp-preview-title">📋 导出预览</span>
          <span class="bead-exp-count" id="beadExpCount">0 项</span>
        </div>
        <div class="bead-exp-list" id="beadExpPreview"></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-glass" onclick="Modal.close()">取消</button>
        <button class="btn btn-primary" onclick="BeadView._doExport()">导出 CSV</button>
      </div>
    `);
    const refresh = () => {
      const active = $('#beadExpRange .filter-chip.active');
      const range = active ? active.dataset.range : 'all';
      $('#beadExpFamWrap').style.display = range === 'family' ? 'block' : 'none';
      const famActive = $('#beadExpFam .filter-chip.active');
      const famCode = famActive ? famActive.dataset.fam : null;
      this._renderExpPreview(range, range === 'family' ? famCode : null);
    };
    $$('#beadExpRange .filter-chip').forEach(ch => {
      ch.addEventListener('click', () => {
        $$('#beadExpRange .filter-chip').forEach(c => c.classList.remove('active'));
        ch.classList.add('active');
        refresh();
      });
    });
    $$('#beadExpFam .filter-chip').forEach(ch => {
      ch.addEventListener('click', () => {
        $$('#beadExpFam .filter-chip').forEach(c => c.classList.remove('active'));
        ch.classList.add('active');
        refresh();
      });
    });
    refresh();
  },
  _renderExpPreview(range, famCode) {
    const threshold = Store.getBeadThreshold();
    let beads = getAllBeads();
    const stock = Store.getBeadStock();
    if (range === 'instock') beads = beads.filter(b => (stock[b.num]?.stock || 0) > 0);
    else if (range === 'low') beads = beads.filter(b => (stock[b.num]?.stock || 0) <= threshold);
    else if (range === 'family' && famCode) beads = beads.filter(b => b.family === famCode);
    const cnt = $('#beadExpCount');
    if (cnt) cnt.textContent = beads.length + ' 项';
    const el = $('#beadExpPreview');
    if (!el) return;
    if (beads.length === 0) { el.innerHTML = '<div class="bead-log-empty">没有符合条件的色号</div>'; return; }
    el.innerHTML = beads.map(b => {
      const v = stock[b.num]?.stock || 0;
      const st = beadStatus(v, threshold);
      const s = BEAD_STATUS[st];
      return `<div class="bead-row">
        <span class="bead-swatch" style="background:${getBeadColor(b.num, b.hex)}" title="${getBeadColor(b.num, b.hex)}"></span>
        <div class="bead-info">
          <div class="bead-num">${b.num}</div>
          <div class="bead-name">${escHtml(b.name)}</div>
        </div>
        <div class="bead-stock">
          <span class="bead-qty">${fmtInt(v)}</span>
          <span class="bead-status ${s.cls}">${s.label}</span>
        </div>
      </div>`;
    }).join('');
  },
  _doExport() {
    const active = $('#beadExpRange .filter-chip.active');
    const range = active ? active.dataset.range : 'all';
    const threshold = Store.getBeadThreshold();
    let beads = getAllBeads();
    const stock = Store.getBeadStock();
    if (range === 'instock') beads = beads.filter(b => (stock[b.num]?.stock || 0) > 0);
    else if (range === 'low') beads = beads.filter(b => (stock[b.num]?.stock || 0) <= threshold);
    else if (range === 'family') { const famActive = $('#beadExpFam .filter-chip.active'); const fc = famActive ? famActive.dataset.fam : null; if (fc) beads = beads.filter(b => b.family === fc); }
    const header = ['色系', '色号', '颜色名称', 'HEX色值', '库存数量', '状态', '备注'];
    const lines = [header.map(csvCell).join(',')];
    beads.forEach(b => {
      const v = stock[b.num]?.stock || 0;
      const note = stock[b.num]?.note || '';
      const st = v <= 0 ? '缺货' : (v <= threshold ? '偏低' : '充足');
      lines.push([b.family, b.num, b.name, getBeadColor(b.num, b.hex), v, st, note].map(csvCell).join(','));
    });
    const csv = '﻿' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const fn = `拼豆库存_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.csv`;
    a.href = url; a.download = fn; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    Modal.close();
    Toast.show('已导出 ' + beads.length + ' 项');
  }
};

/* ============================================
   云端备份
   ============================================ */
const CloudBackup = {
  open() {
    Modal.open('云端备份', `
      <p class="form-hint">将全部数据（记账、体重、经期、记事本、待办、拼豆库存等）打包成一个备份文件。可保存到你的网盘或本机，换设备 / 清缓存后可一键恢复。</p>
      <div class="backup-actions" style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
        <button class="btn btn-primary" onclick="CloudBackup.doExport()">☁️ 备份并下载</button>
        <button class="btn btn-glass" onclick="CloudBackup.pickFile()">📥 从备份恢复</button>
        <input type="file" id="backupFile" accept=".json,application/json" style="display:none" onchange="CloudBackup.doImport(event)">
      </div>
    `);
  },
  doExport() {
    const data = Store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const name = `All数据备份_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.json`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    Modal.close();
    Toast.show('已生成备份文件，请保存到网盘 / 本机');
  },
  pickFile() {
    const input = document.getElementById('backupFile');
    if (input) input.click();
  },
  doImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        ConfirmDialog.show('恢复备份将覆盖当前全部数据，确认继续？', () => {
          if (Store.importAll(obj)) {
            Modal.close();
            Toast.show('恢复成功');
            if (typeof HomeView !== 'undefined') HomeView.render();
            if (typeof AccountView !== 'undefined') AccountView.render();
            if (typeof HealthView !== 'undefined') { HealthView.renderWeight && HealthView.renderWeight(); HealthView.renderPeriod && HealthView.renderPeriod(); }
            if (typeof NotebookView !== 'undefined') NotebookView.render();
            if (typeof BeadView !== 'undefined') BeadView.render();
          } else {
            Toast.show('备份文件格式不正确', 'error');
          }
        });
      } catch (err) {
        Toast.show('无法解析备份文件', 'error');
      }
    };
    reader.readAsText(file, 'utf-8');
  }
};

/* ============================================
   App
   ============================================ */
const App = {
  init() {
    Store._init();
    this.boot();
  },
  boot() {
    this.migrate();
    this.seed();
    this.seedBeads();
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', () => this.navigate(item.dataset.view));
    });
    this.navigate('home');
    this._fillLaunchPreview();
  },
  _fillLaunchPreview() {
    const el = document.getElementById('appLaunch');
    if (!el) return;
    const now = new Date();
    const today = todayStr();
    const expenses = Store.getAccounts().filter(e => e.date === today);
    const todayExpense = expenses.filter(e => e.type === 'expense').reduce((s, e) => s + parseFloat(e.amount), 0);
    const monthExpense = Store.getAccounts().filter(e => monthKey(e.date) === monthKey(today) && e.type === 'expense').reduce((s, e) => s + parseFloat(e.amount), 0);
    const weights = Store.getWeights().sort((a, b) => a.date.localeCompare(b.date));
    const latestWeight = weights[weights.length - 1];
    const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
    set('launchHi', now.getHours() < 12 ? '早上好' : now.getHours() < 18 ? '下午好' : '晚上好');
    set('launchDay', `${now.getMonth() + 1}.${now.getDate()}`);
    set('launchWeek', getWeekday(today));
    set('launchToday', '¥' + (todayExpense < 1000 ? fmtMoney(todayExpense) : (todayExpense / 1000).toFixed(1) + 'k'));
    set('launchMonth', '¥' + (monthExpense < 1000 ? fmtMoney(monthExpense) : (monthExpense / 1000).toFixed(1) + 'k'));
    const wEl = document.getElementById('launchWeight');
    if (wEl) wEl.innerHTML = latestWeight ? `${Number(latestWeight.weight).toFixed(2)}<span class="unit">kg</span>` : '--';
  },
  migrate() {
    // 迁移旧账户名到新账户名
    const map = { '微信': '微信1', '银行卡': '浦发1', '信用卡': '中国工商', '现金': '微信2' };
    const accounts = Store.getAccounts();
    let changed = false;
    accounts.forEach(e => {
      if (map[e.account]) { e.account = map[e.account]; changed = true; }
      // 旧版「互转」记录以 expense/income 存储，迁移为 transfer 类型（互转不计入收入/支出）
      if (!e.type || e.type === 'expense' || e.type === 'income') {
        const note = e.note || '';
        if (note.includes('转出至')) { e.type = 'transfer'; e.transferDir = 'out'; e.category = '转账'; changed = true; }
        else if (note.includes('转入自')) { e.type = 'transfer'; e.transferDir = 'in'; e.category = '转账'; changed = true; }
      }
    });
    // 为迁移出的 transfer 配对补上 transferGroup，使删除一笔自动删除配对笔
    const transfers = accounts.filter(e => e.type === 'transfer' && !e.transferGroup);
    const paired = new Set();
    transfers.forEach(e => {
      if (paired.has(e.id)) return;
      const partner = transfers.find(x =>
        x.id !== e.id && !paired.has(x.id) && x.amount === e.amount && x.date === e.date &&
        ((e.transferDir === 'out' && x.transferDir === 'in' && e.note.includes('转出至' + x.account) && x.note.includes('转入自' + e.account)) ||
         (e.transferDir === 'in' && x.transferDir === 'out' && e.note.includes('转入自' + x.account) && x.note.includes('转出至' + e.account)))
      );
      if (partner) {
        const gid = uid();
        e.transferGroup = gid; partner.transferGroup = gid; paired.add(e.id); paired.add(partner.id);
        changed = true;
      }
    });
    if (changed) Store.saveAccounts(accounts);
  },
  navigate(view, tab) {
    ChartMgr.destroyAll();
    $$('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === view));
    $$('.view').forEach(v => v.classList.remove('active'));
    const map = { home: HomeView, account: AccountView, health: HealthView, notebook: NotebookView, bead: BeadView };
    if (map[view]) {
      if (view === 'health' && tab) HealthView.activeTab = tab;
      map[view].render();
      $(`#view-${view}`).classList.add('active');
    }
    // 首页舞台背景显隐
    const stageBg = $('#stageHeroBg');
    if (stageBg) stageBg.classList.toggle('show', view === 'home');
    $('.content').scrollTop = 0;
  },
  seed() {
    if (Store.get(KEYS.seeded, false)) return;
    const t = todayStr();
    const d = (n) => fmtDate(new Date(Date.now() - n * 86400000));

    Store.saveWeights([
      { id: uid(), date: d(60), weight: 69.2 },
      { id: uid(), date: d(30), weight: 68.5 },
      { id: uid(), date: d(14), weight: 68.0 },
      { id: uid(), date: d(7), weight: 67.5 },
      { id: uid(), date: t, weight: 67.2 },
    ]);

    // 经期种子数据
    Store.savePeriods([
      { id: uid(), startDate: d(56), endDate: d(52), note: '正常' },
      { id: uid(), startDate: d(28), endDate: d(24), note: '正常' },
      { id: uid(), startDate: t, endDate: null, note: '进行中' },
    ]);

    const expenses = [];
    const mk = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    const pmk = `${new Date().getFullYear()}-${String(new Date().getMonth()).padStart(2,'0')}`;
    const pmk2 = `${new Date().getFullYear()}-${String(new Date().getMonth()-1).padStart(2,'0')}`;
    expenses.push(
      { id: uid(), date: t, type: 'expense', amount: 32.5, category: '餐饮', account: '微信1', note: '午餐' },
      { id: uid(), date: t, type: 'expense', amount: 15, category: '交通', account: '支付宝', note: '地铁' },
      { id: uid(), date: t, type: 'income', amount: 50, category: '兼职', account: '微信2', note: '稿费' },
      { id: uid(), date: d(1), type: 'expense', amount: 128, category: '购物', account: '支付宝', note: '日用品' },
      { id: uid(), date: d(1), type: 'expense', amount: 45, category: '餐饮', account: '微信1', note: '晚餐' },
      { id: uid(), date: d(2), type: 'expense', amount: 60, category: '娱乐', account: '浦发1', note: '电影票' },
      { id: uid(), date: d(3), type: 'expense', amount: 200, category: '居住', account: '浦发2', note: '水电费' },
      { id: uid(), date: d(5), type: 'income', amount: 8000, category: '工资', account: '中国银行', note: '月薪' },
      { id: uid(), date: d(5), type: 'expense', amount: 350, category: '购物', account: '中国工商', note: '衣服' },
      { id: uid(), date: d(8), type: 'expense', amount: 88, category: '餐饮', account: '支付宝', note: '聚餐' },
      { id: uid(), date: d(10), type: 'expense', amount: 120, category: '医疗', account: '微信1', note: '体检' },
      { id: uid(), date: d(12), type: 'expense', amount: 500, category: '购物', account: '中国农业', note: '超市采购' },
      { id: uid(), date: d(6), type: 'income', amount: 200, category: '兼职', account: '浙江农信', note: '外快' },
    );
    for (const k of [pmk, pmk2]) {
      expenses.push(
        { id: uid(), date: `${k}-05`, type: 'income', amount: 8000, category: '工资', account: '中国银行', note: '月薪' },
        { id: uid(), date: `${k}-05`, type: 'expense', amount: 1800, category: '居住', account: '浦发1', note: '房租' },
        { id: uid(), date: `${k}-10`, type: 'expense', amount: 320, category: '购物', account: '支付宝', note: '日用品' },
        { id: uid(), date: `${k}-15`, type: 'expense', amount: 280, category: '餐饮', account: '微信1', note: '日常' },
        { id: uid(), date: `${k}-20`, type: 'expense', amount: 150, category: '交通', account: '微信2', note: '打车' },
        { id: uid(), date: `${k}-25`, type: 'expense', amount: 600, category: '居住', account: '农村信用社', note: '物业费' },
      );
    }
    const ly = new Date().getFullYear() - 1;
    expenses.push(
      { id: uid(), date: `${ly}-06-05`, type: 'income', amount: 7500, category: '工资', account: '中国银行', note: '月薪' },
      { id: uid(), date: `${ly}-06-05`, type: 'expense', amount: 1600, category: '居住', account: '浦发1', note: '房租' },
      { id: uid(), date: `${ly}-06-10`, type: 'expense', amount: 400, category: '购物', account: '支付宝', note: '日用品' },
      { id: uid(), date: `${ly}-06-15`, type: 'expense', amount: 250, category: '餐饮', account: '微信1', note: '日常' },
    );
    Store.saveAccounts(expenses);

    Store.set(KEYS.seeded, true);
  },
  seedBeads() {
    // 以 1.csv（色号,存量）文件数值作为 221 色默认库存；seed 版本升级时覆盖应用
    const SEED_VER = 2;
    const curVer = Store.get(KEYS.beadSeedVer, 0);
    if (curVer >= SEED_VER) return;
    const existing = Store.getBeadStock() || {};
    const stock = {};
    getAllBeads().forEach(c => {
      if (BEAD_FILE_STOCK[c.num] !== undefined) {
        // 文件中有该色号：套用文件数值，保留已有备注
        stock[c.num] = { stock: BEAD_FILE_STOCK[c.num], note: (existing[c.num] && existing[c.num].note) || '' };
      } else if (existing[c.num]) {
        // 自定义色号：保留用户已有数据
        stock[c.num] = existing[c.num];
      } else {
        stock[c.num] = { stock: 0, note: '' };
      }
    });
    Store.saveBeadStock(stock);
    Store.set(KEYS.beadSeeded, true);
    Store.set(KEYS.beadSeedVer, SEED_VER);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());

// 启动动画已移除：打开直接显示首页背景图
(function () {
  const el = document.getElementById('appLaunch');
  if (el) el.remove();
})();

