import '@fontsource-variable/jetbrains-mono';
import '@xterm/xterm/css/xterm.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);

if (import.meta.env.DEV) {
  // Lets tools/e2e.mjs drive the real app. This code is not in release builds.
  void Promise.all([
    import('./store'),
    import('./lib/actions'),
    import('./lib/engines'),
    import('./lib/terminals'),
    import('./lib/api'),
  ]).then(([store, actions, engines, terminals, api]) => {
    Object.assign(window, { __sy: { useStore: store.useStore, actions, engines, terminals, api: api.api } });
  });
}
