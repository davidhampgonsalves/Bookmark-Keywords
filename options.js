const STORAGE_KEY = "selectedBookmarkIds";
const treeContainer = document.getElementById("bookmark-tree");
const emptyMessage = document.getElementById("empty-message");

let selectedIds = new Set();

async function loadSelectedIds() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  selectedIds = new Set(result[STORAGE_KEY] || []);
}

async function saveSelectedIds() {
  await chrome.storage.sync.set({ [STORAGE_KEY]: [...selectedIds] });
}

function createFolderNode(node, startExpanded) {
  const details = document.createElement("details");
  if (startExpanded) details.open = true;

  const summary = document.createElement("summary");
  summary.className = "folder";
  summary.textContent = node.title || "Bookmarks";
  details.appendChild(summary);

  const children = document.createElement("div");
  children.className = "folder-children";

  for (const child of node.children || []) {
    if (child.children) {
      children.appendChild(createFolderNode(child, false));
    } else if (child.url) {
      children.appendChild(createBookmarkNode(child));
    }
  }

  details.appendChild(children);
  return details;
}

function createBookmarkNode(node) {
  const label = document.createElement("label");
  label.className = "bookmark";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = selectedIds.has(node.id);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selectedIds.add(node.id);
    } else {
      selectedIds.delete(node.id);
    }
    saveSelectedIds();
  });

  const title = document.createElement("span");
  title.className = "bookmark-title";
  title.textContent = node.title || "(untitled)";

  const url = document.createElement("span");
  url.className = "bookmark-url";
  url.textContent = node.url;

  label.appendChild(checkbox);
  label.appendChild(title);
  label.appendChild(url);
  return label;
}

function cleanStaleIds(tree) {
  const validIds = new Set();

  function collectIds(nodes) {
    for (const node of nodes) {
      if (node.url) validIds.add(node.id);
      if (node.children) collectIds(node.children);
    }
  }

  collectIds(tree);

  let changed = false;
  for (const id of selectedIds) {
    if (!validIds.has(id)) {
      selectedIds.delete(id);
      changed = true;
    }
  }

  if (changed) saveSelectedIds();
}

function isBookmarksBar(node) {
  return node.id === "1";
}

function hasBookmarks(node) {
  if (node.url) return true;
  if (!node.children) return false;
  return node.children.some(hasBookmarks);
}

async function render() {
  await loadSelectedIds();

  const tree = await chrome.bookmarks.getTree();
  const roots = tree[0].children || [];

  cleanStaleIds(tree);

  treeContainer.innerHTML = "";
  let hasAny = false;

  for (const root of roots) {
    if (!hasBookmarks(root)) continue;
    hasAny = true;
    treeContainer.appendChild(createFolderNode(root, isBookmarksBar(root)));
  }

  emptyMessage.hidden = hasAny;
}

render();
