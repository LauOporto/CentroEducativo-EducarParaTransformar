// ==========================================
// 1. UTILIDADES VISUALES Y ANIMACIONES
// ==========================================

// Hero Slider
let slideIndex = 0;
const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');
const totalSlides = slides ? slides.length : 0;

if (totalSlides > 0) {
    function showSlide(n) {
        slides.forEach(s => s.classList.remove('active'));
        dots.forEach(d => d.classList.remove('active'));

        slideIndex = n;
        if (slideIndex >= totalSlides) slideIndex = 0;
        if (slideIndex < 0) slideIndex = totalSlides - 1;

        slides[slideIndex].classList.add('active');
        dots[slideIndex].classList.add('active');
    }

    function moveSlide(n) {
        showSlide(slideIndex + n);
    }

    function currentSlide(n) {
        showSlide(n);
    }

    setInterval(() => moveSlide(1), 5000);
}

// Menu Hamburguesa (Mobile)
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
        navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = '70px';
        navLinks.style.left = '0';
        navLinks.style.width = '100%';
        navLinks.style.background = 'white';
        navLinks.style.padding = '20px';
        navLinks.style.boxShadow = '0 5px 10px rgba(0,0,0,0.1)';
        navLinks.style.zIndex = '1000';
    });
}

// Toggle de tema (dark/light) para la landing — usa misma clave que campus.js
function syncThemeToggleIcon() {
    const btn = document.getElementById('themeToggleLanding');
    if (!btn) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.innerHTML = isDark
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';
}

function toggleLandingTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('et_theme', next); } catch (e) { /* ignore */ }
    syncThemeToggleIcon();
}

document.addEventListener('DOMContentLoaded', syncThemeToggleIcon);

// Auto-grow para textareas del landing (queda al tamaño del contenido)
function autoGrowTextarea(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    const min = parseInt(getComputedStyle(ta).minHeight, 10) || 80;
    ta.style.height = Math.max(min, ta.scrollHeight) + 'px';
}
function attachAutoGrow(ta) {
    if (!ta || ta._autoGrowBound) return;
    ta._autoGrowBound = true;
    ta.addEventListener('input', () => autoGrowTextarea(ta));
    autoGrowTextarea(ta);
}
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('textarea').forEach(attachAutoGrow);
});

// ==========================================
// 2. GESTIÓN DE MODALES
// ==========================================

function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function openRegisterModal() {
    closeModal();
    const regModal = document.getElementById('registerModal');
    if (regModal) {
        regModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeRegisterModal() {
    const regModal = document.getElementById('registerModal');
    if (regModal) {
        regModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function switchToLogin() {
    closeRegisterModal();
    openLoginModal();
}

// Cerrar modales al hacer clic afuera
window.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
});

function updateRegisterFields() {
    const tipo = document.getElementById('reg-tipo').value;
    const cursoGroup = document.getElementById('curso-group');
    const cursoInput = document.getElementById('reg-curso');
    
    // Si eligen "estudiante", mostramos el curso y lo hacemos obligatorio
    if (tipo === 'estudiante') {
        cursoGroup.style.display = 'block';
        cursoInput.required = true;
    } else {
        // Para docentes o padres, lo volvemos a ocultar
        cursoGroup.style.display = 'none';
        cursoInput.required = false;
        cursoInput.value = ''; // Limpiamos lo que haya escrito por error
    }
}

// ==========================================
// 3. SISTEMA DE AUTENTICACIÓN (LOGIN/REGISTRO)
// ==========================================

// Verificar estado al cargar cualquier página
document.addEventListener('DOMContentLoaded', function () {
    checkUserStatus();
});

function checkUserStatus() {
    const user = JSON.parse(localStorage.getItem('usuarioActual'));
    const userMenu = document.getElementById('userMenu');
    const loginLink = document.getElementById('loginLink');
    const userName = document.getElementById('userName');

    if (userMenu && loginLink && userName) {
        if (user) {
            userMenu.style.display = 'block';
            loginLink.style.display = 'none';
            userName.textContent = user.nombre.split(' ')[0];
        } else {
            userMenu.style.display = 'none';
            loginLink.style.display = 'block';
        }
    }
}

function logout() {
    localStorage.removeItem('usuarioActual');
    window.location.href = 'index.html';
}

// Enrutador de Paneles por Rol
function showUserPanel() {
    const user = JSON.parse(localStorage.getItem('usuarioActual'));
    if (!user) {
        openLoginModal();
        return;
    }

    if (user.tipo === 'estudiante') {
        window.location.href = 'panel_estudiante.html';
    } else if (user.tipo === 'docente' || user.tipo === 'autoridad' || user.tipo === 'personal') {
        window.location.href = 'panel_docente.html';
    } else if (user.tipo === 'padre') {
        window.location.href = 'panel_padre.html';
    } else if (user.tipo === 'admin') {
        window.location.href = 'panel_admin.html';
    } else {
        window.location.href = 'index.html';
    }
}

// Enviar formulario de Login al PHP
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const usuario = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: usuario, password: password })
        })
            .then(response => response.json())
            .then(data => {
                if (data.exito) {
                    sessionStorage.setItem('token', data.usuario.token);
                    localStorage.setItem('usuarioActual', JSON.stringify(data.usuario));
                    closeModal();
                    this.reset();
                    showUserPanel();
                } else {
                    toastError(data.mensaje || 'No se pudo iniciar sesión.');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                toastError('Error al conectar con el servidor.');
            });
    });
}

// Enviar formulario de Registro al PHP
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const datosRegistro = {
            tipo: document.getElementById('reg-tipo').value,
            nombre: document.getElementById('reg-nombre').value,
            email: document.getElementById('reg-email').value,
            usuario: document.getElementById('reg-usuario').value,
            password: document.getElementById('reg-password').value,
            dni: document.getElementById('reg-dni').value, 
            curso: document.getElementById('reg-curso') ? document.getElementById('reg-curso').value : null
        };

        fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosRegistro)
        })
            .then(response => response.json())
            .then(data => {
                if (data.exito) {
                    if (data.pendingApproval) {
                        toastSuccess(data.mensaje || 'Cuenta de docente creada. Un administrador debe aprobarla antes del primer ingreso.');
                        closeRegisterModal();
                        this.reset();
                    } else {
                        toastSuccess('¡Registro exitoso! Ya puedes iniciar sesión.');
                        closeRegisterModal();
                        this.reset();
                        openLoginModal();
                    }
                } else {
                    toastError(data.mensaje || 'No se pudo completar el registro.');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                toastError('Ocurrió un error al registrar en el servidor.');
            });
    });
}

// ==========================================
// 4. FORMULARIOS DE LA LANDING (toast feedback)
// ==========================================

// Helper para el input de archivo del CV
function updateFileName(input) {
    const el = document.getElementById('fileName');
    if (!el) return;
    if (input.files && input.files.length > 0) {
        el.textContent = input.files[0].name;
    } else {
        el.textContent = 'Seleccionar archivo';
    }
}


// A) Solicitud de Inscripción
const CURSOS_POR_NIVEL = {
    inicial: ['Sala de 3', 'Sala de 4', 'Sala de 5'],
    primaria: ['1° grado', '2° grado', '3° grado', '4° grado', '5° grado', '6° grado'],
    secundaria: ['1° año', '2° año', '3° año', '4° año', '5° año'],
};

function actualizarCursosInscripcion() {
    const nivel = document.getElementById('nivel').value;
    const cursoSel = document.getElementById('curso');
    if (!cursoSel) return;
    cursoSel.innerHTML = '';
    const opciones = CURSOS_POR_NIVEL[nivel];
    if (!opciones) {
        cursoSel.innerHTML = '<option value="">Primero seleccioná un nivel</option>';
        cursoSel.disabled = true;
        return;
    }
    cursoSel.disabled = false;
    cursoSel.insertAdjacentHTML('beforeend', '<option value="">Seleccionar curso...</option>');
    opciones.forEach(c => {
        cursoSel.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`);
    });
}

const inscriptionForm = document.getElementById('inscriptionForm');
if (inscriptionForm) {
    inscriptionForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const body = {
            nombreTutor: document.getElementById('nombre').value.trim(),
            emailTutor: document.getElementById('email').value.trim(),
            telefonoTutor: document.getElementById('telefono').value.trim(),
            nombreEstudiante: document.getElementById('nombre_estudiante').value.trim(),
            nivel: document.getElementById('nivel').value,
            curso: document.getElementById('curso').value,
            mensaje: document.getElementById('mensaje').value.trim() || null,
        };
        fetch('/api/public/inscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
            .then(r => r.json())
            .then(data => {
                if (data.exito) {
                    toastSuccess(data.mensaje || 'Solicitud enviada.');
                    inscriptionForm.reset();
                    actualizarCursosInscripcion();
                } else {
                    toastError(data.mensaje || 'No se pudo enviar la solicitud.');
                }
            })
            .catch(() => toastError('Error al conectar con el servidor.'));
    });
}

// B) Postulación de Empleo (CV)
const employmentForm = document.getElementById('employmentForm');
if (employmentForm) {
    employmentForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const fd = new FormData();
        fd.append('nombre', document.getElementById('cv-nombre').value.trim());
        fd.append('email', document.getElementById('cv-email').value.trim());
        fd.append('puesto', document.getElementById('cv-puesto').value);
        const file = document.getElementById('cv-archivo').files[0];
        if (file) fd.append('cv', file);
        fetch('/api/public/employment', { method: 'POST', body: fd })
            .then(r => r.json())
            .then(data => {
                if (data.exito) {
                    toastSuccess(data.mensaje || 'Postulación enviada.');
                    employmentForm.reset();
                    const fileNameEl = document.getElementById('fileName');
                    if (fileNameEl) fileNameEl.textContent = 'Seleccionar archivo';
                } else {
                    toastError(data.mensaje || 'No se pudo enviar la postulación.');
                }
            })
            .catch(() => toastError('Error al conectar con el servidor.'));
    });
}

// C) Opinión / Valoración
let ratingValue = 0;
document.querySelectorAll('.stars i').forEach(star => {
    star.addEventListener('click', () => {
        ratingValue = parseInt(star.dataset.value, 10);
        document.querySelectorAll('.stars i').forEach(s => {
            const v = parseInt(s.dataset.value, 10);
            s.classList.toggle('fas', v <= ratingValue);
            s.classList.toggle('far', v > ratingValue);
            s.style.color = v <= ratingValue ? '#f59e0b' : '';
        });
    });
});

const opinionForm = document.getElementById('opinionForm');
if (opinionForm) {
    opinionForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const texto = document.getElementById('opinion-texto').value.trim();
        const estrellas = ratingValue || 5;
        if (!texto) {
            toastWarning('Escribí tu opinión antes de enviar.');
            return;
        }
        const body = {
            nombre: document.getElementById('opinion-nombre').value.trim() || null,
            rol: document.getElementById('opinion-rol').value,
            texto,
            rating: estrellas,
        };
        fetch('/api/public/opinions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
            .then(r => r.json())
            .then(data => {
                if (data.exito) {
                    toastSuccess(data.mensaje || '¡Gracias por compartir tu opinión!');
                    opinionForm.reset();
                    ratingValue = 0;
                    document.querySelectorAll('.stars i').forEach(s => {
                        s.classList.remove('fas');
                        s.classList.add('far');
                        s.style.color = '';
                    });
                } else {
                    toastError(data.mensaje || 'No se pudo enviar la opinión.');
                }
            })
            .catch(() => toastError('Error al conectar con el servidor.'));
    });
}

// Mostrar opiniones aprobadas en la landing
function renderOpinionesAprobadas() {
    const display = document.querySelector('.opiniones-display');
    if (!display) return;
    fetch('/api/public/opinions')
        .then(r => r.json())
        .then(data => {
            if (!data.exito) return;
            const titulo = display.querySelector('h3');
            display.innerHTML = '';
            if (titulo) display.appendChild(titulo);
            else {
                const h = document.createElement('h3');
                h.textContent = 'Últimas opiniones';
                display.appendChild(h);
            }
            if (data.opiniones.length === 0) {
                const p = document.createElement('p');
                p.style.color = '#64748b';
                p.style.textAlign = 'center';
                p.textContent = 'Aún no hay opiniones publicadas.';
                display.appendChild(p);
                return;
            }
            data.opiniones.forEach(o => {
                const card = document.createElement('div');
                card.className = 'opinion-card';
                const nombre = o.nombre ? String(o.nombre) : 'Anónimo';
                const safeNombre = nombre.replace(/[<>&"]/g, '');
                const safeTexto = String(o.texto).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
                card.innerHTML = `
                    <div class="opinion-header">
                        <span class="opinion-author">${safeNombre}</span>
                        <span class="opinion-rating">${'★'.repeat(o.rating)}${'☆'.repeat(5 - o.rating)}</span>
                    </div>
                    <p>"${safeTexto}"</p>
                `;
                display.appendChild(card);
            });
        })
        .catch(() => { /* silencioso */ });
}
document.addEventListener('DOMContentLoaded', renderOpinionesAprobadas);

// D) Contacto
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
        e.preventDefault();
        toastSuccess('Mensaje enviado. Te responderemos dentro de las próximas 24 hs.');
        this.reset();
    });
}

// ==========================================
// 5. MÓDULO DE CALIFICACIONES
// ==========================================

// A) Panel Docente: Guardar Nota
const formCalificaciones = document.getElementById('formCalificaciones');
if (formCalificaciones) {
    formCalificaciones.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const token = sessionStorage.getItem('token');
        const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual'));

        const datosNota = {
            estudiante_id: document.getElementById('notaAlumno').value,
            docente_id: usuarioActual.id,
            materia: document.getElementById('notaMateria').value,
            instancia_evaluacion: document.getElementById('notaInstancia').value,
            nota: document.getElementById('notaValor').value,
            fecha: new Date().toISOString().split('T')[0] // Saca la fecha de hoy automáticamente
        };

        fetch('/api/grades', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token // Candado de seguridad
            },
            body: JSON.stringify(datosNota)
        })
        .then(res => res.json())
        .then(data => {
            if(data.exito) {
                toastSuccess('¡Nota guardada correctamente en la base de datos!');
                formCalificaciones.reset();
            } else {
                toastError(data.mensaje || 'No se pudo guardar la nota.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            toastError('Error al conectar con el servidor.');
        });
    });
}

// B) Panel Estudiante/Padre: Leer Notas
function renderizarBoletin() {
    const token = sessionStorage.getItem('token');
    const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual'));
    
    if (!usuarioActual) return;
    
    const estudianteId = usuarioActual.id; 

    fetch(`/api/grades?estudiante_id=${estudianteId}`, {
        method: 'GET',
        headers: { 
            'Authorization': 'Bearer ' + token // Candado de seguridad
        }
    })
    .then(res => res.json())
    .then(data => {
        if(data.exito) {
            const tbody = document.querySelector('#tablaNotas tbody'); 
            if (!tbody) return; // Si no hay tabla en esta página, no hace nada
            
            tbody.innerHTML = ''; 
            
            if(data.notas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">No hay calificaciones registradas.</td></tr>';
            } else {
                data.notas.forEach(nota => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${nota.materia}</td>
                            <td>${nota.instancia_evaluacion}</td>
                            <td>${nota.nota}</td>
                            <td>${nota.fecha}</td>
                            <td>${nota.nombre_docente}</td>
                        </tr>
                    `;
                });
            }
        } else {
            console.error('No se pudieron cargar las notas:', data.mensaje);
        }
    })
    .catch(error => console.error('Error:', error));
}

// Hacemos que las notas se carguen solas si entramos a un panel con la tabla
document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('tablaNotas')) {
        renderizarBoletin();
    }
});


// =========================================================
// CIERRE DE SESIÓN AUTOMÁTICO POR INACTIVIDAD
// =========================================================

let temporizadorInactividad;

function resetearTemporizador() {
    // Limpiamos el contador anterior
    clearTimeout(temporizadorInactividad);
    
    // 30 minutos * 60 segundos * 1000 milisegundos = 1.800.000
    temporizadorInactividad = setTimeout(cerrarSesionPorInactividad, 1800000);
}

function cerrarSesionPorInactividad() {
    // Verificamos si el usuario realmente tiene una sesión iniciada
    if (sessionStorage.getItem('token') || localStorage.getItem('usuarioActual')) {
        if (typeof toastWarning === 'function') {
            toastWarning('Tu sesión caducó por 30 minutos de inactividad. Por tu seguridad, vuelve a iniciar sesión.', 5000);
        }

        // Destruimos las credenciales
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('usuarioActual');
        localStorage.removeItem('usuarioActual');

        // Demoramos la redirección para que se vea el toast
        setTimeout(() => { window.location.href = 'index.html'; }, 2000);
    }
}

// Empezar a contar cuando la página carga
window.onload = resetearTemporizador;

// Reiniciar el contador si el usuario hace cualquier de estas acciones:
document.onmousemove = resetearTemporizador; // Mover el mouse
document.onkeypress = resetearTemporizador;  // Tocar una tecla
document.onclick = resetearTemporizador;     // Hacer clic
document.onscroll = resetearTemporizador;    // Bajar o subir la página