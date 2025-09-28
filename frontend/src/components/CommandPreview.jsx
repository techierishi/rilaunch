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

      </div>

      <div class="preview-content">

      </div>
    </div>
  );
}

export default CommandPreview;
