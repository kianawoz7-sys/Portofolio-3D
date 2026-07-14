import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

type ViteHotContext = {
  on: (event: 'vite:beforeUpdate', callback: () => void) => void;
  dispose: (callback: () => void) => void;
};

const previousScrollRestoration = window.history.scrollRestoration;

const scrollToPageTop = (removeInitialHash = false) => {
  window.history.scrollRestoration = 'manual';

  if (removeInitialHash && window.location.hash) {
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
  }

  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
};

// Run before React paints so browser restoration or an initial hash cannot reveal a later chapter.
scrollToPageTop(true);

// Some engines apply their saved position after the first script pass. Reassert the
// initial position once the first layout has settled without affecting later navigation.
const initialTopFrame = window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => scrollToPageTop());
});
const handleInitialPageShow = () => scrollToPageTop();
window.addEventListener('pageshow', handleInitialPageShow, { once: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const hot = (import.meta as ImportMeta & { hot?: ViteHotContext }).hot;

if (hot) {
  hot.on('vite:beforeUpdate', () => scrollToPageTop());
  hot.dispose(() => {
    window.cancelAnimationFrame(initialTopFrame);
    window.removeEventListener('pageshow', handleInitialPageShow);
    window.history.scrollRestoration = previousScrollRestoration;
  });
}
