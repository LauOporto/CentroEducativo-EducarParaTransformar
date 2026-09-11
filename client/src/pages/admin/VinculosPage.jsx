import { useEffect, useState } from 'react';
import { adminService } from '../../services/api/adminService';
import { useToast } from '../../hooks/useToast';
import DataTable from '../../components/ui/DataTable';

export default function VinculosPage() {
  const toast = useToast();
  const [links, setLinks] = useState(null);
  const [padres, setPadres] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [padreId, setPadreId] = useState('');
  const [estudianteId, setEstudianteId] = useState('');

  const cargar = async () => {
    const [linksData, padresData, estudiantesData] = await Promise.all([
      adminService.listLinks(),
      adminService.listUsers({ role: 'PADRE' }),
      adminService.listUsers({ role: 'ESTUDIANTE' }),
    ]);
    setLinks(linksData.exito ? linksData.links : []);
    setPadres(padresData.exito ? padresData.usuarios.filter((u) => u.isActive) : []);
    setEstudiantes(estudiantesData.exito ? estudiantesData.usuarios.filter((u) => u.isActive) : []);
  };

  useEffect(() => {
    cargar();
  }, []);

  const crear = async (e) => {
    e.preventDefault();
    const res = await adminService.createLink(padreId, estudianteId);
    if (res.exito) {
      toast.success('Vínculo creado.');
      setPadreId('');
      setEstudianteId('');
      cargar();
    } else {
      toast.error(res.mensaje || 'Error.');
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este vínculo padre-hijo?')) return;
    const res = await adminService.deleteLink(id);
    if (res.exito) {
      toast.success('Vínculo eliminado.');
      cargar();
    } else {
      toast.error(res.mensaje || 'Error.');
    }
  };

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'padre', label: 'Padre', render: (l) => <b>{l.padre.nombre}</b> },
    { key: 'padreDni', label: 'DNI', render: (l) => l.padre.dni },
    { key: 'estudiante', label: 'Estudiante', render: (l) => <b>{l.estudiante.nombre}</b> },
    { key: 'estudianteDni', label: 'DNI', render: (l) => l.estudiante.dni },
    { key: 'curso', label: 'Curso', render: (l) => l.estudiante.curso || '—' },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (l) => <button onClick={() => eliminar(l.id)} className="rounded bg-red-500 px-2.5 py-1.5 text-xs text-white">Eliminar</button>,
    },
  ];

  return (
    <div>
      <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Vínculos Padre-Hijo</h3>

      <details className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
        <summary className="cursor-pointer font-semibold"><i className="fas fa-plus-circle text-accent" /> Crear vínculo</summary>
        <form onSubmit={crear} className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-semibold">Padre</label>
            <select required value={padreId} onChange={(e) => setPadreId(e.target.value)} className="w-full rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900">
              <option value="">Seleccionar…</option>
              {padres.map((p) => <option key={p.id} value={p.id}>{p.nombre} (DNI {p.dni})</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Estudiante</label>
            <select required value={estudianteId} onChange={(e) => setEstudianteId(e.target.value)} className="w-full rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900">
              <option value="">Seleccionar…</option>
              {estudiantes.map((al) => <option key={al.id} value={al.id}>{al.nombre} — {al.curso || ''}</option>)}
            </select>
          </div>
          <button type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white">Vincular</button>
        </form>
      </details>

      <DataTable columns={columns} rows={links ?? []} loading={links === null} emptyMessage="Sin vínculos cargados." />
    </div>
  );
}
