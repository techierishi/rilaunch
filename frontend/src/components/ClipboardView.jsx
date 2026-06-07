import { For, Show } from 'solid-js';
import './ClipboardView.css';

// --- SVGs for Eye and Eye-Slash Icons ---
const IconEye = () => (
  <svg class="eye-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeSlash = () => (
  <svg class="eye-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

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
              <div class={`clip-text${item.is_secret ? ' masked' : ''}`}>
                {item.content || item.text || 'No content'}
              </div>
              <div class="clip-meta">
                <span class="clip-type">{item.type || 'text'}</span>
                <div class="clip-meta-right">
                  <button
                    class="clip-mask-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onToggleSecret(item);
                    }}
                    title={item.is_secret ? 'Reveal content' : 'Mask content'}
                  >
                    <Show when={item.is_secret} fallback={<IconEye />}>
                      <IconEyeSlash />
                    </Show>
                  </button>
                  <span class="clip-time">
                    {item.timestamp ? new Date(item.timestamp * 1000).toLocaleTimeString() : ''}
                  </span>
                </div>
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


