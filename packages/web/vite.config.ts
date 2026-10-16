import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so dist works from a subpath (GitHub Pages) as well as a domain root.
  base: './',
  plugins: [preact()],
  server: { port: 5173, strictPort: true },
});
