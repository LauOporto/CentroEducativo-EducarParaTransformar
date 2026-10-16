import StudyPlansList from '../../components/features/StudyPlansList';

export default function PlanesPage() {
  return (
    <div>
      <h3 className="mb-5 border-b border-blue-100 pb-3 text-xl font-bold dark:border-slate-700">Planes de Estudio de mis materias</h3>
      <StudyPlansList />
    </div>
  );
}
