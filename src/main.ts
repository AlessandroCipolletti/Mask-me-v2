import './style.css';
import { readConfig } from './config';
import { createSafeLogger } from './safeLogger';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application root missing');

try {
  const config = readConfig({
    mode: import.meta.env.MODE,
    provider: import.meta.env.VITE_PROVIDER,
  });
  const log = createSafeLogger(config.debug);
  log('app_boot');

  if (location.pathname === '/provider') {
    void import('./provider/ProviderWorkspace')
      .then(({ mountProviderWorkspace }) => mountProviderWorkspace(app, false))
      .catch(() => {
        app.textContent =
          'The provider connection page could not load. Reload and try again.';
      });
  } else if (
    import.meta.env.MODE !== 'production' &&
    location.pathname === '/dev/generation'
  ) {
    void import('./generation/StudioWorkspace')
      .then(({ mountStudioWorkspace }) => mountStudioWorkspace(app, true))
      .catch(() => {
        app.textContent =
          'The generation lab could not load. Reload and try again.';
      });
  } else if (
    import.meta.env.MODE !== 'production' &&
    location.pathname === '/dev/avatar'
  ) {
    void import('./dev/avatarPage')
      .then(({ mountAvatarLab }) => mountAvatarLab(app))
      .catch(() => {
        app.textContent =
          'The avatar lab could not load. Check WebGL2 and reload.';
      });
  } else if (
    import.meta.env.MODE !== 'production' &&
    location.pathname === '/dev/tracking'
  ) {
    void import('./dev/trackingPage')
      .then(({ mountTrackingLab }) => mountTrackingLab(app))
      .catch(() => {
        app.textContent =
          'The tracking lab could not load. Reload and try again.';
      });
  } else {
    void import('./generation/StudioWorkspace')
      .then(({ mountStudioWorkspace }) => mountStudioWorkspace(app))
      .catch(() => {
        app.textContent = 'The studio could not load. Reload and try again.';
      });
  }
} catch {
  // Boot errors are deliberately kept out of production UI and logs.
  const main = document.createElement('main');
  main.className = 'workspace';
  const heading = document.createElement('h1');
  heading.textContent = 'Unable to start';
  const message = document.createElement('p');
  message.textContent = 'Check the build configuration and reload.';
  main.append(heading, message);
  app.replaceChildren(main);
}
