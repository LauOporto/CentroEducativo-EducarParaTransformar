import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import RequireRole from './RequireRole';
import LandingPage from '../pages/public/LandingPage';
import NotFoundPage from '../pages/public/NotFoundPage';

// Cada rol se descarga solo cuando ese rol entra a su sección: así un
// estudiante no baja el bundle de admin/docente/padre y viceversa.
const EstudianteShell = lazy(() => import('../pages/estudiante/EstudianteShell'));
const PerfilPage = lazy(() => import('../pages/estudiante/PerfilPage'));
const ServiciosEstudiantePage = lazy(() => import('../pages/estudiante/ServiciosPage'));
const BoletinPage = lazy(() => import('../pages/estudiante/BoletinPage'));
const PlanesPage = lazy(() => import('../pages/estudiante/PlanesPage'));
const AsistenciasPage = lazy(() => import('../pages/estudiante/AsistenciasPage'));

const DocenteShell = lazy(() => import('../pages/docente/DocenteShell'));
const CalificacionesPage = lazy(() => import('../pages/docente/CalificacionesPage'));
const PerfilDocentePage = lazy(() => import('../pages/docente/PerfilPage'));
const MisCursosPage = lazy(() => import('../pages/docente/MisCursosPage'));
const AsistenciaDocentePage = lazy(() => import('../pages/docente/AsistenciaPage'));
const HistorialAsistenciaPage = lazy(() => import('../pages/docente/HistorialAsistenciaPage'));
const PlanesDocentePage = lazy(() => import('../pages/docente/PlanesPage'));

const PadreShell = lazy(() => import('../pages/padre/PadreShell'));
const BoletinPadrePage = lazy(() => import('../pages/padre/BoletinPage'));
const MateriasPadrePage = lazy(() => import('../pages/padre/MateriasPage'));
const AsistenciasPadrePage = lazy(() => import('../pages/padre/AsistenciasPage'));
const ServiciosPadrePage = lazy(() => import('../pages/padre/ServiciosPage'));

const AdminShell = lazy(() => import('../pages/admin/AdminShell'));
const DashboardPage = lazy(() => import('../pages/admin/DashboardPage'));
const UsuariosPage = lazy(() => import('../pages/admin/UsuariosPage'));
const ProfesoresPage = lazy(() => import('../pages/admin/ProfesoresPage'));
const DocentesPendientesPage = lazy(() => import('../pages/admin/DocentesPendientesPage'));
const InscripcionesPage = lazy(() => import('../pages/admin/InscripcionesPage'));
const OpinionesPage = lazy(() => import('../pages/admin/OpinionesPage'));
const EmpleoPage = lazy(() => import('../pages/admin/EmpleoPage'));
const VinculosPage = lazy(() => import('../pages/admin/VinculosPage'));
const AcademicoPage = lazy(() => import('../pages/admin/AcademicoPage'));
const ServiciosPage = lazy(() => import('../pages/admin/ServiciosPage'));
const PagosPage = lazy(() => import('../pages/admin/PagosPage'));
const ReportesPage = lazy(() => import('../pages/admin/ReportesPage'));
const AuditoriaPage = lazy(() => import('../pages/admin/AuditoriaPage'));
const GaleriaPage = lazy(() => import('../pages/admin/GaleriaPage'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Cargando…</div>}>
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
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="servicios" element={<ServiciosEstudiantePage />} />
          <Route path="planes" element={<PlanesPage />} />
          <Route path="asistencias" element={<AsistenciasPage />} />
          <Route path="*" element={<NotFoundPage volverA="/estudiante" textoVolver="Volver al panel" />} />
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
          <Route path="perfil" element={<PerfilDocentePage />} />
          <Route path="cursos" element={<MisCursosPage />} />
          <Route path="asistencia" element={<AsistenciaDocentePage />} />
          <Route path="historial-asistencia" element={<HistorialAsistenciaPage />} />
          <Route path="planes" element={<PlanesDocentePage />} />
          <Route path="*" element={<NotFoundPage volverA="/docente" textoVolver="Volver al panel" />} />
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
          <Route path="servicios" element={<ServiciosPadrePage />} />
          <Route path="*" element={<NotFoundPage volverA="/padre" textoVolver="Volver al panel" />} />
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
          <Route path="profesores" element={<ProfesoresPage />} />
          <Route path="docentes" element={<DocentesPendientesPage />} />
          <Route path="inscripciones" element={<InscripcionesPage />} />
          <Route path="opiniones" element={<OpinionesPage />} />
          <Route path="empleo" element={<EmpleoPage />} />
          <Route path="vinculos" element={<VinculosPage />} />
          <Route path="academico" element={<AcademicoPage />} />
          <Route path="servicios" element={<ServiciosPage />} />
          <Route path="pagos" element={<PagosPage />} />
          <Route path="reportes" element={<ReportesPage />} />
          <Route path="auditoria" element={<AuditoriaPage />} />
          <Route path="galeria" element={<GaleriaPage />} />
          <Route path="*" element={<NotFoundPage volverA="/admin" textoVolver="Volver al panel" />} />
        </Route>

        <Route path="*" element={<NotFoundPage pantallaCompleta />} />
      </Routes>
    </Suspense>
  );
}
