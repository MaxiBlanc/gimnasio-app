// Punto de entrada del paquete compartido. Lo importan la API y la web:
//   import { ROLES, type Rol } from '@gimnasio/compartido';
export * from './roles';
export * from './auth';
export * from './gimnasios';
export * from './planes';
export * from './socios';
export * from './texto';
export * from './pagos';

export const NOMBRE_APP = 'GimnasioApp';
