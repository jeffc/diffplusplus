# diff++ (Code Browser and Git Diff/Blame Tool)

> [!WARNING]
> This tool was **100% vibe coded**, including this readme (though I did update
> the readme to make it a little less obnoxious). I made this tool in an
> afternoon because it was useful to me, and I published it because it might be
> useful to you. The application is strictly read-only, so you won't damage your
> repositories by using it, but I can't promise you won't encounter some
> frustrating bug that wastes your time.

A local web application designed to show per-file diffs and detailed blame
histories for any local Git repository. Point the tool at your repository,
compare branches, commits, or your active live workspace, and view real-time
updates as you edit files.

---

## Key Features

- **Point-and-Explore Repo Loader**: Run the server once and point the UI to any directory on your local machine. If it is a valid Git repository, it loads instantly.
- **Versatile Comparisons**: Compare any two git references—branches, tags, commits, or the active **Live State (Working Tree)**.
- **Real-Time Workspace Watcher**: When comparing against the Live State, the app watches your files (respecting `.gitignore` exclusions) and automatically reloads the diff list and editor views when modifications are saved, while suppressing startup notification toasts on load.
- **Visual Commit Graph (DAG)**: An interactive SVG-rendered graph of the commit log (`git log --graph`) displayed on the dashboard home screen. Features color-coded branches/merges and clickable commit node dots to instantly pick base/target comparison references.
- **File History Explorer**: A dedicated "History" tab in the main panel toolbar to browse a file-specific commit log, with one-click actions to view full content at that commit or inspect the diff introduced by it.
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
- **100% Read-Only Safety**: The tool is strictly read-only on the repositories it touches, ensuring no risk to your working tree or commit history.

---

## Technical Stack

- **Backend**: Node.js + Express
- **File Watching**: Chokidar + dynamic runtime `.gitignore` matcher
- **Real-Time Communication**: Server-Sent Events (SSE) for automatic push updates
- **Frontend**: HTML5 + Vanilla CSS + Vanilla JS (Lucide Icons, Google Fonts)
- **Zero Build Step**: Pure HTML/JS/CSS served statically from the backend for fast startup and minimal dependency bloat.

---

## Installation & Running

### Prerequisites

Make sure you have the following installed on your machine:

- **Node.js** (v14 or higher recommended)
- **Git** CLI (installed and available in your system's PATH)
- Or **Docker** (if running via container)

### Local Setup

#### 1. Install Dependencies

Clone or download the project and run the following command in the project directory:

```bash
npm install
```

#### 2. Start the Server

Run the startup script:

```bash
npm start
```

The application will boot up at **`http://localhost:3000`**. Open this URL in your web browser.

---

### Docker Setup (Alternative)

You can run the application containerized. This is useful to avoid installing Node.js locally.

#### 1. Build the Docker Image

In the project directory, run:

```bash
docker build -t diff-viewer .
```

#### 2. Start the Container

Start the container and mount the local Git repository you want to inspect. Map port `3000` and mount your repository directory to `/repo` inside the container:

```bash
docker run -d --name diff-viewer -p 3000:3000 -v /path/to/your/local/git-repo:/repo diff-viewer
```

#### 3. Access the Application

Open your web browser and navigate to **`http://localhost:3000`**. In the repository loader input box, type `/repo` and press **Enter** to inspect the mounted repository.



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
- _Note: If Live is selected, the green "LIVE WATCH" blinking indicator is active, indicating file modifications are actively tracked._

### 3. Repository Homepage & Visual Commit Graph (DAG)

- **Accessing the Homepage**: When you first load a repository, or anytime you click the **diff++** logo in the top-left header, the main panel displays a rich repository summary dashboard.
- **Workspace Summary**: The dashboard provides real-time counts of modified files, untracked files, local branches, and tags. It also lists all modified files in a central scrollable list for quick access.
- **Visual Commit Graph**: On the left side of the dashboard, an interactive SVG-styled DAG (Directed Acyclic Graph) of the Git commit log (`git log --graph`) is drawn.
    - The branches, merges, and commit relationships are color-coded dynamically.
    - **Interactivity**: Click on any commit node dot or commit SHA in the graph to set that commit as either the Base or Target reference instantly.

### 4. Filter and Browse Files

- **Full Repository Tree**: By default, the sidebar shows the complete directory tree of the repository in a dense, scannable layout. Folders containing modifications or untracked files are expanded by default and marked with a change indicator dot.
- **Only Changes Filter**: Toggle the "Only Changes" switch to collapse the tree and show only modified, added, renamed, or untracked files.
- **Color-Coded Statuses & Ignored Files**:
    - **Modified (M)**, **Added (A)**, **Deleted (D)**, and **Renamed (R)** files are highlighted in their respective status colors.
    - **Untracked files** are marked in light blue with a `?` badge.
    - **Ignored files** (matched by `.gitignore`) are hidden from the tree.
- Use the **Filter files...** input in the sidebar to search for specific filenames or folder paths.
- Click a file to open the detailed file view.

### 5. Diff Layout & Context Modes

In the top-right toolbar of the main panel:

- Click **Unified** to see edits inline with traditional red-deletion and green-addition lines.
- Click **Split** to see the original file version side-by-side with the modified version. Deleted lines will align horizontally with added lines, and unmodified/normal context is aligned line-by-line.
- Click **Full File** to show the entire file contents. The diff hunks are rendered in place within the rest of the unmodified file contents.
- **Binary Files**: Opening a binary file will display a prompt asking for confirmation before loading. Click "Confirm and Render" to display its status/metadata.

### 6. Inspect Line Blames

1. Open a file in the detailed workspace panel.
2. In the top-right toolbar, click the **Blame** button.
3. The diff highlights will vanish, and the file will render with line numbers and a left metadata column:
    - **Commit SHA**: Clickable hash referencing the source commit.
    - **Author**: The author who wrote that line.
    - **Date**: Date of modification.
    - **Commit Color Stripe**: A color-coded vertical bar grouping lines written in the same commit.
4. **Hover** over any meta card in the left column to view the full commit hash, author name, timestamp, and the complete commit summary message in a custom tooltip.

### 7. File History Explorer

- **Accessing History**: Open any file in the main panel, then click the **History** tab in the toolbar.
- **Commit Log**: This displays a full, dedicated history log (`git log --follow`) of all commits that have modified the open file.
- **Historical Actions**:
    - **View Content**: Click this button on any commit in the list to load and view the complete file content at that point in history.
    - **View Diff**: Click this button to compare that commit against its parent (`commit~1`), highlighting the exact changes introduced by that commit in this file.


