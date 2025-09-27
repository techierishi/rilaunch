import { createEffect } from 'solid-js';
import './SearchBar.css';

function SearchBar({ searchQuery, setSearchQuery }) {
  let inputRef;

  createEffect(() => {
    // Focus the input when component mounts
    if (inputRef) {
      inputRef.focus();
    }
  });

  const handleInput = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleKeyDown = (e) => {
    // Prevent default behavior for arrow keys to let parent handle navigation
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
    }
  };

  return (
    <div class="search-bar">
      <div class="search-icon">
        🔍
      </div>
      <input
        ref={inputRef}
        type="text"
        class="search-input"
        placeholder="Search for commands..."
        value={searchQuery}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        autocomplete="off"
        spellcheck={false}
      />
      <div class="search-shortcut">
        <span class="shortcut-key">⌘</span>
        <span class="shortcut-key">K</span>
      </div>
    </div>
  );
}

export default SearchBar;
