const STORAGE_KEY = "selectedBookmarkIds";
const MAX_SUGGESTIONS = 6;

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightMatch(title, query) {
  if (!query) return escapeXml(title);
  const idx = title.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeXml(title);
  const before = escapeXml(title.slice(0, idx));
  const match = escapeXml(title.slice(idx, idx + query.length));
  const after = escapeXml(title.slice(idx + query.length));
  return `${before}<match>${match}</match>${after}`;
}

async function getSelectedBookmarks() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const ids = result[STORAGE_KEY] || [];
  if (ids.length === 0) return [];

  const bookmarks = [];
  for (const id of ids) {
    try {
      const [bm] = await chrome.bookmarks.get(id);
      if (bm && bm.url) bookmarks.push(bm);
    } catch {
      // bookmark was deleted, skip
    }
  }
  return bookmarks;
}

function filterBookmarks(bookmarks, query) {
  if (!query) return bookmarks.slice(0, MAX_SUGGESTIONS);
  const lower = query.toLowerCase();
  return bookmarks
    .filter((bm) => bm.title.toLowerCase().includes(lower))
    .slice(0, MAX_SUGGESTIONS);
}

chrome.omnibox.setDefaultSuggestion({
  description: "Type to search bookmark keywords",
});

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const bookmarks = await getSelectedBookmarks();
  const matches = filterBookmarks(bookmarks, text);

  const suggestions = matches.map((bm) => ({
    content: bm.url,
    description: `${highlightMatch(bm.title, text)} <dim>- ${escapeXml(bm.url)}</dim>`,
  }));

  suggest(suggestions);
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  let url = text;

  if (!/^https?:\/\//.test(text)) {
    const bookmarks = await getSelectedBookmarks();
    const matches = filterBookmarks(bookmarks, text);
    if (matches.length > 0) {
      url = matches[0].url;
    } else {
      return;
    }
  }

  switch (disposition) {
    case "currentTab":
      chrome.tabs.update({ url });
      break;
    case "newForegroundTab":
      chrome.tabs.create({ url, active: true });
      break;
    case "newBackgroundTab":
      chrome.tabs.create({ url, active: false });
      break;
  }
});
