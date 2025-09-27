import './CommandPreview.css';

function CommandPreview({ command }) {
  if (!command) {
    return (
      <div class="command-preview">
        <div class="preview-empty">
          <div class="preview-empty-icon">✨</div>
          <div class="preview-empty-text">Select a command to see details</div>
        </div>
      </div>
    );
  }

  return (
    <div class="command-preview">
      <div class="preview-header">
        <div class="preview-icon">
          {command.icon}
        </div>
        <div class="preview-title-section">
          <h2 class="preview-title">{command.title}</h2>
          <p class="preview-subtitle">{command.subtitle}</p>
        </div>
      </div>

      <div class="preview-content">
        <div class="preview-section">
          <h3 class="section-title">Category</h3>
          <div class="category-badge">
            {command.category}
          </div>
        </div>

        <div class="preview-section">
          <h3 class="section-title">Description</h3>
          <p class="section-content">
            This command allows you to {command.title.toLowerCase()}.
            {command.subtitle && ` ${command.subtitle}.`}
          </p>
        </div>

        <div class="preview-section">
          <h3 class="section-title">Keyboard Shortcuts</h3>
          <div class="shortcuts">
            <div class="shortcut">
              <span class="shortcut-key">Enter</span>
              <span class="shortcut-desc">Execute command</span>
            </div>
            <div class="shortcut">
              <span class="shortcut-key">⌘ + Enter</span>
              <span class="shortcut-desc">Execute without closing</span>
            </div>
          </div>
        </div>

        <div class="preview-section">
          <h3 class="section-title">Details</h3>
          <div class="details-list">
            <div class="detail-item">
              <span class="detail-label">ID:</span>
              <span class="detail-value">{command.id}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Type:</span>
              <span class="detail-value">System Command</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Status:</span>
              <span class="detail-value status-active">Active</span>
            </div>
          </div>
        </div>
      </div>

      <div class="preview-footer">
        <button class="action-button primary">
          Execute Command
        </button>
        <button class="action-button secondary">
          Add to Favorites
        </button>
      </div>
    </div>
  );
}

export default CommandPreview;
