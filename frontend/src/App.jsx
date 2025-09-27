import { createSignal, createEffect, For } from 'solid-js';
import SearchBar from './components/SearchBar';
import CommandList from './components/CommandList';
import CommandPreview from './components/CommandPreview';
import './App.css';

function App() {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedIndex, setSelectedIndex] = createSignal(0);
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

  const handleKeyDown = (e) => {
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
      case 'Escape':
        setSearchQuery('');
        setSelectedIndex(0);
        break;
    }
  };

  createEffect(() => {
    // Reset selection when search changes
    setSelectedIndex(0);
  });

  createEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div class="app">
      <div class="main-container">
        <SearchBar
          searchQuery={searchQuery()}
          setSearchQuery={setSearchQuery}
        />
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
      </div>
    </div>
  );
}

export default App;
