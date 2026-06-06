import { createSignal, onMount, For } from 'solid-js';
import './CommandExecutor.css';

const HISTORY_KEY = 'rilaunch_shell_history';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveToHistory(cmd) {
  const hist = loadHistory().filter(h => h !== cmd);
  hist.unshift(cmd);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, 50)));
}

function CommandExecutor({ output, isLoading, onExecute, lastExecutedCommand }) {
  const [localCommand, setLocalCommand] = createSignal('');
  const [history, setHistory] = createSignal(loadHistory());
  const [historyIndex, setHistoryIndex] = createSignal(-1);
  const [showHistory, setShowHistory] = createSignal(false);
  let inputRef;

  onMount(() => {
    setTimeout(() => { if (inputRef) inputRef.focus(); }, 50);
  });

  const filteredHistory = () => {
    const q = localCommand().trim();
    if (!q) return history();
    return history().filter(h => h.toLowerCase().includes(q.toLowerCase()));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = localCommand().trim();
      if (!cmd) return;
      onExecute(cmd);
      saveToHistory(cmd);
      setHistory(loadHistory());
      setLocalCommand('');
      setHistoryIndex(-1);
      setShowHistory(false);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const hist = history();
      if (hist.length === 0) return;
      const next = Math.min(historyIndex() + 1, hist.length - 1);
      setHistoryIndex(next);
      setLocalCommand(hist[next]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = historyIndex() - 1;
      if (next < 0) { setHistoryIndex(-1); setLocalCommand(''); return; }
      setHistoryIndex(next);
      setLocalCommand(history()[next]);
      return;
    }
    if (e.key === 'Escape') {
      setShowHistory(false);
    }
  };

  const fillFromHistory = (cmd) => {
    setLocalCommand(cmd);
    setShowHistory(false);
    if (inputRef) inputRef.focus();
  };

  return (
    <div class="command-executor">
      <div class="cmd-input-row">
        <span class="cmd-prompt">$</span>
        <input
          ref={inputRef}
          type="text"
          class="cmd-input"
          value={localCommand()}
          onInput={(e) => { setLocalCommand(e.target.value); setHistoryIndex(-1); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowHistory(true)}
          onBlur={() => setTimeout(() => setShowHistory(false), 150)}
          placeholder="Enter shell command..."
          disabled={isLoading()}
          autocomplete="off"
          spellcheck={false}
        />
        {isLoading() && <span class="cmd-spinner" />}
      </div>

      {showHistory() && filteredHistory().length > 0 && (
        <div class="cmd-history-list">
          <For each={filteredHistory().slice(0, 8)}>
            {(cmd) => (
              <div class="cmd-history-item" onMouseDown={() => fillFromHistory(cmd)}>
                <span class="cmd-history-prompt">$</span>
                <span class="cmd-history-text">{cmd}</span>
              </div>
            )}
          </For>
        </div>
      )}

      <div class="cmd-output-section">
        {output() ? (
          <div class="cmd-output">
            <div class="cmd-output-header">
              <span class="cmd-output-label">$ {lastExecutedCommand}</span>
              <button
                class="cmd-copy-btn"
                onClick={() => navigator.clipboard.writeText(output())}
                title="Copy output"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="4" y="4" width="8" height="8" rx="1"/>
                  <path d="M2 9H1.5A.5.5 0 011 8.5v-7A.5.5 0 01.5.5V2"/>
                </svg>
              </button>
            </div>
            <pre class="cmd-output-content">{output()}</pre>
          </div>
        ) : (
          <div class="cmd-empty">
            <div class="cmd-empty-text">No output yet</div>
            <div class="cmd-empty-sub">Type a command above and press Enter. Use ↑ ↓ for history.</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommandExecutor;
