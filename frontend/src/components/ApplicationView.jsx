import { For } from 'solid-js';
import CommandList from './CommandList';
import CommandPreview from './CommandPreview';

function ApplicationView({
  apps,
  selectedIndex,
  onSelect,
  onLaunch
}) {
  console.log("apps ", apps)
  return (
    <>
      <div class="content-area">
        <CommandList
          commands={apps}
          selectedIndex={selectedIndex}
          onSelect={onSelect}
          onLaunch={onLaunch}
        />
        <CommandPreview
          command={apps[selectedIndex]}
        />
      </div>
      {apps.length === 0 && (
        <div class="no-results">
          <div class="no-results-icon">🔍</div>
          <div class="no-results-text">No applications found</div>
          <div class="no-results-subtitle">Try a different search term</div>
        </div>
      )}
    </>
  );
}

export default ApplicationView;
