const express = require('express');
const chokidar = require('chokidar');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Global state in-memory config
let currentRepoPath = '';

// Helper to run git commands
function runGit(args, repoPath) {
  return new Promise((resolve, reject) => {
    if (!repoPath) {
      return reject(new Error('No repository path configured'));
    }
    execFile('git', args, { cwd: repoPath, maxBuffer: 15 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        // Some commands like git diff might exit with non-zero under certain conditions,
        // but normally we can return the error context.
        return reject({ error, stderr, stdout });
      }
      resolve(stdout);
    });
  });
}

// Helper to run git commands and return a Buffer
function runGitBuffer(args, repoPath) {
  return new Promise((resolve, reject) => {
    if (!repoPath) {
      return reject(new Error('No repository path configured'));
    }
    execFile('git', args, { cwd: repoPath, encoding: 'buffer', maxBuffer: 15 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        return reject({ error, stderr, stdout });
      }
      resolve(stdout);
    });
  });
}

// Check if directory is a valid git repository
async function isValidGitRepo(repoPath) {
  try {
    if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
      return false;
    }
    await runGit(['rev-parse', '--is-inside-work-tree'], repoPath);
    return true;
  } catch (err) {
    return false;
  }
}

// 1. Config Endpoint
app.get('/api/config', async (req, res) => {
  const isRepo = await isValidGitRepo(currentRepoPath);
  let currentBranch = '';
  if (isRepo) {
    try {
      currentBranch = (await runGit(['branch', '--show-current'], currentRepoPath)).trim();
      if (!currentBranch) {
        // Detached HEAD or similar
        currentBranch = (await runGit(['rev-parse', '--short', 'HEAD'], currentRepoPath)).trim();
      }
    } catch (e) {
      currentBranch = 'unknown';
    }
  }
  res.json({
    repoPath: currentRepoPath,
    isRepo,
    currentBranch
  });
});

app.post('/api/config', async (req, res) => {
  const { repoPath } = req.body;
  if (!repoPath) {
    return res.status(400).json({ error: 'Repository path is required' });
  }

  const resolvedPath = path.resolve(repoPath);
  const isRepo = await isValidGitRepo(resolvedPath);

  if (isRepo) {
    currentRepoPath = resolvedPath;
    let currentBranch = '';
    try {
      currentBranch = (await runGit(['branch', '--show-current'], currentRepoPath)).trim();
      if (!currentBranch) {
        currentBranch = (await runGit(['rev-parse', '--short', 'HEAD'], currentRepoPath)).trim();
      }
    } catch (e) {
      currentBranch = 'unknown';
    }
    res.json({ success: true, repoPath: currentRepoPath, currentBranch });
  } else {
    res.status(400).json({ error: 'Path is not a valid Git repository' });
  }
});

// 2. References Endpoint (branches and commits)
app.get('/api/refs', async (req, res) => {
  if (!currentRepoPath) {
    return res.status(400).json({ error: 'No repository configured' });
  }

  try {
    // Get local branches only
    const branchesOutput = await runGit(['branch', '--format=%(refname:short)'], currentRepoPath);
    const branches = branchesOutput
      .split('\n')
      .map(b => b.trim())
      .filter(b => b && !b.startsWith('HEAD'));

    // Get tags
    const tagsOutput = await runGit(['tag'], currentRepoPath);
    const tags = tagsOutput.split('\n').map(t => t.trim()).filter(Boolean);

    // Get last 10 commits
    const commitsOutput = await runGit(
      ['log', '-n', '10', '--format=%H|%h|%an|%at|%s'],
      currentRepoPath
    );
    const commits = commitsOutput
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [hash, shortHash, author, timestamp, subject] = line.split('|');
        return {
          hash,
          shortHash,
          author,
          date: new Date(parseInt(timestamp) * 1000).toISOString(),
          subject
        };
      });

    res.json({ branches, tags, commits });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve refs', details: err.stderr || err.message });
  }
});

// Helper to recursively list files in directory, ignoring .git
function getFilesRecursive(dir, baseDir) {
  let files = [];
  try {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      if (item === '.git') continue;
      const fullPath = path.join(dir, item);
      const stat = fs.lstatSync(fullPath);
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        files = files.concat(getFilesRecursive(fullPath, baseDir));
      } else {
        files.push(path.relative(baseDir, fullPath));
      }
    }
  } catch (e) {
    // Ignore folder read errors
  }
  return files;
}

// Helper to parse git name-status output to map
function parseDiffStatusToMap(output, map) {
  const lines = output.split('\n').filter(Boolean);
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length >= 2) {
      const statusCode = parts[0];
      const filePath = parts[1].replace(/^"(.*)"$/, '$1');
      
      let status = 'M';
      let oldPath = null;
      let newPath = filePath;

      if (statusCode.startsWith('A')) {
        status = 'A';
      } else if (statusCode.startsWith('D')) {
        status = 'D';
      } else if (statusCode.startsWith('R')) {
        status = 'R';
        oldPath = parts[1].replace(/^"(.*)"$/, '$1');
        newPath = parts[2].replace(/^"(.*)"$/, '$1');
      }

      map.set(newPath, { status, oldPath });
    }
  }
}

// 3. Diff List Endpoint (Whole Repository Tree + Statuses)
app.get('/api/diff', async (req, res) => {
  const { base, target } = req.query;
  if (!currentRepoPath) {
    return res.status(400).json({ error: 'No repository configured' });
  }
  if (!base || !target) {
    return res.status(400).json({ error: 'Both base and target parameters are required' });
  }

  try {
    const fileMap = new Map(); // path -> { path, status, oldPath, isIgnored, isUntracked }

    // Case A: Comparing base against the Live State (Working Tree)
    if (target === '__live__') {
      // 1. Scan directory recursively (excluding .git and node_modules)
      const allDirFiles = getFilesRecursive(currentRepoPath, currentRepoPath);

      // 2. Get tracked files (using git ls-files)
      const trackedFiles = new Set();
      try {
        const lsFilesOutput = await runGit(['ls-files'], currentRepoPath);
        lsFilesOutput.split('\n').filter(Boolean).forEach(f => trackedFiles.add(f.trim()));
      } catch (err) {
        // ignore ls-files errors
      }

      // 3. Get status of changed files compared to base (M, A, D, R)
      const diffStatusMap = new Map();
      try {
        const diffStatusOutput = await runGit(['diff', '--name-status', base], currentRepoPath);
        parseDiffStatusToMap(diffStatusOutput, diffStatusMap);
      } catch (err) {
        // ignore diff errors
      }

      // 4. Get untracked files from git status --porcelain
      const statusPorcelainMap = new Map();
      try {
        const statusOutput = await runGit(['status', '--porcelain'], currentRepoPath);
        const lines = statusOutput.split('\n').filter(Boolean);
        for (const line of lines) {
          const code = line.substring(0, 2);
          const filePath = line.substring(3).trim().replace(/^"(.*)"$/, '$1');
          statusPorcelainMap.set(filePath, code);
        }
      } catch (err) {
        // ignore status errors
      }

      // 5. Classify every file found in working directory
      for (const filePath of allDirFiles) {
        let status = 'unchanged';
        let oldPath = null;
        let isIgnored = false;
        let isUntracked = false;

        const porcelainCode = statusPorcelainMap.get(filePath);
        const diffInfo = diffStatusMap.get(filePath);

        if (porcelainCode === '??') {
          status = 'A';
          isUntracked = true;
        } else if (diffInfo) {
          status = diffInfo.status;
          oldPath = diffInfo.oldPath;
        } else if (!trackedFiles.has(filePath) && !porcelainCode) {
          // Exists on disk, but not tracked by git and not in status -> Ignored!
          isIgnored = true;
        }

        fileMap.set(filePath, { path: filePath, status, oldPath, isIgnored, isUntracked });
      }

      // Also merge deleted files (which exist in base, but deleted in working tree)
      for (const [filePath, diffInfo] of diffStatusMap.entries()) {
        if (diffInfo.status === 'D' && !fileMap.has(filePath)) {
          fileMap.set(filePath, {
            path: filePath,
            status: 'D',
            oldPath: null,
            isIgnored: false,
            isUntracked: false
          });
        }
      }
    } 
    // Case B: Comparing base ref vs target ref (Committed branches/commits/tags)
    else {
      // 1. Get all files in target ref (using git ls-tree)
      let targetFiles = [];
      try {
        const lsTreeOutput = await runGit(['ls-tree', '-r', '--name-only', target], currentRepoPath);
        targetFiles = lsTreeOutput.split('\n').map(f => f.trim()).filter(Boolean);
      } catch (err) {
        // ignore ls-tree errors
      }

      // 2. Get status of changed files between base and target
      const diffStatusMap = new Map();
      try {
        const diffStatusOutput = await runGit(['diff', '--name-status', base, target], currentRepoPath);
        parseDiffStatusToMap(diffStatusOutput, diffStatusMap);
      } catch (err) {
        return res.status(500).json({ error: `Git diff failed: ${err.stderr || err.message}` });
      }

      // 3. Add all files in target
      for (const filePath of targetFiles) {
        const diffInfo = diffStatusMap.get(filePath);
        const status = diffInfo ? diffInfo.status : 'unchanged';
        const oldPath = diffInfo ? diffInfo.oldPath : null;

        fileMap.set(filePath, {
          path: filePath,
          status,
          oldPath,
          isIgnored: false,
          isUntracked: false
        });
      }

      // Also add deleted files (exist in base, but deleted in target)
      for (const [filePath, diffInfo] of diffStatusMap.entries()) {
        if (diffInfo.status === 'D' && !fileMap.has(filePath)) {
          fileMap.set(filePath, {
            path: filePath,
            status: 'D',
            oldPath: null,
            isIgnored: false,
            isUntracked: false
          });
        }
      }
    }

    res.json({ files: Array.from(fileMap.values()) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve file list', details: err.message });
  }
});

// 4. File Diff Detailed Endpoint
app.get('/api/file-diff', async (req, res) => {
  const { base, target, filePath, oldFilePath, status } = req.query;
  if (!currentRepoPath) {
    return res.status(400).json({ error: 'No repository configured' });
  }
  if (!base || !target || !filePath) {
    return res.status(400).json({ error: 'base, target, and filePath are required' });
  }

  const fileStatus = status || 'M';

  try {
    // Handle Case: Target is Live and file is Untracked (status A)
    if (target === '__live__' && fileStatus === 'A') {
      const fullPath = path.join(currentRepoPath, filePath);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        if (stats.size > 2 * 1024 * 1024) {
          return res.json({ isLarge: true, size: stats.size });
        }
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        const hunkLines = lines.map((line, idx) => ({
          type: 'add',
          oldLine: null,
          newLine: idx + 1,
          content: '+' + line
        }));

        return res.json({
          oldPath: null,
          newPath: filePath,
          hunks: [{
            oldStart: 0,
            oldLines: 0,
            newStart: 1,
            newLines: lines.length,
            header: `@@ -0,0 +1,${lines.length} @@`,
            lines: hunkLines
          }]
        });
      } else {
        return res.status(404).json({ error: `File not found on disk: ${filePath}` });
      }
    }

    // Handle Case: File was deleted (status D) and target is Live
    if (target === '__live__' && fileStatus === 'D') {
      try {
        const content = await runGit(['show', `${base}:${filePath}`], currentRepoPath);
        const lines = content.split('\n');
        const hunkLines = lines.map((line, idx) => ({
          type: 'delete',
          oldLine: idx + 1,
          newLine: null,
          content: '-' + line
        }));

        return res.json({
          oldPath: filePath,
          newPath: null,
          hunks: [{
            oldStart: 1,
            oldLines: lines.length,
            newStart: 0,
            newLines: 0,
            header: `@@ -1,${lines.length} +0,0 @@`,
            lines: hunkLines
          }]
        });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve deleted file content', details: err.stderr || err.message });
      }
    }

    // Run normal git diff for the file
    let diffOutput = '';
    const diffArgs = ['diff', '--no-color'];

    if (req.query.fullContext === 'true') {
      diffArgs.push('-U999999');
    }

    if (target === '__live__') {
      if (oldFilePath && oldFilePath !== filePath) {
        diffArgs.push(base, '--', oldFilePath, filePath);
      } else {
        diffArgs.push(base, '--', filePath);
      }
    } else {
      diffArgs.push(base, target, '--', filePath);
    }

    try {
      diffOutput = await runGit(diffArgs, currentRepoPath);
    } catch (err) {
      // git diff can exit with code 1 if differences exist and we configure it, 
      // but standard node execFile throws on non-zero. Let's check if stdout has content:
      if (err.stdout) {
        diffOutput = err.stdout;
      } else {
        return res.status(500).json({ error: 'Failed to run git diff', details: err.stderr || err.message });
      }
    }

    const parsedDiff = parseRawDiff(diffOutput, filePath, oldFilePath);

    if (parsedDiff.hunks.length === 0 && !parsedDiff.isBinary) {
      try {
        let buffer;
        if (target === '__live__') {
          const fullPath = path.join(currentRepoPath, filePath);
          if (fs.existsSync(fullPath)) {
            buffer = fs.readFileSync(fullPath);
          } else {
            buffer = Buffer.alloc(0);
          }
        } else {
          buffer = await runGitBuffer(['show', `${target}:${filePath}`], currentRepoPath);
        }

        // Check if binary
        const checkLimit = Math.min(buffer.length, 8000);
        let isBinary = false;
        for (let i = 0; i < checkLimit; i++) {
          if (buffer[i] === 0) {
            isBinary = true;
            break;
          }
        }

        if (isBinary) {
          parsedDiff.isBinary = true;
        } else {
          const contentStr = buffer.toString('utf8');
          if (buffer.length > 2 * 1024 * 1024) {
            parsedDiff.isLarge = true;
            parsedDiff.size = buffer.length;
          } else {
            parsedDiff.isUnchangedFile = true;
            parsedDiff.content = contentStr;
          }
        }
      } catch (err) {
        // Fail silently and return empty hunks
      }
    }

    res.json(parsedDiff);
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse file diff', details: err.message });
  }
});

// 4.5 Raw File Serving Endpoint (for images, PDFs, raw markdown/html)
app.get('/api/file-raw', async (req, res) => {
  const { ref, path: filePath } = req.query;
  if (!currentRepoPath) {
    return res.status(400).json({ error: 'No repository configured' });
  }
  if (!filePath) {
    return res.status(400).json({ error: 'path parameter is required' });
  }

  try {
    const fullPath = path.join(currentRepoPath, filePath);
    
    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.html' || ext === '.htm') contentType = 'text/html';
    else if (ext === '.md' || ext === '.markdown') contentType = 'text/markdown';
    else if (ext === '.js') contentType = 'application/javascript';
    else if (ext === '.css') contentType = 'text/css';
    
    res.setHeader('Content-Type', contentType);

    if (ref === '__live__') {
      if (fs.existsSync(fullPath)) {
        return res.sendFile(fullPath);
      } else {
        return res.status(404).send('File not found');
      }
    } else {
      // Fetch binary data via git show
      const buffer = await runGitBuffer(['show', `${ref}:${filePath}`], currentRepoPath);
      return res.send(buffer);
    }
  } catch (err) {
    res.status(500).send(`Failed to load raw file: ${err.message}`);
  }
});

// Helper to parse standard unified diff
function parseRawDiff(diffStr, filePath, oldFilePath) {
  const lines = diffStr.split('\n');
  const result = {
    oldPath: oldFilePath || filePath,
    newPath: filePath,
    hunks: []
  };

  let currentHunk = null;
  let oldLineNum = 0;
  let newLineNum = 0;
  let parsedHeaders = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for binary file message
    if (line.includes('Binary files') && line.includes('differ')) {
      return { ...result, isBinary: true };
    }

    // Match hunk header: @@ -oldStart,oldLength +newStart,newLength @@
    const hunkHeaderMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
    if (hunkHeaderMatch) {
      parsedHeaders = true;
      oldLineNum = parseInt(hunkHeaderMatch[1]);
      newLineNum = parseInt(hunkHeaderMatch[3]);

      currentHunk = {
        oldStart: oldLineNum,
        oldLines: parseInt(hunkHeaderMatch[2] || '1'),
        newStart: newLineNum,
        newLines: parseInt(hunkHeaderMatch[4] || '1'),
        header: hunkHeaderMatch[0],
        lines: []
      };
      result.hunks.push(currentHunk);
      continue;
    }

    if (!parsedHeaders) {
      // Skip the diff header metadata (e.g. index, ---, +++)
      continue;
    }

    if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'add',
          oldLine: null,
          newLine: newLineNum++,
          content: line
        });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'delete',
          oldLine: oldLineNum++,
          newLine: null,
          content: line
        });
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: 'normal',
          oldLine: oldLineNum++,
          newLine: newLineNum++,
          content: line
        });
      } else if (line.startsWith('\\')) {
        currentHunk.lines.push({
          type: 'info',
          oldLine: null,
          newLine: null,
          content: line
        });
      }
    }
  }

  return result;
}

// 5. Blame Endpoint
app.get('/api/blame', async (req, res) => {
  const { path: filePath, ref } = req.query;
  if (!currentRepoPath) {
    return res.status(400).json({ error: 'No repository configured' });
  }
  if (!filePath) {
    return res.status(400).json({ error: 'filePath parameter is required' });
  }

  try {
    let blameOutput = '';
    const blameArgs = ['blame', '--line-porcelain'];
    
    if (ref && ref !== 'Live' && ref !== '__live__') {
      blameArgs.push(ref);
    }
    blameArgs.push('--', filePath);

    try {
      blameOutput = await runGit(blameArgs, currentRepoPath);
    } catch (err) {
      // If git blame fails, it could be an untracked file or new repository
      // Let's check if the file exists locally and fallback to mock blame
      const fullPath = path.join(currentRepoPath, filePath);
      if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        // Handle trailing empty line
        if (lines.length > 1 && lines[lines.length - 1] === '') {
          lines.pop();
        }
        
        const mockBlame = lines.map((line, idx) => ({
          commit: '0000000000000000000000000000000000000000',
          sourceLine: idx + 1,
          resultLine: idx + 1,
          groupCount: 1,
          author: 'Not Committed Yet',
          authorTime: Math.floor(Date.now() / 1000),
          summary: 'Local uncommitted changes',
          content: line
        }));
        return res.json(mockBlame);
      }
      return res.status(500).json({ error: 'Failed to run git blame', details: err.stderr || err.message });
    }

    // Parse porcelain blame output
    const blameLines = [];
    const lines = blameOutput.split('\n');
    let currentLine = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line && i === lines.length - 1) break; // trailing newline

      if (currentLine === null) {
        const parts = line.split(' ');
        if (parts.length >= 3 && parts[0].length === 40) {
          currentLine = {
            commit: parts[0],
            sourceLine: parseInt(parts[1]),
            resultLine: parseInt(parts[2]),
            groupCount: parts[3] ? parseInt(parts[3]) : 1,
            author: '',
            authorTime: 0,
            summary: '',
            content: ''
          };
        }
      } else if (line.startsWith('\t')) {
        currentLine.content = line.substring(1);
        blameLines.push(currentLine);
        currentLine = null;
      } else {
        const spaceIndex = line.indexOf(' ');
        if (spaceIndex !== -1) {
          const key = line.substring(0, spaceIndex);
          const val = line.substring(spaceIndex + 1);
          if (key === 'author') currentLine.author = val;
          else if (key === 'author-time') currentLine.authorTime = parseInt(val);
          else if (key === 'summary') currentLine.summary = val;
        }
      }
    }

    res.json(blameLines);
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse blame data', details: err.message });
  }
});

// Helper to parse gitignore globs to regexes
function parseGitignore(repoPath) {
  const rules = [];
  
  const gitignorePath = path.join(repoPath, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    try {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .forEach(rule => {
          // Convert gitignore globs to regexes
          let regexStr = rule
            .replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&') // escape all except *
            .replace(/\*/g, '.*'); // convert * to .*
            
          // Handle directories
          if (rule.endsWith('/')) {
            regexStr = regexStr + '?.*';
          } else {
            regexStr = regexStr + '($|/.*)';
          }
          
          // Handle leading slash (match from root)
          if (rule.startsWith('/')) {
            regexStr = '^' + regexStr.substring(1);
          } else {
            regexStr = '(^|/)' + regexStr;
          }
          
          try {
            rules.push(new RegExp(regexStr));
          } catch (e) {
            // skip invalid regexes
          }
        });
    } catch (e) {
      // ignore read errors
    }
  }

  return (filePath) => {
    const relPath = path.relative(repoPath, filePath).replace(/\\/g, '/');
    if (!relPath) return false;
    return rules.some(regex => regex.test(relPath));
  };
}

// Helper for check-ignore
function isIgnoredByGit(filePath, repoPath) {
  return new Promise((resolve) => {
    // git check-ignore exits with 0 if ignored, 1 if not ignored
    execFile('git', ['check-ignore', '-q', filePath], { cwd: repoPath }, (error) => {
      resolve(!error); // if no error, exit code is 0 -> file is ignored
    });
  });
}

// 6. SSE Watcher Endpoint
app.get('/api/watch', (req, res) => {
  if (!currentRepoPath) {
    return res.status(400).json({ error: 'No repository configured' });
  }

  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Initialize gitignore matcher
  let gitignoreMatcher = parseGitignore(currentRepoPath);

  // Initialize chokidar watcher using parsed gitignore rules
  const watcher = chokidar.watch(currentRepoPath, {
    ignored: (filePath) => {
      // Always ignore .git directory
      const rel = path.relative(currentRepoPath, filePath);
      if (rel.split(path.sep).includes('.git')) return true;
      return gitignoreMatcher(filePath);
    },
    persistent: true,
    ignoreInitial: true,
    followSymlinks: false
  });

  const sendFileChange = async (event, filePath) => {
    const relativePath = path.relative(currentRepoPath, filePath);
    
    // If gitignore changes, rebuild the matcher
    if (relativePath === '.gitignore') {
      gitignoreMatcher = parseGitignore(currentRepoPath);
    }
    
    // Check if git ignores this file
    const ignored = await isIgnoredByGit(relativePath, currentRepoPath);
    console.log(`[Watcher] ${event} on ${relativePath} (ignored: ${ignored})`);
    if (!ignored) {
      res.write(`data: ${JSON.stringify({ event, path: relativePath })}\n\n`);
    }
  };

  watcher.on('add', (filePath) => sendFileChange('add', filePath));
  watcher.on('change', (filePath) => sendFileChange('change', filePath));
  watcher.on('unlink', (filePath) => sendFileChange('unlink', filePath));

  req.on('close', () => {
    clearInterval(heartbeat);
    watcher.close();
  });
});

app.listen(PORT, () => {
  console.log(`diff++ running on http://localhost:${PORT}`);
});
