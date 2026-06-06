import { createSignal, createEffect, createMemo, onMount } from 'solid-js';
import Fuse from 'fuse.js';
import { GetClipData, GetAllApps, LaunchApp, ExecuteCommand, GetLastCommand, GetLastOutput, GetNotes, SaveNote, DeleteNote } from '../wailsjs/go/main/App';
import { EventsOn, WindowHide, WindowShow, Quit } from '../wailsjs/runtime/runtime';
import SearchBar from './components/SearchBar';
import ClipboardView from './components/ClipboardView';
import ApplicationView from './components/ApplicationView';
import CommandExecutor from './components/CommandExecutor';
import NotesView from './components/NotesView';
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

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const TABS = ['apps', 'clipboard', 'shell', 'notes'];

  const [activeTab, setActiveTab] = createSignal('apps');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [clipboardData, setClipboardData] = createSignal([]);
  const [clipboardSelectedIndex, setClipboardSelectedIndex] = createSignal(0);
  const [allApps, setAllApps] = createSignal([]);
  const [currentCommand, setCurrentCommand] = createSignal('');
  const [commandOutput, setCommandOutput] = createSignal('');
  const [isExecuting, setIsExecuting] = createSignal(false);
  const [notesList, setNotesList] = createSignal([]);

  let searchInputRef;

  // ── Fuse index (recreated only when allApps changes) ──────────────────────
  const fuseIndex = createMemo(() =>
    new Fuse(allApps(), {
      keys: ['title', 'subtitle', 'category'],
      threshold: 0.4,
      ignoreLocation: true,
    })
  );

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
      n.content.toLowerCase().includes(term) ||
      n.tag.toLowerCase().includes(term)
    );
  });

  // ── Placeholder per tab ──────────────────────────────────────────────────
  const searchPlaceholder = () => {
    switch (activeTab()) {
      case 'apps':      return 'Search applications...';
      case 'clipboard': return 'Filter clipboard...';
      case 'shell':     return 'Shell executor';
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
    if (tab === 'clipboard') loadClipboardData();
    if (tab === 'shell')     loadLastCommand();
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
      if (mapped.length === 0) {
        // Backend may still be initializing — retry
        setTimeout(loadAllApps, 1500);
      }
    } catch (e) {
      console.error(e);
      setTimeout(loadAllApps, 2000);
    }
  };

  const loadLastCommand = async () => {
    try {
      const cmd = await GetLastCommand();
      const out = await GetLastOutput();
      if (cmd) { setCurrentCommand(cmd); setCommandOutput(out || ''); }
    } catch (e) {}
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

  const handleCommandExecute = async (command) => {
    setIsExecuting(true);
    try {
      const output = await ExecuteCommand(command);
      setCurrentCommand(command);
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

  const handleSaveNote = async (content, tag) => {
    try {
      await SaveNote(content, tag);
      await loadNotes();
    } catch (e) { console.error(e); }
  };

  const handleDeleteNote = async (id) => {
    try {
      await DeleteNote(id);
      await loadNotes();
    } catch (e) { console.error(e); }
  };

  // ── Keyboard ──────────────────────────────────────────────────────────────
  const handleKeyDown = async (e) => {
    if (e.key === 'Escape') {
      if (searchQuery() !== '') { setSearchQuery(''); return; }
      Quit();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && ['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault();
      switchTab(TABS[parseInt(e.key) - 1]);
      return;
    }

    if (activeTab() === 'clipboard') {
      const data = filteredClipboardData();
      if (e.key === 'ArrowDown') { e.preventDefault(); setClipboardSelectedIndex(i => (i + 1) % Math.max(data.length, 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setClipboardSelectedIndex(i => i === 0 ? data.length - 1 : i - 1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const item = data[clipboardSelectedIndex()];
        if (item) { navigator.clipboard.writeText(item.content || item.text || ''); WindowHide(); }
      }
      return;
    }

    if (activeTab() === 'shell' || activeTab() === 'notes') return;

    // apps tab arrow nav + enter to launch
    const filtered = filteredApps();
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => (i + 1) % Math.max(filtered.length, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => i === 0 ? filtered.length - 1 : i - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); await handleAppLaunch(filtered[selectedIndex()]); }
  };

  // ── Effects ───────────────────────────────────────────────────────────────
  createEffect(() => { const _ = searchQuery(); setSelectedIndex(0); setClipboardSelectedIndex(0); });

  createEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    EventsOn('Backend:GlobalHotkeyEvent', () => WindowShow());
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  onMount(() => {
    loadAllApps();
    if (searchInputRef) searchInputRef.focus();
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div class="app">
      <div class="main-container">

        <div class="search-section">
          <SearchBar
            ref={searchInputRef}
            searchQuery={searchQuery()}
            setSearchQuery={setSearchQuery}
            placeholder={searchPlaceholder()}
          />
        </div>

        <div class="body-section">

          <div class="sidebar">
            <button class={"tab-btn" + (activeTab() === 'apps' ? ' active' : '')} onClick={() => switchTab('apps')} title="Applications  ⌘1"><IconApps /></button>
            <button class={"tab-btn" + (activeTab() === 'clipboard' ? ' active' : '')} onClick={() => switchTab('clipboard')} title="Clipboard  ⌘2"><IconClipboard /></button>
            <button class={"tab-btn" + (activeTab() === 'shell' ? ' active' : '')} onClick={() => switchTab('shell')} title="Shell  ⌘3"><IconTerminal /></button>
            <button class={"tab-btn" + (activeTab() === 'notes' ? ' active' : '')} onClick={() => switchTab('notes')} title="Notes  ⌘4"><IconNotes /></button>
          </div>

          <div class="content-panel">
            {activeTab() === 'apps' && (
              <ApplicationView
                apps={filteredApps()}
                selectedIndex={selectedIndex()}
                onSelect={setSelectedIndex}
                onLaunch={handleAppLaunch}
              />
            )}
            {activeTab() === 'clipboard' && (
              <ClipboardView
                clipboardData={clipboardData()}
                filteredClipboardData={filteredClipboardData()}
                clipboardSelectedIndex={clipboardSelectedIndex()}
                onItemClick={handleClipboardItemClick}
              />
            )}
            {activeTab() === 'shell' && (
              <CommandExecutor
                output={() => commandOutput()}
                isLoading={() => isExecuting()}
                onExecute={handleCommandExecute}
                lastExecutedCommand={currentCommand()}
              />
            )}
            {activeTab() === 'notes' && (
              <NotesView
                notes={filteredNotes()}
                onSave={handleSaveNote}
                onDelete={handleDeleteNote}
              />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
