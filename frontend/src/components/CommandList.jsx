import { For, createResource, Show } from 'solid-js';
import './CommandList.css';

// Deterministic color from string
function nameToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 50%, 52%)`;
}

// Lazy-loading app icon with letter avatar fallback
function AppIcon({ appPath, name }) {
  const [iconSrc] = createResource(
    () => appPath,
    (path) => path ? GetAppIcon(path) : Promise.resolve('')
  );

  return (
    <Show
      when={iconSrc() && iconSrc().startsWith('data:')}
      fallback={
        <div
          class="app-letter-icon"
          style={{ background: nameToColor(name || '?') }}
        >
          {(name || '?')[0].toUpperCase()}
        </div>
      }
    >
      <img src={iconSrc()} class="app-real-icon" alt="" />
    </Show>
  );
}

function CommandList(props) {
  const handleClick = (command, index) => {
    props.onSelect(index);
    if (props.onLaunch) props.onLaunch(command);
  };

  return (
    <div class="command-list">
      <div class="command-list-scroll">
        <For each={props.commands}>
          {(command, index) => (
            <div
              class={"command-item" + (index() === props.selectedIndex ? ' selected' : '')}
              onClick={() => handleClick(command, index())}
              onMouseEnter={() => props.onSelect(index())}
            >
              <div class="command-icon">
                <AppIcon
                  appPath={command.appData?.path || command.appData?.Path || ''}
                  name={command.title}
                />
              </div>
              <div class="command-content">
                <div class="command-title">{command.title}</div>
                <div class="command-subtitle">{command.subtitle}</div>
              </div>
              <div class="command-category">{command.category}</div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

export default CommandList;
