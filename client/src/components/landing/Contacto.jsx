import { useState } from 'react';
import { consultasService } from '../../services/api/contenidoService';
import { useToast } from '../../hooks/useToast';
import { CONTACTO, INSTITUCION, REDES, whatsappUrl } from '../../config/institucion';

const EMPTY = { nombre: '', email: '', telefono: '', asunto: '', mensaje: '' };

const campo =
  'w-full rounded border border-blue-200 bg-white px-4 py-3 text-ink placeholder:text-ink-faint focus:border-blue-500';

export default function Contacto() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [enviando, setEnviando] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const res = await consultasService.enviar(form);
      if (res.exito) {
        toast.success(res.mensaje || 'Consulta enviada.');
        setForm(EMPTY);
      } else {
        toast.error(res.message || res.mensaje || 'No se pudo enviar la consulta.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section id="contacto">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="max-w-md">
          <div className="mb-5 h-1 w-14 rounded-full bg-magenta" />
          <h2 className="font-display text-3xl text-ink sm:text-4xl">Contacto</h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Escribinos por este formulario, por WhatsApp o por redes sociales. Te respondemos a la brevedad.
          </p>

          <ul className="mt-8 flex flex-col gap-4 text-ink">
            <li className="flex items-start gap-3">
              <i className="fab fa-whatsapp mt-1 w-5 text-lg text-teal" aria-hidden="true" />
              <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500">
                WhatsApp {CONTACTO.whatsappTexto}
              </a>
            </li>
            <li className="flex items-start gap-3">
              <i className="fas fa-phone mt-1 w-5 text-blue-500" aria-hidden="true" />
              <a href={CONTACTO.telefonoHref} className="hover:text-blue-500">
                {CONTACTO.telefono}
              </a>
            </li>
            <li className="flex items-start gap-3">
              <i className="fas fa-envelope mt-1 w-5 text-blue-500" aria-hidden="true" />
              <a href={`mailto:${CONTACTO.email}`} className="break-all hover:text-blue-500">
                {CONTACTO.email}
              </a>
            </li>
            <li className="flex items-start gap-3">
              <i className="fas fa-map-marker-alt mt-1 w-5 text-blue-500" aria-hidden="true" />
              <span>{INSTITUCION.direccion}</span>
            </li>
            <li className="flex items-start gap-3">
              <i className="fas fa-clock mt-1 w-5 text-blue-500" aria-hidden="true" />
              <span>{INSTITUCION.horarioAtencion}</span>
            </li>
          </ul>

          <div className="mt-8 flex gap-3">
            {REDES.map((r) => (
              <a
                key={r.nombre}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={r.nombre}
                title={r.nombre}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-lg text-blue-500 transition hover:bg-blue-500 hover:text-white"
              >
                <i className={`fab ${r.icono}`} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            required
            minLength={2}
            placeholder="Nombre y apellido"
            value={form.nombre}
            onChange={set('nombre')}
            className={campo}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={set('email')}
              className={campo}
            />
            <input
              placeholder="Teléfono (opcional, solo números)"
              inputMode="numeric"
              pattern="\d{6,20}"
              title="Solo números, entre 6 y 20 dígitos"
              value={form.telefono}
              onChange={set('telefono')}
              className={campo}
            />
          </div>
          <input
            required
            minLength={3}
            placeholder="Asunto"
            value={form.asunto}
            onChange={set('asunto')}
            className={campo}
          />
          <textarea
            required
            minLength={10}
            rows={5}
            placeholder="Tu consulta"
            value={form.mensaje}
            onChange={set('mensaje')}
            className={campo}
          />
          <button
            type="submit"
            disabled={enviando}
            className="mt-2 self-start rounded bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60"
          >
            {enviando ? 'Enviando…' : 'Enviar consulta'}
          </button>
        </form>
      </div>
    </section>
  );
}
