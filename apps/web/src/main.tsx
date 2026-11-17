import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/archivo/wdth.css'; // Archivo con eje de ancho (angosta para títulos)
import './estilos/global.css';
import { ErrorApi } from './api/cliente';
import { enrutador } from './rutas';
import { ProveedorSesion } from './sesion/sesion';
import { aplicarTemaGuardado } from './tema/tema';

aplicarTemaGuardado();

/**
 * TanStack Query guarda en caché lo que traemos de la API: si dos pantallas piden lo mismo,
 * se pide una sola vez, y al volver a una pantalla se muestra lo último mientras se actualiza.
 */
const clienteQuery = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Un error 4xx (permiso, no existe) no se arregla reintentando.
      retry: (intentos, error) =>
        !(error instanceof ErrorApi && error.estado < 500) && intentos < 2,
    },
  },
});

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Falta el elemento #raiz en index.html');

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={clienteQuery}>
      <ProveedorSesion>
        <RouterProvider router={enrutador} />
      </ProveedorSesion>
    </QueryClientProvider>
  </StrictMode>,
);
