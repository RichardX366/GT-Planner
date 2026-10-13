import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GT's Banner course-detail endpoints don't send CORS headers, so the browser can't call
// them directly. Route them through the Vite server (dev and `vite preview`).
const bannerProxy = {
  '/banner': {
    target: 'https://registration.banner.gatech.edu',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/banner/, '/StudentRegistrationSsb/ssb'),
  },
};

export default defineConfig({
  plugins: [react()],
  server: { proxy: bannerProxy },
  preview: { proxy: bannerProxy },
});
