import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ErrorApi } from './cliente';

/**
 * Lleva un error de la API al formulario: los errores por campo (400 con `campos`)
 * van al lado de cada input; el resto se devuelve como mensaje general.
 */
export function mostrarErrorEnFormulario<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): string {
  if (error instanceof ErrorApi) {
    for (const { campo, mensaje } of error.campos) {
      setError(campo as Path<T>, { message: mensaje });
    }
    return error.campos.length > 0 ? 'Revisá los datos marcados' : error.message;
  }
  return 'Ocurrió un error inesperado';
}
