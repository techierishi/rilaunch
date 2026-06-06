import { Show } from 'solid-js';
import CommandList from './CommandList';

function ApplicationView(props) {
  return (
    <Show
      when={props.apps.length > 0}
      fallback={
        <div class="empty-state">
          <div class="empty-icon">⊘</div>
          <div class="empty-text">No applications found</div>
          <div class="empty-sub">Try a different search term</div>
        </div>
      }
    >
      <CommandList
        commands={props.apps}
        selectedIndex={props.selectedIndex}
        onSelect={props.onSelect}
        onLaunch={props.onLaunch}
      />
    </Show>
  );
}

export default ApplicationView;
