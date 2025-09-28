import { createSignal, createEffect, For } from 'solid-js';
import { GetClipData, GetAllApps, SearchApps, LaunchApp, ExecuteCommand, GetLastCommand, GetLastOutput } from '../wailsjs/go/main/App';
import { EventsOn, WindowHide, WindowShow, Quit } from '../wailsjs/runtime/runtime';
import SearchBar from './components/SearchBar';
import ClipboardView from './components/ClipboardView';
import ApplicationView from './components/ApplicationView';
import CommandExecutor from './components/CommandExecutor';
import './App.css';

function App() {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [clipboardData, setClipboardData] = createSignal([]);
  const [showClipboard, setShowClipboard] = createSignal(false);
  const [clipboardSelectedIndex, setClipboardSelectedIndex] = createSignal(0);
  const [apps, setApps] = createSignal([]);
  const [filteredApps, setFilteredApps] = createSignal([]);
  const [showCommandExecutor, setShowCommandExecutor] = createSignal(false);
  const [currentCommand, setCurrentCommand] = createSignal('');
  const [commandOutput, setCommandOutput] = createSignal('');
  const [isExecuting, setIsExecuting] = createSignal(false);





  const checkTriggers = async (query) => {
    if (query.startsWith('c ')) {
      setShowCommandExecutor(false);
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
    } else if (query.startsWith('e ')) {
      setShowClipboard(false);
      if (!showCommandExecutor()) {
        setShowCommandExecutor(true);
        loadLastCommand();
      }
    } else {
      setShowClipboard(false);
      setShowCommandExecutor(false);
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

  const filteredClipboardData = () => {
    if (!showClipboard()) return [];

    const searchTerm = searchQuery().substring(2).toLowerCase(); // Remove 'c ' prefix
    if (!searchTerm) return clipboardData();

    return clipboardData().filter(item => {
      const content = (item.content || item.text || '').toLowerCase();
      return content.includes(searchTerm);
    });
  };

  const loadLastCommand = async () => {
    try {
      const lastCmd = await GetLastCommand();
      const lastOut = await GetLastOutput();
      if (lastCmd) {
        setCurrentCommand(lastCmd);
        setCommandOutput(lastOut || '');
      }
    } catch (error) {
      console.error('Error loading last command:', error);
    }
  };

  const handleCommandExecute = async (command) => {
    setIsExecuting(true);
    try {
      const output = await ExecuteCommand(command);
      setCurrentCommand(command);
      setCommandOutput(output);
    } catch (error) {
      console.error('Error executing command:', error);
      setCommandOutput(`Error: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
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
      if (showCommandExecutor()) {
        setShowCommandExecutor(false);
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
            WindowHide();
          }
          break;
      }
      return;
    }

    if (showCommandExecutor()) {
      return;
    }

    const filtered = filteredApps();

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
    checkTriggers(searchQuery());
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
            <ClipboardView
              clipboardData={clipboardData()}
              filteredClipboardData={filteredClipboardData()}
              clipboardSelectedIndex={clipboardSelectedIndex()}
              onItemClick={handleClipboardItemClick}
            />
          </div>
        ) : showCommandExecutor() ? (
          <div class="content-area">
            <CommandExecutor
              output={() => commandOutput()}
              isLoading={isExecuting()}
              onExecute={handleCommandExecute}
              lastExecutedCommand={currentCommand()}
            />
          </div>
        ) : (
          <>
            <ApplicationView
              apps={filteredApps()}
              selectedIndex={selectedIndex()}
              onSelect={setSelectedIndex}
              onLaunch={handleAppLaunch}
            />
            <div class="hotkey-hint">
              <span>💡 Type to search applications • Type "c " for clipboard • Type "e " for commands • Escape to quit</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
