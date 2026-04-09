/* ─────────────────────────── app.js ───────────────────────────
   KBGen AI — Frontend Logic
   Handles all UI interactions, API calls, and page navigation
──────────────────────────────────────────────────────────────── */

const API = 'http://localhost:5000/api';

// ══════════════════════════════════════════
// PAGE NAVIGATION
// ══════════════════════════════════════════

const pages = {
  generator: { title: 'Generate KB Article', subtitle: 'Paste a resolved support conversation to auto-generate an article' },
  library:   { title: 'Article Library',     subtitle: 'Browse and manage all generated knowledge base articles' },
  search:    { title: 'Search Articles',     subtitle: 'Find articles by keyword, category, or tag' },
  patterns:  { title: 'Pattern Insights',    subtitle: 'Discover trends and clusters across your knowledge base' },
  dashboard: { title: 'Dashboard',           subtitle: 'Overview of your KB performance and coverage' },
};

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');

  const nav = document.querySelector(`[data-page="${name}"]`);
  if (nav) nav.classList.add('active');

  const meta = pages[name] || {};
  document.getElementById('pageTitle').textContent    = meta.title    || '';
  document.getElementById('pageSubtitle').textContent = meta.subtitle || '';

  // Lazy-load page data
  if (name === 'library')   loadLibrary('');
  if (name === 'patterns')  loadPatterns();
  if (name === 'dashboard') loadDashboard();
  if (name === 'search')    document.getElementById('searchInput').focus();
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  await loadDemoButtons();
  await refreshHeaderStats();

  document.getElementById('conversationInput').addEventListener('input', e => {
    document.getElementById('charCount').textContent = `${e.target.value.length} characters`;
  });
});

async function refreshHeaderStats() {
  try {
    const stats = await apiGet('/stats');
    document.getElementById('totalArticleCount').textContent = stats.total_articles || 0;
  } catch {}
}

// ══════════════════════════════════════════
// DEMO BUTTONS
// ══════════════════════════════════════════

async function loadDemoButtons() {
  try {
    const demos = await apiGet('/demo-conversations');
    const container = document.getElementById('demoButtonsContainer');
    container.innerHTML = '';
    demos.forEach((d, i) => {
      const btn = document.createElement('button');
      btn.className = 'demo-btn';
      btn.textContent = d.label;
      btn.onclick = () => loadDemo(d.text);
      container.appendChild(btn);
    });
  } catch (e) {
    console.warn('Demo load failed:', e);
  }
}

function loadDemo(text) {
  const ta = document.getElementById('conversationInput');
  ta.value = text;
  document.getElementById('charCount').textContent = `${text.length} characters`;
  ta.focus();
}

// ══════════════════════════════════════════
// GENERATOR
// ══════════════════════════════════════════

let processingTimer = null;

async function processConversation() {
  const text = document.getElementById('conversationInput').value.trim();
  if (!text) {
    showToast('Please paste a conversation first', 'warning');
    return;
  }

  const btn = document.getElementById('processBtn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-inline"></span> Processing...`;

  showSection('loadingState');
  animateProcessingSteps();

  try {
    const data = await apiPost('/process', { conversation: text });
    clearTimeout(processingTimer);

    if (data.article) {
      renderArticleResult(data.article);
      showSection('articleResult');
      await refreshHeaderStats();
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (err) {
    showSection('emptyState');
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> Generate Article`;
  }
}

function showSection(sectionId) {
  ['emptyState', 'loadingState', 'articleResult'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(sectionId).classList.remove('hidden');
}

function animateProcessingSteps() {
  const steps = ['step1', 'step2', 'step3', 'step4'];
  const delays = [0, 800, 1600, 2400];

  steps.forEach(id => {
    const el = document.getElementById(id);
    el.className = 'proc-step';
  });

  steps.forEach((id, i) => {
    setTimeout(() => {
      if (i > 0) {
        const prev = document.getElementById(steps[i - 1]);
        prev.className = 'proc-step done';
        prev.textContent = '✅ ' + prev.textContent.substring(3);
      }
      document.getElementById(id).className = 'proc-step active';
    }, delays[i]);
  });
}

function renderArticleResult(article) {
  const isUpdated = article._action === 'updated';
  const sev = (article.severity || 'medium').toLowerCase();

  const el = document.getElementById('articleResult');
  el.innerHTML = `
    <div class="status-banner ${isUpdated ? 'updated' : 'created'}">
      ${isUpdated ? '🔄 Existing article updated — new conversation merged' : '✅ New KB article created and saved to library'}
    </div>

    <div class="result-header">
      <h2 class="result-title">${escHtml(article.title)}</h2>
    </div>

    <div class="badge-group" style="margin-bottom:16px">
      <span class="badge badge-category">${escHtml(article.category)}</span>
      ${article.subcategory ? `<span class="badge" style="background:rgba(56,189,248,0.1);color:#38bdf8;border:1px solid rgba(56,189,248,0.25)">${escHtml(article.subcategory)}</span>` : ''}
      <span class="badge badge-severity-${sev}">${sev.toUpperCase()} severity</span>
      <span class="badge" style="background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-muted)">${escHtml(article.estimated_read_time || '2 min read')}</span>
    </div>

    <div class="result-meta">
      <span>🆔 ${article.id}</span>
      <span>📅 ${formatDate(article.created_at)}</span>
    </div>

    <div class="result-section">
      <div class="result-section-label">🔍 Problem Statement</div>
      <div class="result-section-content">${escHtml(article.problem)}</div>
    </div>

    <div class="result-section">
      <div class="result-section-label">⚡ Root Cause</div>
      <div class="result-section-content">${escHtml(article.root_cause)}</div>
    </div>

    <div class="result-section">
      <div class="result-section-label">✅ Solution</div>
      <div class="solution-steps">${escHtml(article.solution)}</div>
    </div>

    ${article.helpful_tip ? `
    <div class="result-section">
      <div class="result-section-label">💡 Pro Tip</div>
      <div class="helpful-tip">${escHtml(article.helpful_tip)}</div>
    </div>` : ''}

    <div class="result-section">
      <div class="result-section-label">🏷️ Tags</div>
      <div class="tag-cloud">
        ${(article.tags || []).map(t => `<span class="tag" onclick="searchByTag('${t}')">${escHtml(t)}</span>`).join('')}
      </div>
    </div>

    <div class="result-actions">
      <button class="btn btn-ghost" onclick="showPage('library')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        View Library
      </button>
      <button class="btn btn-ghost" onclick="clearInput()">New Conversation</button>
      <span class="action-id">KB-${article.id}</span>
    </div>
  `;
}

function clearInput() {
  document.getElementById('conversationInput').value = '';
  document.getElementById('charCount').textContent = '0 characters';
  showSection('emptyState');
}

// ══════════════════════════════════════════
// LIBRARY
// ══════════════════════════════════════════

let currentFilter = '';

async function loadLibrary(category) {
  currentFilter = category;

  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  const tabs = document.querySelectorAll('.filter-tab');
  tabs.forEach(t => {
    if ((t.textContent === 'All' && !category) || t.textContent === category) {
      t.classList.add('active');
    }
  });

  try {
    const url = category ? `/articles?category=${encodeURIComponent(category)}` : '/articles';
    const articles = await apiGet(url);
    renderArticlesGrid(articles);
  } catch (e) {
    showToast('Failed to load articles', 'error');
  }
}

function filterLibrary(category) {
  loadLibrary(category);
}

function renderArticlesGrid(articles) {
  const grid = document.getElementById('articlesGrid');

  if (!articles.length) {
    grid.innerHTML = `
      <div class="empty-library">
        <div class="empty-icon">📚</div>
        <h3>No articles found</h3>
        <p>Try a different category or generate new articles</p>
        <button class="btn btn-primary" onclick="showPage('generator')">Generate Article</button>
      </div>`;
    return;
  }

  grid.innerHTML = articles.map(a => `
    <div class="article-card" onclick="openArticleModal('${a.id}')">
      <div class="card-header">
        <div class="card-title">${escHtml(a.title)}</div>
        <span class="badge badge-severity-${(a.severity||'medium').toLowerCase()}">${(a.severity||'medium').toUpperCase()}</span>
      </div>
      <div class="badge-group">
        <span class="badge badge-category">${escHtml(a.category)}</span>
        ${a.subcategory ? `<span class="badge" style="background:rgba(56,189,248,0.08);color:#38bdf8;border:1px solid rgba(56,189,248,0.2);font-size:0.7rem;padding:3px 8px">${escHtml(a.subcategory)}</span>` : ''}
      </div>
      <div class="card-problem">${escHtml(a.problem)}</div>
      <div class="tag-cloud">
        ${(a.tags||[]).slice(0,4).map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}
      </div>
      <div class="card-footer">
        <div class="card-meta">
          <span>👁 ${a.views || 0}</span>
          <span>❤ ${a.helpful_votes || 0}</span>
          <span>${a.estimated_read_time || '2 min'}</span>
        </div>
        <div class="card-actions" onclick="event.stopPropagation()">
          <button class="icon-btn" title="Delete" onclick="deleteArticle('${a.id}')">🗑</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function deleteArticle(id) {
  if (!confirm('Delete this article?')) return;
  try {
    await apiFetch(`/articles/${id}`, { method: 'DELETE' });
    showToast('Article deleted', 'success');
    loadLibrary(currentFilter);
    refreshHeaderStats();
  } catch (e) {
    showToast('Delete failed', 'error');
  }
}

// ══════════════════════════════════════════
// ARTICLE MODAL
// ══════════════════════════════════════════

async function openArticleModal(id) {
  try {
    const article = await apiGet(`/articles/${id}`);
    const sev = (article.severity || 'medium').toLowerCase();

    document.getElementById('modalContent').innerHTML = `
      <div class="modal-header">
        <div style="flex:1">
          <div class="badge-group" style="margin-bottom:10px">
            <span class="badge badge-category">${escHtml(article.category)}</span>
            <span class="badge badge-severity-${sev}">${sev.toUpperCase()}</span>
            <span class="badge" style="background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-muted);font-size:0.7rem">${escHtml(article.estimated_read_time||'')}</span>
          </div>
          <h2 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);line-height:1.4">${escHtml(article.title)}</h2>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;display:flex;gap:16px">
            <span>🆔 KB-${article.id}</span>
            <span>📅 ${formatDate(article.created_at)}</span>
            <span>👁 ${article.views || 0} views</span>
            <span>v${article.version || 1}</span>
          </div>
        </div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="result-section">
          <div class="result-section-label">🔍 Problem</div>
          <div class="result-section-content">${escHtml(article.problem)}</div>
        </div>
        <div class="result-section">
          <div class="result-section-label">⚡ Root Cause</div>
          <div class="result-section-content">${escHtml(article.root_cause)}</div>
        </div>
        <div class="result-section">
          <div class="result-section-label">✅ Solution</div>
          <div class="solution-steps">${escHtml(article.solution)}</div>
        </div>
        ${article.helpful_tip ? `
        <div class="result-section">
          <div class="result-section-label">💡 Pro Tip</div>
          <div class="helpful-tip">${escHtml(article.helpful_tip)}</div>
        </div>` : ''}
        <div class="result-section">
          <div class="result-section-label">🏷️ Tags</div>
          <div class="tag-cloud">
            ${(article.tags||[]).map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:24px;padding-top:16px;border-top:1px solid var(--border)">
          <button class="btn btn-primary" onclick="voteHelpful('${article.id}')">👍 Helpful</button>
          <button class="btn btn-ghost" onclick="closeModal()">Close</button>
        </div>
      </div>
    `;

    document.getElementById('articleModal').classList.remove('hidden');
  } catch (e) {
    showToast('Failed to load article', 'error');
  }
}

async function voteHelpful(id) {
  try {
    await apiFetch(`/articles/${id}/helpful`, { method: 'POST' });
    showToast('Thanks for your feedback! 👍', 'success');
  } catch {}
}

function closeModal(event) {
  if (!event || event.target.id === 'articleModal') {
    document.getElementById('articleModal').classList.add('hidden');
  }
}

// ══════════════════════════════════════════
// SEARCH
// ══════════════════════════════════════════

let searchTimer = null;

function handleSearch(q) {
  clearTimeout(searchTimer);
  if (!q.trim()) {
    document.getElementById('searchResults').innerHTML = '';
    return;
  }
  searchTimer = setTimeout(() => doSearch(q), 300);
}

async function doSearch(q) {
  try {
    const results = await apiGet(`/search?q=${encodeURIComponent(q)}`);
    renderSearchResults(results, q);
  } catch {}
}

function renderSearchResults(results, q) {
  const container = document.getElementById('searchResults');

  if (!results.length) {
    container.innerHTML = `<div class="search-empty">No articles found for "<strong>${escHtml(q)}</strong>"</div>`;
    return;
  }

  const catEmojis = {
    'Account & Billing': '💳',
    'Technical Issues':  '⚙️',
    'Shipping & Delivery': '📦',
    'Returns & Refunds': '🔄',
    'Security': '🔐',
    'Product Usage': '📱',
    'Other': '📄',
  };

  container.innerHTML = results.map(a => `
    <div class="search-result-item" onclick="openArticleModal('${a.id}')">
      <div class="result-icon">${catEmojis[a.category] || '📄'}</div>
      <div class="result-info">
        <h4>${escHtml(a.title)}</h4>
        <p>${escHtml(a.problem.substring(0, 120))}${a.problem.length > 120 ? '...' : ''}</p>
        <div class="badge-group" style="margin-top:8px">
          <span class="badge badge-category" style="font-size:0.68rem">${escHtml(a.category)}</span>
          ${(a.tags||[]).slice(0,3).map(t => `<span class="tag" style="font-size:0.7rem;padding:2px 8px">${escHtml(t)}</span>`).join('')}
        </div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);padding:4px 8px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:6px;white-space:nowrap;color:var(--accent-hover);font-weight:600">
        Score: ${a._score}
      </div>
    </div>
  `).join('');
}

function searchByTag(tag) {
  showPage('search');
  const input = document.getElementById('searchInput');
  input.value = tag;
  doSearch(tag);
}

// ══════════════════════════════════════════
// PATTERNS
// ══════════════════════════════════════════

async function loadPatterns() {
  try {
    const data = await apiGet('/patterns');

    // Trending tags
    const tagContainer = document.getElementById('trendingTags');
    if (!data.trending_tags || !data.trending_tags.length) {
      tagContainer.innerHTML = '<p class="muted">Generate more articles to see trends.</p>';
    } else {
      const max = data.trending_tags[0].count;
      tagContainer.innerHTML = data.trending_tags.map(t => `
        <div class="tag-trend-item">
          <span class="trend-tag">#${escHtml(t.tag)}</span>
          <div class="trend-bar-wrap">
            <div class="trend-bar" style="width:${Math.round(t.count/max*100)}%"></div>
          </div>
          <span class="trend-count">${t.count}</span>
        </div>
      `).join('');
    }

    // Clusters
    const clusterContainer = document.getElementById('articleClusters');
    if (!data.clusters || !data.clusters.length) {
      clusterContainer.innerHTML = '<p class="muted">Need at least 3 similar articles to detect clusters.</p>';
    } else {
      clusterContainer.innerHTML = data.clusters.map((cluster, i) => `
        <div class="cluster-item">
          <div class="cluster-title">Cluster ${i + 1} — ${cluster.length} related articles</div>
          <div class="cluster-ids">
            ${cluster.map(id => `<span class="cluster-id" onclick="openArticleModal('${id}')">KB-${id}</span>`).join('')}
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.warn('Pattern load failed:', e);
  }
}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════

const catColors = [
  'linear-gradient(90deg, #6366f1, #a78bfa)',
  'linear-gradient(90deg, #10b981, #34d399)',
  'linear-gradient(90deg, #f59e0b, #fbbf24)',
  'linear-gradient(90deg, #f43f5e, #fb7185)',
  'linear-gradient(90deg, #38bdf8, #7dd3fc)',
  'linear-gradient(90deg, #a78bfa, #c4b5fd)',
];

async function loadDashboard() {
  try {
    const stats = await apiGet('/stats');
    const articles = await apiGet('/articles');

    document.getElementById('statTotal').textContent      = stats.total_articles || 0;
    document.getElementById('statPublished').textContent  = stats.total_articles || 0;
    document.getElementById('statCategories').textContent = Object.keys(stats.categories || {}).length;
    document.getElementById('statViews').textContent      = articles.reduce((s, a) => s + (a.views||0), 0);

    // Category chart
    const catChart = document.getElementById('categoryChart');
    const cats = Object.entries(stats.categories || {}).sort((a,b) => b[1]-a[1]);
    const maxCat = cats[0]?.[1] || 1;

    if (cats.length === 0) {
      catChart.innerHTML = '<p class="muted">No data yet.</p>';
    } else {
      catChart.innerHTML = cats.map(([name, count], i) => `
        <div class="cat-bar-row">
          <div class="cat-name">${escHtml(name)}</div>
          <div class="cat-bar-wrap">
            <div class="cat-bar" style="background:${catColors[i % catColors.length]};width:${Math.round(count/maxCat*100)}%"></div>
          </div>
          <span class="cat-count">${count}</span>
        </div>
      `).join('');
    }

    // Most viewed
    const mvContainer = document.getElementById('mostViewed');
    const ranked = [...articles].sort((a,b) => (b.views||0)-(a.views||0)).slice(0,5);
    const rankLabels = ['🥇', '🥈', '🥉', '4', '5'];
    const rankClasses = ['gold', 'silver', 'bronze', '', ''];

    if (!ranked.length) {
      mvContainer.innerHTML = '<p class="muted">No articles yet.</p>';
    } else {
      mvContainer.innerHTML = ranked.map((a, i) => `
        <div class="most-viewed-row" onclick="openArticleModal('${a.id}')">
          <div class="mv-rank ${rankClasses[i]}">${rankLabels[i]}</div>
          <div class="mv-info">
            <div class="mv-title">${escHtml(a.title)}</div>
            <div class="mv-cat">${escHtml(a.category)}</div>
          </div>
          <div class="mv-views">👁 ${a.views || 0}</div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.warn('Dashboard load failed:', e);
  }
}

// ══════════════════════════════════════════
// API HELPERS
// ══════════════════════════════════════════

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function apiGet(path)           { return apiFetch(path); }
function apiPost(path, body)    { return apiFetch(path, { method: 'POST', body: JSON.stringify(body) }); }

// ══════════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════════

function showToast(msg, type = 'info') {
  const colors = {
    success: '#10b981',
    error:   '#f43f5e',
    warning: '#f59e0b',
    info:    '#6366f1',
  };

  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:#1a2235; border:1px solid ${colors[type]};
    color:#f1f5f9; padding:12px 20px; border-radius:10px;
    font-size:0.85rem; font-family:Inter,sans-serif;
    box-shadow:0 8px 32px rgba(0,0,0,0.5);
    animation: fadeIn 0.3s ease;
    max-width:320px; display:flex; align-items:center; gap:10px;
  `;
  toast.innerHTML = `<span style="color:${colors[type]};font-size:1rem">${type === 'success' ? '✓' : type === 'error' ? '✕' : '⚡'}</span>${escHtml(msg)}`;

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ══════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}
