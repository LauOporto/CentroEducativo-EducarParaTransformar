import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ROLE_ROUTES } from '../../domain/roles';

export default function LoginModal({ open, onClose, onSwitchToRegister }) {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const data = await login(usuario, password);
    if (data.exito) {
      onClose();
      setUsuario('');
      setPassword('');
      navigate(ROLE_ROUTES[data.usuario.tipo] ?? '/');
    } else {
      toast.error(data.mensaje || 'No se pudo iniciar sesión.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Iniciar sesión">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          required
          placeholder="Usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          required
          type="password"
          placeholder="Contraseña"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-slate-300 p-2.5 dark:border-slate-600 dark:bg-slate-800"
        />
        <button type="submit" className="rounded-lg bg-accent py-2.5 font-semibold text-white">
          Ingresar
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        ¿No tenés cuenta?{' '}
        <button onClick={onSwitchToRegister} className="font-semibold text-accent">
          Registrate acá
        </button>
      </p>
    </Modal>
  );
}
