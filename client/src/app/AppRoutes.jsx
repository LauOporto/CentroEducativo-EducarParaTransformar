import { Route, Routes } from 'react-router-dom';
import RequireRole from './RequireRole';
import LandingPage from '../pages/public/LandingPage';

import EstudianteShell from '../pages/estudiante/EstudianteShell';
import BoletinPage from '../pages/estudiante/BoletinPage';
import PlanesPage from '../pages/estudiante/PlanesPage';
import AsistenciasPage from '../pages/estudiante/AsistenciasPage';
import ForosPage from '../pages/estudiante/ForosPage';

import DocenteShell from '../pages/docente/DocenteShell';
import PadreShell from '../pages/padre/PadreShell';
import AdminShell from '../pages/admin/AdminShell';

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
      />
      <Route
        path="/padre"
        element={
          <RequireRole role="padre">
            <PadreShell />
          </RequireRole>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <AdminShell />
          </RequireRole>
        }
      />
    </Routes>
  );
}
