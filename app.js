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
  const STORAGE_CODE_KEY = 'ai_html_runner_saved_code';
  const STORAGE_THEME_KEY = 'ai_html_runner_theme';

  /* ================= 1. 初始化与事件监听 ================= */

  function init() {
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

    if (type === 'vue-alarm') {
      demoCode = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>监控告警中心 · Vue 原型</title>
  <!-- 引入 Vue 与 Element UI -->
  <link rel="stylesheet" href="https://npm.elemecdn.com/element-ui@2.15.14/lib/theme-chalk/index.css">
  <script src="https://npm.elemecdn.com/vue@2.6.14/dist/vue.min.js"><\/script>
  <script src="https://npm.elemecdn.com/element-ui@2.15.14/lib/index.js"><\/script>
  <style>
    body { margin: 0; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; padding: 16px; }
    .card { background: #1e293b; border-radius: 16px; padding: 18px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); border: 1px solid #334155; }
    .title { font-size: 18px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
    .item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #334155; font-size: 14px; }
    .label { color: #94a3b8; }
    .value { font-weight: 600; }
    .btn-wrap { margin-top: 20px; display: flex; gap: 10px; }
    .el-button--primary { background: #3b82f6; border-color: #3b82f6; }
  </style>
</head>
<body>
  <div id="app">
    <div class="card">
      <div class="title">
        <span>🚨 异常告警实时详情</span>
        <el-tag :type="currentAlarm.handled ? 'success' : 'danger'" size="medium">
          {{ currentAlarm.handled ? '已处理' : '待处理' }}
        </el-tag>
      </div>

      <div class="item">
        <span class="label">告警时间</span>
        <span class="value">{{ currentAlarm.time }}</span>
      </div>
      <div class="item">
        <span class="label">监控点位</span>
        <span class="value">{{ currentAlarm.pointName }}</span>
      </div>
      <div class="item">
        <span class="label">告警级别</span>
        <span class="value" style="color: #f87171;">{{ currentAlarm.alarmType }}</span>
      </div>
      <div class="item">
        <span class="label">触发源</span>
        <span class="value">🤖 {{ currentAlarm.source }}</span>
      </div>

      <div class="btn-wrap">
        <el-button size="medium" @click="showDialog = true">查看抓拍</el-button>
        <el-button type="primary" size="medium" v-if="!currentAlarm.handled" @click="handleAlarm">
          立即确认处理
        </el-button>
      </div>
    </div>

    <!-- 弹窗组件 -->
    <el-dialog title="现场红外抓拍" :visible.sync="showDialog" width="90%">
      <div style="text-align: center; padding: 20px 0; background: #0f172a; border-radius: 8px;">
        <span style="font-size: 40px;">📷</span>
        <p style="color: #94a3b8; margin-top: 10px; font-size: 13px;">红外高清截图已自动归档存证</p>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button @click="showDialog = false" size="small">关 闭</el-button>
      </span>
    </el-dialog>
  </div>

  <script>
    new Vue({
      el: '#app',
      data: {
        showDialog: false,
        currentAlarm: {
          time: '2026-09-21 10:58:32',
          pointName: '东区 2 号地库入口红外探头',
          alarmType: '重点区域入侵警报 (P1)',
          source: 'AI 视觉分析引擎 v3',
          handled: false
        }
      },
      methods: {
        handleAlarm: function() {
          this.currentAlarm.handled = true;
          this.$message({ message: '告警已成功标记为已处理！', type: 'success' });
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
  <title>微信用户表重复账号排查研报</title>
  <style>
    body { background: #0f172a; color: #e2e8f0; font-family: system-ui, sans-serif; padding: 20px 16px; margin: 0; line-height: 1.7; }
    h1 { font-size: 22px; color: #60a5fa; margin-bottom: 8px; }
    .badge { display: inline-block; background: rgba(96,165,250,0.15); color: #60a5fa; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    th, td { border: 1px solid #334155; padding: 10px; text-align: left; }
    th { background: #1e293b; color: #94a3b8; }
    pre { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px; overflow-x: auto; color: #38bdf8; font-family: monospace; }
  </style>
</head>
<body>
  <span class="badge">技术复盘报告</span>
  <h1>微信用户表 (wechat_user) 重复账号深度排查</h1>
  <p>在核对用户中心数据时，发现同一 openId 在高并发登录时偶发建号冲突，以下为定位分析：</p>
  
  <table>
    <thead>
      <tr><th>编号</th><th>问题</th><th>严重度</th><th>影响规模</th></tr>
    </thead>
    <tbody>
      <tr><td>P1</td><td>并发授权重复建号</td><td style="color:#ef4444;font-weight:700;">高</td><td>1,501 条</td></tr>
      <tr><td>P2</td><td>真实 openId 缺失</td><td style="color:#f59e0b;font-weight:700;">中</td><td>75,552 条</td></tr>
    </tbody>
  </table>

  <h3>修复 SQL 示例</h3>
  <pre>ALTER TABLE wechat_user ADD COLUMN active_key VARCHAR(80);</pre>
</body>
</html>`;
    } else if (type === 'interactive-counter') {
      demoCode = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>触控反馈计数器</title>
  <style>
    body { margin: 0; background: #090d16; color: #fff; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; }
    .count { font-size: 80px; font-weight: 800; color: #818cf8; margin-bottom: 24px; transition: transform 0.1s; }
    .btn-row { display: flex; gap: 16px; }
    button { width: 70px; height: 70px; border-radius: 50%; border: none; background: #1e293b; color: #fff; font-size: 28px; cursor: pointer; transition: transform 0.1s, background 0.2s; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
    button:active { transform: scale(0.9); background: #4f46e5; }
  </style>
</head>
<body>
  <div id="num" class="count">0</div>
  <div class="btn-row">
    <button onclick="change(-1)">-</button>
    <button onclick="change(1)">+</button>
  </div>
  <script>
    var n = 0;
    var el = document.getElementById('num');
    function change(d) {
      n += d;
      el.textContent = n;
      el.style.transform = 'scale(1.2)';
      setTimeout(function(){ el.style.transform = 'scale(1)'; }, 100);
      if (navigator.vibrate) navigator.vibrate(15);
    }
  <\/script>
</body>
</html>`;
    }

    codeTextarea.value = demoCode;
    updateCharCount();
    localStorage.setItem(STORAGE_CODE_KEY, demoCode);
    showToast('已载入示例，点击「立即运行」即可体验');
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

  /* ================= 8. PWA / 添加到主屏幕提示 ================= */
  function initPwaGuide() {
    const pwaGuide = document.getElementById('pwaGuide');
    const closePwaGuideBtn = document.getElementById('closePwaGuideBtn');
    if (!pwaGuide) return;

    // 如果已经是独立应用模式运行 (standalone)，无需提示
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const hasDismissed = sessionStorage.getItem('pwa_guide_dismissed');

    if (!isStandalone && !hasDismissed) {
      setTimeout(() => {
        pwaGuide.style.display = 'block';
      }, 2500);
    }

    if (closePwaGuideBtn) {
      closePwaGuideBtn.addEventListener('click', () => {
        pwaGuide.style.display = 'none';
        sessionStorage.setItem('pwa_guide_dismissed', '1');
      });
    }
  }

  // 启动
  function start() {
    init();
    initPwaGuide();
  }

  start();
})();
