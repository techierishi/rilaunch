import { Show } from 'solid-js';
import './SearchBar.css';

// SearchBar: unified input for all tabs.
// Shell mode: $ prompt, monospace font, ghost-text inline autocomplete.
// Accept suggestion with → (ArrowRight) when cursor is at end.
function SearchBar(props) {
  // The un-typed remainder of the best history match
  const ghostRemainder = () => {
    const sug = props.suggestion || '';
    const val = props.value || '';
    if (!sug || !val) return '';
    if (sug.toLowerCase().startsWith(val.toLowerCase())) return sug.slice(val.length);
    return '';
  };

  return (
    <div class="search-bar">
      <Show
        when={props.isShellMode}
        fallback={
          <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none"
            stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="6.5" cy="6.5" r="4.5"/>
            <line x1="10.5" y1="10.5" x2="14" y2="14"/>
          </svg>
        }
      >
        <span class="shell-prompt-icon">$</span>
      </Show>

      <div class="search-input-wrap">
        {/* Ghost text: typed (transparent spacer) + suggestion remainder (gray) */}
        <Show when={props.isShellMode && ghostRemainder()}>
          <div class="shell-ghost" aria-hidden="true">
            <span class="ghost-typed">{props.value}</span><span class="ghost-suggestion">{ghostRemainder()}</span>
          </div>
        </Show>

        <input
          ref={props.ref}
          type="text"
          class={"search-input" + (props.isShellMode ? " shell-input" : "")}
          placeholder={props.placeholder || 'Search...'}
          value={props.value}
          onInput={(e) => props.onInput(e.target.value)}
          autocomplete="off"
          spellcheck={false}
        />
      </div>
    </div>
  );
}

export default SearchBar;
