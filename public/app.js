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
  fullContext: false,      // toggle showing entire file in diff view
  confirmedBinaryFiles: new Set(), // set of binary file paths confirmed by user to render
  
  onlyChanged: false,      // only show changed files filter toggle
  expandedFolders: new Set(), // paths of currently expanded directory folders in the tree
  expandedSummaryFiles: new Set(), // Set of paths expanded in summary list
  searchTerm: '',
  
  sseSource: null,
  isOutlineOpen: false,
  symbols: []
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
const onlyChangedFilter = document.getElementById('onlyChangedFilter');
const sidebarStats = document.getElementById('sidebarStats');
const filesListContainer = document.getElementById('filesListContainer');
const onlyChangedToggle = document.getElementById('onlyChangedToggle');
const filesChangedStat = document.getElementById('filesChangedStat');

const detailHeader = document.getElementById('detailHeader');
const detailFileBadge = document.getElementById('detailFileBadge');
const detailFilePath = document.getElementById('detailFilePath');
const detailFileRename = document.getElementById('detailFileRename');

const unifiedFormatBtn = document.getElementById('unifiedFormatBtn');
const splitFormatBtn = document.getElementById('splitFormatBtn');
const diffFormatToggleGroup = document.getElementById('diffFormatToggleGroup');
const fullContextBtn = document.getElementById('fullContextBtn');
const fullContextToggleGroup = document.getElementById('fullContextToggleGroup');
const modeDiffBtn = document.getElementById('modeDiffBtn');
const modeBlameBtn = document.getElementById('modeBlameBtn');
const modeRenderBtn = document.getElementById('modeRenderBtn');
const modeHistoryBtn = document.getElementById('modeHistoryBtn');

const mainEmptyState = document.getElementById('mainEmptyState');
const diffViewerPanel = document.getElementById('diffViewerPanel');
const blameViewerPanel = document.getElementById('blameViewerPanel');
const renderViewerPanel = document.getElementById('renderViewerPanel');
const historyViewerPanel = document.getElementById('historyViewerPanel');
const codeOutlinePanel = document.getElementById('codeOutlinePanel');
const outlineToggleBtn = document.getElementById('outlineToggleBtn');
const outlineToggleGroup = document.getElementById('outlineToggleGroup');
const outlineCloseBtn = document.getElementById('outlineCloseBtn');
const outlineSymbolsContainer = document.getElementById('outlineSymbolsContainer');
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
  fullContextBtn.addEventListener('click', toggleFullContext);
  modeDiffBtn.addEventListener('click', () => setViewMode('diff'));
  modeBlameBtn.addEventListener('click', () => setViewMode('blame'));
  modeRenderBtn.addEventListener('click', () => setViewMode('render'));
  modeHistoryBtn.addEventListener('click', () => setViewMode('history'));

  outlineToggleBtn.addEventListener('click', () => {
    state.isOutlineOpen = !state.isOutlineOpen;
    outlineToggleBtn.classList.toggle('active', state.isOutlineOpen);
    fetchAndRenderOutline();
  });

  outlineCloseBtn.addEventListener('click', () => {
    state.isOutlineOpen = false;
    outlineToggleBtn.classList.remove('active');
    codeOutlinePanel.style.display = 'none';
  });


  // File search
  fileSearchInput.addEventListener('input', (e) => {
    state.searchTerm = e.target.value.toLowerCase();
    renderFilesList();
  });

  // Filter toggle change
  onlyChangedFilter.addEventListener('change', (e) => {
    state.onlyChanged = e.target.checked;
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
    
    state.confirmedBinaryFiles.clear();
    if (!initialLoad) {
      state.baseRef = 'HEAD';
      state.targetRef = '__live__';
      state.selectedFile = null;
      state.expandedSummaryFiles.clear();
      state.expandedFolders.clear();
      state.onlyChanged = false;
      if (onlyChangedFilter) onlyChangedFilter.checked = false;
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
      const urlFullContext = params.get('fullContext');

      if (urlBase) state.baseRef = urlBase;
      else state.baseRef = state.currentBranch || 'HEAD';
      
      if (urlTarget) state.targetRef = urlTarget;
      else state.targetRef = '__live__';
      
      if (urlLayout) state.diffLayout = urlLayout;
      if (urlMode) state.viewMode = urlMode;
      if (urlFullContext === 'true') {
        state.fullContext = true;
      } else {
        state.fullContext = false;
      }

      // Sync toggles in UI
      if (urlLayout) {
        unifiedFormatBtn.classList.toggle('active', state.diffLayout === 'unified');
        splitFormatBtn.classList.toggle('active', state.diffLayout === 'split');
      }
      if (urlMode) {
        modeDiffBtn.classList.toggle('active', state.viewMode === 'diff');
        modeBlameBtn.classList.toggle('active', state.viewMode === 'blame');
        modeRenderBtn.classList.toggle('active', state.viewMode === 'render');
      }
      if (fullContextBtn) {
        fullContextBtn.classList.toggle('active', state.fullContext === true);
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

async function fetchDiffList(initialLoad = false, shouldReloadDetails = true) {
  if (!state.isRepo) return;

  try {
    const res = await fetch(`/api/diff?base=${encodeURIComponent(state.baseRef)}&target=${encodeURIComponent(state.targetRef)}`);
    const data = await res.json();
    
    state.files = data.files || [];
    
    // Expand directories containing changes by default
    expandFoldersWithChanges();

    renderFilesList();
    updateStatsUI();

    if (!state.selectedFile) {
      renderHomepage();
    }

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
        if (shouldReloadDetails) {
          loadDetailedContent();
        }
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
  state.expandedFolders.clear();
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
  const nonIgnoredFiles = state.files.filter(f => !f.isIgnored);
  const changedCount = nonIgnoredFiles.filter(f => f.status !== 'unchanged' && !f.isUntracked).length;
  const untrackedCount = nonIgnoredFiles.filter(f => f.isUntracked).length;

  if (changedCount === 0 && untrackedCount === 0) {
    sidebarStats.innerText = 'No files changed';
    return;
  }

  let statsText = `${changedCount} file${changedCount === 1 ? '' : 's'} changed`;
  if (untrackedCount > 0) {
    statsText += ` (${untrackedCount} untracked)`;
  }
  sidebarStats.innerText = statsText;
}

function renderFilesList() {
  const container = filesListContainer;
  container.innerHTML = '';

  // Filter list of files based on search term and changes toggle (excluding ignored files)
  const filteredFiles = state.files.filter(file => {
    if (file.isIgnored) return false;
    const matchesSearch = file.path.toLowerCase().includes(state.searchTerm);
    const matchesChanges = !state.onlyChanged || (file.status !== 'unchanged' || file.isUntracked);
    return matchesSearch && matchesChanges;
  });

  if (filteredFiles.length === 0) {
    container.innerHTML = `
      <div class="empty-list-message">
        <i data-lucide="search-slash"></i>
        <p>${state.files.length === 0 ? 'No files found in workspace.' : 'No matching files found.'}</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Build tree hierarchy
  const tree = buildFileTree(filteredFiles);

  // Render tree to HTML
  container.innerHTML = renderFileTreeHTML(tree);

  // Fetch inline diffs for expanded items
  state.expandedSummaryFiles.forEach(path => {
    const wrapperId = `file-wrapper-${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const wrapper = document.getElementById(wrapperId);
    if (wrapper) {
      const inlineContainer = wrapper.querySelector('.file-inline-diff-container');
      if (inlineContainer) {
        const file = state.files.find(f => f.path === path);
        if (file) {
          fetchAndRenderInlineDiff(file, inlineContainer);
        }
      }
    }
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
  const items = filesListContainer.querySelectorAll('.tree-file-row');
  items.forEach(el => el.classList.remove('active'));
  
  const activeWrapper = document.getElementById(`file-wrapper-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}`);
  if (activeWrapper) {
    activeWrapper.classList.add('active');
  }

  // Show details panel
  detailHeader.style.display = 'flex';
  mainEmptyState.style.display = 'none';

  // Populate header details
  if (file.isUntracked) {
    detailFileBadge.className = 'file-status-badge badge-untracked';
    detailFileBadge.innerText = 'UNTRACKED';
    detailFileBadge.title = 'Untracked';
  } else {
    detailFileBadge.className = `file-status-badge ${getBadgeClass(file.status)}`;
    detailFileBadge.innerText = file.status === 'R' ? 'RENAMED' : file.status === 'A' ? 'ADDED' : file.status === 'D' ? 'DELETED' : 'MODIFIED';
    detailFileBadge.title = file.status === 'R' ? 'Renamed' : file.status === 'A' ? 'Added' : file.status === 'D' ? 'Deleted' : 'Modified';
  }
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
  renderViewerPanel.style.display = 'none';
  historyViewerPanel.style.display = 'none';
  codeOutlinePanel.style.display = 'none';
  mainEmptyState.style.display = 'flex';
  renderHomepage();
  syncStateToUrl();
}

async function loadDetailedContent() {
  if (!state.selectedFile) return;

  if (state.viewMode === 'diff') {
    diffViewerPanel.style.display = 'block';
    blameViewerPanel.style.display = 'none';
    renderViewerPanel.style.display = 'none';
    diffFormatToggleGroup.style.visibility = 'visible';
    if (fullContextToggleGroup) {
      fullContextToggleGroup.style.display = 'flex';
    }
    
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
      if (state.fullContext) {
        params.append('fullContext', 'true');
      }

      const res = await fetch(`/api/file-diff?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load file diff');
      
      const diffData = await res.json();
      renderDetailedDiff(diffData);
    } catch (err) {
      diffViewerPanel.innerHTML = `<div class="loader-container" style="color: var(--status-del)"><i data-lucide="circle-alert"></i> Failed to retrieve file diff: ${err.message}</div>`;
      lucide.createIcons();
    }
  } else if (state.viewMode === 'blame') {
    diffViewerPanel.style.display = 'none';
    blameViewerPanel.style.display = 'block';
    renderViewerPanel.style.display = 'none';
    diffFormatToggleGroup.style.visibility = 'hidden';
    if (fullContextToggleGroup) {
      fullContextToggleGroup.style.display = 'none';
    }
    
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
  } else if (state.viewMode === 'render') {
    diffViewerPanel.style.display = 'none';
    blameViewerPanel.style.display = 'none';
    renderViewerPanel.style.display = 'block';
    diffFormatToggleGroup.style.visibility = 'hidden';
    if (fullContextToggleGroup) {
      fullContextToggleGroup.style.display = 'none';
    }
    
    renderDetailedContent();
  }
  
  if (state.selectedFile) {
    fetchAndRenderOutline();
  }
}

// ==========================================================================
// Diff and Blame Custom Renderers
// ==========================================================================
function renderDetailedDiff(diffData) {
  if (diffData.isUnchangedFile && diffData.content !== undefined) {
    const lines = diffData.content.split('\n');
    diffData.hunks = [{
      oldStart: 1,
      oldLines: lines.length,
      newStart: 1,
      newLines: lines.length,
      header: `@@ -1,${lines.length} +1,${lines.length} @@`,
      lines: lines.map((line, idx) => ({
        type: 'normal',
        oldLine: idx + 1,
        newLine: idx + 1,
        content: ' ' + line
      }))
    }];
  }

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
    if (!state.confirmedBinaryFiles.has(diffData.newPath)) {
      diffViewerPanel.innerHTML = `
        <div class="binary-diff-info">
          <i data-lucide="binary"></i>
          <h3>Binary File Detected</h3>
          <p>This file is a binary file. Render contents/diff?</p>
          <button class="btn btn-primary" onclick="confirmRenderBinary('${escapeJsString(diffData.newPath)}')">
            Confirm and Render
          </button>
        </div>
      `;
      lucide.createIcons();
      return;
    }
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
    renderUnifiedDiff(diffData, diffViewerPanel, state.fullContext);
  } else {
    renderSplitDiff(diffData, diffViewerPanel, state.fullContext);
  }
  linkSymbolsInDom(diffViewerPanel);
}

function renderUnifiedDiff(diffData, targetElement, hideHunkHeaders = false) {
  let html = '<table class="diff-table">';
  
  diffData.hunks.forEach(hunk => {
    // Render Hunk header
    if (!hideHunkHeaders) {
      html += `
        <tr class="diff-row row-hunk">
          <td class="diff-gutter">...</td>
          <td class="diff-gutter">...</td>
          <td class="diff-marker"> </td>
          <td class="diff-code">${escapeHtml(hunk.header)}</td>
        </tr>
      `;
    }

    // Render lines
    hunk.lines.forEach(line => {
      const typeClass = line.type === 'add' ? 'row-add' : line.type === 'delete' ? 'row-delete' : line.type === 'info' ? 'row-info' : '';
      const oldLineVal = line.oldLine !== null ? line.oldLine : '';
      const newLineVal = line.newLine !== null ? line.newLine : '';
      const marker = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' ';
      
      const dataLineAttr = newLineVal !== '' ? `data-line="${newLineVal}"` : '';
      html += `
        <tr class="diff-row ${typeClass}" ${dataLineAttr}>
          <td class="diff-gutter">${oldLineVal}</td>
          <td class="diff-gutter">${newLineVal}</td>
          <td class="diff-marker">${marker}</td>
          <td class="diff-code">${highlightCodeLine(line.content.substring(1), diffData.newPath || diffData.oldPath)}</td>
        </tr>
      `;
    });
  });

  html += '</table>';
  targetElement.innerHTML = html;
}

function renderSplitDiff(diffData, targetElement, hideHunkHeaders = false) {
  let html = '<table class="split-diff-table">';

  diffData.hunks.forEach(hunk => {
    // Hunk Header (Spans full width)
    if (!hideHunkHeaders) {
      html += `
        <tr class="split-diff-row row-hunk">
          <td colspan="2" class="diff-code" style="padding-left: 12px; border-right: none;">${escapeHtml(hunk.header)}</td>
        </tr>
      `;
    }

    // Align lines within the hunk
    const alignedRows = alignHunkLines(hunk.lines);

    alignedRows.forEach(row => {
      const dataLineAttr = (row.right && row.right.newLine !== null) ? `data-line="${row.right.newLine}"` : '';
      html += `<tr class="split-diff-row" ${dataLineAttr}>`;


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
              <span class="diff-code">${highlightCodeLine(content, diffData.newPath || diffData.oldPath)}</span>
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
              <span class="diff-code">${highlightCodeLine(content, diffData.newPath || diffData.oldPath)}</span>
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
            <div class="blame-line-row" data-line="${line.resultLine}">
              <div class="blame-line-num">${line.resultLine}</div>
              <div class="blame-code">${highlightCodeLine(line.content, state.selectedFile.path)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  html += '</div>';
  blameViewerPanel.innerHTML = html;
  linkSymbolsInDom(blameViewerPanel);
}

async function renderDetailedContent() {
  const filePath = state.selectedFile.path;
  const target = state.targetRef;
  const ext = filePath.split('.').pop().toLowerCase();
  const rawUrl = `/api/file-raw?ref=${encodeURIComponent(target)}&path=${encodeURIComponent(filePath)}`;

  // Images
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'];
  
  if (imageExtensions.includes(ext)) {
    renderViewerPanel.innerHTML = `
      <div class="rendered-image-container">
        <img src="${rawUrl}" alt="${escapeHtml(filePath)}" class="rendered-image" />
      </div>
    `;
    return;
  }

  // PDF
  if (ext === 'pdf') {
    renderViewerPanel.innerHTML = `
      <div class="rendered-pdf-container">
        <iframe src="${rawUrl}" class="rendered-pdf-iframe"></iframe>
      </div>
    `;
    return;
  }

  // HTML
  if (ext === 'html' || ext === 'htm') {
    renderViewerPanel.innerHTML = `
      <div class="rendered-html-container">
        <iframe src="${rawUrl}" class="rendered-html-iframe"></iframe>
      </div>
    `;
    return;
  }

  // Markdown
  if (ext === 'md' || ext === 'markdown') {
    renderViewerPanel.innerHTML = '<div class="loader-container"><div class="spinner"></div><div>Parsing Markdown...</div></div>';
    try {
      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error('Failed to load raw markdown content');
      const text = await res.text();
      
      let htmlContent = '';
      if (window.marked && window.marked.parse) {
        htmlContent = marked.parse(text);
      } else {
        htmlContent = `<pre class="plaintext-render">${escapeHtml(text)}</pre>`;
      }
      
      renderViewerPanel.innerHTML = `
        <div class="rendered-markdown-body markdown-body">
          ${htmlContent}
        </div>
      `;
    } catch (err) {
      renderViewerPanel.innerHTML = `<div class="loader-container" style="color: var(--status-del)"><i data-lucide="circle-alert"></i> Failed to render Markdown: ${err.message}</div>`;
      lucide.createIcons();
    }
    return;
  }

  // Default fallback (e.g. text/code files)
  renderViewerPanel.innerHTML = '<div class="loader-container"><div class="spinner"></div><div>Loading text...</div></div>';
  try {
    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error('Failed to load file contents');
    const text = await res.text();
    
    const lines = text.split('\n');
    const linesHtml = lines.map((line, idx) => {
      const lineNum = idx + 1;
      const highlightedLine = highlightCodeLine(line, filePath);
      return `
        <div class="fallback-line-row" data-line="${lineNum}">
          <span class="fallback-line-num">${lineNum}</span>
          <span class="fallback-code">${highlightedLine}</span>
        </div>
      `;
    }).join('');
    
    renderViewerPanel.innerHTML = `
      <div class="rendered-fallback-container">
        <div class="rendered-fallback-info">
          <i data-lucide="info"></i>
          <span>Interactive render mode not supported for this file type. Showing as source code.</span>
        </div>
        <div class="fallback-code-table">${linesHtml}</div>
      </div>
    `;
    lucide.createIcons();
    linkSymbolsInDom(renderViewerPanel);
  } catch (err) {
    renderViewerPanel.innerHTML = `<div class="loader-container" style="color: var(--status-del)"><i data-lucide="circle-alert"></i> Failed to retrieve content: ${err.message}</div>`;
    lucide.createIcons();
  }
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
    
    if (diffData.isUnchangedFile && diffData.content !== undefined) {
      const lines = diffData.content.split('\n');
      diffData.hunks = [{
        oldStart: 1,
        oldLines: lines.length,
        newStart: 1,
        newLines: lines.length,
        header: `@@ -1,${lines.length} +1,${lines.length} @@`,
        lines: lines.map((line, idx) => ({
          type: 'normal',
          oldLine: idx + 1,
          newLine: idx + 1,
          content: ' ' + line
        }))
      }];
    }

    if (diffData.isLarge) {
      inlineContainer.innerHTML = '<div style="font-size: 11px; color: var(--text-muted);">File too large to preview inline.</div>';
      return;
    }
    
    if (diffData.isBinary) {
      if (!state.confirmedBinaryFiles.has(file.path)) {
        inlineContainer.innerHTML = `
          <div style="font-size: 11px; padding: 6px; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
            <i data-lucide="binary" style="width: 12px; height: 12px; display: inline; vertical-align: middle;"></i>
            <span>Binary file.</span>
            <button class="btn-xs" onclick="confirmRenderBinaryInline('${escapeJsString(file.path)}', '${escapeJsString(inlineContainer.id)}')">
              Confirm & Render
            </button>
          </div>
        `;
        lucide.createIcons();
        return;
      }
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
  modeRenderBtn.classList.toggle('active', mode === 'render');
  modeHistoryBtn.classList.toggle('active', mode === 'history');
  
  if (fullContextToggleGroup) {
    fullContextToggleGroup.style.display = mode === 'diff' ? 'flex' : 'none';
  }
  
  // Hide outline panel if switching away from content views or if history is active
  if (mode === 'history' || !state.selectedFile) {
    codeOutlinePanel.style.display = 'none';
  }
  
  if (state.selectedFile) {
    if (mode === 'history') {
      loadFileHistory();
    } else {
      loadDetailedContent();
    }
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
  
  let refreshTimeout = null;
  const changedPathsSinceLastRefresh = new Set();

  watchIndicator.classList.add('active');

  state.sseSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.event) {
        if (data.path) {
          changedPathsSinceLastRefresh.add(data.path);
        }

        if (refreshTimeout) clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
          const paths = Array.from(changedPathsSinceLastRefresh);
          changedPathsSinceLastRefresh.clear();

          if (paths.length === 0) return;

          const openFileChanged = state.selectedFile && paths.includes(state.selectedFile.path);
          fetchDiffList(false, openFileChanged);

          // Suppress notification toasts and highlights that trigger within 2.5s of watcher connection
          const isInitialEvent = (Date.now() - connectionTime) < 2500;

          if (!isInitialEvent) {
            // Flash modified file items in sidebar
            paths.forEach(p => {
              const fileWrapper = document.getElementById(`file-wrapper-${p.replace(/[^a-zA-Z0-9]/g, '_')}`);
              if (fileWrapper) {
                fileWrapper.classList.add('pulse-highlight');
                setTimeout(() => fileWrapper.classList.remove('pulse-highlight'), 1500);
              }
            });

            if (paths.length === 1) {
              showToast('File Changed', `${paths[0]} has been updated. Auto-refreshed!`, 'success');
            } else {
              showToast('Files Changed', `${paths.length} files have been updated. Auto-refreshed!`, 'success');
            }
          }
        }, 300);
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

function escapeJsString(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function getLanguageFromExtension(filePath) {
  if (!filePath) return 'plaintext';
  const ext = filePath.split('.').pop().toLowerCase();
  const map = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'json': 'json',
    'html': 'xml',
    'htm': 'xml',
    'css': 'css',
    'py': 'python',
    'rb': 'ruby',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',
    'cpp': 'cpp',
    'cxx': 'cpp',
    'cc': 'cpp',
    'c': 'c',
    'h': 'cpp',
    'hpp': 'cpp',
    'cs': 'csharp',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'md': 'markdown',
    'yml': 'yaml',
    'yaml': 'yaml',
    'sql': 'sql',
    'php': 'php',
    'xml': 'xml',
    'toml': 'toml',
    'ini': 'ini',
    'diff': 'diff',
    'patch': 'diff',
  };
  return map[ext] || 'plaintext';
}

function highlightCodeLine(lineText, filePath) {
  const lang = getLanguageFromExtension(filePath);
  if (!window.hljs || lang === 'plaintext') {
    return escapeHtml(lineText);
  }
  try {
    return hljs.highlight(lineText, { language: lang, ignoreIllegals: true }).value;
  } catch (err) {
    return escapeHtml(lineText);
  }
}

// Automatically expand folders that contain changed or untracked files
function expandFoldersWithChanges() {
  state.files.forEach(file => {
    if (file.status !== 'unchanged' || file.isUntracked) {
      const parts = file.path.split('/');
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        state.expandedFolders.add(currentPath);
      }
    }
  });
}

// Construct nested file tree object
function buildFileTree(files) {
  const root = { name: 'root', path: '', type: 'directory', children: {}, hasChanges: false };
  
  files.forEach(file => {
    const parts = file.path.split('/');
    let current = root;
    
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const currentPath = current.path ? `${current.path}/${part}` : part;
      
      const fileHasChanges = file.status !== 'unchanged' || file.isUntracked;

      if (!current.children[part]) {
        current.children[part] = isLast 
          ? { name: part, path: currentPath, type: 'file', fileData: file }
          : { name: part, path: currentPath, type: 'directory', children: {}, hasChanges: false };
      }
      
      if (fileHasChanges) {
        current.children[part].hasChanges = true;
      }
      
      current = current.children[part];
    });
  });

  // Helper to recursively propagate change flag to parent folders
  function propagateChanges(node) {
    if (node.type === 'file') {
      return node.fileData.status !== 'unchanged' || node.fileData.isUntracked;
    }
    let nodeHasChanges = false;
    for (const key in node.children) {
      const childHasChanges = propagateChanges(node.children[key]);
      if (childHasChanges) {
        nodeHasChanges = true;
      }
    }
    node.hasChanges = nodeHasChanges;
    return nodeHasChanges;
  }
  
  propagateChanges(root);
  return root;
}

// Render tree object recursively to HTML
function renderFileTreeHTML(node, depth = 0) {
  if (node.type === 'file') {
    const file = node.fileData;
    const isSelected = state.selectedFile && state.selectedFile.path === file.path;
    const isExpanded = state.expandedSummaryFiles.has(file.path);
    const isIgnored = file.isIgnored;
    const isUntracked = file.isUntracked;
    const isChanged = file.status !== 'unchanged' && !isUntracked;

    let fileClass = 'tree-file-row';
    if (isSelected) fileClass += ' active';
    if (isIgnored) fileClass += ' file-ignored';
    if (isUntracked) fileClass += ' file-untracked';
    if (isChanged) fileClass += ` file-changed file-changed-${file.status}`;

    let badgeHtml = '';
    if (isChanged) {
      const titleText = file.status === 'R' ? 'Renamed' : file.status === 'A' ? 'Added' : file.status === 'D' ? 'Deleted' : 'Modified';
      badgeHtml = `<span class="file-badge ${getBadgeClass(file.status)}" title="${titleText}">${file.status}</span>`;
    } else if (isUntracked) {
      badgeHtml = `<span class="file-badge badge-untracked" title="Untracked">?</span>`;
    } else if (isIgnored) {
      badgeHtml = `<span class="file-badge badge-ignored" title="Ignored">I</span>`;
    }

    let inlineDiffHtml = '';
    if (isExpanded) {
      inlineDiffHtml = `
        <div class="file-inline-diff-container" id="inline-diff-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}">
          <div class="spinner"></div>
        </div>
      `;
    }

    const rowId = `file-wrapper-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}`;

    return `
      <div class="${fileClass}" id="${rowId}">
        <div class="tree-file-header" onclick="handleFileClick('${escapeJsString(file.path)}')">
          <div class="tree-file-left">
            <i data-lucide="file-text"></i>
            <span class="tree-file-name" title="${escapeHtml(file.path)}">${escapeHtml(node.name)}</span>
          </div>
          <div class="tree-file-right">
            ${badgeHtml}
          </div>
        </div>
        ${inlineDiffHtml}
      </div>
    `;
  }

  // Directory node sorting (directories first, then files alphabetically)
  const sortedKeys = Object.keys(node.children).sort((a, b) => {
    const childA = node.children[a];
    const childB = node.children[b];
    if (childA.type !== childB.type) {
      return childA.type === 'directory' ? -1 : 1;
    }
    return a.localeCompare(b);
  });

  const isCollapsed = !state.expandedFolders.has(node.path) && node.path !== '';
  const folderIcon = isCollapsed ? 'folder' : 'folder-open';
  const folderHeaderClass = `tree-folder-header ${node.hasChanges ? 'folder-has-changes' : ''}`;
  
  let childrenHtml = '';
  if (!isCollapsed) {
    childrenHtml = `
      <div class="tree-folder-children">
        ${sortedKeys.map(key => renderFileTreeHTML(node.children[key], depth + 1)).join('')}
      </div>
    `;
  }

  if (node.path === '') {
    return sortedKeys.map(key => renderFileTreeHTML(node.children[key], depth)).join('');
  }

  return `
    <div class="tree-folder">
      <div class="${folderHeaderClass}" onclick="handleFolderClick('${escapeJsString(node.path)}')">
        <i data-lucide="chevron-right" class="tree-folder-arrow ${isCollapsed ? 'collapsed' : ''}"></i>
        <i data-lucide="${folderIcon}"></i>
        <span class="tree-folder-name">${escapeHtml(node.name)}</span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

// Global click binders for tree interactivity
window.handleFileClick = (filePath) => {
  const file = state.files.find(f => f.path === filePath);
  if (file) {
    selectFile(file);
  }
};

window.handleFolderClick = (folderPath) => {
  if (state.expandedFolders.has(folderPath)) {
    state.expandedFolders.delete(folderPath);
  } else {
    state.expandedFolders.add(folderPath);
  }
  renderFilesList();
};

window.handleInlineToggle = (event, filePath, rowId) => {
  event.stopPropagation();
  if (state.expandedSummaryFiles.has(filePath)) {
    state.expandedSummaryFiles.delete(filePath);
  } else {
    state.expandedSummaryFiles.add(filePath);
  }
  renderFilesList();
};

function syncStateToUrl() {
  if (!state.repoPath) return;
  const url = new URL(window.location);
  url.searchParams.set('repoPath', state.repoPath);
  url.searchParams.set('base', state.baseRef || '');
  url.searchParams.set('target', state.targetRef || '');
  url.searchParams.set('file', state.selectedFile ? state.selectedFile.path : '');
  url.searchParams.set('mode', state.viewMode || '');
  url.searchParams.set('layout', state.diffLayout || '');
  url.searchParams.set('fullContext', state.fullContext ? 'true' : 'false');
  
  window.history.replaceState({}, '', url.pathname + url.search);
}

function toggleFullContext() {
  state.fullContext = !state.fullContext;
  fullContextBtn.classList.toggle('active', state.fullContext);
  loadDetailedContent();
  syncStateToUrl();
}

window.confirmRenderBinary = (filePath) => {
  state.confirmedBinaryFiles.add(filePath);
  loadDetailedContent();
};

window.confirmRenderBinaryInline = (filePath, containerId) => {
  state.confirmedBinaryFiles.add(filePath);
  const container = document.getElementById(containerId);
  if (container) {
    const file = state.files.find(f => f.path === filePath);
    if (file) {
      fetchAndRenderInlineDiff(file, container);
    }
  }
};

window.showHomepage = () => {
  const activeRow = filesListContainer.querySelector('.tree-file-row.active');
  if (activeRow) {
    activeRow.classList.remove('active');
  }
  hideDetailView();
};

window.setCustomTargetRef = (ref) => {
  state.targetRef = ref;
  populateDropdowns();
  handleRefsChange();
};

window.setQuickCompare = (base, target) => {
  state.baseRef = base;
  state.targetRef = target;
  populateDropdowns();
  handleRefsChange();
};

window.resetCompareScope = () => {
  state.baseRef = 'HEAD';
  state.targetRef = '__live__';
  populateDropdowns();
  handleRefsChange();
};

function renderHomepage() {
  if (!state.isRepo) {
    mainEmptyState.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-icon-container">
          <i data-lucide="git-branch"></i>
        </div>
        <h3>diff++ Studio</h3>
        <p>Select a file from the sidebar to inspect detailed git modifications or view full code line history using Git Blame.</p>
        <div class="empty-tips">
          <div class="tip-item">
            <i data-lucide="zap"></i>
            <span>Comparing with <strong>Live State</strong> will automatically monitor file changes.</span>
          </div>
          <div class="tip-item">
            <i data-lucide="eye"></i>
            <span>Toggle between <strong>Unified</strong> and <strong>Split</strong> diff layouts.</span>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Extract folder name from path
  const repoName = state.repoPath.split('/').filter(Boolean).pop() || 'Repository';
  
  // Calculate status breakdown
  const activeFiles = state.files.filter(f => !f.isIgnored);
  const changedCount = activeFiles.filter(f => f.status !== 'unchanged' && !f.isUntracked).length;
  const untrackedCount = activeFiles.filter(f => f.isUntracked).length;
  
  const changedFiles = activeFiles.filter(f => f.status !== 'unchanged' || f.isUntracked);

  // Changed files list html
  let changedFilesHtml = '';
  if (changedFiles.length > 0) {
    changedFilesHtml = `
      <div class="dashboard-section">
        <h3><i data-lucide="file-diff"></i> Changed Files</h3>
        <div class="dashboard-changed-list">
          ${changedFiles.map(f => {
            let badgeClass = '';
            let badgeText = '';
            let titleText = '';
            if (f.isUntracked) {
              badgeClass = 'badge-untracked';
              badgeText = '?';
              titleText = 'Untracked';
            } else {
              badgeClass = getBadgeClass(f.status);
              badgeText = f.status;
              titleText = f.status === 'R' ? 'Renamed' : f.status === 'A' ? 'Added' : f.status === 'D' ? 'Deleted' : 'Modified';
            }
            return `
              <div class="dashboard-file-row" onclick="handleFileClick('${escapeJsString(f.path)}')" title="Click to view diff for ${escapeHtml(f.path)}">
                <span class="file-badge ${badgeClass}" title="${titleText}">${badgeText}</span>
                <span class="dashboard-file-path">${escapeHtml(f.path)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else {
    changedFilesHtml = `
      <div class="dashboard-section">
        <h3><i data-lucide="file-diff"></i> Changed Files</h3>
        <p class="empty-dashboard-text">No changed files in this comparison scope.</p>
      </div>
    `;
  }

  mainEmptyState.innerHTML = `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <div class="dashboard-title-group">
          <h2>${escapeHtml(repoName)}</h2>
          <div class="repo-abs-path">${escapeHtml(state.repoPath)}</div>
        </div>
        <div class="dashboard-branch-badge">
          <i data-lucide="git-branch"></i>
          <span>${escapeHtml(state.currentBranch || 'unknown')}</span>
        </div>
      </div>
      
      <div class="dashboard-grid">
        <div class="dashboard-card status-card">
          <div class="card-icon"><i data-lucide="folder-git-2"></i></div>
          <div class="card-title">Workspace Status</div>
          <div class="status-stats">
            <div class="status-stat-item">
              <span class="stat-num color-modified">${changedCount}</span>
              <span class="stat-label">Changed Tracked Files</span>
            </div>
            <div class="status-stat-item">
              <span class="stat-num color-untracked">${untrackedCount}</span>
              <span class="stat-label">Untracked Files</span>
            </div>
          </div>
        </div>
        
        <div class="dashboard-card compare-card">
          <div class="card-icon"><i data-lucide="git-compare"></i></div>
          <div class="card-title">Compare Scope</div>
          <div class="compare-details">
            <div class="compare-ref-flow">
              <span class="ref-pill base-pill">${escapeHtml(state.baseRef)}</span>
              <i data-lucide="arrow-right"></i>
              <span class="ref-pill target-pill">${escapeHtml(state.targetRef === '__live__' ? 'Live' : state.targetRef)}</span>
            </div>
            <div class="compare-scope-label">Comparing base ref to target ref</div>
          </div>
        </div>

        <div class="dashboard-card summary-card">
          <div class="card-icon"><i data-lucide="tags"></i></div>
          <div class="card-title">References</div>
          <div class="ref-stats">
            <div class="ref-stat-item">
              <span class="ref-num">${state.branches.length}</span>
              <span class="ref-label">Branches</span>
            </div>
            <div class="ref-stat-item">
              <span class="ref-num">${state.tags.length}</span>
              <span class="ref-label">Tags</span>
            </div>
          </div>
        </div>
      </div>

      <div class="dashboard-columns">
        <div class="dashboard-section" id="dagGraphSection">
          <h3><i data-lucide="history"></i> Commit History Graph</h3>
          <div class="dag-container" id="dagContainer">
            <div class="loader-container" style="padding: 20px 0;"><div class="spinner"></div><div>Loading Git graph...</div></div>
          </div>
        </div>
        ${changedFilesHtml}
      </div>
    </div>
  `;
  lucide.createIcons();
  fetchAndRenderDag();
}

async function fetchAndRenderDag() {
  const dagContainer = document.getElementById('dagContainer');
  if (!dagContainer) return;

  try {
    const res = await fetch('/api/dag');
    if (!res.ok) throw new Error('Failed to fetch commit graph');
    const dagData = await res.json();
    
    if (!dagData || dagData.length === 0) {
      dagContainer.innerHTML = '<p class="empty-dashboard-text">No commits found in history.</p>';
      return;
    }

    const maxCols = Math.max(...dagData.map(row => row.graph.length), 1);
    const colWidth = 14;
    const graphWidth = maxCols * colWidth;
    
    const TRACK_COLORS = [
      '#8b5cf6', // Violet
      '#10b981', // Emerald
      '#f59e0b', // Amber
      '#3b82f6', // Blue
      '#ef4444', // Red
      '#06b6d4', // Cyan
      '#ec4899', // Pink
      '#a855f7'  // Purple
    ];

    dagContainer.innerHTML = dagData.map(row => {
      const isConnector = !row.commit;
      const rowHeight = isConnector ? 18 : 26;
      const cy = rowHeight / 2;
      
      let shapes = [];
      row.graph.split('').forEach((char, c) => {
        const x = c * colWidth + colWidth / 2;
        const color = TRACK_COLORS[c % TRACK_COLORS.length];
        
        if (char === '*') {
          shapes.push(`<line x1="${x}" y1="0" x2="${x}" y2="${rowHeight}" stroke="${color}" stroke-width="2" />`);
          const hashVal = row.commit ? row.commit.hash : '';
          const shortHash = row.commit ? row.commit.shortHash : '';
          shapes.push(`<circle cx="${x}" cy="${cy}" r="5" fill="var(--bg-surface)" stroke="${color}" stroke-width="3" class="dag-node-dot" onclick="setCustomTargetRef('${hashVal}')" title="Set commit ${shortHash} as target ref" style="cursor: pointer;" />`);
        } else if (char === '|') {
          shapes.push(`<line x1="${x}" y1="0" x2="${x}" y2="${rowHeight}" stroke="${color}" stroke-width="2" />`);
        } else if (char === '/') {
          shapes.push(`<line x1="${(c + 1) * colWidth + colWidth / 2}" y1="0" x2="${(c - 1) * colWidth + colWidth / 2}" y2="${rowHeight}" stroke="${color}" stroke-width="2" />`);
        } else if (char === '\\') {
          shapes.push(`<line x1="${(c - 1) * colWidth + colWidth / 2}" y1="0" x2="${(c + 1) * colWidth + colWidth / 2}" y2="${rowHeight}" stroke="${color}" stroke-width="2" />`);
        } else if (char === '_') {
          shapes.push(`<line x1="${c * colWidth}" y1="${cy}" x2="${(c + 1) * colWidth}" y2="${cy}" stroke="${color}" stroke-width="2" />`);
        }
      });

      const svgHtml = `
        <svg width="${graphWidth}" height="${rowHeight}" class="dag-svg-slice">
          ${shapes.join('')}
        </svg>
      `;

      let commitHtml = '';
      if (row.commit) {
        const commitDate = new Date(row.commit.date).toLocaleDateString();
        commitHtml = `
          <div class="dag-commit-col">
            <span class="dag-commit-sha" onclick="setCustomTargetRef('${row.commit.hash}')" title="Set as target ref">${row.commit.shortHash}</span>
            <span class="dag-commit-subject" title="${escapeHtml(row.commit.subject)}">${escapeHtml(row.commit.subject)}</span>
            <span class="dag-commit-meta">${escapeHtml(row.commit.author)} on ${commitDate}</span>
          </div>
        `;
      }

      const rowClass = isConnector ? 'dag-row dag-row-connector' : 'dag-row';

      return `
        <div class="${rowClass}">
          <div class="dag-graph-col">${svgHtml}</div>
          ${commitHtml}
        </div>
      `;
    }).join('');

  } catch (err) {
    dagContainer.innerHTML = `<p style="color: var(--status-del); font-size: 12px; padding: 12px;">Failed to load graph: ${err.message}</p>`;
  }
}

function linkSymbolsInDom(container) {
  if (!state.symbols || state.symbols.length === 0) return;

  // Build map of symbol name to definition line
  const symbolMap = new Map();
  state.symbols.forEach(sym => {
    if (sym.line && ['function', 'method', 'class'].includes(sym.type)) {
      symbolMap.set(sym.name, sym.line);
    }
  });

  if (symbolMap.size === 0) return;

  // Escape symbol names to build a safe regular expression
  const escapedNames = Array.from(symbolMap.keys())
    .map(name => name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
    .filter(name => name.length > 0);

  if (escapedNames.length === 0) return;

  // Match symbol names as whole words
  const regex = new RegExp(`\\b(${escapedNames.join('|')})\\b`, 'g');

  // Find all elements containing code cells
  const codeElements = container.querySelectorAll('.diff-code, .blame-code, .fallback-code');
  codeElements.forEach(el => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    const nodesToReplace = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      
      // Skip text nodes inside links, comments, or string literals to preventdubious matches
      if (node.parentElement) {
        const parent = node.parentElement;
        if (parent.classList.contains('code-symbol-link') ||
            parent.closest('.hljs-comment') ||
            parent.closest('.hljs-string') ||
            parent.tagName.toLowerCase() === 'a') {
          continue;
        }
      }
      
      if (regex.test(node.nodeValue)) {
        nodesToReplace.push(node);
      }
    }

    nodesToReplace.forEach(node => {
      const text = node.nodeValue;
      regex.lastIndex = 0;
      
      const fragment = document.createDocumentFragment();
      let lastIdx = 0;
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const matchText = match[0];
        const matchIdx = match.index;
        
        // Add text leading to the match
        if (matchIdx > lastIdx) {
          fragment.appendChild(document.createTextNode(text.substring(lastIdx, matchIdx)));
        }
        
        // Add clickable link element
        const lineNum = symbolMap.get(matchText);
        const link = document.createElement('a');
        link.className = 'code-symbol-link';
        link.href = '#';
        link.textContent = matchText;
        link.title = `Go to definition of ${matchText} (Line ${lineNum})`;
        
        link.addEventListener('click', (e) => {
          e.preventDefault();
          scrollToSymbolLine(lineNum);
        });
        
        fragment.appendChild(link);
        lastIdx = regex.lastIndex;
      }
      
      if (lastIdx < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIdx)));
      }
      
      if (node.parentNode) {
        node.parentNode.replaceChild(fragment, node);
      }
    });
  });
}

async function fetchAndRenderOutline() {
  if (!state.selectedFile) {
    outlineToggleGroup.style.display = 'none';
    codeOutlinePanel.style.display = 'none';
    state.symbols = [];
    return;
  }

  const filePath = state.selectedFile.path;
  const ext = '.' + filePath.split('.').pop().toLowerCase();
  const supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.rs', '.c', '.cpp', '.h', '.hpp', '.cc', '.md', '.markdown'];

  if (!supportedExtensions.includes(ext)) {
    outlineToggleGroup.style.display = 'none';
    codeOutlinePanel.style.display = 'none';
    state.symbols = [];
    return;
  }

  outlineToggleGroup.style.display = 'flex';
  
  if (state.isOutlineOpen) {
    codeOutlinePanel.style.display = 'flex';
    outlineToggleBtn.classList.add('active');
  } else {
    codeOutlinePanel.style.display = 'none';
    outlineToggleBtn.classList.remove('active');
  }

  if (state.isOutlineOpen) {
    outlineSymbolsContainer.innerHTML = '<div class="loader-container" style="padding: 10px 0;"><div class="spinner" style="width: 16px; height: 16px; margin: 0 auto;"></div></div>';
  }

  try {
    const res = await fetch(`/api/symbols?path=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(state.targetRef)}`);
    if (!res.ok) throw new Error('Failed to fetch symbols');
    const symbols = await res.json();
    state.symbols = symbols;
    
    if (state.isOutlineOpen) {
      renderSymbolsList();
    }
    
    linkSymbolsInDom(document);
  } catch (err) {
    state.symbols = [];
    if (state.isOutlineOpen) {
      outlineSymbolsContainer.innerHTML = `<div style="color: var(--status-del); font-size: 11px; padding: 10px;">Outline failed: ${err.message}</div>`;
    }
  }
}

function renderSymbolsList() {
  if (!state.symbols || state.symbols.length === 0) {
    outlineSymbolsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 11px; padding: 10px; text-align: center;">No symbols found in this file.</div>';
    return;
  }

  outlineSymbolsContainer.innerHTML = state.symbols.map(s => {
    let iconClass = '';
    let iconText = '';
    
    if (s.type === 'class') {
      iconClass = 'symbol-class';
      iconText = 'C';
    } else if (s.type === 'function') {
      iconClass = 'symbol-function';
      iconText = 'F';
    } else if (s.type === 'method') {
      iconClass = 'symbol-method';
      iconText = 'M';
    } else if (s.type.startsWith('h')) {
      iconClass = 'symbol-heading';
      iconText = '#';
    } else {
      iconClass = 'symbol-class';
      iconText = 'S';
    }

    return `
      <div class="outline-row" onclick="scrollToSymbolLine(${s.line})">
        <span class="outline-symbol-icon ${iconClass}">${iconText}</span>
        <span class="outline-symbol-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
        <span class="outline-symbol-line">L${s.line}</span>
      </div>
    `;
  }).join('');
}

window.scrollToSymbolLine = (lineNum) => {
  const activePanelId = state.viewMode === 'diff' ? 'diffViewerPanel' 
                      : state.viewMode === 'blame' ? 'blameViewerPanel'
                      : 'renderViewerPanel';
  
  const panel = document.getElementById(activePanelId);
  if (!panel) return;

  const targetEl = panel.querySelector(`[data-line="${lineNum}"]`);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    targetEl.classList.remove('line-flash-highlight');
    void targetEl.offsetWidth; // trigger reflow
    targetEl.classList.add('line-flash-highlight');
  }
};

async function loadFileHistory() {
  if (!state.selectedFile) return;

  diffViewerPanel.style.display = 'none';
  blameViewerPanel.style.display = 'none';
  renderViewerPanel.style.display = 'none';
  historyViewerPanel.style.display = 'block';
  diffFormatToggleGroup.style.visibility = 'hidden';
  if (fullContextToggleGroup) {
    fullContextToggleGroup.style.display = 'none';
  }

  historyViewerPanel.innerHTML = '<div class="loader-container"><div class="spinner"></div><div>Loading file history...</div></div>';

  try {
    const res = await fetch(`/api/file-history?path=${encodeURIComponent(state.selectedFile.path)}`);
    if (!res.ok) throw new Error('Failed to load file history');
    
    const historyData = await res.json();
    renderFileHistory(historyData);
  } catch (err) {
    historyViewerPanel.innerHTML = `<div class="loader-container" style="color: var(--status-del)"><i data-lucide="circle-alert"></i> Failed to retrieve history: ${err.message}</div>`;
    lucide.createIcons();
  }
}

function renderFileHistory(historyData) {
  if (!historyData || historyData.length === 0) {
    historyViewerPanel.innerHTML = '<div class="loader-container">No commit history found for this file.</div>';
    return;
  }

  historyViewerPanel.innerHTML = `
    <div class="history-list">
      ${historyData.map(c => {
        const commitDate = new Date(c.date).toLocaleString();
        return `
          <div class="history-item">
            <div class="history-meta">
              <div class="history-subject">${escapeHtml(c.subject)}</div>
              <div class="history-author">
                by <strong>${escapeHtml(c.author)}</strong>
                <span>on ${commitDate}</span>
              </div>
            </div>
            <div class="history-actions">
              <span class="commit-sha" onclick="setCustomTargetRef('${c.hash}')" title="Set comparison target to this commit">${c.shortHash}</span>
              <button class="btn btn-xs btn-primary" onclick="viewFileAtCommit('${escapeJsString(c.hash)}')" title="View file content at this commit">
                <i data-lucide="eye"></i> View Content
              </button>
              <button class="btn btn-xs" onclick="viewFileCommitDiff('${escapeJsString(c.hash)}')" title="View changes introduced in this commit">
                <i data-lucide="split"></i> View Diff
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  lucide.createIcons();
}

window.viewFileAtCommit = (hash) => {
  state.baseRef = hash;
  state.targetRef = hash;
  state.viewMode = 'diff';
  populateDropdowns();
  handleRefsChange();
};

window.viewFileCommitDiff = (hash) => {
  state.baseRef = `${hash}~1`;
  state.targetRef = hash;
  state.viewMode = 'diff';
  populateDropdowns();
  handleRefsChange();
};

