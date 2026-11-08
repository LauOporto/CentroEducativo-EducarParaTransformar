// RF-50 (web) — panel del administrador: revisión de comprobantes, precios y
// facturación. No depende del orden de otros specs ni del comprobante del seed:
// prepara el suyo por API (el padre mgomezp genera un comprobante de un ítem
// pendiente de iflores y carga la transferencia) y lo rechaza desde la UI, lo
// que devuelve el ítem a PENDIENTE y deja la base lista para la próxima corrida.
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());

// Genera un comprobante de UN ítem pendiente de iflores y carga la transferencia.
// El multipart se manda con fetch desde la página: cy.request no arma FormData.
function prepararComprobanteEnRevision() {
  return cy.loginApi('iflores').then(({ id: hijoId }) => {
    return cy.loginApi('mgomezp').then(({ token }) => {
      return cy.api('GET', `/api/pagos/hijos/${hijoId}/estado-cuenta`, token).then(({ body }) => {
        const factura = body.facturas.find((f) => f.items.some((i) => ['PENDIENTE', 'VENCIDA'].includes(i.estado)));
        expect(factura, 'factura con un ítem pendiente').to.exist;
        const item = factura.items.find((i) => ['PENDIENTE', 'VENCIDA'].includes(i.estado));
        return cy
          .api('POST', '/api/pagos/comprobantes', token, { facturaId: factura.id, cuotaIds: [item.id] })
          .then(({ status, body: comp }) => {
            expect(status).to.eq(201);
            const c = comp.comprobante;
            cy.visit('/');
            cy.window()
              .then((win) => {
                const bytes = Uint8Array.from(win.atob(PNG_1X1), (ch) => ch.charCodeAt(0));
                const fd = new win.FormData();
                fd.append('archivo', new win.Blob([bytes], { type: 'image/png' }), 'transferencia.png');
                fd.append('nroOperacion', `E2E${Date.now()}`);
                fd.append('fechaTransferencia', hoy());
                fd.append('montoTransferido', String(c.total));
                fd.append('medio', 'TRANSFERENCIA');
                return win.fetch(`/api/pagos/comprobantes/${c.id}/transferencia`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                  body: fd,
                });
              })
              .then((res) => expect(res.status).to.eq(200))
              .then(() => cy.wrap({ id: c.id, numero: c.numero }));
          });
      });
    });
  });
}

describe('RF-50 · Panel de pagos del administrador', () => {
  const entrarAPagos = () => {
    cy.loginUI('admin');
    cy.get('a[href="/admin/pagos"]').click();
    cy.contains('h1', 'Pagos').should('be.visible');
  };

  it('muestra la bandeja y rechaza un comprobante en revisión con motivo', () => {
    // El comprobante se prepara por API antes de abrir la sesión del admin.
    prepararComprobanteEnRevision().then(({ id, numero }) => {
      entrarAPagos();

      // La bandeja abre en "En revisión" y trae el comprobante recién cargado.
      cy.get('#filtro-estado').should('have.value', 'EN_REVISION');
      cy.contains('tr', numero).within(() => {
        cy.contains('Ignacio Flores').should('be.visible');
        cy.contains('Mariana Gómez').should('be.visible');
        cy.contains('En revisión').should('be.visible');
        cy.contains('button', /detalle/i).click();
      });

      // Detalle: ítems, transferencia y archivo disponible.
      cy.contains('h2', `Comprobante ${numero}`).should('be.visible');
      cy.contains('Ítems incluidos').should('be.visible');
      cy.contains('Monto transferido').should('be.visible');
      cy.contains('button', 'Ver archivo').should('not.be.disabled');

      // Rechazo: el motivo de 5 a 300 caracteres es obligatorio.
      cy.contains('button', 'Rechazar').click();
      cy.contains('El padre va a recibir este motivo y tendrá que generar un comprobante nuevo.').should('be.visible');
      cy.contains('button', 'Rechazar comprobante').should('be.disabled');
      cy.get('#motivo-rechazo').type('No');
      cy.contains('button', 'Rechazar comprobante').should('be.disabled');
      cy.get('#motivo-rechazo').type('rma el monto no figura acreditado.');
      cy.contains('button', 'Rechazar comprobante').should('not.be.disabled').click();

      cy.contains('rechazado. Se avisó al padre.').should('be.visible');
      cy.contains('tr', numero).should('not.exist');

      // Quedó RECHAZADO en el backend con el motivo guardado.
      cy.loginApi('admin').then(({ token }) => {
        cy.api('GET', '/api/admin/pagos/comprobantes?estado=RECHAZADO&limit=100', token).then(({ body }) => {
          const c = body.comprobantes.find((x) => x.id === id);
          expect(c, 'comprobante rechazado').to.exist;
          expect(c.motivoRechazo).to.contain('monto no figura acreditado');
        });
      });
    });
  });

  it('cambia el precio de un deporte, muestra el aviso y lo restaura', () => {
    entrarAPagos();
    cy.loginApi('admin').then(({ token }) => {
      cy.api('GET', '/api/deportes', token).then(({ body }) => {
        const ajedrez = body.deportes.find((d) => d.nombre === 'Ajedrez');
        const nuevo = ajedrez.precioMensual + 1;

        cy.contains('[role=tab]', 'Precios').click();
        cy.contains('section', 'Deportes').within(() => {
          cy.contains('Las facturas ya emitidas no cambian.').should('be.visible');
          cy.get(`#deporte-${ajedrez.id}`).clear().type(String(nuevo));
          cy.get('button[aria-label="Guardar precio de Ajedrez"]').should('not.be.disabled').click();
        });
        cy.contains('Precio de Ajedrez actualizado').should('be.visible');

        // Persistió en el backend.
        cy.api('GET', '/api/deportes', token).then(({ body: b2 }) => {
          expect(b2.deportes.find((d) => d.id === ajedrez.id).precioMensual).to.eq(nuevo);
        });

        // Un valor inválido deshabilita el botón.
        cy.get(`#deporte-${ajedrez.id}`).clear().type('-5');
        cy.get('button[aria-label="Guardar precio de Ajedrez"]').should('be.disabled');

        // Restaura el precio original para no dejar rastro entre corridas.
        cy.api('PUT', `/api/deportes/${ajedrez.id}/precio`, token, { precio: ajedrez.precioMensual })
          .its('status')
          .should('eq', 200);
      });
    });
  });

  it('genera la facturación del período actual y es idempotente', () => {
    entrarAPagos();
    cy.contains('[role=tab]', 'Facturación').click();
    cy.contains('Es seguro repetirlo: las facturas ya emitidas no se duplican.').should('be.visible');
    cy.contains('button', 'Generar facturas').click();
    cy.contains('button', 'Sí, generar').click();

    cy.contains('section', 'Resultado de').within(() => {
      cy.contains('dt', 'Facturas creadas').should('be.visible');
      cy.contains('dt', 'Omitidas').should('be.visible');
    });
    cy.contains('Facturación de').should('be.visible');

    // Repetirla no duplica: la segunda vez no crea nada.
    cy.contains('button', 'Generar facturas').click();
    cy.contains('button', 'Sí, generar').click();
    cy.contains('dt', 'Facturas creadas').next('dd').should('have.text', '0');
    cy.contains('Ya tiene factura del período.').should('be.visible');
  });
});
