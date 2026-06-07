import { createSignal, createEffect, createMemo, onMount, onCleanup, Show } from 'solid-js';
import Fuse from 'fuse.js';
import { GetClipData, GetAllApps, LaunchApp, ExecuteCommand, GetNotes, SaveNote, DeleteNote, UpdateNote, ToggleClipSecret, ClearClipboard } from '../wailsjs/go/main/App';
import { EventsOn, WindowHide, WindowShow, Quit } from '../wailsjs/runtime/runtime';
import SearchBar from './components/SearchBar';
import ClipboardView from './components/ClipboardView';
import ApplicationView from './components/ApplicationView';
import CommandExecutor from './components/CommandExecutor';
import NotesView from './components/NotesView';
import SettingsView from './components/SettingsView';
import StatusBar from './components/StatusBar';
import './App.css';

// ── Flat SVG icons ────────────────────────────────────────────────────────────

const IconApps = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
    <rect x="1"   y="1"   width="5.5" height="5.5" rx="1.2"/>
    <rect x="8.5" y="1"   width="5.5" height="5.5" rx="1.2"/>
    <rect x="1"   y="8.5" width="5.5" height="5.5" rx="1.2"/>
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2"/>
  </svg>
);

const IconClipboard = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3.5" y="2" width="8" height="11.5" rx="1.2"/>
    <path d="M5.5 2V3a1 1 0 001 1h2a1 1 0 001-1V2"/>
  </svg>
);

const IconTerminal = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="2.5,4.5 6.5,7.5 2.5,10.5"/>
    <line x1="8.5" y1="10.5" x2="12.5" y2="10.5"/>
  </svg>
);

const IconNotes = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 2h9a1 1 0 011 1v7.5L10.5 13H3a1 1 0 01-1-1V3a1 1 0 011-1z"/>
    <line x1="4.5" y1="5.5" x2="10.5" y2="5.5"/>
    <line x1="4.5" y1="8" x2="8" y2="8"/>
  </svg>
);

const IconSettings = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="7" cy="7" r="2"/>
    <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1.5 4.5h3v-3M13.5 10.5h-3v3"/>
    <path d="M12.4 4.5A5.5 5.5 0 004.2 2L1.5 4.5M13.5 10.5l-2.7 2.5a5.5 5.5 0 01-8.2-2.5"/>
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2.5 3.5h10M4.5 3.5v-1a1 1 0 011-1h4a1 1 0 011 1v1M11.5 3.5v9a1 1 0 01-1 1h-6a1 1 0 01-1-1v-9"/>
    <line x1="6" y1="6" x2="6" y2="10"/>
    <line x1="9" y1="6" x2="9" y2="10"/>
  </svg>
);

const IconClear = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="7.5" cy="7.5" r="5.5"/>
    <line x1="3.5" y1="3.5" x2="11.5" y2="11.5"/>
  </svg>
);

const IconSettingsSmall = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="7.5" cy="7.5" r="1.5"/>
    <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14"/>
  </svg>
);

const IconLock = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3.5" y="6.5" width="8" height="6" rx="1"/>
    <path d="M5.5 6.5V4.5a2 2 0 1 1 4 0v2"/>
  </svg>
);

const IconHistory = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="7.5" cy="7.5" r="5.5"/>
    <polyline points="7.5,4.5 7.5,7.5 9.5,8.5"/>
  </svg>
);

const IconFolder = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1.5 2.5h4l1.5 1.5h6.5v8.5a1 1 0 01-1 1h-11a1 1 0 01-1-1z"/>
  </svg>
);

// ── Shell history helpers ─────────────────────────────────────────────────────

const SHELL_HISTORY_KEY = 'rilaunch_shell_history';

function loadShellHistory() {
  try { return JSON.parse(localStorage.getItem(SHELL_HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveShellHistoryItem(cmd) {
  const hist = loadShellHistory().filter(h => h !== cmd);
  hist.unshift(cmd);
  localStorage.setItem(SHELL_HISTORY_KEY, JSON.stringify(hist.slice(0, 50)));
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const TABS = ['apps', 'clipboard', 'notes', 'shell'];

  const [activeTab, setActiveTab] = createSignal('apps');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [clipboardData, setClipboardData] = createSignal([]);
  const [clipboardSelectedIndex, setClipboardSelectedIndex] = createSignal(0);
  const [allApps, setAllApps] = createSignal([]);
  const [commandOutput, setCommandOutput] = createSignal('');
  const [isExecuting, setIsExecuting] = createSignal(false);
  const [notesList, setNotesList] = createSignal([]);
  const [shellHistory, setShellHistory] = createSignal(loadShellHistory());
  const [shellHistoryIndex, setShellHistoryIndex] = createSignal(-1);
  const [showSettings, setShowSettings] = createSignal(false);
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [statusMsg, setStatusMsg] = createSignal('');
  const [statusColor, setStatusColor] = createSignal('info');
  let statusTimer;

  const showStatus = (msg, type = 'info') => {
    clearTimeout(statusTimer);
    setStatusMsg(msg);
    setStatusColor(type);
    statusTimer = setTimeout(() => setStatusMsg(''), 2500);
  };

  let searchInputRef;

  // ── Fuse index (rebuilt only when allApps changes) ────────────────────────
  const fuseIndex = createMemo(() =>
    new Fuse(allApps(), {
      keys: ['title', 'subtitle', 'category'],
      threshold: 0.4,
      ignoreLocation: true,
    })
  );

  // ── Per-tab filtered data (memos) ─────────────────────────────────────────
  const filteredApps = createMemo(() => {
    const q = searchQuery().trim();
    if (!q) return allApps();
    return fuseIndex().search(q).map(r => r.item);
  });

  const filteredClipboardData = createMemo(() => {
    const term = searchQuery().toLowerCase();
    if (!term) return clipboardData();
    return clipboardData().filter(item =>
      (item.content || item.text || '').toLowerCase().includes(term)
    );
  });

  const filteredNotes = createMemo(() => {
    const term = searchQuery().toLowerCase();
    if (!term) return notesList();
    return notesList().filter(n =>
      n.content.toLowerCase().includes(term) || n.tag.toLowerCase().includes(term)
    );
  });

  // Inline autocomplete: first history item starting with current input
  const shellSuggestion = createMemo(() => {
    if (activeTab() !== 'shell') return '';
    const q = searchQuery().trim();
    if (!q) return '';
    return shellHistory().find(h => h.toLowerCase().startsWith(q.toLowerCase())) || '';
  });

  // ── Search bar config per tab ─────────────────────────────────────────────
  const searchPlaceholder = () => {
    switch (activeTab()) {
      case 'apps':      return 'Search applications...';
      case 'clipboard': return 'Filter clipboard...';
      case 'shell':     return 'Enter shell command...';
      case 'notes':     return 'Search notes...';
      default:          return 'Search...';
    }
  };

  // ── Tab switching ─────────────────────────────────────────────────────────
  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setSelectedIndex(0);
    setClipboardSelectedIndex(0);
    setShellHistoryIndex(-1);
    if (tab === 'clipboard') loadClipboardData();
    if (tab === 'notes')     loadNotes();
    setTimeout(() => { if (searchInputRef) searchInputRef.focus(); }, 30);
  };

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadClipboardData = async () => {
    try {
      const raw = await GetClipData('');
      setClipboardData(JSON.parse(raw));
    } catch (e) { console.error(e); }
  };

  const loadAllApps = async () => {
    try {
      const raw = await GetAllApps();
      const parsed = JSON.parse(raw || '[]');
      const mapped = parsed.map(app => ({
        id:       app.id,
        title:    app.displayName || app.name,
        subtitle: app.description || 'Application',
        icon:     app.icon || '',
        category: app.category || 'App',
        appData:  app,
      }));
      setAllApps(mapped);
      if (mapped.length === 0) setTimeout(loadAllApps, 1500);
    } catch (e) {
      console.error(e);
      setTimeout(loadAllApps, 2000);
    }
  };

  const loadNotes = async () => {
    try {
      const raw = await GetNotes();
      setNotesList(JSON.parse(raw || '[]'));
    } catch (e) { console.error(e); }
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleAppLaunch = async (command) => {
    if (command?.appData) {
      try { await LaunchApp(command.appData.id); } catch (e) { console.error(e); }
    }
  };

  const handleCommandExecute = async (cmd) => {
    setIsExecuting(true);
    try {
      const output = await ExecuteCommand(cmd);
      setCommandOutput(output);
    } catch (e) {
      setCommandOutput('Error: ' + e.message);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClipboardItemClick = (item) => {
    navigator.clipboard.writeText(item.content || item.text || '');
    WindowHide();
  };

  const handleToggleSecret = async (item) => {
    try {
      await ToggleClipSecret(item.hash);
      setClipboardData(prev => prev.map(x => x.hash === item.hash ? { ...x, is_secret: !x.is_secret } : x));
    } catch (e) {
      console.error('Failed to toggle secret:', e);
    }
  };

  const handleClearClipboard = async () => {
    if (confirm('Are you sure you want to clear all clipboard items?')) {
      try {
        await ClearClipboard();
        setClipboardData([]);
        showStatus('Clipboard cleared', 'success');
      } catch (e) {
        console.error(e);
        showStatus('Failed to clear clipboard', 'error');
      }
    }
  };

  const handleClearConsole = () => {
    setCommandOutput('');
    showStatus('Console cleared', 'success');
  };

  const handleReloadNotes = async () => {
    await loadNotes();
    showStatus('Notes reloaded', 'success');
  };



  const handleSaveNote = async (content, tag) => {
    try { await SaveNote(content, tag); await loadNotes(); showStatus('Note saved', 'success'); }
    catch (e) { console.error(e); showStatus('Failed to save', 'error'); }
  };

  const handleDeleteNote = async (id) => {
    try { await DeleteNote(id); await loadNotes(); showStatus('Note deleted'); }
    catch (e) { console.error(e); }
  };

  const handleUpdateNote = async (id, content, tag) => {
    try { await UpdateNote(id, content, tag); await loadNotes(); showStatus('Note updated', 'success'); }
    catch (e) { console.error(e); showStatus('Failed to update', 'error'); }
  };

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = async (e) => {
    // Escape: clear query or quit
    if (e.key === 'Escape') {
      if (searchQuery() !== '') { setSearchQuery(''); setShellHistoryIndex(-1); return; }
      Quit();
      return;
    }

    // Tab / Shift+Tab: cycle plugins (skip inside form fields)
    if (e.key === 'Tab' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      const cur = TABS.indexOf(activeTab());
      const next = e.shiftKey
        ? (cur - 1 + TABS.length) % TABS.length
        : (cur + 1) % TABS.length;
      switchTab(TABS[next]);
      return;
    }

    // ⌘1-4: switch tabs
    if ((e.metaKey || e.ctrlKey) && ['1','2','3','4'].includes(e.key)) {
      e.preventDefault();
      switchTab(TABS[parseInt(e.key) - 1]);
      return;
    }

    // Shell tab: Enter executes, ↑↓ navigates history
    if (activeTab() === 'shell') {
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = searchQuery().trim();
        if (!cmd || isExecuting()) return;
        saveShellHistoryItem(cmd);
        setShellHistory(loadShellHistory());
        setShellHistoryIndex(-1);
        setSearchQuery('');
        handleCommandExecute(cmd);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const hist = shellHistory();
        if (!hist.length) return;
        const next = Math.min(shellHistoryIndex() + 1, hist.length - 1);
        setShellHistoryIndex(next);
        setSearchQuery(hist[next]);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = shellHistoryIndex() - 1;
        if (next < 0) { setShellHistoryIndex(-1); setSearchQuery(''); return; }
        setShellHistoryIndex(next);
        setSearchQuery(shellHistory()[next]);
      } else if (e.key === 'ArrowRight') {
        // Accept inline ghost suggestion when cursor is at end
        const sug = shellSuggestion();
        if (sug && searchInputRef &&
            searchInputRef.selectionEnd === (searchInputRef.value || '').length) {
          e.preventDefault();
          setSearchQuery(sug);
          setShellHistoryIndex(-1);
        }
      }
      return;
    }

    // Notes tab: no keyboard nav
    if (activeTab() === 'notes') return;

    // Clipboard tab
    if (activeTab() === 'clipboard') {
      const data = filteredClipboardData();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setClipboardSelectedIndex(i => (i + 1) % Math.max(data.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setClipboardSelectedIndex(i => i === 0 ? data.length - 1 : i - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = data[clipboardSelectedIndex()];
        if (item) { navigator.clipboard.writeText(item.content || item.text || ''); WindowHide(); }
      }
      return;
    }

    // Apps tab: ↑↓ navigate, Enter launch
    const filtered = filteredApps();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % Math.max(filtered.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => i === 0 ? filtered.length - 1 : i - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      await handleAppLaunch(filtered[selectedIndex()]);
    }
  };

  // ── Effects ───────────────────────────────────────────────────────────────
  // Reset selection when query changes
  createEffect(() => {
    const _ = searchQuery();
    setSelectedIndex(0);
    setClipboardSelectedIndex(0);
  });

  onMount(() => {
    // Use capture phase so our Tab/Esc handler fires before any element's own keydown,
    // preventing browser-native focus navigation from stealing Tab on the clipboard page.
    document.addEventListener('keydown', handleKeyDown, true);
    EventsOn('Backend:GlobalHotkeyEvent', () => WindowShow());
    EventsOn('ClipboardUpdated', () => loadClipboardData());
    loadAllApps();
    if (searchInputRef) searchInputRef.focus();
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown, true);
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
            isShellMode={activeTab() === 'shell'}
            suggestion={shellSuggestion()}
            onMenuClick={(e) => { e.stopPropagation(); setIsMenuOpen(o => !o); }}
          />

          <Show when={isMenuOpen() && !showSettings()}>
            <div class="plugin-menu-panel floating-menu" onClick={(e) => e.stopPropagation()}>
              <span class="plugin-menu-title">
                {activeTab() === 'apps' && 'Apps'}
                {activeTab() === 'clipboard' && 'Clipboard'}
                {activeTab() === 'shell' && 'Terminal'}
                {activeTab() === 'notes' && 'Notes'}
              </span>
              <div class="menu-list">
                <Show when={activeTab() === 'apps'}>
                  <button class="menu-item" onClick={() => { setIsMenuOpen(false); loadAllApps(); }}>
                    <IconRefresh />
                    <span>Refresh Apps</span>
                  </button>
                  <button class="menu-item disabled">
                    <IconSettingsSmall />
                    <span>App Settings</span>
                  </button>
                </Show>
                <Show when={activeTab() === 'clipboard'}>
                  <button class="menu-item danger" onClick={() => { setIsMenuOpen(false); handleClearClipboard(); }}>
                    <IconTrash />
                    <span>Clear All</span>
                  </button>
                </Show>
                <Show when={activeTab() === 'shell'}>
                  <button class="menu-item" onClick={() => { setIsMenuOpen(false); handleClearConsole(); }}>
                    <IconClear />
                    <span>Clear Console</span>
                  </button>
                  <button class="menu-item disabled">
                    <IconHistory />
                    <span>History Limit</span>
                  </button>
                </Show>
                <Show when={activeTab() === 'notes'}>
                  <button class="menu-item" onClick={() => { setIsMenuOpen(false); handleReloadNotes(); }}>
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
            <button class={"tab-btn" + (activeTab() === 'apps'      ? ' active' : '')} onClick={() => switchTab('apps')}      title="Applications ⌘1"><IconApps /></button>
            <button class={"tab-btn" + (activeTab() === 'clipboard' ? ' active' : '')} onClick={() => switchTab('clipboard')} title="Clipboard ⌘2"><IconClipboard /></button>
            <button class={"tab-btn" + (activeTab() === 'notes'     ? ' active' : '')} onClick={() => switchTab('notes')}     title="Notes ⌘3"><IconNotes /></button>
            <button class={"tab-btn" + (activeTab() === 'shell'     ? ' active' : '')} onClick={() => switchTab('shell')}     title="Shell ⌘4"><IconTerminal /></button>
            <div class="sidebar-spacer" />
            <button class={"tab-btn settings-btn" + (showSettings() ? ' active' : '')} onClick={() => setShowSettings(s => !s)} title="Settings"><IconSettings /></button>
          </div>

          <div class="content-panel">
            <Show when={showSettings()}>
              <SettingsView onClose={() => setShowSettings(false)} />
            </Show>
            <Show when={activeTab() === 'apps'}>
              <ApplicationView
                apps={filteredApps()}
                selectedIndex={selectedIndex()}
                onSelect={setSelectedIndex}
                onLaunch={handleAppLaunch}
              />
            </Show>
            <Show when={activeTab() === 'clipboard'}>
              <ClipboardView
                clipboardData={clipboardData()}
                filteredClipboardData={filteredClipboardData()}
                clipboardSelectedIndex={clipboardSelectedIndex()}
                onItemClick={handleClipboardItemClick}
                onToggleSecret={handleToggleSecret}
              />
            </Show>
            <Show when={activeTab() === 'shell'}>
              <CommandExecutor
                output={commandOutput()}
                isLoading={isExecuting()}
              />
            </Show>
            <Show when={activeTab() === 'notes'}>
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

        <StatusBar activeTab={activeTab()} statusMsg={statusMsg()} statusColor={statusColor()} />

      </div>
    </div>
  );
}

export default App;
