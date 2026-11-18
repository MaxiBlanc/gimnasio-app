import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { z } from 'zod';
import { nombresDeRoles, esquemaColor, type GimnasioAdminDetalle } from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import { mostrarErrorEnFormulario } from '../../api/formularios';
import { Campo } from '../../componentes/Campo';
import { Dialogo } from '../../componentes/Dialogo';
import { formatearFecha } from '../../formato';
import estilos from '../paginas.module.css';
import tabla from '../tabla.module.css';
import propios from './GimnasioDetalle.module.css';

// Lo que el admin edita acá: el nombre y la marca. La suspensión va aparte, con confirmación.
const esquemaEdicion = z.object({
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80),
  colorPrimario: esquemaColor,
  colorSecundario: esquemaColor,
});
type DatosEdicion = z.infer<typeof esquemaEdicion>;

export function GimnasioDetalle() {
  const { id = '' } = useParams();
  const ubicacion = useLocation();
  const clienteQuery = useQueryClient();
  const [aviso, setAviso] = useState<string | undefined>(
    (ubicacion.state as { aviso?: string } | null)?.aviso,
  );
  const [confirmando, setConfirmando] = useState(false);

  const gimnasio = useQuery({
    queryKey: ['admin', 'gimnasios', id],
    queryFn: () => pedir<GimnasioAdminDetalle>(`/admin/gimnasios/${id}`),
  });

  const cambiarActivo = useMutation({
    mutationFn: (activo: boolean) =>
      pedir<GimnasioAdminDetalle>(`/admin/gimnasios/${id}`, {
        metodo: 'PATCH',
        cuerpo: { activo },
      }),
    onSuccess: async (editado) => {
      clienteQuery.setQueryData(['admin', 'gimnasios', id], editado);
      await clienteQuery.invalidateQueries({ queryKey: ['admin', 'gimnasios'], exact: true });
      setConfirmando(false);
      setAviso(editado.activo ? 'reactivado' : 'suspendido');
    },
  });

  if (gimnasio.isPending) return <p className="texto-suave">Cargando…</p>;
  if (gimnasio.isError) return <p className="alerta-error">{gimnasio.error.message}</p>;
  const g = gimnasio.data;
  const linkIngreso = `${location.origin}/g/${g.slug}`;

  const AVISOS: Record<string, string> = {
    alta: `Gimnasio creado. El dueño ya puede entrar en ${linkIngreso}`,
    editado: 'Cambios guardados.',
    suspendido: 'Gimnasio suspendido. Se cerraron las sesiones de su personal y de sus socios.',
    reactivado: 'Gimnasio reactivado.',
  };

  return (
    <div className={estilos.pagina}>
      <header className={estilos.encabezado}>
        <div>
          <Link to="/admin" className={estilos.volver}>
            <ChevronLeft size={18} aria-hidden /> Gimnasios
          </Link>
          <h1 className="titulo-pagina">{g.nombre}</h1>
          <p className="texto-suave">
            {g.activo ? 'Activo' : 'Suspendido'}. Dado de alta el {formatearFecha(g.creadoEn)}.{' '}
            {g.cantidadSocios} {g.cantidadSocios === 1 ? 'socio' : 'socios'}.
          </p>
        </div>
      </header>

      {aviso && AVISOS[aviso] && (
        <p className="alerta-ok" role="status">
          {AVISOS[aviso]}
        </p>
      )}

      <section className={estilos.seccion}>
        <h2 className={estilos.tituloSeccion}>Link de ingreso del personal</h2>
        <div className={propios.link}>
          <code>{linkIngreso}</code>
          <BotonCopiar texto={linkIngreso} />
        </div>
      </section>

      <section className={estilos.seccion} aria-labelledby="titulo-datos">
        <h2 id="titulo-datos" className={estilos.tituloSeccion}>
          Datos
        </h2>
        <FormularioGimnasio key={g.id} gimnasio={g} alGuardar={() => setAviso('editado')} />
      </section>

      <section className={estilos.seccion} aria-labelledby="titulo-usuarios">
        <h2 id="titulo-usuarios" className={estilos.tituloSeccion}>
          Personal
        </h2>
        <div className={tabla.contenedor}>
          <table className={tabla.tabla}>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Rol</th>
                <th scope="col" className={tabla.secundaria}>
                  Email
                </th>
              </tr>
            </thead>
            <tbody>
              {g.usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td>
                    <strong>{usuario.nombre}</strong>{' '}
                    {!usuario.activo && <span className="etiqueta">Inactivo</span>}
                  </td>
                  <td>{nombresDeRoles(usuario.roles)}</td>
                  <td className={tabla.secundaria}>{usuario.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${estilos.seccion} ${propios.zona}`}>
        <div>
          <h2 className={estilos.tituloSeccion}>{g.activo ? 'Suspender' : 'Reactivar'}</h2>
          <p className="texto-suave">
            {g.activo
              ? 'Nadie del gimnasio (personal ni socios) puede entrar mientras esté suspendido. No se borra ningún dato.'
              : 'El personal y los socios vuelven a poder entrar.'}
          </p>
        </div>
        {g.activo ? (
          <button
            type="button"
            className="boton boton-peligro"
            onClick={() => setConfirmando(true)}
          >
            Suspender gimnasio
          </button>
        ) : (
          <button
            type="button"
            className="boton boton-secundario"
            onClick={() => cambiarActivo.mutate(true)}
            disabled={cambiarActivo.isPending}
          >
            Reactivar
          </button>
        )}
      </section>

      <Dialogo
        abierto={confirmando}
        alCerrar={() => setConfirmando(false)}
        titulo={`¿Suspender ${g.nombre}?`}
      >
        <p>
          Se cierran al instante las sesiones de su personal y de sus {g.cantidadSocios} socios. Se
          puede reactivar en cualquier momento.
        </p>
        {cambiarActivo.isError && <p className="alerta-error">{cambiarActivo.error.message}</p>}
        <div className={estilos.botonera}>
          <button
            type="button"
            className="boton boton-peligro-lleno"
            onClick={() => cambiarActivo.mutate(false)}
            disabled={cambiarActivo.isPending}
          >
            {cambiarActivo.isPending ? 'Suspendiendo…' : 'Suspender'}
          </button>
          <button
            type="button"
            className="boton boton-secundario"
            onClick={() => setConfirmando(false)}
          >
            Cancelar
          </button>
        </div>
      </Dialogo>
    </div>
  );
}

function FormularioGimnasio({
  gimnasio,
  alGuardar,
}: {
  gimnasio: GimnasioAdminDetalle;
  alGuardar: () => void;
}) {
  const clienteQuery = useQueryClient();
  const [errorGeneral, setErrorGeneral] = useState<string>();
  const formulario = useForm<DatosEdicion>({
    resolver: zodResolver(esquemaEdicion),
    defaultValues: {
      nombre: gimnasio.nombre,
      colorPrimario: gimnasio.colorPrimario,
      colorSecundario: gimnasio.colorSecundario,
    },
  });
  const { errors: errores, isSubmitting: enviando, isDirty: hayCambios } = formulario.formState;

  const enviar = formulario.handleSubmit(async (datos) => {
    setErrorGeneral(undefined);
    try {
      const editado = await pedir<GimnasioAdminDetalle>(`/admin/gimnasios/${gimnasio.id}`, {
        metodo: 'PATCH',
        cuerpo: datos,
      });
      clienteQuery.setQueryData(['admin', 'gimnasios', gimnasio.id], editado);
      await clienteQuery.invalidateQueries({ queryKey: ['admin', 'gimnasios'], exact: true });
      formulario.reset(datos);
      alGuardar();
    } catch (error) {
      setErrorGeneral(mostrarErrorEnFormulario(error, formulario.setError));
    }
  });

  return (
    <form className={estilos.formularioDialogo} onSubmit={enviar} noValidate>
      {errorGeneral && <p className="alerta-error">{errorGeneral}</p>}
      <div className={estilos.grupo}>
        <div className={estilos.ancho}>
          <Campo
            etiqueta="Nombre"
            error={errores.nombre?.message}
            {...formulario.register('nombre')}
          />
        </div>
        <Campo
          etiqueta="Color principal"
          ayuda="#RRGGBB"
          error={errores.colorPrimario?.message}
          {...formulario.register('colorPrimario')}
        />
        <Campo
          etiqueta="Color de fondo"
          ayuda="#RRGGBB"
          error={errores.colorSecundario?.message}
          {...formulario.register('colorSecundario')}
        />
      </div>
      <div className={estilos.botonera}>
        <button type="submit" className="boton boton-principal" disabled={enviando || !hayCambios}>
          {enviando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className="boton boton-secundario"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          // Sin permiso para el portapapeles: el link igual se puede seleccionar y copiar a mano.
        }
      }}
    >
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  );
}
