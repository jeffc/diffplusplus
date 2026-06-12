# diff++ (Git Diff & Blame Studio)

A sleek, premium local web application designed to show per-file diffs and detailed blame histories for any local Git repository. Point the tool at your repository, compare branches, commits, or your active live workspace, and view real-time updates as you edit files.

---

## Key Features

- **Point-and-Explore Repo Loader**: Run the server once and point the UI to any directory on your local machine. If it is a valid Git repository, it loads instantly.
- **Versatile Comparisons**: Compare any two git references—branches, tags, commits, or the active **Live State (Working Tree)**.
- **Real-Time Workspace Watcher**: When comparing against the Live State, the app watches your files (respecting `.gitignore` exclusions) and automatically reloads the diff list and editor views when modifications are saved, while suppressing startup notification toasts on load.
- **Dual Diff Formats**: Toggle between a **Unified** (single-column inline) diff and a premium **Split** (side-by-side) diff.
- **Git Blame Mode**: Hides diff annotations to show a line-by-line file blame. Groups consecutive lines written in the same commit to span a single metadata block. Commits are mapped to a hand-curated palette of 16 highly distinct, premium HSL colors for clear visual separation, with full commit details available on hover.
- **Repository Tree Sidebar**: Shows the full directory structure of your project by default. Features a compact, dense design for high scalability. Unchanged files are visible but clean; modified files highlight in status colors; untracked files are marked in green; and ignored files are deemphasized (reduced opacity/italicized).
- **Inline Expandable Diffs**: Click the chevron icon next to any file in the directory tree to expand the file's diff inline in the sidebar without losing your current main panel view.
- **Only Changes Filter**: Easily toggle a filter switch to show only files containing changes.
- **Full File Context Toggle**: Toggle the **Full File** button in the toolbar to load the entire file, displaying diff blocks in place inside their full surrounding context.
- **Binary File Confirmation**: Requires explicit confirmation before rendering binary files in both detailed and inline views, preventing unwanted rendering performance hits.
- **Dynamic Gitignore Watcher**: Reads and parses the repository's `.gitignore` file dynamically at runtime, using compiled rules to ignore files synchronously in the filesystem watcher (preventing overhead on ignored folders).
- **URL State Tracking**: Synchronizes state variables (`repoPath`, `base`, `target`, `file`, `mode`, `layout`, `fullContext`) dynamically with the browser's URL search parameters, preserving the exact workspace layout and selection across page refreshes.
- **Studio Aesthetics**: Premium dark theme powered by a custom CSS variables design system, glassmorphic header blur, smooth transitions, and pulse animations.

---

## Technical Stack

- **Backend**: Node.js + Express
- **File Watching**: Chokidar + dynamic runtime `.gitignore` matcher
- **Real-Time Communication**: Server-Sent Events (SSE) for automatic push updates
- **Frontend**: HTML5 + Vanilla CSS + Vanilla JS (Lucide Icons, Google Fonts)
- **Zero Build Step**: Pure HTML/JS/CSS served statically from the backend for fast startup and minimal dependency bloat.

---

## Installation & Running

### 1. Install Dependencies
Clone or download the project and run:
```bash
npm install
```

### 2. Start the Server
Run the startup script:
```bash
npm start
```
The application will boot up at **`http://localhost:3000`**.

---

## User Manual

### 1. Load a Repository
1. Open your browser and navigate to `http://localhost:3000`.
2. In the top-left input box, enter the absolute path to your local Git repository (e.g. `/home/user/code/my-project`).
3. Click the **Arrow Button** (or press **Enter**).
4. The status badge will change to a green **VALID REPO** state, and the comparison selectors will populate.

### 2. Configure Your Comparison
- **Base Selection**: Select your starting ref from the dropdown (contains `HEAD`, local branches only, tags, and the last 10 commits). Defaults to **`HEAD`**.
- **Target Selection**: Select your target ref from the dropdown (contains `Live (Working Tree)`, `HEAD`, local branches, tags, and the last 10 commits). Defaults to **`Live (Working Tree)`**.
- **Manual Custom Ref Entry**: For either Base or Target, choose **Custom Ref...** at the bottom of the list. The select dropdown will transition into a text input field where you can enter any arbitrary git reference (such as commit hashes, branches, tags, or expressions like `HEAD~3`). Click the list icon next to the input field to return to the dropdown list.
- *Note: If Live is selected, the green "LIVE WATCH" blinking indicator is active, indicating file modifications are actively tracked.*

### 3. Filter and Browse Files
- **Full Repository Tree**: By default, the sidebar shows the complete directory tree of the repository in a dense, scannable layout. Folders containing modifications or untracked files are expanded by default and marked with a change indicator dot.
- **Only Changes Filter**: Toggle the "Only Changes" switch to collapse the tree and show only modified, added, renamed, or untracked files.
- **Color-Coded Statuses & Ignored Files**:
  - **Modified (M)**, **Added (A)**, **Deleted (D)**, and **Renamed (R)** files are highlighted in their respective status colors.
  - **Untracked files** are marked in light green with a `?` badge.
  - **Ignored files** (matched by `.gitignore`) are displayed with reduced opacity, italicized, and marked with an `I` badge.
- Use the **Filter files...** input in the sidebar to search for specific filenames or folder paths.
- Click a file to open the detailed file view.
- Click the **Chevron Icon** (`>`) on the right of any file list item to expand the diff inline in the sidebar without losing your current main panel view.

### 4. Diff Layout & Context Modes
In the top-right toolbar of the main panel:
- Click **Unified** to see edits inline with traditional red-deletion and green-addition lines.
- Click **Split** to see the original file version side-by-side with the modified version. Deleted lines will align horizontally with added lines, and unmodified/normal context is aligned line-by-line.
- Click **Full File** to show the entire file contents. The diff hunks are rendered in place within the rest of the unmodified file contents.
- **Binary Files**: Opening a binary file will display a prompt asking for confirmation before loading. Click "Confirm and Render" to display its status/metadata.

### 5. Inspect Line Blames
1. Open a file in the detailed workspace panel.
2. In the top-right toolbar, click the **Blame** button.
3. The diff highlights will vanish, and the file will render with line numbers and a left metadata column:
   - **Commit SHA**: Clickable hash referencing the source commit.
   - **Author**: The author who wrote that line.
   - **Date**: Date of modification.
   - **Commit Color Stripe**: A color-coded vertical bar grouping lines written in the same commit.
4. **Hover** over any meta card in the left column to view the full commit hash, author name, timestamp, and the complete commit summary message in a custom tooltip.
