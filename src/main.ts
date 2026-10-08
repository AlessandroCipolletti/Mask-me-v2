import './style.css';
import { readConfig } from './config';
import { initialFlow } from './flow';
import { createSafeLogger } from './safeLogger';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application root missing');

function paragraph(text: string, className?: string): HTMLParagraphElement {
  const element = document.createElement('p');
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

try {
  const config = readConfig({
    mode: import.meta.env.MODE,
    provider: import.meta.env.VITE_PROVIDER,
  });
  const flow = initialFlow(Date.now());
  const log = createSafeLogger(config.debug);
  log('app_boot');

  const main = document.createElement('main');
  main.className = 'workspace';
  const heading = document.createElement('h1');
  heading.textContent = 'Avatar Studio';
  main.append(
    paragraph('Project foundation', 'eyebrow'),
    heading,
    paragraph(
      'The workspace is ready. Camera setup is coming in the next milestone.',
      'description',
    ),
    paragraph(`Status: ${flow.phase}`, 'status'),
  );
  if (config.debug && import.meta.env.MODE !== 'production') {
    main.append(
      paragraph(
        `Debug build · ${config.mode} · ${config.provider}`,
        'debug-note',
      ),
    );
  }
  app.replaceChildren(main);
} catch {
  // Boot errors are deliberately kept out of production UI and logs.
  const main = document.createElement('main');
  main.className = 'workspace';
  const heading = document.createElement('h1');
  heading.textContent = 'Unable to start';
  main.append(heading, paragraph('Check the build configuration and reload.'));
  app.replaceChildren(main);
}
