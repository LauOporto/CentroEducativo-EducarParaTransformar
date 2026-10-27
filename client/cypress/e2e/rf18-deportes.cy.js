// CP-RF18-01 — RF-18: un alumno puede estar inscripto como máximo en 2 deportes.
// Datos del seed: fbarrabino tiene Fútbol (martes) y Vóley (miércoles), y
// Básquet de Primaria (viernes) le queda disponible sin superposición horaria.
const elegirGrupo = (deporte) =>
  cy
    .get('select option')
    .contains(deporte)
    .then(($opcion) => cy.get('select').select($opcion.val()));

describe('RF-18 · Máximo 2 deportes simultáneos por alumno', () => {
  beforeEach(() => cy.restaurarDeportesSeed());

  it('rechaza un tercer deporte y lo acepta después de dar de baja uno', () => {
    cy.loginUI('fbarrabino');
    cy.contains('a', 'Deportes y Servicios').click();

    // Paso 1: el alumno ve sus 2 deportes y el aviso de máximo.
    cy.get('[data-cy=deportes-inscriptos] li').should('have.length', 2);
    cy.get('[data-cy=deportes]').should('contain', 'Ya alcanzó el máximo de 2 deportes');

    // Paso 2: intenta sumar un tercero → el sistema lo rechaza y no cambia nada.
    cy.get('[data-cy=deportes]').within(() => {
      elegirGrupo('Básquet — Primaria, Viernes');
      cy.contains('button', 'Inscribir').click();
    });
    cy.contains('ya está inscripto en 2 deportes').should('be.visible');
    cy.get('[data-cy=deportes-inscriptos] li').should('have.length', 2);

    // Paso 3: da de baja Vóley (la confirmación del navegador se acepta sola).
    cy.get('[data-cy=deportes-inscriptos]').contains('li', 'Vóley').contains('button', 'Dar de baja').click();
    cy.contains('Baja realizada.').should('be.visible');
    cy.get('[data-cy=deportes-inscriptos] li').should('have.length', 1);

    // Paso 4: ahora sí puede inscribirse a Básquet.
    cy.get('[data-cy=deportes]').within(() => {
      elegirGrupo('Básquet — Primaria, Viernes');
      cy.contains('button', 'Inscribir').click();
    });
    cy.contains('Inscripto al deporte.').should('be.visible');
    cy.get('[data-cy=deportes-inscriptos] li').should('have.length', 2).and('contain', 'Básquet');
  });

  // HU2 está escrita desde el Padre/Tutor: la regla vale igual para él, y un
  // padre no vinculado ni siquiera llega a la regla (403).
  it('HU2: el padre vinculado recibe el mismo rechazo y otro padre no puede inscribirlo', () => {
    cy.loginApi('fbarrabino').then(({ id, token }) => {
      cy.api('GET', `/api/inscripciones/estudiantes/${id}/resumen`, token).then(({ body }) => {
        const basquet = body.deportes.disponibles.find((g) => g.deporte === 'Básquet');
        const inscribir = (padre) =>
          cy
            .loginApi(padre)
            .then((p) =>
              cy.api('POST', `/api/inscripciones/estudiantes/${id}/deportes`, p.token, { grupoDeporteId: basquet.id }),
            );

        inscribir('pbarrabino').then((res) => {
          expect(res.status).to.eq(409);
          expect(JSON.stringify(res.body)).to.contain('ya está inscripto en 2 deportes');
        });
        inscribir('rperez').its('status').should('eq', 403);
      });
    });
  });
});
