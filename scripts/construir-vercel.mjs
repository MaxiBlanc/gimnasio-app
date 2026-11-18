/**
 * Arma el deploy de Vercel en `.vercel/output` (la "Build Output API" de Vercel).
 *
 * ¿Por qué a mano y no con la detección automática de Vercel? Porque es un monorepo con
 * TypeScript que importa sin extensión (".js"), un paquete compartido y el cliente de Prisma
 * generado: compilarlo nosotros con esbuild en UN solo archivo evita sorpresas en la nube.
 *
 * Resultado:
 *   .vercel/output/static/        → la web (lo que genera Vite)
 *   .vercel/output/functions/api.func/  → la API entera, en un archivo
 *   .vercel/output/config.json    → reglas: /api/* va a la función; el resto, a la web
 *
 * Uso: npm run build:vercel  (y después npm run deploy)
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const SALIDA = '.vercel/output';
const FUNCION = `${SALIDA}/functions/api.func`;

console.log('▸ Limpiando la salida anterior');
rmSync(SALIDA, { recursive: true, force: true });

console.log('▸ Generando el cliente de Prisma');
execSync('npm run db:generar -w @gimnasio/api', { stdio: 'inherit' });

console.log('▸ Compilando la web (Vite)');
execSync('npm run build -w @gimnasio/web', { stdio: 'inherit' });
mkdirSync(SALIDA, { recursive: true });
cpSync('apps/web/dist', `${SALIDA}/static`, { recursive: true });

console.log('▸ Empaquetando la API (esbuild)');
await build({
  entryPoints: ['apps/api/src/vercel.ts'],
  outfile: `${FUNCION}/index.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  // pg intenta cargar "pg-native" solo si existe; no lo usamos.
  external: ['pg-native'],
  // Algunas dependencias son CommonJS y usan require(): en un módulo ESM hay que crearlo.
  banner: {
    js: "import { createRequire as __crearRequire } from 'node:module'; const require = __crearRequire(import.meta.url);",
  },
  logLevel: 'warning',
});
writeFileSync(
  `${FUNCION}/.vc-config.json`,
  JSON.stringify(
    { runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', maxDuration: 30 },
    null,
    2,
  ),
);

console.log('▸ Escribiendo las reglas de ruteo');
writeFileSync(
  `${SALIDA}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        // Los archivos de Vite llevan hash en el nombre: se pueden cachear para siempre.
        {
          src: '/assets/(.*)',
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
          continue: true,
        },
        // El service worker siempre se pide de nuevo, para que las actualizaciones lleguen.
        { src: '/sw.js', headers: { 'cache-control': 'no-cache' }, continue: true },
        // Toda la API va a la función.
        { src: '/api/(.*)', dest: '/api' },
        // Si existe el archivo (JS, CSS, íconos…), se sirve tal cual…
        { handle: 'filesystem' },
        // …y cualquier otra ruta (/panel/socios, /g/power-gym…) es la web: React Router decide.
        { src: '/(.*)', dest: '/index.html' },
      ],
      // Cron de Vercel (el plan gratis permite uno por día): mails de cuota por vencer o
      // vencida. 12:00 UTC = 9:00 en Argentina. Vercel le agrega el header con CRON_SECRET.
      crons: [{ path: '/api/cron/avisos', schedule: '0 12 * * *' }],
    },
    null,
    2,
  ),
);

console.log('✔ Listo: .vercel/output');
