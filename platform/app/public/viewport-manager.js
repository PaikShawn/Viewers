(function () {
  const handled = new WeakSet();

  function setupViewport(viewport) {
    if (handled.has(viewport)) return;
    handled.add(viewport);

    const data = { isFloating: false, originalStyle: {} };

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.style.cssText = `
      position: absolute;
      bottom: 0;
      right: 0;
      width: 24px;
      height: 24px;
      cursor: se-resize;
      z-index: 99999;
      background: linear-gradient(135deg, transparent 50%, rgba(0,212,255,0.4) 50%);
    `;

    // Dock button
    const dockBtn = document.createElement('button');
    dockBtn.textContent = '⊡';
    dockBtn.style.cssText = `
      position: absolute;
      top: 32px;
      right: 4px;
      width: 18px;
      height: 18px;
      border-radius: 4px;
      background: #22c55e;
      border: none;
      cursor: pointer;
      z-index: 99999;
      display: none;
      font-size: 10px;
      color: black;
      line-height: 1;
      padding: 0;
    `;

    viewport.style.position = 'relative';
    viewport.appendChild(resizeHandle);
    viewport.appendChild(dockBtn);

    function floatViewport() {
      if (data.isFloating) return;
      const rect = viewport.getBoundingClientRect();
      data.originalStyle = {
        position: viewport.style.position,
        left: viewport.style.left,
        top: viewport.style.top,
        width: viewport.style.width,
        height: viewport.style.height,
        zIndex: viewport.style.zIndex,
        boxShadow: viewport.style.boxShadow,
        borderRadius: viewport.style.borderRadius,
      };
      viewport.style.position = 'fixed';
      viewport.style.left = rect.left + 'px';
      viewport.style.top = rect.top + 'px';
      viewport.style.width = rect.width + 'px';
      viewport.style.height = rect.height + 'px';
      viewport.style.zIndex = '9998';
      viewport.style.boxShadow = '0 8px 32px rgba(0,0,0,0.8)';
      viewport.style.borderRadius = '8px';
      data.isFloating = true;
      dockBtn.style.display = 'block';
    }

    // Ctrl+drag to move
    viewport.addEventListener('mousedown', function(e) {
      if (!e.ctrlKey) return;
      const t = e.target;
      if (t === resizeHandle || t === dockBtn || t.closest('button') || t.closest('[role="button"]')) return;

      e.preventDefault();
      floatViewport();

      const startX = e.clientX - parseInt(viewport.style.left || '0');
      const startY = e.clientY - parseInt(viewport.style.top || '0');

      function onMove(e) {
        viewport.style.left = Math.max(0, e.clientX - startX) + 'px';
        viewport.style.top = Math.max(0, e.clientY - startY) + 'px';
      }
      function onUp() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }, true);

    // Resize
    resizeHandle.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
      floatViewport();

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = viewport.offsetWidth;
      const startH = viewport.offsetHeight;

      function onMove(e) {
        viewport.style.width = Math.max(200, startW + e.clientX - startX) + 'px';
        viewport.style.height = Math.max(150, startH + e.clientY - startY) + 'px';
      }
      function onUp() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    // Dock back
    dockBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      viewport.style.position = data.originalStyle.position || 'relative';
      viewport.style.left = data.originalStyle.left || '';
      viewport.style.top = data.originalStyle.top || '';
      viewport.style.width = data.originalStyle.width || '';
      viewport.style.height = data.originalStyle.height || '';
      viewport.style.zIndex = data.originalStyle.zIndex || '';
      viewport.style.boxShadow = '';
      viewport.style.borderRadius = '';
      data.isFloating = false;
      dockBtn.style.display = 'none';
    });
  }

  function scanViewports() {
    document.querySelectorAll('[data-cy="viewport-pane"]').forEach(setupViewport);
  }

  // Keep scanning every second until viewports appear
  const interval = setInterval(() => {
    scanViewports();
  }, 1000);

  // Stop after 30 seconds
  setTimeout(() => clearInterval(interval), 30000);

  // Also watch for DOM changes
  new MutationObserver(scanViewports).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
