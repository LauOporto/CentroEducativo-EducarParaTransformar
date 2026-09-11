import { Route, Routes } from 'react-router-dom';
import RequireRole from './RequireRole';
import LandingPage from '../pages/public/LandingPage';

import EstudianteShell from '../pages/estudiante/EstudianteShell';
import BoletinPage from '../pages/estudiante/BoletinPage';
import PlanesPage from '../pages/estudiante/PlanesPage';
import AsistenciasPage from '../pages/estudiante/AsistenciasPage';
import ForosPage from '../pages/estudiante/ForosPage';

import DocenteShell from '../pages/docente/DocenteShell';
import CalificacionesPage from '../pages/docente/CalificacionesPage';
import AsistenciaDocentePage from '../pages/docente/AsistenciaPage';
import PlanesDocentePage from '../pages/docente/PlanesPage';
import ForosDocentePage from '../pages/docente/ForosPage';

import PadreShell from '../pages/padre/PadreShell';
import BoletinPadrePage from '../pages/padre/BoletinPage';
import MateriasPadrePage from '../pages/padre/MateriasPage';
import AsistenciasPadrePage from '../pages/padre/AsistenciasPage';

import AdminShell from '../pages/admin/AdminShell';
import DashboardPage from '../pages/admin/DashboardPage';
import UsuariosPage from '../pages/admin/UsuariosPage';
import DocentesPendientesPage from '../pages/admin/DocentesPendientesPage';
import InscripcionesPage from '../pages/admin/InscripcionesPage';
import OpinionesPage from '../pages/admin/OpinionesPage';
import EmpleoPage from '../pages/admin/EmpleoPage';
import VinculosPage from '../pages/admin/VinculosPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route
        path="/estudiante"
        element={
          <RequireRole role="estudiante">
            <EstudianteShell />
          </RequireRole>
        }
      >
        <Route index element={<BoletinPage />} />
        <Route path="planes" element={<PlanesPage />} />
        <Route path="asistencias" element={<AsistenciasPage />} />
        <Route path="foros" element={<ForosPage />} />
      </Route>

      <Route
        path="/docente"
        element={
          <RequireRole role="docente">
            <DocenteShell />
          </RequireRole>
        }
      >
        <Route index element={<CalificacionesPage />} />
        <Route path="asistencia" element={<AsistenciaDocentePage />} />
        <Route path="planes" element={<PlanesDocentePage />} />
        <Route path="foros" element={<ForosDocentePage />} />
      </Route>
      <Route
        path="/padre"
        element={
          <RequireRole role="padre">
            <PadreShell />
          </RequireRole>
        }
      >
        <Route index element={<BoletinPadrePage />} />
        <Route path="materias" element={<MateriasPadrePage />} />
        <Route path="asistencias" element={<AsistenciasPadrePage />} />
      </Route>
      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <AdminShell />
          </RequireRole>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
        <Route path="docentes" element={<DocentesPendientesPage />} />
        <Route path="inscripciones" element={<InscripcionesPage />} />
        <Route path="opiniones" element={<OpinionesPage />} />
        <Route path="empleo" element={<EmpleoPage />} />
        <Route path="vinculos" element={<VinculosPage />} />
      </Route>
    </Routes>
  );
}
