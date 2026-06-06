import { For, Show } from 'solid-js';
import './ClipboardView.css';

function ClipboardView(props) {
  return (
    <div class="clipboard-view">
      <div class="clipboard-list">
        <For each={props.filteredClipboardData}>
          {(item, index) => (
            <div
              class={`clipboard-item${index() === props.clipboardSelectedIndex ? ' selected' : ''}`}
              onClick={() => props.onItemClick(item)}
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
        <Show when={props.filteredClipboardData.length === 0}>
          <div class="clip-empty">
            {props.clipboardData.length > 0 ? 'No matching items' : 'Clipboard is empty'}
          </div>
        </Show>
      </div>
    </div>
  );
}

export default ClipboardView;
