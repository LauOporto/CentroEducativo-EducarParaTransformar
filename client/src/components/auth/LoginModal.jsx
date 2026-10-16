import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ROLE_ROUTES } from '../../domain/roles';

const campo = 'w-full rounded border border-blue-200 px-4 py-3 text-ink placeholder:text-ink-faint focus:border-blue-500';

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
        <input required placeholder="Usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} className={campo} />
        <input required type="password" placeholder="Contraseña" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={campo} />
        <button type="submit" className="mt-1 rounded bg-blue-500 py-3 font-semibold text-white transition hover:bg-blue-600">
          Ingresar
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-soft">
        ¿No tenés cuenta?{' '}
        <button onClick={onSwitchToRegister} className="font-semibold text-blue-500 hover:text-blue-600">
          Registrate acá
        </button>
      </p>
    </Modal>
  );
}
