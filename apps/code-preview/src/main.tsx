import {
  configuredParentOrigin,
  createBrowserHostPort,
  createDomPreviewSurface,
  createPreviewBridge,
  installPreviewCsp,
} from './bridge';

const root = document.getElementById('root');
if (root === null) throw new Error('The preview application is missing its root element.');

installPreviewCsp(document);

try {
  const parentOrigin = configuredParentOrigin(window.location.href);
  const surface = createDomPreviewSurface(document, root);
  const session = createPreviewBridge({
    host: createBrowserHostPort(window, parentOrigin),
    surface,
  });
  window.addEventListener(
    'pagehide',
    () => {
      session.dispose();
    },
    { once: true },
  );
} catch (error) {
  root.setAttribute('role', 'alert');
  root.textContent =
    error instanceof Error ? error.message : 'The isolated preview could not start.';
}
