import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En desarrollo, todo lo que empiece con /api se lo pasamos a la API (puerto 3000).
    // Así el navegador cree que front y API son el MISMO sitio: la cookie de sesión
    // (sameSite strict) funciona igual que en producción, donde Vercel sirve los dos juntos.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
