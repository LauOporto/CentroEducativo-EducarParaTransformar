import { useState } from 'react';
import Modal from '../ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

const CURSOS = [
  'Inicial — Sala de 3', 'Inicial — Sala de 4', 'Inicial — Sala de 5',
  'Primaria — 1° grado', 'Primaria — 2° grado', 'Primaria — 3° grado', 'Primaria — 4° grado', 'Primaria — 5° grado', 'Primaria — 6° grado',
  'Secundaria — 1° año', 'Secundaria — 2° año', 'Secundaria — 3° año', 'Secundaria — 4° año', 'Secundaria — 5° año',
];

const EMPTY = { tipo: '', nombre: '', email: '', dni: '', curso: '', usuario: '', password: '' };

export default function RegisterModal({ open, onClose, onSwitchToLogin }) {
  const { register } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);

  const submit = async (e) => {
    e.preventDefault();
    const data = await register(form);
    if (data.exito) {
      toast.success(data.mensaje || (data.pendingApproval ? 'Cuenta creada, pendiente de aprobación.' : '¡Registro exitoso!'));
      setForm(EMPTY);
      if (!data.pendingApproval) onSwitchToLogin();
      else onClose();
    } else {
      toast.error(data.mensaje || 'No se pudo completar el registro.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Crear cuenta nueva" wide>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <select
          required
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          className="col-span-2 rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="">Tipo de usuario…</option>
          <option value="docente">Docente / Autoridad / Personal</option>
          <option value="padre">Padre / Tutor</option>
          <option value="estudiante">Estudiante</option>
        </select>
        <input
          required
          placeholder="Apellido, Nombre"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          className="col-span-2 rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          required
          placeholder="DNI (7-8 dígitos)"
          pattern="[0-9]{7,8}"
          title="Debe contener entre 7 y 8 números."
          value={form.dni}
          onChange={(e) => setForm({ ...form, dni: e.target.value })}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        {form.tipo === 'estudiante' && (
          <select
            required
            value={form.curso}
            onChange={(e) => setForm({ ...form, curso: e.target.value })}
            className="col-span-2 rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
          >
            <option value="">Curso / año…</option>
            {CURSOS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <input
          required
          placeholder="Usuario"
          value={form.usuario}
          onChange={(e) => setForm({ ...form, usuario: e.target.value })}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          required
          type="password"
          minLength={6}
          placeholder="Contraseña (mín. 6)"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <button type="submit" className="col-span-2 rounded-lg bg-accent py-2.5 font-semibold text-white">
          Crear mi cuenta
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        ¿Ya tenés cuenta?{' '}
        <button onClick={onSwitchToLogin} className="font-semibold text-accent">
          Iniciá sesión acá
        </button>
      </p>
    </Modal>
  );
}
