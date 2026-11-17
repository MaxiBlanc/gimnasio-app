import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { Building2, House, Users } from 'lucide-react';
import type { Rol, UsuarioSesion } from '@gimnasio/compartido';
import { LayoutPanel, type ItemMenu } from './disposicion/LayoutPanel';
import { ElegirGimnasio } from './paginas/ElegirGimnasio';
import { InicioAdmin } from './paginas/InicioAdmin';
import { InicioPanel } from './paginas/InicioPanel';
import { LoginAdmin } from './paginas/LoginAdmin';
import { LoginStaff } from './paginas/LoginStaff';
import { NoEncontrada } from './paginas/NoEncontrada';
import { SocioFicha } from './paginas/socios/SocioFicha';
import { SocioEditar, SocioNuevo } from './paginas/socios/SocioNuevo';
import { SociosLista } from './paginas/socios/SociosLista';
import { useSesion } from './sesion/sesion';
import { leerUltimoGimnasio } from './sesion/ultimoGimnasio';

const ROLES_STAFF: Rol[] = ['DUENO', 'RECEPCION', 'PROFESOR', 'KIOSCO'];

const MENU_STAFF: ItemMenu[] = [
  { ruta: '/panel', etiqueta: 'Inicio', Icono: House, roles: ROLES_STAFF, exacto: true },
  {
    ruta: '/panel/socios',
    etiqueta: 'Socios',
    Icono: Users,
    roles: ['DUENO', 'RECEPCION', 'PROFESOR'],
  },
];

const MENU_ADMIN: ItemMenu[] = [
  { ruta: '/admin', etiqueta: 'Gimnasios', Icono: Building2, roles: ['SUPERADMIN'], exacto: true },
];

/**
 * Protege un grupo de rutas: si no hay sesión con alguno de esos roles, manda al login.
 * Ojo: esto es solo comodidad para el usuario. La seguridad de verdad está en la API,
 * que rechaza cualquier pedido sin permiso aunque alguien saltee esta pantalla.
 */
interface PropsConSesion {
  roles: Rol[];
  children: (usuario: UsuarioSesion) => ReactNode;
}

function ConSesion({ roles, children }: PropsConSesion) {
  const { cargando, usuario } = useSesion();
  if (cargando)
    return (
      <p className="texto-suave" style={{ padding: '2rem' }}>
        Cargando…
      </p>
    );
  if (!usuario || !roles.includes(usuario.rol)) {
    if (roles.includes('SUPERADMIN')) return <Navigate to="/admin/ingresar" replace />;
    const ultimo = leerUltimoGimnasio();
    return <Navigate to={ultimo ? `/g/${ultimo.slug}` : '/'} replace />;
  }
  return children(usuario);
}

export const enrutador = createBrowserRouter([
  { path: '/', element: <ElegirGimnasio /> },
  { path: '/g/:slug', element: <LoginStaff /> },
  { path: '/admin/ingresar', element: <LoginAdmin /> },
  {
    path: '/panel',
    element: (
      <ConSesion roles={ROLES_STAFF}>
        {(usuario) => (
          <LayoutPanel
            usuario={usuario}
            menu={MENU_STAFF}
            alSalir={usuario.gimnasio ? `/g/${usuario.gimnasio.slug}` : '/'}
          />
        )}
      </ConSesion>
    ),
    children: [
      { index: true, element: <InicioPanel /> },
      { path: 'socios', element: <SociosLista /> },
      { path: 'socios/nuevo', element: <SocioNuevo /> },
      { path: 'socios/:id', element: <SocioFicha /> },
      { path: 'socios/:id/editar', element: <SocioEditar /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <ConSesion roles={['SUPERADMIN']}>
        {(usuario) => <LayoutPanel usuario={usuario} menu={MENU_ADMIN} alSalir="/admin/ingresar" />}
      </ConSesion>
    ),
    children: [{ index: true, element: <InicioAdmin /> }],
  },
  { path: '*', element: <NoEncontrada /> },
]);
