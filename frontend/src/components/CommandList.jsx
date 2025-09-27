import { For } from 'solid-js';
import './CommandList.css';

function CommandList({ commands, selectedIndex, onSelect }) {
  const handleClick = (index) => {
    onSelect(index);
  };

  const handleMouseEnter = (index) => {
    onSelect(index);
  };

  return (
    <div class="command-list">
      <div class="command-list-scroll">
        <For each={commands}>
          {(command, index) => (
            <div
              class={`command-item ${index() === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleClick(index())}
              onMouseEnter={() => handleMouseEnter(index())}
            >
              <div class="command-icon">
                {command.icon}
              </div>
              <div class="command-content">
                <div class="command-title">
                  {command.title}
                </div>
                <div class="command-subtitle">
                  {command.subtitle}
                </div>
              </div>
              <div class="command-category">
                {command.category}
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

export default CommandList;
