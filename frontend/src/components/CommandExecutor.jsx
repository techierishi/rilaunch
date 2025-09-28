import { createSignal, createEffect, onMount } from 'solid-js';
import './CommandExecutor.css';

function CommandExecutor({
  output,
  isLoading,
  onExecute,
  lastExecutedCommand
}) {
  const [localCommand, setLocalCommand] = createSignal('');
  let inputRef;

  onMount(() => {
    setTimeout(() => {
      if (inputRef) {
        inputRef.focus();
        inputRef.setSelectionRange(inputRef.value.length, inputRef.value.length);
      }
    }, 100);
  });

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = localCommand().trim();
      if (cmd) {
        onExecute(cmd);
      }
    }
  };

  const handleInputChange = (e) => {
    setLocalCommand(e.target.value);
  };

  return (
    <div class="command-executor">
      <div class="command-header">
        <h2>⚡ Command Executor</h2>
        <p class="command-hint">Type shell commands and press Enter to execute</p>
      </div>

      <div class="command-input-section">
        <div class="command-prompt">$</div>
        <input
          ref={inputRef}
          type="text"
          class="command-input"
          value={localCommand()}
          onInput={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter shell command (e.g., ls, find, grep)"
          disabled={isLoading}
        />
        {isLoading && <div class="command-spinner">⏳</div>}
      </div>

      <div class="command-output-section">
        {output() ? (
          <div class="command-output">
            <div class="output-header">
              <span class="output-command">$ {lastExecutedCommand || 'No command executed'}</span>
              <div class="output-actions">
                <button
                  class="copy-button"
                  onClick={() => navigator.clipboard.writeText(output())}
                  title="Copy output"
                >
                  📋
                </button>
              </div>
            </div>
            <pre class="output-content">{output()}</pre>
          </div>
        ) : (
          <div class="no-output">
            <div class="no-output-icon">💻</div>
            <div class="no-output-text">No command executed yet</div>
            <div class="no-output-subtitle">Type a command above and press Enter</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommandExecutor;
