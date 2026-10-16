import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { profesoresService } from '../../services/api/profesoresService';
import { materiasService } from '../../services/api/materiasService';
import { cursosService } from '../../services/api/cursosService';
import { useToast } from '../../hooks/useToast';

export default function AsignarMateriaModal({ profesor, onClose }) {
  const toast = useToast();
  const [materias, setMaterias] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [asignaciones, setAsignaciones] = useState(null);
  const [materiaId, setMateriaId] = useState('');
  const [cursoId, setCursoId] = useState('');

  const cargar = async () => {
    const data = await profesoresService.get(profesor.id);
    setAsignaciones(data.exito ? data.materias : []);
  };

  useEffect(() => {
    if (!profesor) return;
    materiasService.list().then((d) => setMaterias(d.exito ? d.materias : []));
    cursosService.list().then((d) => setCursos(d.exito ? d.cursos : []));
    cargar();
  }, [profesor]);

  if (!profesor) return null;

  const asignar = async (e) => {
    e.preventDefault();
    if (!materiaId || !cursoId) return;
    const res = await profesoresService.asignarMateria(profesor.id, {
      materiaId: Number(materiaId), cursoId: Number(cursoId),
    });
    if (res.exito) {
      toast.success('Materia asignada.');
      setMateriaId('');
      setCursoId('');
      cargar();
    } else {
      toast.error(res.mensaje || 'No se pudo asignar.');
    }
  };

  const quitar = async (asignacionId) => {
    const res = await profesoresService.quitarMateria(profesor.id, asignacionId);
    if (res.exito) {
      toast.success('Asignación quitada.');
      cargar();
    } else {
      toast.error(res.mensaje || 'No se pudo quitar.');
    }
  };

  const campo = 'rounded border border-blue-200 p-2 text-sm dark:border-slate-600 dark:bg-slate-900';

  return (
    <Modal open onClose={onClose} title={`Materias de ${profesor.nombre}`} wide>
      <form onSubmit={asignar} className="mb-4 flex flex-wrap items-end gap-2">
        <select required value={materiaId} onChange={(e) => setMateriaId(e.target.value)} className={`${campo} flex-1`}>
          <option value="">Materia…</option>
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <select required value={cursoId} onChange={(e) => setCursoId(e.target.value)} className={`${campo} flex-1`}>
          <option value="">Curso…</option>
          {cursos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
        </select>
        <button type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white">
          <i className="fas fa-plus" /> Asignar
        </button>
      </form>

      <div className="max-h-64 overflow-y-auto rounded border border-blue-100 dark:border-slate-700">
        {asignaciones === null && <p className="p-3 text-sm text-ink-faint">Cargando…</p>}
        {asignaciones?.length === 0 && <p className="p-3 text-sm text-ink-faint">Sin materias asignadas.</p>}
        {asignaciones?.map((a) => (
          <div key={a.id} className="flex items-center justify-between border-b border-blue-100 px-3 py-2 text-sm last:border-0 dark:border-slate-800">
            <span>{a.materia} — {a.curso} ({a.nivel})</span>
            <button onClick={() => quitar(a.id)} className="text-red-500 hover:text-red-600">
              <i className="fas fa-trash" />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
