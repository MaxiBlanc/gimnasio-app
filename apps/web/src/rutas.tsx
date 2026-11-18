import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { Building2, House, Settings, Tags, Users } from 'lucide-react';
import type { RolSesion, UsuarioSesion } from '@gimnasio/compartido';
import { LayoutPanel, type ItemMenu } from './disposicion/LayoutPanel';
import { ElegirGimnasio } from './paginas/ElegirGimnasio';
import { InicioAdmin } from './paginas/InicioAdmin';
import { InicioPanel } from './paginas/InicioPanel';
import { LoginAdmin } from './paginas/LoginAdmin';
import { LoginStaff } from './paginas/LoginStaff';
import { Configuracion } from './paginas/configuracion/Configuracion';
import { GimnasioDetalle } from './paginas/admin/GimnasioDetalle';
import { GimnasioNuevo } from './paginas/admin/GimnasioNuevo';
import { ActivarCuenta } from './paginas/ActivarCuenta';
import { ErrorDePantalla } from './paginas/ErrorDePantalla';
import { NoEncontrada } from './paginas/NoEncontrada';
import { PlanesDescuentos } from './paginas/planes/PlanesDescuentos';
import { SocioFicha } from './paginas/socios/SocioFicha';
import { SocioEditar, SocioNuevo } from './paginas/socios/SocioNuevo';
import { SociosLista } from './paginas/socios/SociosLista';
import { useSesion } from './sesion/sesion';
import { leerUltimoGimnasio } from './sesion/ultimoGimnasio';

const ROLES_STAFF: RolSesion[] = ['DUENO', 'RECEPCION', 'PROFESOR', 'KIOSCO'];

const MENU_STAFF: ItemMenu[] = [
  { ruta: '/panel', etiqueta: 'Inicio', Icono: House, roles: ROLES_STAFF, exacto: true },
  {
    ruta: '/panel/socios',
    etiqueta: 'Socios',
    Icono: Users,
    roles: ['DUENO', 'RECEPCION', 'PROFESOR'],
  },
  { ruta: '/panel/planes', etiqueta: 'Planes y descuentos', Icono: Tags, roles: ['DUENO'] },
  { ruta: '/panel/configuracion', etiqueta: 'Configuración', Icono: Settings, roles: ['DUENO'] },
];

const MENU_ADMIN: ItemMenu[] = [
  { ruta: '/admin', etiqueta: 'Gimnasios', Icono: Building2, roles: ['SUPERADMIN'] },
];

/**
 * Protege un grupo de rutas: si no hay sesión con alguno de esos roles, manda al login.
 * Ojo: esto es solo comodidad para el usuario. La seguridad de verdad está en la API,
 * que rechaza cualquier pedido sin permiso aunque alguien saltee esta pantalla.
 */
interface PropsConSesion {
  roles: RolSesion[];
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

/** Dentro del panel: una pantalla solo para algunos roles (el resto vuelve al inicio). */
function SoloRoles({ roles, children }: { roles: RolSesion[]; children: ReactNode }) {
  const { usuario } = useSesion();
  if (!usuario || !roles.includes(usuario.rol)) return <Navigate to="/panel" replace />;
  return children;
}

export const enrutador = createBrowserRouter([
  {
    // Si cualquier pantalla falla, se muestra ErrorDePantalla en vez de quedar en blanco.
    errorElement: <ErrorDePantalla />,
    children: [
      { path: '/', element: <ElegirGimnasio /> },
      { path: '/g/:slug', element: <LoginStaff /> },
      { path: '/g/:slug/activar', element: <ActivarCuenta /> },
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
          {
            path: 'socios/nuevo',
            element: (
              <SoloRoles roles={['DUENO', 'RECEPCION']}>
                <SocioNuevo />
              </SoloRoles>
            ),
          },
          { path: 'socios/:id', element: <SocioFicha /> },
          {
            path: 'socios/:id/editar',
            element: (
              <SoloRoles roles={['DUENO', 'RECEPCION']}>
                <SocioEditar />
              </SoloRoles>
            ),
          },
          {
            path: 'planes',
            element: (
              <SoloRoles roles={['DUENO']}>
                <PlanesDescuentos />
              </SoloRoles>
            ),
          },
          {
            path: 'configuracion',
            element: (
              <SoloRoles roles={['DUENO']}>
                <Configuracion />
              </SoloRoles>
            ),
          },
        ],
      },
      {
        path: '/admin',
        element: (
          <ConSesion roles={['SUPERADMIN']}>
            {(usuario) => (
              <LayoutPanel usuario={usuario} menu={MENU_ADMIN} alSalir="/admin/ingresar" />
            )}
          </ConSesion>
        ),
        children: [
          { index: true, element: <InicioAdmin /> },
          { path: 'gimnasios/nuevo', element: <GimnasioNuevo /> },
          { path: 'gimnasios/:id', element: <GimnasioDetalle /> },
        ],
      },
      { path: '*', element: <NoEncontrada /> },
    ],
  },
]);
