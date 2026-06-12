// ==========================================================================
// App State & DOM Selectors
// ==========================================================================
const state = {
  repoPath: '',
  isRepo: false,
  currentBranch: '',
  
  branches: [],
  commits: [],
  tags: [],
  
  files: [],
  selectedFile: null,      // { path, status, oldPath }
  
  baseRef: 'HEAD',
  targetRef: '__live__',
  
  diffLayout: 'unified',   // 'unified' | 'split'
  viewMode: 'diff',        // 'diff' | 'blame'
  
  expandedSummaryFiles: new Set(), // Set of paths expanded in summary list
  searchTerm: '',
  
  sseSource: null
};

// DOM Elements
const repoPathInput = document.getElementById('repoPathInput');
const loadRepoBtn = document.getElementById('loadRepoBtn');
const repoStatusBadge = document.getElementById('repoStatusBadge');

const baseRefSelect = document.getElementById('baseRefSelect');
const baseRefCustomInput = document.getElementById('baseRefCustomInput');
const baseRefResetBtn = document.getElementById('baseRefResetBtn');

const targetRefSelect = document.getElementById('targetRefSelect');
const targetRefCustomInput = document.getElementById('targetRefCustomInput');
const targetRefResetBtn = document.getElementById('targetRefResetBtn');

const watchIndicator = document.getElementById('watchIndicator');

const fileSearchInput = document.getElementById('fileSearchInput');
const sidebarStats = document.getElementById('sidebarStats');
const filesListContainer = document.getElementById('filesListContainer');

const detailHeader = document.getElementById('detailHeader');
const detailFileBadge = document.getElementById('detailFileBadge');
const detailFilePath = document.getElementById('detailFilePath');
const detailFileRename = document.getElementById('detailFileRename');

const unifiedFormatBtn = document.getElementById('unifiedFormatBtn');
const splitFormatBtn = document.getElementById('splitFormatBtn');
const diffFormatToggleGroup = document.getElementById('diffFormatToggleGroup');
const modeDiffBtn = document.getElementById('modeDiffBtn');
const modeBlameBtn = document.getElementById('modeBlameBtn');

const mainEmptyState = document.getElementById('mainEmptyState');
const diffViewerPanel = document.getElementById('diffViewerPanel');
const blameViewerPanel = document.getElementById('blameViewerPanel');
const toastContainer = document.getElementById('toastContainer');

// ==========================================================================
// Initialization & Event Listeners
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // Config listeners
  loadRepoBtn.addEventListener('click', handleLoadRepo);
  repoPathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLoadRepo();
  });

  // Ref selection listeners
  baseRefSelect.addEventListener('change', (e) => {
    if (e.target.value === '__custom__') {
      baseRefSelect.style.display = 'none';
      baseRefCustomInput.style.display = 'block';
      baseRefResetBtn.style.display = 'block';
      baseRefCustomInput.value = state.baseRef !== 'HEAD' && !state.branches.includes(state.baseRef) ? state.baseRef : '';
      baseRefCustomInput.focus();
    } else {
      state.baseRef = e.target.value;
      handleRefsChange();
    }
  });

  baseRefCustomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = baseRefCustomInput.value.trim();
      if (val && val !== state.baseRef) {
        state.baseRef = val;
        handleRefsChange();
      }
      baseRefCustomInput.blur();
    }
  });

  baseRefCustomInput.addEventListener('blur', () => {
    const val = baseRefCustomInput.value.trim();
    if (val && val !== state.baseRef) {
      state.baseRef = val;
      handleRefsChange();
    }
  });

  baseRefResetBtn.addEventListener('click', () => {
    baseRefSelect.style.display = 'block';
    baseRefCustomInput.style.display = 'none';
    baseRefResetBtn.style.display = 'none';
    
    baseRefSelect.value = 'HEAD';
    state.baseRef = 'HEAD';
    handleRefsChange();
  });

  targetRefSelect.addEventListener('change', (e) => {
    if (e.target.value === '__custom__') {
      targetRefSelect.style.display = 'none';
      targetRefCustomInput.style.display = 'block';
      targetRefResetBtn.style.display = 'block';
      targetRefCustomInput.value = state.targetRef !== '__live__' && state.targetRef !== 'HEAD' && !state.branches.includes(state.targetRef) ? state.targetRef : '';
      targetRefCustomInput.focus();
    } else {
      state.targetRef = e.target.value;
      handleRefsChange();
    }
  });

  targetRefCustomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = targetRefCustomInput.value.trim();
      if (val && val !== state.targetRef) {
        state.targetRef = val;
        handleRefsChange();
      }
      targetRefCustomInput.blur();
    }
  });

  targetRefCustomInput.addEventListener('blur', () => {
    const val = targetRefCustomInput.value.trim();
    if (val && val !== state.targetRef) {
      state.targetRef = val;
      handleRefsChange();
    }
  });

  targetRefResetBtn.addEventListener('click', () => {
    targetRefSelect.style.display = 'block';
    targetRefCustomInput.style.display = 'none';
    targetRefResetBtn.style.display = 'none';
    
    targetRefSelect.value = '__live__';
    state.targetRef = '__live__';
    handleRefsChange();
  });

  // Layout & Mode toggle listeners
  unifiedFormatBtn.addEventListener('click', () => setDiffLayout('unified'));
  splitFormatBtn.addEventListener('click', () => setDiffLayout('split'));
  modeDiffBtn.addEventListener('click', () => setViewMode('diff'));
  modeBlameBtn.addEventListener('click', () => setViewMode('blame'));

  // File search
  fileSearchInput.addEventListener('input', (e) => {
    state.searchTerm = e.target.value.toLowerCase();
    renderFilesList();
  });

  // Check URL parameters first, fallback to server config
  const params = new URLSearchParams(window.location.search);
  const urlRepoPath = params.get('repoPath');
  if (urlRepoPath) {
    loadRepoFromPath(urlRepoPath, true);
  } else {
    fetchConfig();
  }
}

// ==========================================================================
// API Calls & State Mutations
// ==========================================================================
async function fetchConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.repoPath) {
      state.repoPath = data.repoPath;
      repoPathInput.value = data.repoPath;
      state.isRepo = data.isRepo;
      state.currentBranch = data.currentBranch;
      
      updateRepoStatusUI();
      if (state.isRepo) {
        await loadRepoFromPath(data.repoPath, true);
      }
    }
  } catch (err) {
    showToast('Error', 'Failed to retrieve initial configuration', 'info');
  }
}

async function handleLoadRepo() {
  const pathVal = repoPathInput.value.trim();
  if (!pathVal) return;
  await loadRepoFromPath(pathVal, false);
}

async function loadRepoFromPath(pathVal, initialLoad = false) {
  setLoading(true);
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath: pathVal })
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to load repository');
    }

    const data = await res.json();
    state.repoPath = data.repoPath;
    repoPathInput.value = data.repoPath;
    state.isRepo = true;
    state.currentBranch = data.currentBranch;
    
    updateRepoStatusUI();
    
    if (!initialLoad) {
      state.baseRef = 'HEAD';
      state.targetRef = '__live__';
      state.selectedFile = null;
      state.expandedSummaryFiles.clear();
      showToast('Success', 'Repository loaded successfully', 'success');
      syncStateToUrl();
    }

    await loadRepoData(initialLoad);
  } catch (err) {
    state.isRepo = false;
    updateRepoStatusUI();
    showToast('Error', err.message, 'info');
    clearRepoData();
    syncStateToUrl();
  } finally {
    setLoading(false);
  }
}

async function loadRepoData(initialLoad = false) {
  try {
    // 1. Fetch references (branches, tags, commits)
    const refsRes = await fetch('/api/refs');
    const refsData = await refsRes.json();
    
    state.branches = refsData.branches || [];
    state.commits = refsData.commits || [];
    state.tags = refsData.tags || [];

    if (initialLoad) {
      const params = new URLSearchParams(window.location.search);
      const urlBase = params.get('base');
      const urlTarget = params.get('target');
      const urlLayout = params.get('layout');
      const urlMode = params.get('mode');

      if (urlBase) state.baseRef = urlBase;
      else state.baseRef = state.currentBranch || 'HEAD';
      
      if (urlTarget) state.targetRef = urlTarget;
      else state.targetRef = '__live__';
      
      if (urlLayout) state.diffLayout = urlLayout;
      if (urlMode) state.viewMode = urlMode;

      // Sync toggles in UI
      if (urlLayout) {
        unifiedFormatBtn.classList.toggle('active', state.diffLayout === 'unified');
        splitFormatBtn.classList.toggle('active', state.diffLayout === 'split');
      }
      if (urlMode) {
        modeDiffBtn.classList.toggle('active', state.viewMode === 'diff');
        modeBlameBtn.classList.toggle('active', state.viewMode === 'blame');
      }
    }

    // Populate dropdowns
    populateDropdowns();

    // 2. Fetch diff list
    await fetchDiffList(initialLoad);

    // 3. Setup watch if target is live
    setupFileWatch();
  } catch (err) {
    showToast('Error', 'Failed to retrieve repository references', 'info');
  }
}

function clearRepoData() {
  baseRefSelect.innerHTML = '<option value="">Select Base Ref</option>';
  targetRefSelect.innerHTML = '<option value="">Select Target Ref</option>';
  baseRefSelect.disabled = true;
  targetRefSelect.disabled = true;
  filesListContainer.innerHTML = `
    <div class="empty-list-message">
      <i data-lucide="git-pull-request"></i>
      <p>Please load a valid Git repository to view diffs.</p>
    </div>
  `;
  lucide.createIcons();
  sidebarStats.innerText = 'No files changed';
  hideDetailView();
  stopFileWatch();
}

async function fetchDiffList(initialLoad = false) {
  if (!state.isRepo) return;

  try {
    const res = await fetch(`/api/diff?base=${encodeURIComponent(state.baseRef)}&target=${encodeURIComponent(state.targetRef)}`);
    const data = await res.json();
    
    state.files = data.files || [];
    renderFilesList();
    updateStatsUI();

    if (initialLoad) {
      const params = new URLSearchParams(window.location.search);
      const urlFile = params.get('file');
      if (urlFile) {
        const file = state.files.find(f => f.path === urlFile);
        if (file) {
          selectFile(file, false);
        } else {
          // Allow opening files in Blame Mode even if not currently modified
          selectFile({ path: urlFile, status: 'M', oldPath: null }, false);
        }
      }
    } else if (state.selectedFile) {
      const stillExists = state.files.find(f => f.path === state.selectedFile.path);
      if (stillExists) {
        state.selectedFile = stillExists;
        loadDetailedContent();
      } else if (state.viewMode !== 'blame') {
        hideDetailView();
        showToast('Info', 'Selected file has no differences anymore', 'info');
      }
    }

    syncStateToUrl();
  } catch (err) {
    showToast('Error', 'Failed to retrieve changed files list', 'info');
  }
}

async function handleRefsChange() {
  state.expandedSummaryFiles.clear();
  setupFileWatch();
  await fetchDiffList();
  syncStateToUrl();
}

// ==========================================================================
// DOM Renderers & UI Syncing
// ==========================================================================
function updateRepoStatusUI() {
  if (state.isRepo) {
    repoStatusBadge.className = 'status-badge status-valid';
    repoStatusBadge.innerHTML = '<i data-lucide="check-circle-2"></i> Valid Repo';
  } else {
    repoStatusBadge.className = 'status-badge status-invalid';
    repoStatusBadge.innerHTML = '<i data-lucide="circle-x"></i> Invalid Repo';
  }
  lucide.createIcons();
}

function populateDropdowns() {
  // Collect all valid values for baseRef select
  const baseValidValues = new Set(['HEAD']);
  state.branches.forEach(b => baseValidValues.add(b));
  state.tags.forEach(t => baseValidValues.add(t));
  state.commits.forEach(c => {
    baseValidValues.add(c.hash);
    baseValidValues.add(c.shortHash);
  });

  // Collect all valid values for targetRef select
  const targetValidValues = new Set(['__live__', 'HEAD']);
  state.branches.forEach(b => targetValidValues.add(b));
  state.tags.forEach(t => targetValidValues.add(t));
  state.commits.forEach(c => {
    targetValidValues.add(c.hash);
    targetValidValues.add(c.shortHash);
  });

  // Check if current values are custom
  const isBaseCustom = !baseValidValues.has(state.baseRef);
  const isTargetCustom = !targetValidValues.has(state.targetRef);

  // 1. Populate Base Select
  let baseHtml = `<optgroup label="Special Refs">
    <option value="HEAD" ${state.baseRef === 'HEAD' ? 'selected' : ''}>HEAD</option>
  </optgroup>`;

  if (state.branches.length > 0) {
    baseHtml += '<optgroup label="Local Branches">';
    state.branches.forEach(b => {
      const selected = b === state.baseRef ? 'selected' : '';
      baseHtml += `<option value="${b}" ${selected}>${b}</option>`;
    });
    baseHtml += '</optgroup>';
  }

  if (state.tags.length > 0) {
    baseHtml += '<optgroup label="Tags">';
    state.tags.forEach(t => {
      const selected = t === state.baseRef ? 'selected' : '';
      baseHtml += `<option value="${t}" ${selected}>${t}</option>`;
    });
    baseHtml += '</optgroup>';
  }

  if (state.commits.length > 0) {
    baseHtml += '<optgroup label="Commits (Last 10)">';
    state.commits.forEach(c => {
      const selected = c.hash === state.baseRef || c.shortHash === state.baseRef ? 'selected' : '';
      const text = `${c.shortHash} by ${c.author} - ${c.subject}`;
      baseHtml += `<option value="${c.hash}" ${selected}>${text}</option>`;
    });
    baseHtml += '</optgroup>';
  }

  baseHtml += `<optgroup label="Other">
    <option value="__custom__" ${isBaseCustom ? 'selected' : ''}>Custom Ref...</option>
  </optgroup>`;

  baseRefSelect.innerHTML = baseHtml;
  baseRefSelect.disabled = false;

  // Sync Base UI layout
  if (isBaseCustom) {
    baseRefSelect.style.display = 'none';
    baseRefCustomInput.style.display = 'block';
    baseRefResetBtn.style.display = 'block';
    baseRefCustomInput.value = state.baseRef;
  } else {
    baseRefSelect.style.display = 'block';
    baseRefCustomInput.style.display = 'none';
    baseRefResetBtn.style.display = 'none';
  }

  // 2. Populate Target Select
  let targetHtml = `<optgroup label="Special Refs">
    <option value="__live__" ${state.targetRef === '__live__' ? 'selected' : ''}>Live (Working Tree)</option>
    <option value="HEAD" ${state.targetRef === 'HEAD' ? 'selected' : ''}>HEAD</option>
  </optgroup>`;

  if (state.branches.length > 0) {
    targetHtml += '<optgroup label="Local Branches">';
    state.branches.forEach(b => {
      const selected = b === state.targetRef ? 'selected' : '';
      targetHtml += `<option value="${b}" ${selected}>${b}</option>`;
    });
    targetHtml += '</optgroup>';
  }

  if (state.tags.length > 0) {
    targetHtml += '<optgroup label="Tags">';
    state.tags.forEach(t => {
      const selected = t === state.targetRef ? 'selected' : '';
      targetHtml += `<option value="${t}" ${selected}>${t}</option>`;
    });
    targetHtml += '</optgroup>';
  }

  if (state.commits.length > 0) {
    targetHtml += '<optgroup label="Commits (Last 10)">';
    state.commits.forEach(c => {
      const selected = c.hash === state.targetRef || c.shortHash === state.targetRef ? 'selected' : '';
      const text = `${c.shortHash} by ${c.author} - ${c.subject}`;
      targetHtml += `<option value="${c.hash}" ${selected}>${text}</option>`;
    });
    targetHtml += '</optgroup>';
  }

  targetHtml += `<optgroup label="Other">
    <option value="__custom__" ${isTargetCustom ? 'selected' : ''}>Custom Ref...</option>
  </optgroup>`;

  targetRefSelect.innerHTML = targetHtml;
  targetRefSelect.disabled = false;

  // Sync Target UI layout
  if (isTargetCustom) {
    targetRefSelect.style.display = 'none';
    targetRefCustomInput.style.display = 'block';
    targetRefResetBtn.style.display = 'block';
    targetRefCustomInput.value = state.targetRef;
  } else {
    targetRefSelect.style.display = 'block';
    targetRefCustomInput.style.display = 'none';
    targetRefResetBtn.style.display = 'none';
  }
}

function updateStatsUI() {
  if (state.files.length === 0) {
    sidebarStats.innerText = 'No files changed';
    return;
  }
  sidebarStats.innerText = `${state.files.length} file${state.files.length > 1 ? 's' : ''} changed`;
}

function renderFilesList() {
  const container = filesListContainer;
  container.innerHTML = '';

  const filteredFiles = state.files.filter(f => 
    f.path.toLowerCase().includes(state.searchTerm) || 
    (f.oldPath && f.oldPath.toLowerCase().includes(state.searchTerm))
  );

  if (filteredFiles.length === 0) {
    container.innerHTML = `
      <div class="empty-list-message">
        <i data-lucide="search-slash"></i>
        <p>${state.files.length === 0 ? 'No files changed between these states.' : 'No matching files found.'}</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  filteredFiles.forEach(file => {
    const isSelected = state.selectedFile && state.selectedFile.path === file.path;
    const isExpanded = state.expandedSummaryFiles.has(file.path);
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = `file-item-wrapper ${isSelected ? 'active' : ''}`;
    wrapper.id = `file-wrapper-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Item contents
    const item = document.createElement('div');
    item.className = 'file-item';
    item.addEventListener('click', (e) => {
      // Don't trigger selection if clicking the inline expand button
      if (e.target.closest('.expand-diff-btn')) return;
      selectFile(file);
    });

    const left = document.createElement('div');
    left.className = 'file-item-left';

    const statusBadge = document.createElement('span');
    statusBadge.className = `file-badge ${getBadgeClass(file.status)}`;
    statusBadge.innerText = file.status;

    const nameContainer = document.createElement('div');
    nameContainer.style.minWidth = '0';
    
    const basename = file.path.split('/').pop();
    const folder = file.path.substring(0, file.path.lastIndexOf('/'));

    const nameSpan = document.createElement('div');
    nameSpan.className = 'file-name';
    nameSpan.innerText = basename;
    nameSpan.title = file.path;

    nameContainer.appendChild(nameSpan);
    if (folder) {
      const folderSpan = document.createElement('div');
      folderSpan.className = 'file-path-folder';
      folderSpan.innerText = folder;
      nameContainer.appendChild(folderSpan);
    }

    left.appendChild(statusBadge);
    left.appendChild(nameContainer);

    const right = document.createElement('div');
    right.className = 'file-item-right';

    // Expand Inline Diff Button
    const expandBtn = document.createElement('button');
    expandBtn.className = `expand-diff-btn ${isExpanded ? 'expanded' : ''}`;
    expandBtn.title = isExpanded ? 'Collapse inline diff' : 'Expand inline diff';
    expandBtn.innerHTML = '<i data-lucide="chevron-right"></i>';
    expandBtn.addEventListener('click', () => toggleInlineDiff(file, wrapper));

    right.appendChild(expandBtn);
    item.appendChild(left);
    item.appendChild(right);
    wrapper.appendChild(item);

    // If expanded, render inline diff container
    if (isExpanded) {
      const inlineContainer = document.createElement('div');
      inlineContainer.className = 'file-inline-diff-container';
      inlineContainer.innerHTML = '<div class="spinner"></div>';
      wrapper.appendChild(inlineContainer);
      
      // Fetch and render inline
      fetchAndRenderInlineDiff(file, inlineContainer);
    }

    container.appendChild(wrapper);
  });

  lucide.createIcons();
}

function getBadgeClass(status) {
  switch (status) {
    case 'M': return 'badge-modified';
    case 'A': return 'badge-added';
    case 'D': return 'badge-deleted';
    case 'R': return 'badge-renamed';
    default: return 'badge-modified';
  }
}

// ==========================================================================
// Inline & Detailed View Handling
// ==========================================================================
function selectFile(file, shouldSync = true) {
  state.selectedFile = file;
  
  // Update selection in list UI
  const items = filesListContainer.querySelectorAll('.file-item-wrapper');
  items.forEach(el => el.classList.remove('active'));
  
  const activeWrapper = document.getElementById(`file-wrapper-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}`);
  if (activeWrapper) {
    activeWrapper.classList.add('active');
  }

  // Show details panel
  detailHeader.style.display = 'flex';
  mainEmptyState.style.display = 'none';

  // Populate header details
  detailFileBadge.className = `file-status-badge ${getBadgeClass(file.status)}`;
  detailFileBadge.innerText = file.status === 'R' ? 'RENAMED' : file.status === 'A' ? 'ADDED' : file.status === 'D' ? 'DELETED' : 'MODIFIED';
  detailFilePath.innerText = file.path;
  
  if (file.status === 'R' && file.oldPath) {
    detailFileRename.innerText = ` (renamed from ${file.oldPath})`;
    detailFileRename.style.display = 'inline';
  } else {
    detailFileRename.style.display = 'none';
  }

  loadDetailedContent();

  if (shouldSync) {
    syncStateToUrl();
  }
}

function hideDetailView() {
  state.selectedFile = null;
  detailHeader.style.display = 'none';
  diffViewerPanel.style.display = 'none';
  blameViewerPanel.style.display = 'none';
  mainEmptyState.style.display = 'flex';
  syncStateToUrl();
}

async function loadDetailedContent() {
  if (!state.selectedFile) return;

  if (state.viewMode === 'diff') {
    diffViewerPanel.style.display = 'block';
    blameViewerPanel.style.display = 'none';
    diffFormatToggleGroup.style.visibility = 'visible';
    
    diffViewerPanel.innerHTML = '<div class="loader-container"><div class="spinner"></div><div>Loading diff...</div></div>';
    
    try {
      const params = new URLSearchParams({
        base: state.baseRef,
        target: state.targetRef,
        filePath: state.selectedFile.path,
        status: state.selectedFile.status
      });
      if (state.selectedFile.oldPath) {
        params.append('oldFilePath', state.selectedFile.oldPath);
      }

      const res = await fetch(`/api/file-diff?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load file diff');
      
      const diffData = await res.json();
      renderDetailedDiff(diffData);
    } catch (err) {
      diffViewerPanel.innerHTML = `<div class="loader-container" style="color: var(--status-del)"><i data-lucide="circle-alert"></i> Failed to retrieve file diff: ${err.message}</div>`;
      lucide.createIcons();
    }
  } else {
    // Blame mode
    diffViewerPanel.style.display = 'none';
    blameViewerPanel.style.display = 'block';
    diffFormatToggleGroup.style.visibility = 'hidden';
    
    blameViewerPanel.innerHTML = '<div class="loader-container"><div class="spinner"></div><div>Running git blame...</div></div>';

    try {
      const res = await fetch(`/api/blame?path=${encodeURIComponent(state.selectedFile.path)}&ref=${encodeURIComponent(state.targetRef)}`);
      if (!res.ok) throw new Error('Failed to run blame');
      
      const blameData = await res.json();
      renderDetailedBlame(blameData);
    } catch (err) {
      blameViewerPanel.innerHTML = `<div class="loader-container" style="color: var(--status-del)"><i data-lucide="circle-alert"></i> Failed to retrieve blame data: ${err.message}</div>`;
      lucide.createIcons();
    }
  }
}

// ==========================================================================
// Diff and Blame Custom Renderers
// ==========================================================================
function renderDetailedDiff(diffData) {
  if (diffData.isLarge) {
    diffViewerPanel.innerHTML = `
      <div class="binary-diff-info">
        <i data-lucide="file-warning"></i>
        <h3>File too large</h3>
        <p>This file is too large to render in the browser (${(diffData.size / 1024 / 1024).toFixed(2)} MB).</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  if (diffData.isBinary) {
    diffViewerPanel.innerHTML = `
      <div class="binary-diff-info">
        <i data-lucide="binary"></i>
        <h3>Binary File</h3>
        <p>Binary files differ. No text diff preview available.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  if (!diffData.hunks || diffData.hunks.length === 0) {
    diffViewerPanel.innerHTML = `
      <div class="binary-diff-info">
        <i data-lucide="info"></i>
        <h3>No differences</h3>
        <p>No changes detected in this file.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  if (state.diffLayout === 'unified') {
    renderUnifiedDiff(diffData, diffViewerPanel);
  } else {
    renderSplitDiff(diffData, diffViewerPanel);
  }
}

function renderUnifiedDiff(diffData, targetElement) {
  let html = '<table class="diff-table">';
  
  diffData.hunks.forEach(hunk => {
    // Render Hunk header
    html += `
      <tr class="diff-row row-hunk">
        <td class="diff-gutter">...</td>
        <td class="diff-gutter">...</td>
        <td class="diff-marker"> </td>
        <td class="diff-code">${escapeHtml(hunk.header)}</td>
      </tr>
    `;

    // Render lines
    hunk.lines.forEach(line => {
      const typeClass = line.type === 'add' ? 'row-add' : line.type === 'delete' ? 'row-delete' : line.type === 'info' ? 'row-info' : '';
      const oldLineVal = line.oldLine !== null ? line.oldLine : '';
      const newLineVal = line.newLine !== null ? line.newLine : '';
      const marker = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' ';
      
      html += `
        <tr class="diff-row ${typeClass}">
          <td class="diff-gutter">${oldLineVal}</td>
          <td class="diff-gutter">${newLineVal}</td>
          <td class="diff-marker">${marker}</td>
          <td class="diff-code">${escapeHtml(line.content.substring(1))}</td>
        </tr>
      `;
    });
  });

  html += '</table>';
  targetElement.innerHTML = html;
}

function renderSplitDiff(diffData, targetElement) {
  let html = '<table class="split-diff-table">';

  diffData.hunks.forEach(hunk => {
    // Hunk Header (Spans full width)
    html += `
      <tr class="split-diff-row row-hunk">
        <td colspan="2" class="diff-code" style="padding-left: 12px; border-right: none;">${escapeHtml(hunk.header)}</td>
      </tr>
    `;

    // Align lines within the hunk
    const alignedRows = alignHunkLines(hunk.lines);

    alignedRows.forEach(row => {
      html += '<tr class="split-diff-row">';

      // Left Column (Old version / Deletions)
      if (row.left) {
        const leftType = row.left.type === 'delete' ? 'cell-delete' : '';
        const oldLineVal = row.left.oldLine !== null ? row.left.oldLine : '';
        const marker = row.left.type === 'delete' ? '-' : ' ';
        const content = row.left.content.substring(1);
        
        html += `
          <td class="split-cell ${leftType}">
            <div class="split-cell-inner">
              <span class="diff-gutter">${oldLineVal}</span>
              <span class="diff-marker">${marker}</span>
              <span class="diff-code">${escapeHtml(content)}</span>
            </div>
          </td>
        `;
      } else {
        html += `
          <td class="split-cell cell-empty">
            <div class="split-cell-inner">
              <span class="diff-gutter"></span>
              <span class="diff-marker"></span>
              <span class="diff-code"></span>
            </div>
          </td>
        `;
      }

      // Right Column (New version / Additions)
      if (row.right) {
        const rightType = row.right.type === 'add' ? 'cell-add' : '';
        const newLineVal = row.right.newLine !== null ? row.right.newLine : '';
        const marker = row.right.type === 'add' ? '+' : ' ';
        const content = row.right.content.substring(1);
        
        html += `
          <td class="split-cell ${rightType}">
            <div class="split-cell-inner">
              <span class="diff-gutter">${newLineVal}</span>
              <span class="diff-marker">${marker}</span>
              <span class="diff-code">${escapeHtml(content)}</span>
            </div>
          </td>
        `;
      } else {
        html += `
          <td class="split-cell cell-empty">
            <div class="split-cell-inner">
              <span class="diff-gutter"></span>
              <span class="diff-marker"></span>
              <span class="diff-code"></span>
            </div>
          </td>
        `;
      }

      html += '</tr>';
    });
  });

  html += '</table>';
  targetElement.innerHTML = html;
}

// Helper to align hunk lines side by side
function alignHunkLines(lines) {
  const aligned = [];
  let deletes = [];
  let adds = [];

  const flush = () => {
    const max = Math.max(deletes.length, adds.length);
    for (let k = 0; k < max; k++) {
      aligned.push({
        left: deletes[k] || null,
        right: adds[k] || null
      });
    }
    deletes = [];
    adds = [];
  };

  for (const line of lines) {
    if (line.type === 'normal') {
      flush();
      aligned.push({ left: line, right: line });
    } else if (line.type === 'delete') {
      deletes.push(line);
    } else if (line.type === 'add') {
      adds.push(line);
    } else if (line.type === 'info') {
      flush();
      aligned.push({ left: line, right: null });
    }
  }
  flush();
  return aligned;
}

// Blame renderer
function renderDetailedBlame(blameData) {
  if (!blameData || blameData.length === 0) {
    blameViewerPanel.innerHTML = '<div class="loader-container">No lines found in this file to blame.</div>';
    return;
  }

  // Group consecutive lines from the same commit
  const groups = [];
  let currentGroup = null;

  blameData.forEach(line => {
    if (currentGroup && currentGroup.commit === line.commit) {
      currentGroup.lines.push(line);
    } else {
      currentGroup = {
        commit: line.commit,
        author: line.author,
        authorTime: line.authorTime,
        summary: line.summary,
        lines: [line]
      };
      groups.push(currentGroup);
    }
  });

  let html = '<div class="blame-table">';
  
  groups.forEach(group => {
    const commitColor = getCommitColor(group.commit);
    const dateStr = group.authorTime ? new Date(group.authorTime * 1000).toLocaleDateString() : '';
    const tooltip = `${group.commit.substring(0, 8)} - ${group.author}\nDate: ${new Date(group.authorTime * 1000).toLocaleString()}\n\n${group.summary}`;

    html += `
      <div class="blame-group">
        <div class="blame-meta" title="${escapeHtml(tooltip)}">
          <span class="blame-commit-accent" style="background-color: ${commitColor}"></span>
          <span class="blame-commit">${group.commit.substring(0, 7)}</span>
          <span class="blame-author">${group.author}</span>
          <span class="blame-date">${dateStr}</span>
        </div>
        <div class="blame-lines">
          ${group.lines.map(line => `
            <div class="blame-line-row">
              <div class="blame-line-num">${line.resultLine}</div>
              <div class="blame-code">${escapeHtml(line.content)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  html += '</div>';
  blameViewerPanel.innerHTML = html;
}

// Hand-curated high-contrast HSL colors for visually distinct commits in dark mode
const DISTINCT_COLORS = [
  'hsl(263, 75%, 52%)',  // Violet
  'hsl(142, 65%, 45%)',  // Emerald Green
  'hsl(36, 75%, 48%)',   // Amber/Orange
  'hsl(200, 80%, 46%)',  // Sky Blue
  'hsl(330, 70%, 50%)',  // Hot Pink
  'hsl(170, 70%, 40%)',  // Dark Teal
  'hsl(15, 80%, 48%)',   // Red-Orange
  'hsl(280, 70%, 52%)',  // Purple-Magenta
  'hsl(82, 65%, 44%)',   // Lime Green
  'hsl(220, 75%, 52%)',  // Royal Blue
  'hsl(48, 80%, 45%)',   // Yellow-Gold
  'hsl(302, 60%, 48%)',  // Orchid
  'hsl(190, 75%, 42%)',  // Cyan/Turquoise
  'hsl(9, 70%, 48%)',    // Coral Red
  'hsl(120, 55%, 42%)',  // Forest Green
  'hsl(245, 70%, 58%)'   // Indigo Blue
];

// Generate colored commits from distinct palette
function getCommitColor(commitHash) {
  if (commitHash === '0000000000000000000000000000000000000000' || commitHash.startsWith('0000000')) {
    return '#52525b'; // Zinc neutral for local changes
  }
  let hash = 0;
  for (let i = 0; i < commitHash.length; i++) {
    hash = commitHash.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DISTINCT_COLORS.length;
  return DISTINCT_COLORS[index];
}

// ==========================================================================
// Expandable Summary View (Sidebar Inline Diff)
// ==========================================================================
function toggleInlineDiff(file, wrapperElement) {
  const isExpanded = state.expandedSummaryFiles.has(file.path);
  
  if (isExpanded) {
    state.expandedSummaryFiles.delete(file.path);
    renderFilesList();
  } else {
    state.expandedSummaryFiles.add(file.path);
    renderFilesList();
  }
}

async function fetchAndRenderInlineDiff(file, inlineContainer) {
  try {
    const params = new URLSearchParams({
      base: state.baseRef,
      target: state.targetRef,
      filePath: file.path,
      status: file.status
    });
    if (file.oldPath) {
      params.append('oldFilePath', file.oldPath);
    }

    const res = await fetch(`/api/file-diff?${params.toString()}`);
    if (!res.ok) throw new Error();
    const diffData = await res.json();
    
    if (diffData.isLarge) {
      inlineContainer.innerHTML = '<div style="font-size: 11px; color: var(--text-muted);">File too large to preview inline.</div>';
      return;
    }
    
    if (diffData.isBinary) {
      inlineContainer.innerHTML = '<div style="font-size: 11px; color: var(--text-muted);"><i data-lucide="binary" style="width: 12px; height: 12px; display: inline; vertical-align: middle;"></i> Binary file.</div>';
      return;
    }
    
    if (!diffData.hunks || diffData.hunks.length === 0) {
      inlineContainer.innerHTML = '<div style="font-size: 11px; color: var(--text-muted);">No changes.</div>';
      return;
    }

    // Render in Unified view inside the inline box
    renderUnifiedDiff(diffData, inlineContainer);
  } catch (err) {
    inlineContainer.innerHTML = '<div style="font-size: 11px; color: var(--status-del);">Failed to load preview.</div>';
  }
}

// ==========================================================================
// Toggles & Format Switchers
// ==========================================================================
function setDiffLayout(layout) {
  state.diffLayout = layout;
  unifiedFormatBtn.classList.toggle('active', layout === 'unified');
  splitFormatBtn.classList.toggle('active', layout === 'split');
  if (state.selectedFile && state.viewMode === 'diff') {
    loadDetailedContent();
  }
  syncStateToUrl();
}

function setViewMode(mode) {
  state.viewMode = mode;
  modeDiffBtn.classList.toggle('active', mode === 'diff');
  modeBlameBtn.classList.toggle('active', mode === 'blame');
  if (state.selectedFile) {
    loadDetailedContent();
  }
  syncStateToUrl();
}

// ==========================================================================
// Live Watching (SSE integration)
// ==========================================================================
function setupFileWatch() {
  // If not comparing against Live state, we don't watch
  if (state.targetRef !== '__live__' || !state.isRepo) {
    stopFileWatch();
    return;
  }

  // Already watching this path
  if (state.sseSource) return;

  // Open EventSource
  const url = `/api/watch`;
  state.sseSource = new EventSource(url);
  const connectionTime = Date.now();

  watchIndicator.classList.add('active');

  state.sseSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.event) {
        // Trigger auto-refresh of file list & detailed view
        fetchDiffList();
        
        // Suppress notification toasts and highlights that trigger within 2.5s of watcher connection
        const isInitialEvent = (Date.now() - connectionTime) < 2500;

        if (!isInitialEvent) {
          // Flash modified file item in sidebar if it's rendered
          setTimeout(() => {
            const fileWrapper = document.getElementById(`file-wrapper-${data.path.replace(/[^a-zA-Z0-9]/g, '_')}`);
            if (fileWrapper) {
              fileWrapper.classList.add('pulse-highlight');
              setTimeout(() => fileWrapper.classList.remove('pulse-highlight'), 1500);
            }
          }, 300);

          showToast('File Changed', `${data.path} has been updated. Auto-refreshed!`, 'success');
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  };

  state.sseSource.onerror = () => {
    // If the server goes down or connection drops
    stopFileWatch();
  };
}

function stopFileWatch() {
  if (state.sseSource) {
    state.sseSource.close();
    state.sseSource = null;
  }
  watchIndicator.classList.remove('active');
}

// ==========================================================================
// Toast & Utilities
// ==========================================================================
function showToast(title, msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const iconName = type === 'success' ? 'check-circle-2' : 'info';
  
  toast.innerHTML = `
    <div class="toast-icon">
      <i data-lucide="${iconName}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <button class="toast-close">
      <i data-lucide="x"></i>
    </button>
  `;

  // Close event listener
  toast.querySelector('.toast-close').addEventListener('click', () => {
    dismissToast(toast);
  });

  toastContainer.appendChild(toast);
  lucide.createIcons();

  // Auto dismiss after 4 seconds
  setTimeout(() => {
    dismissToast(toast);
  }, 4000);
}

function dismissToast(toast) {
  if (toast.parentNode) {
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }
}

function setLoading(isLoading) {
  loadRepoBtn.disabled = isLoading;
  repoPathInput.disabled = isLoading;
  if (isLoading) {
    loadRepoBtn.innerHTML = '<span class="spinner" style="width: 14px; height: 14px; margin: 0;"></span>';
  } else {
    loadRepoBtn.innerHTML = '<i data-lucide="arrow-right"></i>';
  }
  lucide.createIcons();
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function syncStateToUrl() {
  if (!state.repoPath) return;
  const url = new URL(window.location);
  url.searchParams.set('repoPath', state.repoPath);
  url.searchParams.set('base', state.baseRef || '');
  url.searchParams.set('target', state.targetRef || '');
  url.searchParams.set('file', state.selectedFile ? state.selectedFile.path : '');
  url.searchParams.set('mode', state.viewMode || '');
  url.searchParams.set('layout', state.diffLayout || '');
  
  window.history.replaceState({}, '', url.pathname + url.search);
}
