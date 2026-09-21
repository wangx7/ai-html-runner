/**
 * AI HTML Runner — 移动端网页沙箱运行核心逻辑
 */

(function () {
  'use strict';

  // DOM 节点引用
  const editorView = document.getElementById('editorView');
  const previewView = document.getElementById('previewView');
  const previewIframe = document.getElementById('previewIframe');
  const codeTextarea = document.getElementById('codeTextarea');
  const charCount = document.getElementById('charCount');

  const pasteRunBtn = document.getElementById('pasteRunBtn');
  const loadFileBtn = document.getElementById('loadFileBtn');
  const fileInput = document.getElementById('fileInput');
  const demoBtn = document.getElementById('demoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const formatBtn = document.getElementById('formatBtn');
  const runBtn = document.getElementById('runBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // 配置开关
  const optViewport = document.getElementById('optViewport');
  const optCdnMirror = document.getElementById('optCdnMirror');

  // 悬浮胶囊控制器 (FAB)
  const fabBackBtn = document.getElementById('fabBackBtn');
  const fabRefreshBtn = document.getElementById('fabRefreshBtn');
  const fabConsoleBtn = document.getElementById('fabConsoleBtn');
  const consoleBadge = document.getElementById('consoleBadge');

  // 控制台抽屉
  const consoleDrawer = document.getElementById('consoleDrawer');
  const consoleLogs = document.getElementById('consoleLogs');
  const drawerLogCount = document.getElementById('drawerLogCount');
  const clearLogsBtn = document.getElementById('clearLogsBtn');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');

  // 弹窗与提示
  const toastEl = document.getElementById('toast');
  const demoModal = document.getElementById('demoModal');
  const closeModalBtn = document.getElementById('closeModalBtn');

  // 状态
  let currentBlobUrl = null;
  let logEntries = [];
  let toastTimer = null;

  // 本地存储 Key
  const STORAGE_CODE_KEY = 'ai_html_runner_saved_code_v2';
  const STORAGE_THEME_KEY = 'ai_html_runner_theme';

  /* ================= 1. 初始化与事件监听 ================= */

  function init() {
    // 清理旧版本本地草稿缓存
    if (localStorage.getItem('ai_html_runner_saved_code')) {
      localStorage.removeItem('ai_html_runner_saved_code');
    }

    // 恢复历史主题
    const savedTheme = localStorage.getItem(STORAGE_THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggleBtn.querySelector('.theme-icon').textContent = savedTheme === 'dark' ? '🌙' : '☀️';

    // 恢复保存的代码
    const savedCode = localStorage.getItem(STORAGE_CODE_KEY);
    if (savedCode) {
      codeTextarea.value = savedCode;
      updateCharCount();
    }

    bindEvents();
  }

  function bindEvents() {
    // 主题切换
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(STORAGE_THEME_KEY, next);
      themeToggleBtn.querySelector('.theme-icon').textContent = next === 'dark' ? '🌙' : '☀️';
    });

    // 字符数统计与本地草稿自动保存
    codeTextarea.addEventListener('input', () => {
      updateCharCount();
      localStorage.setItem(STORAGE_CODE_KEY, codeTextarea.value);
    });

    // 粘贴并运行
    pasteRunBtn.addEventListener('click', handlePasteAndRun);

    // 文件读取
    loadFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    // 示例弹窗
    demoBtn.addEventListener('click', () => demoModal.classList.add('open'));
    closeModalBtn.addEventListener('click', () => demoModal.classList.remove('open'));
    demoModal.addEventListener('click', (e) => {
      if (e.target === demoModal) demoModal.classList.remove('open');
    });

    document.querySelectorAll('.demo-card').forEach(card => {
      card.addEventListener('click', () => {
        const demoType = card.dataset.demo;
        loadDemo(demoType);
        demoModal.classList.remove('open');
      });
    });

    // 清空
    clearBtn.addEventListener('click', () => {
      if (!codeTextarea.value) return;
      if (confirm('确定清空编辑器内容吗？')) {
        codeTextarea.value = '';
        updateCharCount();
        localStorage.removeItem(STORAGE_CODE_KEY);
        showToast('已清空');
      }
    });

    // 整理代码格式（简单缩进调整）
    formatBtn.addEventListener('click', () => {
      const val = codeTextarea.value.trim();
      if (!val) return;
      codeTextarea.value = val;
      updateCharCount();
      showToast('已整理排版');
    });

    // 立即运行
    runBtn.addEventListener('click', () => runCode(codeTextarea.value));

    // 悬浮胶囊：返回编辑
    fabBackBtn.addEventListener('click', showEditor);

    // 悬浮胶囊：刷新沙箱
    fabRefreshBtn.addEventListener('click', () => {
      runCode(codeTextarea.value, false);
      showToast('已重新运行');
    });

    // 悬浮胶囊：控制台日志抽屉
    fabConsoleBtn.addEventListener('click', () => {
      consoleDrawer.classList.toggle('open');
    });

    closeDrawerBtn.addEventListener('click', () => consoleDrawer.classList.remove('open'));
    clearLogsBtn.addEventListener('click', clearLogs);

    // 监听子 iframe postMessage 日志与错误
    window.addEventListener('message', (event) => {
      if (event.data && event.data.__runner_log__) {
        appendLog(event.data.type, event.data.message);
      }
    });
  }

  function updateCharCount() {
    const len = (codeTextarea.value || '').length;
    charCount.textContent = `${len.toLocaleString()} 字符`;
  }

  /* ================= 2. 剪贴板一键读取与运行 ================= */

  async function handlePasteAndRun() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          codeTextarea.value = text;
          updateCharCount();
          localStorage.setItem(STORAGE_CODE_KEY, text);
          showToast('已读取剪贴板，立即运行！');
          runCode(text);
          return;
        }
      }
    } catch (err) {
      console.warn('Clipboard read failed:', err);
    }

    // 若系统权限受限无法直接读剪贴板，平滑引导聚焦输入
    codeTextarea.focus();
    showToast('请长按输入框选择「粘贴」后运行');
  }

  function handleFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      codeTextarea.value = content;
      updateCharCount();
      localStorage.setItem(STORAGE_CODE_KEY, content);
      showToast(`已加载 ${file.name}`);
      runCode(content);
    };
    reader.readAsText(file);
    fileInput.value = '';
  }

  /* ================= 3. AI 特调“真机手术”预处理器 ================= */

  /**
   * 预处理 HTML，打入真机适配补丁
   */
  function preprocessHtml(rawHtml) {
    let html = rawHtml || '';

    // 1. 自动补齐 Viewport 标签 (防 980px 微缩字体)
    if (optViewport.checked && !/<meta\s+name=["']viewport["']/i.test(html)) {
      const viewportTag = '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">\n';
      if (/<head\b[^>]*>/i.test(html)) {
        html = html.replace(/<head\b[^>]*>/i, `$& \n  ${viewportTag}`);
      } else if (/<html\b[^>]*>/i.test(html)) {
        html = html.replace(/<html\b[^>]*>/i, `$& \n<head>${viewportTag}</head>`);
      } else {
        html = `<head>${viewportTag}</head>\n${html}`;
      }
    }

    // 2. 国内 CDN 镜像智能替换 (解决 unpkg / cdnjs 国内白屏)
    if (optCdnMirror.checked) {
      // unpkg.com -> npm.elemecdn.com
      html = html.replace(/https?:\/\/unpkg\.com\//gi, 'https://npm.elemecdn.com/');
      // cdn.jsdelivr.net/npm/ 稳定镜像
      html = html.replace(/https?:\/\/cdn\.jsdelivr\.net\/npm\//gi, 'https://npm.elemecdn.com/');
    }

    // 3. 注入控制台错误拦截器 (把子 iframe 的报错传给外部宿主便于排查)
    const consoleInterceptorScript = `
<script id="__runner_console_bridge__">
(function(){
  function send(type, args) {
    try {
      var msg = Array.prototype.slice.call(args).map(function(item){
        if (item instanceof Error) return item.stack || item.message;
        if (typeof item === 'object') {
          try { return JSON.stringify(item); } catch(e){ return String(item); }
        }
        return String(item);
      }).join(' ');
      window.parent.postMessage({ __runner_log__: true, type: type, message: msg }, '*');
    } catch(e) {}
  }
  var origErr = console.error;
  console.error = function(){ send('error', arguments); origErr && origErr.apply(console, arguments); };
  var origWarn = console.warn;
  console.warn = function(){ send('warn', arguments); origWarn && origWarn.apply(console, arguments); };
  window.addEventListener('error', function(e){
    send('error', [e.message + ' (' + (e.filename || 'inline') + ':' + e.lineno + ')']);
  });
})();
<\/script>
`;
    if (/<head\b[^>]*>/i.test(html)) {
      html = html.replace(/<head\b[^>]*>/i, `$& \n${consoleInterceptorScript}`);
    } else {
      html = `${consoleInterceptorScript}\n${html}`;
    }

    return html;
  }

  /* ================= 4. 沙箱运行器 (Blob URL) ================= */

  function runCode(sourceCode, switchView = true) {
    const raw = (sourceCode || '').trim();
    if (!raw) {
      showToast('请输入或粘贴 HTML 代码');
      return;
    }

    // 清理先前的日志与 URL
    clearLogs();
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }

    // 实施预处理手术
    const processedHtml = preprocessHtml(raw);

    try {
      const blob = new Blob([processedHtml], { type: 'text/html;charset=utf-8' });
      currentBlobUrl = URL.createObjectURL(blob);
      previewIframe.src = currentBlobUrl;

      if (switchView) {
        showPreview();
      }
    } catch (err) {
      console.error('Blob URL creation error:', err);
      // 降级使用 srcdoc
      previewIframe.srcdoc = processedHtml;
      if (switchView) {
        showPreview();
      }
    }
  }

  function showPreview() {
    editorView.classList.remove('active');
    previewView.classList.add('active');
  }

  function showEditor() {
    previewView.classList.remove('active');
    editorView.classList.add('active');
    consoleDrawer.classList.remove('open');
  }

  /* ================= 5. 控制台日志管理 ================= */

  function appendLog(type, message) {
    logEntries.push({ type, message });
    updateLogCount();

    const entryEl = document.createElement('div');
    entryEl.className = `log-entry log-${type}`;
    entryEl.textContent = `[${type.toUpperCase()}] ${message}`;

    const empty = consoleLogs.querySelector('.log-empty');
    if (empty) empty.remove();

    consoleLogs.appendChild(entryEl);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }

  function updateLogCount() {
    const errorCount = logEntries.filter(e => e.type === 'error').length;
    consoleBadge.textContent = errorCount;
    drawerLogCount.textContent = logEntries.length;

    if (errorCount > 0) {
      consoleBadge.classList.add('has-error');
    } else {
      consoleBadge.classList.remove('has-error');
    }
  }

  function clearLogs() {
    logEntries = [];
    consoleLogs.innerHTML = '<div class="log-empty">暂无报错或日志信息，运行顺畅 🎉</div>';
    updateLogCount();
  }

  /* ================= 6. 内置 Demo 库 ================= */

  function loadDemo(type) {
    let demoCode = '';

    if (type === 'vue-dashboard' || type === 'vue-alarm') {
      demoCode = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>AI 智算集群实时控制台</title>
  <!-- 引入 Vue 与 Element UI -->
  <link rel="stylesheet" href="https://npm.elemecdn.com/element-ui@2.15.14/lib/theme-chalk/index.css">
  <script src="https://npm.elemecdn.com/vue@2.6.14/dist/vue.min.js"><\/script>
  <script src="https://npm.elemecdn.com/element-ui@2.15.14/lib/index.js"><\/script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #0b0f19;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 16px;
      -webkit-font-smoothing: antialiased;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #1e293b;
    }
    .header-title {
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 8px #10b981;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .stat-card {
      background: #161f30;
      border: 1px solid #27354f;
      border-radius: 12px;
      padding: 12px;
      text-align: center;
    }
    .stat-val {
      font-size: 18px;
      font-weight: 800;
      color: #38bdf8;
      margin-top: 4px;
    }
    .stat-lbl {
      font-size: 11px;
      color: #94a3b8;
    }
    .card {
      background: #161f30;
      border: 1px solid #27354f;
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    }
    .card-title {
      font-size: 14px;
      font-weight: 600;
      color: #cbd5e1;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .task-item {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .task-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .task-name {
      font-size: 13px;
      font-weight: 600;
      color: #f8fafc;
    }
    .task-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #64748b;
    }
    .btn-wrap {
      display: flex;
      gap: 8px;
      margin-top: 14px;
    }
    .btn-wrap .el-button {
      flex: 1;
    }
    .el-dialog {
      background: #161f30 !important;
      border: 1px solid #334155 !important;
      border-radius: 14px !important;
    }
    .el-dialog__title {
      color: #f1f5f9 !important;
      font-size: 15px !important;
      font-weight: 700 !important;
    }
    .el-form-item__label {
      color: #94a3b8 !important;
    }
    .el-input__inner {
      background: #0f172a !important;
      border-color: #334155 !important;
      color: #f8fafc !important;
    }
    .el-progress-bar__outer {
      background-color: #1e293b !important;
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="header">
      <div class="header-title">
        <span class="status-dot"></span>
        AI 智算集群调度中心
      </div>
      <el-tag size="mini" type="success" effect="dark">集群健康</el-tag>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-lbl">算力利用率</div>
        <div class="stat-val">{{ computeLoad }}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">活跃任务数</div>
        <div class="stat-val">{{ tasks.length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">GPU 显存占用</div>
        <div class="stat-val">58.4G</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>🚀 实时推理与训练队列</span>
        <span style="font-size: 12px; color: #64748b;">已接入 3 个节点</span>
      </div>

      <div class="task-item" v-for="t in tasks" :key="t.id">
        <div class="task-top">
          <span class="task-name">{{ t.name }}</span>
          <el-tag size="mini" :type="t.statusType">{{ t.statusText }}</el-tag>
        </div>
        <el-progress :percentage="t.progress" :color="t.progressColor" :stroke-width="6" :show-text="false"></el-progress>
        <div class="task-meta">
          <span>节点: {{ t.node }}</span>
          <span>进度: {{ t.progress }}%</span>
        </div>
      </div>

      <div class="btn-wrap">
        <el-button size="medium" icon="el-icon-plus" type="primary" @click="dialogVisible = true">分发新任务</el-button>
        <el-button size="medium" icon="el-icon-refresh" @click="optimizeCluster">动态调度</el-button>
      </div>
    </div>

    <el-dialog title="分发新推理任务" :visible.sync="dialogVisible" width="90%">
      <el-form label-position="top" size="small">
        <el-form-item label="任务名称">
          <el-input v-model="newTaskName" placeholder="例如：Qwen-2.5 代码评测流水线"></el-input>
        </el-form-item>
        <el-form-item label="基础模型">
          <el-select v-model="newTaskModel" style="width: 100%;">
            <el-option label="DeepSeek-R1-671B-Q4" value="DeepSeek-R1-671B-Q4"></el-option>
            <el-option label="Qwen-2.5-Coder-32B" value="Qwen-2.5-Coder-32B"></el-option>
            <el-option label="Llama-3.3-70B-Instruct" value="Llama-3.3-70B-Instruct"></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button size="small" @click="dialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="handleAddTask">立即派发</el-button>
      </span>
    </el-dialog>
  </div>

  <script>
    new Vue({
      el: '#app',
      data: {
        dialogVisible: false,
        computeLoad: 76,
        newTaskName: '',
        newTaskModel: 'DeepSeek-R1-671B-Q4',
        tasks: [
          { id: 1, name: 'DeepSeek-R1 批量复杂推理', node: 'GPU-Cluster-01', statusText: '运行中', statusType: 'success', progress: 82, progressColor: '#10b981' },
          { id: 2, name: 'Qwen-Coder 代码辅助生成', node: 'GPU-Cluster-02', statusText: '推理中', statusType: 'primary', progress: 48, progressColor: '#38bdf8' },
          { id: 3, name: '多模态视觉 Embedding 批处理', node: 'GPU-Cluster-03', statusText: '排队中', statusType: 'info', progress: 12, progressColor: '#f59e0b' }
        ]
      },
      methods: {
        optimizeCluster: function() {
          this.computeLoad = Math.floor(65 + Math.random() * 20);
          this.$message({
            message: '集群拓扑调度完成，算力利用率平衡至 ' + this.computeLoad + '%',
            type: 'success'
          });
        },
        handleAddTask: function() {
          if (!this.newTaskName) {
            this.$message.warning('请输入任务名称');
            return;
          }
          this.tasks.unshift({
            id: Date.now(),
            name: this.newTaskName + ' (' + this.newTaskModel.split('-')[0] + ')',
            node: 'GPU-Auto-Dynamic',
            statusText: '初始化',
            statusType: 'warning',
            progress: 5,
            progressColor: '#6366f1'
          });
          this.newTaskName = '';
          this.dialogVisible = false;
          this.$message.success('新任务已成功下发至 GPU 算力池');
        }
      }
    });
  <\/script>
</body>
</html>`;
    } else if (type === 'tech-report') {
      demoCode = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>混合专家架构 (MoE) 推理吞吐与显存优化研报</title>
  <style>
    * { box-sizing: border-box; }
    body {
      background: #0a0e17;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 20px 16px;
      margin: 0;
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }
    .badge {
      display: inline-block;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.35);
      color: #818cf8;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 20px;
      color: #f8fafc;
      margin: 6px 0 10px;
      line-height: 1.35;
    }
    .meta-row {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .summary-box {
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9));
      border-left: 3px solid #6366f1;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 20px;
      font-size: 13px;
      color: #cbd5e1;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #38bdf8;
      margin: 20px 0 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .table-wrap {
      overflow-x: auto;
      margin: 12px 0 20px;
      border-radius: 10px;
      border: 1px solid #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: left;
    }
    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid #1e293b;
      white-space: nowrap;
    }
    th {
      background: #111827;
      color: #94a3b8;
      font-weight: 600;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .highlight-cell {
      color: #10b981;
      font-weight: 700;
    }
    .diff-block {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      line-height: 1.6;
      overflow-x: auto;
    }
    .diff-del { color: #f87171; background: rgba(239, 68, 68, 0.1); display: block; border-radius: 2px; }
    .diff-add { color: #4ade80; background: rgba(34, 197, 94, 0.1); display: block; border-radius: 2px; }
    .diff-normal { color: #94a3b8; display: block; }
    .insight-card {
      background: #131d2e;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 12px;
      margin-top: 10px;
      font-size: 13px;
    }
    .insight-header {
      font-weight: 600;
      color: #f1f5f9;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <span class="badge">技术研报 · 架构性能评测</span>
  <h1>混合专家架构 (MoE) 高并发推理与显存优化研报</h1>
  <div class="meta-row">
    <span>基准集群: 8×H800 NVLink</span>
    <span>评测框架: vLLM + Triton</span>
    <span>日期: 2026-09</span>
  </div>

  <div class="summary-box">
    <strong>执行摘要：</strong>针对百亿至千亿级 MoE 架构模型在并发推理场景下的吞吐瓶颈，实测表明：采用动态 Top-2 路由辅助均衡结合 FP8 KV Cache 量化，吞吐可提升 <strong>1.82 倍</strong>，显存峰值降低 <strong>40.6%</strong>。
  </div>

  <div class="section-title">📊 吞吐与延迟基准对比</div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>模型架构</th>
          <th>激活参数</th>
          <th>首 Token 延迟</th>
          <th>峰值吞吐</th>
          <th>显存开销</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>MoE-8x7B (FP8 优化)</strong></td>
          <td>12.8B</td>
          <td class="highlight-cell">38 ms</td>
          <td class="highlight-cell">3,940 tok/s</td>
          <td class="highlight-cell">28.4 GB</td>
        </tr>
        <tr>
          <td>MoE-8x7B (FP16 基线)</td>
          <td>12.8B</td>
          <td>72 ms</td>
          <td>2,160 tok/s</td>
          <td>47.8 GB</td>
        </tr>
        <tr>
          <td>Dense-70B (稠密对比)</td>
          <td>70.0B</td>
          <td>116 ms</td>
          <td>1,240 tok/s</td>
          <td>72.5 GB</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">⚡ 专家路由门控配置 Diff</div>
  <div class="diff-block">
    <span class="diff-del">- routing_policy = StaticTopK(k=1, capacity_factor=1.0)</span>
    <span class="diff-add">+ routing_policy = DynamicMoERouter(k=2, aux_loss_weight=0.01)</span>
    <span class="diff-del">- kv_cache_dtype = torch.float16</span>
    <span class="diff-add">+ kv_cache_dtype = torch.float8_e4m3fn  # 显存减少 40.6%</span>
    <span class="diff-normal">  enable_chunked_prefill = True</span>
  </div>

  <div class="section-title">💡 关键优化建议</div>
  <div class="insight-card">
    <div class="insight-header">1. 门控偏置惩罚 (Sinkhorn Routing)</div>
    <div style="color: #94a3b8; font-size: 12px;">在高并发负载下，避免特定“通识专家”过载导致流水线气泡，有效均衡 GPU 算力利用率。</div>
  </div>
  <div class="insight-card">
    <div class="insight-header">2. 预填充与解码解耦调度 (Chunked Prefill)</div>
    <div style="color: #94a3b8; font-size: 12px;">长 prompt 输入时避免阻塞正在并发生成的微批次，降低 P99 抖动 65%。</div>
  </div>
</body>
</html>`;
    } else if (type === 'canvas-particles' || type === 'interactive-counter') {
      demoCode = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>星空粒子引力触控场</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; touch-action: none; }
    body {
      background: #030712;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      user-select: none;
      -webkit-user-select: none;
    }
    canvas {
      display: block;
      width: 100vw;
      height: 100vh;
    }
    .hud {
      position: fixed;
      top: 16px;
      left: 16px;
      right: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      pointer-events: none;
    }
    .hud-chip {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(12px);
      padding: 6px 12px;
      border-radius: 9999px;
      color: #94a3b8;
      font-size: 12px;
      font-family: monospace;
    }
    .hud-title {
      font-size: 13px;
      font-weight: 700;
      color: #38bdf8;
    }
    .controls {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(16px);
      padding: 8px 14px;
      border-radius: 9999px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }
    .btn {
      background: transparent;
      border: none;
      color: #cbd5e1;
      padding: 8px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn.active {
      background: linear-gradient(135deg, #6366f1, #3b82f6);
      color: #fff;
      box-shadow: 0 2px 12px rgba(99, 102, 241, 0.5);
    }
    .btn:active {
      transform: scale(0.92);
    }
  </style>
</head>
<body>
  <div class="hud">
    <div class="hud-chip hud-title">✨ 粒子引力触控场</div>
    <div class="hud-chip" id="stats">FPS: 60 · 粒子: 120</div>
  </div>

  <canvas id="canvas"></canvas>

  <div class="controls">
    <button class="btn active" id="attractBtn">🌌 引力吸引</button>
    <button class="btn" id="repelBtn">💥 能量排斥</button>
    <button class="btn" id="burstBtn">🎆 烟花喷涌</button>
  </div>

  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const statsEl = document.getElementById('stats');
    const attractBtn = document.getElementById('attractBtn');
    const repelBtn = document.getElementById('repelBtn');
    const burstBtn = document.getElementById('burstBtn');

    let width, height;
    let mode = 'attract';
    let pointer = { x: null, y: null, active: false };
    const particles = [];
    const PARTICLE_COUNT = 90;
    const CONNECT_DIST = 90;

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    class Particle {
      constructor(x, y) {
        this.x = x || Math.random() * width;
        this.y = y || Math.random() * height;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.radius = Math.random() * 2 + 1.5;
        this.hue = Math.random() * 60 + 190;
      }

      update() {
        if (pointer.active && pointer.x !== null) {
          const dx = pointer.x - this.x;
          const dy = pointer.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180 && dist > 5) {
            const force = (180 - dist) / 180;
            const factor = mode === 'attract' ? 0.08 : -0.15;
            this.vx += (dx / dist) * force * factor * 5;
            this.vy += (dy / dist) * force * factor * 5;
          }
        }

        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.98;
        this.vy *= 0.98;

        if (this.x < 0) { this.x = width; }
        if (this.x > width) { this.x = 0; }
        if (this.y < 0) { this.y = height; }
        if (this.y > height) { this.y = 0; }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'hsl(' + this.hue + ', 90%, 65%)';
        ctx.fill();
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle());
    }

    function burst(cx, cy) {
      for (let i = 0; i < 25; i++) {
        const p = new Particle(cx, cy);
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 7 + 2;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.hue = Math.random() * 360;
        particles.push(p);
      }
      if (particles.length > 200) {
        particles.splice(0, particles.length - 150);
      }
      if (navigator.vibrate) navigator.vibrate(25);
    }

    function handlePointerMove(e) {
      const touch = e.touches ? e.touches[0] : e;
      pointer.x = touch.clientX;
      pointer.y = touch.clientY;
      pointer.active = true;
    }

    function handlePointerEnd() {
      pointer.active = false;
      pointer.x = null;
      pointer.y = null;
    }

    window.addEventListener('touchstart', (e) => {
      handlePointerMove(e);
      burst(e.touches[0].clientX, e.touches[0].clientY);
    });
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerEnd);
    window.addEventListener('mousedown', (e) => {
      handlePointerMove(e);
      burst(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
      if (e.buttons > 0) handlePointerMove(e);
    });
    window.addEventListener('mouseup', handlePointerEnd);

    attractBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mode = 'attract';
      attractBtn.classList.add('active');
      repelBtn.classList.remove('active');
    });

    repelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mode = 'repel';
      repelBtn.classList.add('active');
      attractBtn.classList.remove('active');
    });

    burstBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      burst(width / 2, height / 2);
    });

    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 60;

    function loop(time) {
      frameCount++;
      if (time - lastTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastTime = time;
        statsEl.textContent = 'FPS: ' + fps + ' · 粒子: ' + particles.length;
      }

      ctx.fillStyle = 'rgba(3, 7, 18, 0.25)';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = 'rgba(99, 102, 241, ' + (1 - dist / CONNECT_DIST) * 0.25 + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      particles.forEach(p => {
        p.update();
        p.draw();
      });

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  <\/script>
</body>
</html>`;
    }

    if (demoCode) {
      codeTextarea.value = demoCode;
      updateCharCount();
      localStorage.setItem(STORAGE_CODE_KEY, demoCode);
      showToast('已载入示例，点击「立即运行」即可体验');
    }
  }

  /* ================= 7. 轻提示 Toast ================= */

  function showToast(text, duration = 2000) {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = text;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, duration);
  }

  // 启动
  function start() {
    init();
  }

  start();
})();
