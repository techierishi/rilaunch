import { createSignal, createEffect, For } from 'solid-js';
import { GetClipData, GetAllApps, SearchApps, LaunchApp } from '../wailsjs/go/main/App';
import { EventsOn, WindowHide, WindowShow, Quit } from '../wailsjs/runtime/runtime';
import SearchBar from './components/SearchBar';
import CommandList from './components/CommandList';
import CommandPreview from './components/CommandPreview';
import './App.css';

function App() {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [clipboardData, setClipboardData] = createSignal([]);
  const [showClipboard, setShowClipboard] = createSignal(false);
  const [clipboardSelectedIndex, setClipboardSelectedIndex] = createSignal(0);
  const [apps, setApps] = createSignal([]);
  const [filteredApps, setFilteredApps] = createSignal([]);
  const [commands] = createSignal([
    {
      id: 1,
      title: 'Open Application',
      subtitle: 'Perform calculations',
      icon: '🧮',
      category: 'System'
    },
    {
      id: 2,
      title: 'Search Files',
      subtitle: 'Find files on your system',
      icon: '📁',
      category: 'File System'
    },  {
      id: 3,
      title: 'Clipboard History',
      subtitle: 'View copied items',
      icon: '📋',
      category: 'Utilities'
    }
  ]);

  const filteredCommands = () => {
    if (!searchQuery()) return filteredApps();
    if (searchQuery().startsWith('c ')) return [];
    return filteredApps();
  };


  const checkClipboardTrigger = async (query) => {
    if (query.startsWith('c ')) {
      if (!showClipboard()) {
        try {
          const clipData = await GetClipData('');
          const parsedData = JSON.parse(clipData);
          setClipboardData(parsedData);
          setShowClipboard(true);
          console.log('Clipboard data loaded:', parsedData);
        } catch (error) {
          console.error('Error fetching clipboard data:', error);
        }
      }
    } else if (showClipboard() && !query.startsWith('c ')) {
      setShowClipboard(false);
    }


    if (!query.startsWith('c ')) {
      await searchApplications(query);
    }
  };


  const searchApplications = async (query) => {
    try {
      let appsData;
      if (query.trim() === '') {
        appsData = await GetAllApps();
      } else {
        appsData = await SearchApps(query);
      }
      const parsedApps = JSON.parse(appsData);


      const appCommands = parsedApps.map(app => ({
        id: app.id,
        title: app.displayName || app.name,
        subtitle: app.description || 'Application',
        icon: app.icon || '🖥️',
        category: app.category || 'Application',
        appData: app
      }));

      setFilteredApps(appCommands);
    } catch (error) {
      console.error('Error searching applications:', error);
      setFilteredApps([]);
    }
  };

  // Filter clipboard data based on search after 'c '
  const filteredClipboardData = () => {
    if (!showClipboard()) return [];

    const searchTerm = searchQuery().substring(2).toLowerCase(); // Remove 'c ' prefix
    if (!searchTerm) return clipboardData();

    return clipboardData().filter(item => {
      const content = (item.content || item.text || '').toLowerCase();
      return content.includes(searchTerm);
    });
  };

  const handleAppLaunch = async (command) => {
    if (command && command.appData) {
      try {
        await LaunchApp(command.appData.id);
      } catch (error) {
        console.error('Error launching app:', error);
      }
    }
  };

  const handleKeyDown = async (e) => {
    if (e.key === 'Escape') {
      if (showClipboard()) {
        setShowClipboard(false);
        setSearchQuery('');
        return;
      }
      if (searchQuery() === '') {
        Quit();
        return;
      }
      setSearchQuery('');
      setSelectedIndex(0);
      return;
    }

    // Handle keyboard navigation for clipboard view
    if (showClipboard()) {
      const filteredClip = filteredClipboardData();

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setClipboardSelectedIndex(prev => (prev + 1) % filteredClip.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setClipboardSelectedIndex(prev => prev === 0 ? filteredClip.length - 1 : prev - 1);
          break;
        case 'Enter':
          e.preventDefault();
          const selected = filteredClip[clipboardSelectedIndex()];
          if (selected) {
            navigator.clipboard.writeText(selected.content || selected.text || '');
            console.log('Copied to clipboard:', selected.content || selected.text);
            WindowHide();
          }
          break;
      }
      return;
    }

    const filtered = filteredCommands();

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev === 0 ? filtered.length - 1 : prev - 1);
        break;
      case 'Enter':
        e.preventDefault();
        const selected = filtered[selectedIndex()];
        await handleAppLaunch(selected);
        break;
    }
  };

  createEffect(() => {
    setSelectedIndex(0);
    setClipboardSelectedIndex(0);
    checkClipboardTrigger(searchQuery());
  });

  createEffect(() => {
    searchApplications('');
  });

  createEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    EventsOn("Backend:GlobalHotkeyEvent", globalHotkeyEventHandler);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  function globalHotkeyEventHandler(time) {
      WindowShow();
  }

  const handleClipboardItemClick = (item) => {
    navigator.clipboard.writeText(item.content || item.text || '');
    console.log('Copied to clipboard:', item.content || item.text);
    Quit();
  };

  return (
    <div class="app">
      <div class="main-container">
        <SearchBar
          searchQuery={searchQuery()}
          setSearchQuery={setSearchQuery}
        />
        {showClipboard() ? (
          <div class="content-area">
            <div class="clipboard-view">
              <div class="clipboard-header">
                <h2>📋 Clipboard History</h2>
                <p class="clipboard-hint">Click item to copy & close • Arrow keys to navigate • Enter to copy & close</p>
              </div>
              <div class="clipboard-list">
                <For each={filteredClipboardData()}>
                  {(item, index) => (
                    <div
                      class={`clipboard-item ${index() === clipboardSelectedIndex() ? 'selected' : ''}`}
                      onClick={() => handleClipboardItemClick(item)}
                    >
                      <div class="clipboard-content">
                        <div class="clipboard-text">{item.content || item.text || 'No content'}</div>
                        <div class="clipboard-meta">
                          <span class="clipboard-type">{item.type || 'text'}</span>
                          <span class="clipboard-time">{item.timestamp ? new Date(item.timestamp * 1000).toLocaleString() : 'Unknown time'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
                {filteredClipboardData().length === 0 && clipboardData().length > 0 && (
                  <div class="no-clipboard-data">
                    <div class="no-clipboard-icon">🔍</div>
                    <div class="no-clipboard-text">No matching clipboard items</div>
                  </div>
                )}
                {clipboardData().length === 0 && (
                  <div class="no-clipboard-data">
                    <div class="no-clipboard-icon">📋</div>
                    <div class="no-clipboard-text">No clipboard data found</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div class="content-area">
              <CommandList
                commands={filteredCommands()}
                selectedIndex={selectedIndex()}
                onSelect={setSelectedIndex}
                onLaunch={handleAppLaunch}
              />
            </div>
            {filteredCommands().length === 0 && (
              <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <div class="no-results-text">No commands found</div>
                <div class="no-results-subtitle">Try a different search term</div>
              </div>
            )}
            <div class="hotkey-hint">
              <span>💡 Type to search applications • Type "c " for clipboard history • Enter or double-click to launch • Escape to quit</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
