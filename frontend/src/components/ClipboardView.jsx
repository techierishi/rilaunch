import { For } from 'solid-js';
import './ClipboardView.css';

function ClipboardView({ clipboardData, filteredClipboardData, clipboardSelectedIndex, onItemClick }) {
  return (
    <div class="clipboard-view">
      <div class="clipboard-list">
        <For each={filteredClipboardData}>
          {(item, index) => (
            <div
              class={`clipboard-item${index() === clipboardSelectedIndex ? ' selected' : ''}`}
              onClick={() => onItemClick(item)}
            >
              <div class="clip-text">{item.content || item.text || 'No content'}</div>
              <div class="clip-meta">
                <span class="clip-type">{item.type || 'text'}</span>
                <span class="clip-time">
                  {item.timestamp ? new Date(item.timestamp * 1000).toLocaleTimeString() : ''}
                </span>
              </div>
            </div>
          )}
        </For>
        {filteredClipboardData.length === 0 && (
          <div class="clip-empty">
            {clipboardData.length > 0 ? 'No matching items' : 'Clipboard is empty'}
          </div>
        )}
      </div>
    </div>
  );
}

export default ClipboardView;
