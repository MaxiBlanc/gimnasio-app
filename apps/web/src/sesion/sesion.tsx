import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type {
  DatosLoginAdmin,
  DatosLoginStaff,
  RespuestaSesion,
  UsuarioSesion,
} from '@gimnasio/compartido';
import { escucharSesion, fijarSesion, pedir, refrescarSesion } from '../api/cliente';

/**
 * Contexto de sesión: cualquier componente puede saber quién está logueado con `useSesion()`.
 *
 * (Los hooks se llaman "use..." aunque el resto del código esté en castellano: es la
 * convención de React y las herramientas, como ESLint, la usan para reconocerlos.)
 *
 * Al abrir la app no sabemos si hay sesión: el token de acceso no sobrevive a una recarga.
 * Por eso arrancamos en "cargando" y probamos refrescar con la cookie. Recién ahí sabemos
 * si mostrar el panel o el login.
 */
interface ValorSesion {
  cargando: boolean;
  usuario: UsuarioSesion | null;
  ingresarStaff: (datos: DatosLoginStaff) => Promise<UsuarioSesion>;
  ingresarAdmin: (datos: DatosLoginAdmin) => Promise<UsuarioSesion>;
  salir: () => Promise<void>;
}

const ContextoSesion = createContext<ValorSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);

  useEffect(() => {
    // Si un refresco falla más adelante (sesión revocada), el cliente avisa y salimos solos.
    const dejarDeEscuchar = escucharSesion((sesion) => setUsuario(sesion?.usuario ?? null));
    void refrescarSesion().finally(() => setCargando(false));
    return dejarDeEscuchar;
  }, []);

  const ingresar = async (ruta: string, datos: unknown) => {
    const sesion = await pedir<RespuestaSesion>(ruta, {
      metodo: 'POST',
      cuerpo: datos,
      sinSesion: true,
    });
    fijarSesion(sesion);
    return sesion.usuario;
  };

  const valor: ValorSesion = {
    cargando,
    usuario,
    ingresarStaff: (datos) => ingresar('/auth/login', datos),
    ingresarAdmin: (datos) => ingresar('/auth/admin/login', datos),
    salir: async () => {
      await pedir('/auth/salir', { metodo: 'POST', sinSesion: true }).catch(() => undefined);
      fijarSesion(null);
    },
  };

  return <ContextoSesion value={valor}>{children}</ContextoSesion>;
}

export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error('useSesion() tiene que usarse dentro de <ProveedorSesion>');
  return valor;
}
