import React from 'react';

/**
 * `beforeinstallprompt` fires once, very early — usually before React has
 * hydrated. If nothing calls `preventDefault()` and keeps a reference to the
 * event, it is lost and the app can never show its own install button.
 *
 * This runs as a blocking inline script in <head> so the event is always
 * caught, then replayed to React via a custom event.
 */
const CAPTURE_SCRIPT = `(function(){
  window.__flousyInstallPrompt = window.__flousyInstallPrompt || null;
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    window.__flousyInstallPrompt = event;
    window.dispatchEvent(new Event('flousy:installprompt'));
  });
  window.addEventListener('appinstalled', function () {
    window.__flousyInstallPrompt = null;
  });
})();`;

export function InstallPromptCapture() {
  return <script dangerouslySetInnerHTML={{ __html: CAPTURE_SCRIPT }} />;
}
