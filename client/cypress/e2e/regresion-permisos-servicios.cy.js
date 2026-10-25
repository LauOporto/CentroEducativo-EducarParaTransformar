// Prueba de regresión del fix 5fca3d9 (22/09/2026): antes del arreglo, un
// alumno recibía 403 al gestionar sus propios deportes. El fix lo habilitó
// para sí mismo y mantuvo el bloqueo sobre otros alumnos. Estas pruebas
// fallan si cualquiera de las dos mitades vuelve a romperse.
const BASE = '/api/inscripciones/estudiantes';
const DNI_JPEREZ = '40000002';

describe('Regresión 5fca3d9 · permisos de inscripción a servicios', () => {
  beforeEach(() => cy.restaurarDeportesSeed());

  it('un alumno puede dar de baja y volver a inscribirse a sus propios deportes', () => {
    cy.loginApi('fbarrabino').then(({ id, token }) => {
      cy.api('GET', `${BASE}/${id}/resumen`, token).then(({ body }) => {
        const voley = body.deportes.inscriptos.find((g) => g.deporte === 'Vóley');
        cy.api('DELETE', `${BASE}/${id}/deportes/${voley.id}`, token).its('status').should('eq', 200);
        cy.api('POST', `${BASE}/${id}/deportes`, token, { grupoDeporteId: voley.id }).its('status').should('eq', 200);
      });
    });
  });

  it('un alumno no puede gestionar los deportes de otro alumno', () => {
    cy.loginApi('admin').then(({ token }) => {
      cy.api('GET', '/api/students', token).then(({ body }) => {
        const otro = body.estudiantes.find((e) => e.dni === DNI_JPEREZ);
        cy.loginApi('fbarrabino').then((alumno) => {
          cy.api('POST', `${BASE}/${otro.id}/deportes`, alumno.token, { grupoDeporteId: 1 })
            .its('status')
            .should('eq', 403);
        });
      });
    });
  });
});
