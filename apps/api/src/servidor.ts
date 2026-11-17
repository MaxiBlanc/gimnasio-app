import { crearApp } from './app';
import { entorno } from './config/entorno';

const app = crearApp();

app.listen(entorno.PUERTO, () => {
  console.log(`🏋️  API escuchando en http://localhost:${entorno.PUERTO}`);
});
