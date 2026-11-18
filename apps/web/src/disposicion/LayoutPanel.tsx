import { useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { LogOut, Menu, X } from 'lucide-react';
import { NOMBRES_ROL, type RolSesion, type UsuarioSesion } from '@gimnasio/compartido';
import { BotonTema } from '../componentes/BotonTema';
import { useSesion } from '../sesion/sesion';
import { aplicarMarca, MARCA_APP } from '../tema/marca';
import estilos from './LayoutPanel.module.css';

export interface ItemMenu {
  ruta: string;
  etiqueta: string;
  Icono: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  /** Roles que ven este ítem. */
  roles: RolSesion[];
  /** true si solo se marca activo en la ruta exacta (para "Inicio"). */
  exacto?: boolean;
}

interface Props {
  usuario: UsuarioSesion;
  menu: ItemMenu[];
  /** A dónde ir después de cerrar sesión. */
  alSalir: string;
}

/**
 * Esqueleto del panel: menú lateral en la PC, barra arriba con menú desplegable en el celular.
 * Los colores salen de la marca del gimnasio del usuario.
 */
export function LayoutPanel({ usuario, menu, alSalir }: Props) {
  const { salir } = useSesion();
  const navegar = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const gimnasio = usuario.gimnasio;
  const nombre = gimnasio?.nombre ?? 'GimnasioApp';

  useEffect(() => aplicarMarca(gimnasio ?? MARCA_APP), [gimnasio]);

  const items = menu.filter((item) => item.roles.includes(usuario.rol));

  const cerrarSesion = async () => {
    await salir();
    void navegar(alSalir, { replace: true });
  };

  return (
    <div className={estilos.panel}>
      <header className={estilos.lateral} data-abierto={menuAbierto}>
        <div className={estilos.marca}>
          {gimnasio?.logoUrl ? (
            <img className={estilos.logo} src={gimnasio.logoUrl} alt={nombre} />
          ) : (
            <span className={`titular ${estilos.nombreGimnasio}`}>{nombre}</span>
          )}
          <button
            type="button"
            className={`boton boton-icono ${estilos.botonMenu}`}
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            aria-expanded={menuAbierto}
            aria-controls="menu-principal"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          >
            {menuAbierto ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>

        <div className={estilos.desplegable} id="menu-principal">
          <nav aria-label="Principal">
            <ul className={estilos.menu}>
              {items.map(({ ruta, etiqueta, Icono, exacto }) => (
                <li key={ruta}>
                  <NavLink
                    to={ruta}
                    end={exacto}
                    className={estilos.item}
                    // En el celular, elegir una sección cierra el menú.
                    onClick={() => setMenuAbierto(false)}
                  >
                    <Icono size={19} aria-hidden />
                    {etiqueta}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className={estilos.usuario}>
            <div>
              <strong>{usuario.nombre}</strong>
              <span className={estilos.rol}>{NOMBRES_ROL[usuario.rol]}</span>
            </div>
            <div className={estilos.acciones}>
              <BotonTema />
              <button
                type="button"
                className="boton boton-fantasma boton-icono"
                onClick={cerrarSesion}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={18} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className={estilos.contenido}>
        <Outlet />
      </main>
    </div>
  );
}
