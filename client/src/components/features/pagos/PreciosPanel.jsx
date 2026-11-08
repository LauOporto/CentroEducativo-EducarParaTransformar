import { useEffect, useState } from 'react';
import { nivelesService } from '../../../services/api/nivelesService';
import { deportesService } from '../../../services/api/deportesService';
import { transporteService } from '../../../services/api/transporteService';
import { comedorService } from '../../../services/api/comedorService';
import { pagosAdminService } from '../../../services/api/pagosAdminService';
import { useToast } from '../../../hooks/useToast';
import { formatearMonto, precioValido } from '../../../domain/pagos';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1';

const aTexto = (n) => (Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2));
const aNumero = (t) => Number(String(t).trim().replace(',', '.'));

function FilaPrecio({ id, nombre, actual, campoId, onGuardar }) {
  const [texto, setTexto] = useState(aTexto(actual));
  const [guardando, setGuardando] = useState(false);
  const inputId = `${campoId}-${id}`;

  // Si el valor guardado cambia desde afuera (recarga), el input lo sigue.
  useEffect(() => setTexto(aTexto(actual)), [actual]);

  const valido = precioValido(texto);
  const cambio = valido && aNumero(texto) !== Number(actual);

  const guardar = async (e) => {
    e.preventDefault();
    if (!cambio) return;
    setGuardando(true);
    await onGuardar(id, nombre, aNumero(texto));
    setGuardando(false);
  };

  return (
    <form
      onSubmit={guardar}
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-blue-100 py-3 last:border-0"
    >
      <label htmlFor={inputId} className="min-w-0 flex-1 basis-40 text-sm font-medium text-ink">
        {nombre}
        <span className="block text-xs font-normal text-ink-faint">Actual: {formatearMonto(actual)}</span>
      </label>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-sm text-ink-soft">
          $
        </span>
        <input
          id={inputId}
          inputMode="decimal"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-invalid={!valido}
          aria-describedby={!valido ? `${inputId}-err` : undefined}
          className={`w-32 rounded border p-2 text-right text-sm ${valido ? 'border-blue-200' : 'border-coral'} ${focus}`}
        />
        <button
          type="submit"
          disabled={!cambio || guardando}
          aria-label={`Guardar precio de ${nombre}`}
          className={`rounded bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-40 ${focus}`}
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {!valido && (
        <p id={`${inputId}-err`} role="alert" className="basis-full text-xs text-[#B23A16]">
          Ingresá un número entre 0 y 10.000.000, con hasta 2 decimales.
        </p>
      )}
    </form>
  );
}

function Bloque({ titulo, icono, items, campoId, valorDe, guardar, vacio }) {
  return (
    <section className="rounded-lg border border-blue-100 bg-white p-4 sm:p-5" aria-labelledby={`${campoId}-t`}>
      <h2 id={`${campoId}-t`} className="font-display text-lg text-ink">
        <i className={`fas ${icono} mr-2 text-accent`} aria-hidden="true" />
        {titulo}
      </h2>
      <p className="mb-2 mt-0.5 text-xs text-ink-faint">Las facturas ya emitidas no cambian.</p>
      {items === null && <p className="py-3 text-sm text-ink-faint">Cargando…</p>}
      {items?.length === 0 && <p className="py-3 text-sm text-ink-faint">{vacio}</p>}
      {items?.map((it) => (
        <FilaPrecio
          key={it.id}
          id={it.id}
          nombre={it.nombre}
          actual={valorDe(it)}
          campoId={campoId}
          onGuardar={guardar}
        />
      ))}
    </section>
  );
}

export default function PreciosPanel() {
  const toast = useToast();
  const [niveles, setNiveles] = useState(null);
  const [deportes, setDeportes] = useState(null);
  const [recorridos, setRecorridos] = useState(null);
  const [turnos, setTurnos] = useState(null);
  const [error, setError] = useState('');

  const cargar = async () => {
    const [n, d, r, t] = await Promise.all([
      nivelesService.list(),
      deportesService.list(),
      transporteService.list(),
      comedorService.list(),
    ]);
    if (!n.exito || !d.exito || !r.exito || !t.exito)
      setError((n.message || d.message || r.message || t.message) ?? 'No se pudieron cargar los precios.');
    else setError('');
    setNiveles(n.exito ? n.niveles : []);
    setDeportes(d.exito ? d.deportes : []);
    setRecorridos(r.exito ? r.recorridos : []);
    setTurnos(t.exito ? t.turnos : []);
  };
  useEffect(() => {
    cargar();
  }, []);

  // Cada bloque guarda con su endpoint y refleja el valor que devolvió el backend.
  const crearGuardar = (fn, setLista, clave, campo, etiqueta) => async (id, nombre, precio) => {
    const res = await fn(id, precio);
    if (res.exito) {
      const nuevo = res[clave]?.[campo] ?? precio;
      setLista((lista) => lista.map((x) => (x.id === id ? { ...x, [campo]: nuevo } : x)));
      toast.success(`${etiqueta} de ${nombre} actualizado: ${formatearMonto(nuevo)}.`);
    } else {
      toast.error(res.message || 'No se pudo guardar el precio.');
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-coral/15 p-3 text-sm text-[#B23A16]"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={cargar}
            className={`rounded border border-coral px-3 py-1 text-xs font-semibold ${focus}`}
          >
            Reintentar
          </button>
        </div>
      )}
      <Bloque
        titulo="Cuota mensual por nivel educativo"
        icono="fa-graduation-cap"
        campoId="nivel"
        items={niveles}
        valorDe={(x) => x.cuotaMensual}
        vacio="No hay niveles educativos cargados."
        guardar={crearGuardar(pagosAdminService.fijarCuotaNivel, setNiveles, 'nivel', 'cuotaMensual', 'Cuota')}
      />
      <Bloque
        titulo="Deportes"
        icono="fa-futbol"
        campoId="deporte"
        items={deportes}
        valorDe={(x) => x.precioMensual}
        vacio="No hay deportes cargados."
        guardar={crearGuardar(pagosAdminService.fijarPrecioDeporte, setDeportes, 'deporte', 'precioMensual', 'Precio')}
      />
      <Bloque
        titulo="Recorridos de transporte"
        icono="fa-bus"
        campoId="recorrido"
        items={recorridos}
        valorDe={(x) => x.precioMensual}
        vacio="No hay recorridos cargados."
        guardar={crearGuardar(
          pagosAdminService.fijarPrecioRecorrido,
          setRecorridos,
          'recorrido',
          'precioMensual',
          'Precio',
        )}
      />
      <Bloque
        titulo="Turnos de comedor"
        icono="fa-utensils"
        campoId="turno"
        items={turnos}
        valorDe={(x) => x.precioMensual}
        vacio="No hay turnos de comedor cargados."
        guardar={crearGuardar(pagosAdminService.fijarPrecioTurno, setTurnos, 'turno', 'precioMensual', 'Precio')}
      />
    </div>
  );
}
