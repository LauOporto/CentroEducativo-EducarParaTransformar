import { useState } from 'react';
import StudyPlanForm from '../../components/features/StudyPlanForm';
import StudyPlansList from '../../components/features/StudyPlansList';

export default function PlanesPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Planes de Estudio</h3>
      <StudyPlanForm onCreated={() => setRefreshKey((k) => k + 1)} />
      <StudyPlansList refreshKey={refreshKey} />
    </div>
  );
}
