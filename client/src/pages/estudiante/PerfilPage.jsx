import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { studentsService } from '../../services/api/studentsService';
import MateriasCursoList from '../../components/features/MateriasCursoList';

const ESTADO_LABEL = { ACTIVO: 'Activo', INACTIVO: 'Inactivo', EGRESADO: 'Egresado' };

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { timeZone: 'UTC' });
}

function Dato({ label, value }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold">{value || '—'}</span>
    </div>
  );
}

export default function PerfilPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [alumno, setAlumno] = useState(null);
  const [materias, setMaterias] = useState(null);
  const [mensajeMaterias, setMensajeMaterias] = useState('');
  const [contacto, setContacto] = useState({ email: '', telefono: '', domicilio: '' });

  const cargar = useCallback(async () => {
    const ficha = await studentsService.get(user.id);
    if (ficha.exito) {
      setAlumno(ficha.alumno);
      setContacto({
        email: ficha.alumno.email || '',
        telefono: ficha.alumno.telefono || '',
        domicilio: ficha.alumno.domicilio || '',
      });
    }
    const mats = await studentsService.getMaterias(user.id);
    setMaterias(mats.exito ? mats.materias : []);
    setMensajeMaterias(mats.mensaje || '');
  }, [user.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarContacto = async (e) => {
    e.preventDefault();
    const res = await studentsService.updateMe(contacto);
    if (res.exito) {
      toast.success('Datos de contacto actualizados.');
      setAlumno(res.alumno);
    } else {
      toast.error(res.message || res.mensaje || 'No se pudo actualizar.');
    }
  };

  if (!alumno) return <p className="text-center text-slate-400">Cargando…</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Mi Ficha</h3>
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <Dato label="Legajo" value={alumno.legajo} />
          <Dato label="DNI" value={alumno.dni} />
          <Dato label="Nombre" value={alumno.nombre} />
          <Dato label="Apellido" value={alumno.apellido} />
          <Dato label="Fecha de nacimiento" value={formatFecha(alumno.fechaNacimiento)} />
          <Dato label="Curso" value={alumno.curso} />
          <Dato label="Estado" value={ESTADO_LABEL[alumno.estado] || alumno.estado} />
        </div>

        <h3 className="mb-3 mt-6 border-b border-slate-200 pb-3 text-lg font-bold dark:border-slate-700">
          Datos de contacto <span className="text-xs font-normal text-slate-400">(vos podés editarlos)</span>
        </h3>
        <form onSubmit={guardarContacto} className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Email
            <input
              required type="email" value={contacto.email}
              onChange={(e) => setContacto({ ...contacto, email: e.target.value })}
              className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Teléfono
            <input
              required pattern="[0-9]{6,20}" placeholder="Solo dígitos" value={contacto.telefono}
              onChange={(e) => setContacto({ ...contacto, telefono: e.target.value })}
              className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Domicilio
            <input
              required value={contacto.domicilio}
              onChange={(e) => setContacto({ ...contacto, domicilio: e.target.value })}
              className="rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <button type="submit" className="justify-self-end rounded bg-accent px-4 py-2 text-sm font-semibold text-white">
            <i className="fas fa-save" /> Guardar
          </button>
        </form>
      </div>

      <div>
        <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Materias que estoy cursando</h3>
        <MateriasCursoList materias={materias} loading={materias === null} mensaje={mensajeMaterias} />
      </div>
    </div>
  );
}
