import {
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  Show
} from "solid-js";
import Fuse from "fuse.js";
import { Events } from "@wailsio/runtime";
import {
  GetClipData,
  GetNotes,
  ToggleClipSecret,
  ClearClipboard
} from "./bindings/rilaunch/app";

import SearchBar from "./components/SearchBar";
import ClipboardView from "./components/ClipboardView";
import NotesView from "./components/NotesView";
import SettingsView from "./components/SettingsView";
import StatusBar from "./components/StatusBar";
import {
  IconApps,
  IconClipboard,
  IconTerminal,
  IconNotes,
  IconSettings,
  IconRefresh,
  IconTrash,
  IconClear,
  IconHistory,
  IconFolder,
  IconSettingsSmall
} from "./components/Icons";
import "./App.css";

// ── Shell history helpers ─────────────────────────────────────────────────────

const SHELL_HISTORY_KEY = "rilaunch_shell_history";

function loadShellHistory() {
  try {
    return JSON.parse(localStorage.getItem(SHELL_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveShellHistoryItem(cmd) {
  const hist = loadShellHistory().filter((h) => h !== cmd);
  hist.unshift(cmd);
  localStorage.setItem(SHELL_HISTORY_KEY, JSON.stringify(hist.slice(0, 50)));
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const TABS = ["clipboard", "notes"];

  const [activeTab, setActiveTab] = createSignal("clipboard");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [clipboardData, setClipboardData] = createSignal([]);
  const [clipboardSelectedIndex, setClipboardSelectedIndex] = createSignal(0);
  const [notesList, setNotesList] = createSignal([]);
  const [showSettings, setShowSettings] = createSignal(false);
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [statusMsg, setStatusMsg] = createSignal("");
  const [statusColor, setStatusColor] = createSignal("info");

  let statusTimer;
  let searchInputRef;
  let clipboardLoadId = 0;
  let notesLoadId = 0;

  const showStatus = (msg, type = "info") => {
    clearTimeout(statusTimer);
    setStatusMsg(msg);
    setStatusColor(type);
    statusTimer = setTimeout(() => setStatusMsg(""), 2500);
  };

  const filteredClipboardData = createMemo(() => {
    const term = searchQuery().toLowerCase();
    if (!term) return clipboardData();
    return clipboardData().filter((item) =>
      (item.content || item.text || "").toLowerCase().includes(term)
    );
  });

  const filteredNotes = createMemo(() => {
    const term = searchQuery().toLowerCase();
    if (!term) return notesList();
    return notesList().filter(
      (n) =>
        n.content.toLowerCase().includes(term) ||
        n.tag.toLowerCase().includes(term)
    );
  });

  const shellSuggestion = createMemo(() => {
    if (activeTab() !== "shell") return "";
    const q = searchQuery().trim();
    if (!q) return "";
    return (
      shellHistory().find((h) => h.toLowerCase().startsWith(q.toLowerCase())) ||
      ""
    );
  });

  // ── Search bar config per tab ─────────────────────────────────────────────
  const searchPlaceholder = () => {
    switch (activeTab()) {
      case "clipboard":
        return "Filter clipboard...";
      case "notes":
        return "Search notes...";
      default:
        return "Search...";
    }
  };

  // ── Tab switching ─────────────────────────────────────────────────────────
  const switchTab = (tab) => {
    const sameTab = activeTab() === tab;

    setShowSettings(false);
    setIsMenuOpen(false);

    if (!sameTab) {
      setActiveTab(tab);
      setSearchQuery("");
      setSelectedIndex(0);
      setClipboardSelectedIndex(0);
      setShellHistoryIndex(-1);
    }

    if (tab === "clipboard") queueMicrotask(() => void loadClipboardData());
    if (tab === "notes") queueMicrotask(() => void loadNotes());

    setTimeout(() => {
      searchInputRef?.focus();
    }, 30);
  };

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadClipboardData = async () => {
    const requestId = ++clipboardLoadId;
    try {
      const raw = await GetClipData("");
      if (requestId !== clipboardLoadId) return;
      setClipboardData(JSON.parse(raw || "[]"));
    } catch (e) {
      console.error("Failed to load clipboard:", e);
    }
  };

  const loadNotes = async () => {
    const requestId = ++notesLoadId;
    try {
      const raw = await GetNotes();
      if (requestId !== notesLoadId) return;
      setNotesList(JSON.parse(raw || "[]"));
    } catch (e) {
      console.error("Failed to load notes:", e);
    }
  };

  const handleClipboardItemClick = (item) => {
    navigator.clipboard.writeText(item.content || item.text || "");
    WindowHide();
  };

  const handleToggleSecret = async (item) => {
    try {
      await ToggleClipSecret(item.hash);
      setClipboardData((prev) =>
        prev.map((x) =>
          x.hash === item.hash ? { ...x, is_secret: !x.is_secret } : x
        )
      );
    } catch (e) {
      console.error("Failed to toggle secret:", e);
    }
  };

  const handleClearClipboard = async () => {
    if (confirm("Are you sure you want to clear all clipboard items?")) {
      try {
        await ClearClipboard();
        setClipboardData([]);
        showStatus("Clipboard cleared", "success");
      } catch (e) {
        console.error(e);
        showStatus("Failed to clear clipboard", "error");
      }
    }
  };

  const handleClearConsole = () => {
    setCommandOutput("");
    showStatus("Console cleared", "success");
  };

  const handleReloadNotes = async () => {
    void loadNotes();
    showStatus("Notes reloaded", "success");
  };

  const handleSaveNote = async (content, tag) => {
    try {
      await SaveNote(content, tag);
      await loadNotes();
      showStatus("Note saved", "success");
    } catch (e) {
      console.error(e);
      showStatus("Failed to save", "error");
    }
  };

  const handleDeleteNote = async (id) => {
    try {
      await DeleteNote(id);
      await loadNotes();
      showStatus("Note deleted", "success");
    } catch (e) {
      console.error(e);
      showStatus("Failed to delete", "error");
    }
  };

  const handleUpdateNote = async (id, content, tag) => {
    try {
      await UpdateNote(id, content, tag);
      await loadNotes();
      showStatus("Note updated", "success");
    } catch (e) {
      console.error(e);
      showStatus("Failed to update", "error");
    }
  };

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = async (e) => {
    // Escape: clear query or quit
    if (e.key === "Escape") {
      if (searchQuery() !== "") {
        setSearchQuery("");
        return;
      }
      Quit();
      return;
    }

    // Ctrl+Tab / Ctrl+Shift+Tab: cycle tabs
    if ((e.ctrlKey || e.metaKey) && e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();

      const cur = TABS.indexOf(activeTab());
      const next = e.shiftKey
        ? (cur - 1 + TABS.length) % TABS.length
        : (cur + 1) % TABS.length;

      switchTab(TABS[next]);
      return;
    }

    // Ctrl/Cmd + 1..4: direct switch
    if ((e.metaKey || e.ctrlKey) && ["1", "2", "3", "4"].includes(e.key)) {
      e.preventDefault();
      switchTab(TABS[parseInt(e.key, 10) - 1]);
      return;
    }

    // Shell tab: Enter executes, ↑↓ navigates history
    if (activeTab() === "shell") {
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = searchQuery().trim();
        if (!cmd || isExecuting()) return;

        setSearchQuery("");
        void handleCommandExecute(cmd);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const hist = shellHistory();
        if (!hist.length) return;
        const next = Math.min(shellHistoryIndex() + 1, hist.length - 1);
        setSearchQuery(hist[next]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const hist = shellHistory();
        if (!hist.length) return;
        const next = Math.max(shellHistoryIndex() - 1, 0);
        setSearchQuery(hist[next]);
      } else if (e.key === "ArrowRight") {
        if (
          searchInputRef &&
          searchInputRef.selectionEnd === (searchInputRef.value || "").length
        ) {
          e.preventDefault();
          setSearchQuery(sug);
        }
      }
      return;
    }

    // Notes tab: no keyboard nav
    if (activeTab() === "notes") return;

    // Clipboard tab
    if (activeTab() === "clipboard") {
      const data = filteredClipboardData();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setClipboardSelectedIndex((i) => (i + 1) % Math.max(data.length, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setClipboardSelectedIndex((i) => (i === 0 ? data.length - 1 : i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = data[clipboardSelectedIndex()];
        if (item) {
          navigator.clipboard.writeText(item.content || item.text || "");
          WindowHide();
        }
      }
      return;
    }

    // ── Effects ───────────────────────────────────────────────────────────────
    createEffect(() => {
      searchQuery();
      setSelectedIndex(0);
      setClipboardSelectedIndex(0);
    });

    onMount(() => {
      document.addEventListener("keydown", handleKeyDown, true);
      Events.On("Backend:GlobalHotkeyEvent", () => WindowShow());
      Events.On("ClipboardUpdated", () => {
        if (activeTab() === "clipboard") void loadClipboardData();
      });
      window.addEventListener("launcher:show", () => {
        requestAnimationFrame(() => {
          document.body.classList.add("visible");
        });
      });
      searchInputRef?.focus();
    });

    onCleanup(() => {
      document.removeEventListener("keydown", handleKeyDown, true);
      clearTimeout(statusTimer);
    });

    // ── Render ────────────────────────────────────────────────────────────────
    return (
      <div class="app" onClick={() => setIsMenuOpen(false)}>
        <div class="main-container">
          <div class="search-section">
            <SearchBar
              ref={searchInputRef}
              value={searchQuery()}
              onInput={setSearchQuery}
              placeholder={searchPlaceholder()}
              isShellMode={activeTab() === "shell"}
              suggestion={shellSuggestion()}
              onMenuClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen((o) => !o);
              }}
            />

            <Show when={isMenuOpen() && !showSettings()}>
              <div
                class="plugin-menu-panel floating-menu"
                onClick={(e) => e.stopPropagation()}
              >
                <span class="plugin-menu-title">
                  {activeTab() === "clipboard" && "Clipboard"}
                  {activeTab() === "notes" && "Notes"}
                </span>

                <div class="menu-list">
                  <Show when={activeTab() === "clipboard"}>
                    <button
                      class="menu-item danger"
                      onClick={() => {
                        setIsMenuOpen(false);
                        void handleClearClipboard();
                      }}
                    >
                      <IconTrash />
                      <span>Clear All</span>
                    </button>
                  </Show>

                  <Show when={activeTab() === "shell"}>
                    <button
                      class="menu-item"
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleClearConsole();
                      }}
                    >
                      <IconClear />
                      <span>Clear Console</span>
                    </button>
                    <button class="menu-item disabled">
                      <IconHistory />
                      <span>History Limit</span>
                    </button>
                  </Show>

                  <Show when={activeTab() === "notes"}>
                    <button
                      class="menu-item"
                      onClick={() => {
                        setIsMenuOpen(false);
                        void handleReloadNotes();
                      }}
                    >
                      <IconRefresh />
                      <span>Reload Notes</span>
                    </button>
                    <button class="menu-item disabled">
                      <IconFolder />
                      <span>Change Folder</span>
                    </button>
                  </Show>
                </div>
              </div>
            </Show>
          </div>

          <div class="body-section">
            <div class="sidebar">
              <button
                class={
                  "tab-btn" +
                  (activeTab() === "clipboard" && !showSettings()
                    ? " active"
                    : "")
                }
                onClick={() => switchTab("clipboard")}
                title="Clipboard Ctrl+2"
              >
                <IconClipboard />
              </button>

              <button
                class={
                  "tab-btn" +
                  (activeTab() === "notes" && !showSettings() ? " active" : "")
                }
                onClick={() => switchTab("notes")}
                title="Notes Ctrl+3"
              >
                <IconNotes />
              </button>

              <div class="sidebar-spacer" />

              <button
                class={
                  "tab-btn settings-btn" + (showSettings() ? " active" : "")
                }
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowSettings((s) => !s);
                  setTimeout(() => searchInputRef?.focus(), 30);
                }}
                title="Settings"
              >
                <IconSettings />
              </button>
            </div>

            <div class="content-panel">
              <Show when={showSettings()}>
                <SettingsView onClose={() => setShowSettings(false)} />
              </Show>

              <Show when={!showSettings() && activeTab() === "clipboard"}>
                <ClipboardView
                  clipboardData={clipboardData()}
                  filteredClipboardData={filteredClipboardData()}
                  clipboardSelectedIndex={clipboardSelectedIndex()}
                  onItemClick={handleClipboardItemClick}
                  onToggleSecret={handleToggleSecret}
                />
              </Show>

              <Show when={!showSettings() && activeTab() === "notes"}>
                <NotesView
                  notes={filteredNotes()}
                  onSave={handleSaveNote}
                  onUpdate={handleUpdateNote}
                  onDelete={handleDeleteNote}
                  onReload={loadNotes}
                />
              </Show>
            </div>
          </div>

          <StatusBar
            activeTab={showSettings() ? "settings" : activeTab()}
            statusMsg={statusMsg()}
            statusColor={statusColor()}
          />
        </div>
      </div>
    );
  };
}

export default App;
