import { createSignal, createEffect, For } from 'solid-js';
import { GetClipData } from '../wailsjs/go/main/App';
import { EventsOn, WindowHide, WindowShow } from '../wailsjs/runtime/runtime';
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
  const [commands] = createSignal([
    {
      id: 1,
      title: 'Open Calculator',
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
    },
    {
      id: 3,
      title: 'System Preferences',
      subtitle: 'Change system settings',
      icon: '⚙️',
      category: 'System'
    },
    {
      id: 4,
      title: 'Take Screenshot',
      subtitle: 'Capture your screen',
      icon: '📸',
      category: 'Utilities'
    },
    {
      id: 5,
      title: 'Open Terminal',
      subtitle: 'Access command line',
      icon: '💻',
      category: 'Development'
    },
    {
      id: 6,
      title: 'Calendar',
      subtitle: 'View your schedule',
      icon: '📅',
      category: 'Productivity'
    },
    {
      id: 7,
      title: 'Weather',
      subtitle: 'Check current weather',
      icon: '🌤️',
      category: 'Information'
    },
    {
      id: 8,
      title: 'Clipboard History',
      subtitle: 'View copied items',
      icon: '📋',
      category: 'Utilities'
    }
  ]);

  const filteredCommands = () => {
    if (!searchQuery()) return commands();
    return commands().filter(command =>
      command.title.toLowerCase().includes(searchQuery().toLowerCase()) ||
      command.subtitle.toLowerCase().includes(searchQuery().toLowerCase()) ||
      command.category.toLowerCase().includes(searchQuery().toLowerCase())
    );
  };

  // Check if search query triggers clipboard view
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

  const handleKeyDown = async (e) => {
    // Handle Escape to close clipboard view
    if (e.key === 'Escape') {
      if (showClipboard()) {
        setShowClipboard(false);
        setSearchQuery('');
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
            // Copy selected item to clipboard and close window
            navigator.clipboard.writeText(selected.content || selected.text || '');
            console.log('Copied to clipboard:', selected.content || selected.text);
            // Close the window
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
        if (selected) {
          console.log('Execute command:', selected.title);
          // Here you would typically execute the command
        }
        break;
    }
  };

  createEffect(() => {
    // Reset selection when search changes
    setSelectedIndex(0);
    setClipboardSelectedIndex(0);
    // Check for clipboard trigger
    checkClipboardTrigger(searchQuery());
  });

  createEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    EventsOn("Backend:GlobalHotkeyEvent", globalHotkeyEventHandler);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  function globalHotkeyEventHandler(time) {
      WindowShow();

      setTimeout(() => {
        WindowHide();
      }, 1000);
  }




  const handleClipboardItemClick = (item) => {
    // Copy selected item to clipboard and close window
    navigator.clipboard.writeText(item.content || item.text || '');
    console.log('Copied to clipboard:', item.content || item.text);
    // Close the window
    WindowHide();
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
              />
              <CommandPreview
                command={filteredCommands()[selectedIndex()]}
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
              <span>💡 Type "c " in search to view clipboard history • Continue typing to filter</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
