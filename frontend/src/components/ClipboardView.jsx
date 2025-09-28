import { For } from 'solid-js';
import './ClipboardView.css';

function ClipboardView({
  clipboardData,
  filteredClipboardData,
  clipboardSelectedIndex,
  onItemClick
}) {
  return (
    <div class="clipboard-view">
      <div class="clipboard-header">
        <h2>📋 Clipboard History</h2>
        <p class="clipboard-hint">Click item to copy & close • Arrow keys to navigate • Enter to copy & close</p>
      </div>
      <div class="clipboard-list">
        <For each={filteredClipboardData}>
          {(item, index) => (
            <div
              class={`clipboard-item ${index() === clipboardSelectedIndex ? 'selected' : ''}`}
              onClick={() => onItemClick(item)}
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
        {filteredClipboardData.length === 0 && clipboardData.length > 0 && (
          <div class="no-clipboard-data">
            <div class="no-clipboard-icon">🔍</div>
            <div class="no-clipboard-text">No matching clipboard items</div>
          </div>
        )}
        {clipboardData.length === 0 && (
          <div class="no-clipboard-data">
            <div class="no-clipboard-icon">📋</div>
            <div class="no-clipboard-text">No clipboard data found</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClipboardView;
