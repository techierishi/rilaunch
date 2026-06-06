import CommandList from './CommandList';

function ApplicationView({ apps, selectedIndex, onSelect, onLaunch }) {
  if (apps.length === 0) {
    return (
      <div class="empty-state">
        <div class="empty-icon">⊘</div>
        <div class="empty-text">No applications found</div>
        <div class="empty-sub">Try a different search term</div>
      </div>
    );
  }

  return (
    <CommandList
      commands={apps}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      onLaunch={onLaunch}
    />
  );
}

export default ApplicationView;
