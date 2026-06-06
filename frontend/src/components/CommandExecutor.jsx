import { Show } from 'solid-js';
import './CommandExecutor.css';

// Shell output panel — the SearchBar above is the command input.
// This component only displays the output of the last executed command.
function CommandExecutor(props) {
  return (
    <div class="command-executor">
      <Show when={props.isLoading}>
        <div class="cmd-running-indicator">
          <span class="cmd-spinner" />
          <span class="cmd-running-text">Executing...</span>
        </div>
      </Show>

      <Show when={!props.output && !props.isLoading}>
        <div class="cmd-empty-state">
          <div class="cmd-empty-prompt">$<span class="cmd-cursor">▌</span></div>
          <div class="cmd-empty-hint">Type a command above and press Enter</div>
        </div>
      </Show>

      <Show when={!!props.output && !props.isLoading}>
        <div class="cmd-output">
          <pre class="cmd-output-text">{props.output}</pre>
        </div>
      </Show>
    </div>
  );
}

export default CommandExecutor;
