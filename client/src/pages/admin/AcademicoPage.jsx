import { useEffect, useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { nivelesService } from '../../services/api/nivelesService';
import { cursosService } from '../../services/api/cursosService';
import { materiasService } from '../../services/api/materiasService';
import { adminService } from '../../services/api/adminService';
import DataTable from '../../components/ui/DataTable';

const inputCls = 'rounded border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-900';
const btnPrimary = 'rounded bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50';
const btnDanger = 'rounded bg-red-500 px-2.5 py-1.5 text-xs text-white';
const btnMuted = 'rounded bg-slate-500 px-2.5 py-1.5 text-xs text-white';

function confirmarBorrado(mensaje) {
  return window.confirm(mensaje);
}

function NivelesSection() {
  const toast = useToast();
  const [niveles, setNiveles] = useState(null);
  const [nombre, setNombre] = useState('');
  const [editId, setEditId] = useState(null);
  const [editNombre, setEditNombre] = useState('');

  const cargar = async () => {
    const data = await nivelesService.list();
    setNiveles(data.exito ? data.niveles : []);
  };
  useEffect(() => { cargar(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    const res = await nivelesService.create({ nombre });
    if (res.exito) { toast.success('Nivel creado.'); setNombre(''); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo crear.');
  };

  const guardarEdicion = async (id) => {
    const res = await nivelesService.update(id, { nombre: editNombre });
    if (res.exito) { toast.success('Nivel actualizado.'); setEditId(null); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo actualizar.');
  };

  const borrar = async (n) => {
    if (!confirmarBorrado(`¿Eliminar el nivel "${n.nombre}"?`)) return;
    const res = await nivelesService.remove(n.id);
    if (res.exito) { toast.success('Nivel eliminado.'); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo eliminar.');
  };

  const columns = [
    {
      key: 'nombre', label: 'Nombre',
      render: (n) => editId === n.id
        ? <input autoFocus value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className={inputCls} />
        : n.nombre,
    },
    {
      key: 'acciones', label: 'Acciones',
      render: (n) => editId === n.id ? (
        <div className="flex gap-1.5">
          <button onClick={() => guardarEdicion(n.id)} className={btnPrimary}>Guardar</button>
          <button onClick={() => setEditId(null)} className={btnMuted}>Cancelar</button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button onClick={() => { setEditId(n.id); setEditNombre(n.nombre); }} className={btnMuted}>Editar</button>
          <button onClick={() => borrar(n)} className={btnDanger}>Eliminar</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <form onSubmit={crear} className="mb-4 flex gap-2">
        <input required placeholder="Nuevo nivel (ej: Terciario)" value={nombre} onChange={(e) => setNombre(e.target.value)} className={`flex-1 ${inputCls}`} />
        <button type="submit" className={btnPrimary}><i className="fas fa-plus" /> Agregar</button>
      </form>
      <DataTable columns={columns} rows={niveles ?? []} loading={niveles === null} emptyMessage="Sin niveles cargados." />
    </div>
  );
}

function CursosSection() {
  const toast = useToast();
  const [cursos, setCursos] = useState(null);
  const [niveles, setNiveles] = useState([]);
  const [form, setForm] = useState({ nombre: '', nivelId: '' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: '', nivelId: '' });

  const cargar = async () => {
    const [c, n] = await Promise.all([cursosService.list(), nivelesService.list()]);
    setCursos(c.exito ? c.cursos : []);
    setNiveles(n.exito ? n.niveles : []);
  };
  useEffect(() => { cargar(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    const res = await cursosService.create({ nombre: form.nombre, nivelId: Number(form.nivelId) });
    if (res.exito) { toast.success('Curso creado.'); setForm({ nombre: '', nivelId: '' }); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo crear.');
  };

  const guardarEdicion = async (id) => {
    const res = await cursosService.update(id, { nombre: editForm.nombre, nivelId: Number(editForm.nivelId) });
    if (res.exito) { toast.success('Curso actualizado.'); setEditId(null); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo actualizar.');
  };

  const borrar = async (c) => {
    if (!confirmarBorrado(`¿Eliminar el curso "${c.etiqueta}"?`)) return;
    const res = await cursosService.remove(c.id);
    if (res.exito) { toast.success('Curso eliminado.'); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo eliminar.');
  };

  const columns = [
    {
      key: 'nivel', label: 'Nivel',
      render: (c) => editId === c.id ? (
        <select value={editForm.nivelId} onChange={(e) => setEditForm({ ...editForm, nivelId: e.target.value })} className={inputCls}>
          {niveles.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
        </select>
      ) : c.nivel,
    },
    {
      key: 'nombre', label: 'Curso',
      render: (c) => editId === c.id
        ? <input value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} className={inputCls} />
        : c.nombre,
    },
    {
      key: 'acciones', label: 'Acciones',
      render: (c) => editId === c.id ? (
        <div className="flex gap-1.5">
          <button onClick={() => guardarEdicion(c.id)} className={btnPrimary}>Guardar</button>
          <button onClick={() => setEditId(null)} className={btnMuted}>Cancelar</button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button onClick={() => { setEditId(c.id); setEditForm({ nombre: c.nombre, nivelId: c.nivelId }); }} className={btnMuted}>Editar</button>
          <button onClick={() => borrar(c)} className={btnDanger}>Eliminar</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <form onSubmit={crear} className="mb-4 flex flex-wrap gap-2">
        <select required value={form.nivelId} onChange={(e) => setForm({ ...form, nivelId: e.target.value })} className={inputCls}>
          <option value="">Nivel…</option>
          {niveles.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
        </select>
        <input required placeholder="Nombre del curso (ej: 1° año)" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={`flex-1 ${inputCls}`} />
        <button type="submit" className={btnPrimary}><i className="fas fa-plus" /> Agregar</button>
      </form>
      <DataTable columns={columns} rows={cursos ?? []} loading={cursos === null} emptyMessage="Sin cursos cargados." />
    </div>
  );
}

function MateriasSection() {
  const toast = useToast();
  const [materias, setMaterias] = useState(null);
  const [nombre, setNombre] = useState('');
  const [editId, setEditId] = useState(null);
  const [editNombre, setEditNombre] = useState('');

  const cargar = async () => {
    const data = await materiasService.list();
    setMaterias(data.exito ? data.materias : []);
  };
  useEffect(() => { cargar(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    const res = await materiasService.create({ nombre });
    if (res.exito) { toast.success('Materia creada.'); setNombre(''); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo crear.');
  };

  const guardarEdicion = async (id) => {
    const res = await materiasService.update(id, { nombre: editNombre });
    if (res.exito) { toast.success('Materia actualizada.'); setEditId(null); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo actualizar.');
  };

  const borrar = async (m) => {
    if (!confirmarBorrado(`¿Eliminar la materia "${m.nombre}"?`)) return;
    const res = await materiasService.remove(m.id);
    if (res.exito) { toast.success('Materia eliminada.'); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo eliminar.');
  };

  const columns = [
    {
      key: 'nombre', label: 'Nombre',
      render: (m) => editId === m.id
        ? <input autoFocus value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className={inputCls} />
        : m.nombre,
    },
    {
      key: 'acciones', label: 'Acciones',
      render: (m) => editId === m.id ? (
        <div className="flex gap-1.5">
          <button onClick={() => guardarEdicion(m.id)} className={btnPrimary}>Guardar</button>
          <button onClick={() => setEditId(null)} className={btnMuted}>Cancelar</button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button onClick={() => { setEditId(m.id); setEditNombre(m.nombre); }} className={btnMuted}>Editar</button>
          <button onClick={() => borrar(m)} className={btnDanger}>Eliminar</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <form onSubmit={crear} className="mb-4 flex gap-2">
        <input required placeholder="Nueva materia (ej: Biología)" value={nombre} onChange={(e) => setNombre(e.target.value)} className={`flex-1 ${inputCls}`} />
        <button type="submit" className={btnPrimary}><i className="fas fa-plus" /> Agregar</button>
      </form>
      <DataTable columns={columns} rows={materias ?? []} loading={materias === null} emptyMessage="Sin materias cargadas." />
    </div>
  );
}

function AsignacionesSection() {
  const toast = useToast();
  const [asignaciones, setAsignaciones] = useState(null);
  const [materias, setMaterias] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [form, setForm] = useState({ materiaId: '', cursoId: '', docenteId: '' });

  const cargar = async () => {
    const [a, m, c, d] = await Promise.all([
      materiasService.listAsignaciones(),
      materiasService.list(),
      cursosService.list(),
      adminService.listUsers({ role: 'DOCENTE' }),
    ]);
    setAsignaciones(a.exito ? a.asignaciones : []);
    setMaterias(m.exito ? m.materias : []);
    setCursos(c.exito ? c.cursos : []);
    setDocentes(d.exito ? d.usuarios : []);
  };
  useEffect(() => { cargar(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    const res = await materiasService.createAsignacion({
      materiaId: Number(form.materiaId), cursoId: Number(form.cursoId), docenteId: Number(form.docenteId),
    });
    if (res.exito) { toast.success('Asignación creada.'); setForm({ materiaId: '', cursoId: '', docenteId: '' }); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo crear.');
  };

  const borrar = async (a) => {
    if (!confirmarBorrado(`¿Quitar a ${a.docente} de "${a.materia}" en ${a.curso}?`)) return;
    const res = await materiasService.removeAsignacion(a.id);
    if (res.exito) { toast.success('Asignación eliminada.'); cargar(); }
    else toast.error(res.message || res.mensaje || 'No se pudo eliminar.');
  };

  const columns = [
    { key: 'materia', label: 'Materia' },
    { key: 'curso', label: 'Curso' },
    { key: 'docente', label: 'Profesor' },
    {
      key: 'acciones', label: 'Acciones',
      render: (a) => <button onClick={() => borrar(a)} className={btnDanger}>Quitar</button>,
    },
  ];

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Asigná qué profesor dicta cada materia en cada curso (una materia puede tener distintos profesores según el curso — RF-13).
      </p>
      <form onSubmit={crear} className="mb-4 flex flex-wrap gap-2">
        <select required value={form.materiaId} onChange={(e) => setForm({ ...form, materiaId: e.target.value })} className={inputCls}>
          <option value="">Materia…</option>
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <select required value={form.cursoId} onChange={(e) => setForm({ ...form, cursoId: e.target.value })} className={inputCls}>
          <option value="">Curso…</option>
          {cursos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
        </select>
        <select required value={form.docenteId} onChange={(e) => setForm({ ...form, docenteId: e.target.value })} className={inputCls}>
          <option value="">Profesor…</option>
          {docentes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <button type="submit" className={btnPrimary}><i className="fas fa-plus" /> Asignar</button>
      </form>
      <DataTable columns={columns} rows={asignaciones ?? []} loading={asignaciones === null} emptyMessage="Sin asignaciones cargadas." />
    </div>
  );
}

const TABS = [
  { key: 'niveles', label: 'Niveles educativos', Component: NivelesSection },
  { key: 'cursos', label: 'Cursos', Component: CursosSection },
  { key: 'materias', label: 'Materias', Component: MateriasSection },
  { key: 'asignaciones', label: 'Materia → Curso → Profesor', Component: AsignacionesSection },
];

export default function AcademicoPage() {
  const [tab, setTab] = useState('niveles');
  const Activo = TABS.find((t) => t.key === tab).Component;

  return (
    <div>
      <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Estructura Académica</h3>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              tab === t.key ? 'bg-accent text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Activo />
    </div>
  );
}
