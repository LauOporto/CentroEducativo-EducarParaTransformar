const NIVELES = [
  { nombre: 'Nivel Inicial', desc: 'Sala de 3 a Sala de 5. Estimulación temprana y juego.', icon: 'fa-child' },
  { nombre: 'Nivel Primario', desc: '1° a 6° grado. Bases sólidas en lengua, matemática y ciencias.', icon: 'fa-book-reader' },
  { nombre: 'Nivel Secundario', desc: '1° a 5° año. Orientación y preparación para el nivel superior.', icon: 'fa-graduation-cap' },
];

export default function Niveles() {
  return (
    <section id="niveles" className="bg-slate-50 px-6 py-16 dark:bg-slate-900/40">
      <h2 className="mb-8 text-center text-3xl font-bold">Niveles Educativos</h2>
      <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
        {NIVELES.map((n) => (
          <div key={n.nombre} className="rounded-xl bg-white p-6 text-center shadow-sm dark:bg-slate-800">
            <i className={`fas ${n.icon} mb-3 text-3xl text-accent`} />
            <h3 className="font-bold">{n.nombre}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{n.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
