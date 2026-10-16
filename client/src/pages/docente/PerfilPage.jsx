import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { profesoresService } from '../../services/api/profesoresService';
import { useToast } from '../../hooks/useToast';

export default function PerfilPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [perfil, setPerfil] = useState(null);
  const [editando, setEditando] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    telefono: '',
  });

  useEffect(() => {
    cargarPerfil();
  }, []);

  const cargarPerfil = async () => {
    const data = await profesoresService.me();
    if (data.exito) {
      setPerfil(data.profesor);
      setFormData({
        email: data.profesor.email || '',
        telefono: data.profesor.telefono || '',
      });
    } else {
      toast.error('No se pudo cargar el perfil.');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const data = await profesoresService.updateMe(formData);
    if (data.exito) {
      toast.success('Perfil actualizado correctamente.');
      setEditando(false);
      cargarPerfil();
    } else {
      toast.error(data.mensaje || 'Error al actualizar el perfil.');
    }
  };

  if (!perfil) return <div className="p-4">Cargando...</div>;

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-6 border-b pb-2 text-2xl font-bold dark:border-slate-700">Mi Perfil Docente</h2>

      <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="block text-sm font-medium text-ink-faint">Nombre</span>
            <span className="text-lg">{perfil.nombre}</span>
          </div>
          <div>
            <span className="block text-sm font-medium text-ink-faint">Apellido</span>
            <span className="text-lg">{perfil.apellido || '—'}</span>
          </div>
          <div>
            <span className="block text-sm font-medium text-ink-faint">Legajo</span>
            <span className="text-lg">{perfil.legajo || '—'}</span>
          </div>
          <div>
            <span className="block text-sm font-medium text-ink-faint">DNI</span>
            <span className="text-lg">{perfil.dni}</span>
          </div>
          <div>
            <span className="block text-sm font-medium text-ink-faint">Especialidad</span>
            <span className="text-lg">{perfil.especialidad || '—'}</span>
          </div>
          <div>
            <span className="block text-sm font-medium text-ink-faint">Estado</span>
            <span className="text-lg">{perfil.estadoProfesor || 'ACTIVO'}</span>
          </div>
        </div>

        {editando ? (
          <form onSubmit={handleSave} className="border-t pt-4 dark:border-slate-700">
            <h3 className="mb-4 text-lg font-medium">Editar Datos de Contacto</h3>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  required
                  className="w-full rounded border border-blue-200 p-2 dark:border-slate-600 dark:bg-slate-900"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Teléfono</label>
                <input
                  type="text"
                  className="w-full rounded border border-blue-200 p-2 dark:border-slate-600 dark:bg-slate-900"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded bg-accent px-4 py-2 text-white">
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="rounded bg-blue-100 px-4 py-2 dark:bg-slate-700"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="border-t pt-4 dark:border-slate-700">
            <h3 className="mb-4 text-lg font-medium">Datos de Contacto</h3>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="block text-sm font-medium text-ink-faint">Email</span>
                <span className="text-lg">{perfil.email || '—'}</span>
              </div>
              <div>
                <span className="block text-sm font-medium text-ink-faint">Teléfono</span>
                <span className="text-lg">{perfil.telefono || '—'}</span>
              </div>
            </div>
            <button
              onClick={() => setEditando(true)}
              className="rounded bg-blue-50 px-4 py-2 text-sm font-medium hover:bg-blue-100 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Editar Contacto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
