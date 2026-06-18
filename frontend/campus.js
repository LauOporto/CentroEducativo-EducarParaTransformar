/**
 * campus.js — helpers compartidos por los 3 paneles
 * (auth headers, fetch wrappers, notification bell, formatos)
 */
(function () {
    function token() { return sessionStorage.getItem('token'); }

    window.authHeaders = function () {
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token()
        };
    };

    window.authHeadersNoCT = function () {
        return { 'Authorization': 'Bearer ' + token() };
    };

    let refreshing = null;
    async function tryRefresh() {
        if (refreshing) return refreshing;
        refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                if (data.exito && data.usuario && data.usuario.token) {
                    sessionStorage.setItem('token', data.usuario.token);
                    localStorage.setItem('usuarioActual', JSON.stringify(data.usuario));
                    return true;
                }
                return false;
            })
            .catch(() => false)
            .finally(() => { setTimeout(() => refreshing = null, 0); });
        return refreshing;
    }

    async function authedFetch(url, init) {
        const opts = Object.assign({ credentials: 'include' }, init || {});
        opts.headers = Object.assign({}, opts.headers || {});
        const tk = token();
        if (tk) opts.headers['Authorization'] = 'Bearer ' + tk;
        let res = await fetch(url, opts);
        if (res.status === 401 && url !== '/api/auth/refresh' && url !== '/api/auth/login') {
            const ok = await tryRefresh();
            if (ok) {
                const ntk = token();
                if (ntk) opts.headers['Authorization'] = 'Bearer ' + ntk;
                res = await fetch(url, opts);
            }
        }
        return res;
    }

    window.apiGet = function (url) {
        return authedFetch(url).then(r => r.json());
    };

    window.apiPost = function (url, body) {
        return authedFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        }).then(r => r.json());
    };

    window.apiPatch = function (url, body) {
        return authedFetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        }).then(r => r.json());
    };

    window.apiUpload = function (url, formData) {
        return authedFetch(url, { method: 'POST', body: formData }).then(r => r.json());
    };

    window.apiDelete = function (url) {
        return authedFetch(url, { method: 'DELETE' }).then(r => r.json());
    };

    window.formatFecha = function (iso) {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    window.formatFechaHora = function (iso) {
        if (!iso) return '—';
        return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    window.escapeHtml = function (s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    /* ============================================================
       Notification bell — usa el contenedor con id="bellContainer"
       Polling cada 30s + actualización local al marcar leídas.
       ============================================================ */
    let _bellTimer = null;

    function renderBell(data) {
        const cont = document.getElementById('bellContainer');
        if (!cont) return;
        const count = (data && data.noLeidas) || 0;
        const items = (data && data.notificaciones) || [];

        const badge = count > 0
            ? `<span class="bell-badge">${count > 9 ? '9+' : count}</span>`
            : '';

        const itemsHtml = items.length === 0
            ? `<li class="bell-empty">Sin notificaciones</li>`
            : items.slice(0, 8).map(n => `
                <li class="bell-item ${n.isRead ? '' : 'bell-unread'}" data-id="${n.id}">
                    <div class="bell-item-title">${window.escapeHtml(n.titulo)}</div>
                    <div class="bell-item-body">${window.escapeHtml(n.contenido)}</div>
                    <div class="bell-item-date">${window.formatFechaHora(n.createdAt)}</div>
                </li>
            `).join('');

        cont.innerHTML = `
            <button class="bell-button" id="bellButton" aria-label="Notificaciones">
                <i class="fas fa-bell"></i>
                ${badge}
            </button>
            <div class="bell-dropdown" id="bellDropdown" style="display:none;">
                <div class="bell-header">
                    <strong>Notificaciones</strong>
                    ${count > 0 ? '<button class="bell-mark-all" id="bellMarkAll">Marcar todo</button>' : ''}
                </div>
                <ul class="bell-list">${itemsHtml}</ul>
            </div>
        `;

        const btn = document.getElementById('bellButton');
        const dd = document.getElementById('bellDropdown');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
        });
        document.addEventListener('click', (e) => {
            if (dd && !cont.contains(e.target)) dd.style.display = 'none';
        });

        cont.querySelectorAll('.bell-item').forEach(li => {
            li.addEventListener('click', () => {
                const id = li.getAttribute('data-id');
                window.apiPost('/api/notifications/' + id + '/read').then(() => {
                    li.classList.remove('bell-unread');
                    refreshBell();
                });
            });
        });

        const markAllBtn = document.getElementById('bellMarkAll');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.apiPost('/api/notifications/read-all').then(() => refreshBell());
            });
        }
    }

    function refreshBell() {
        if (!token()) return;
        window.apiGet('/api/notifications')
            .then(renderBell)
            .catch(err => console.error('bell fetch', err));
    }

    window.initBell = function () {
        refreshBell();
        if (_bellTimer) clearInterval(_bellTimer);
        _bellTimer = setInterval(refreshBell, 30000);
    };

    window.refreshBell = refreshBell;

    /* ============================================================
       Dark mode toggle
       ============================================================ */
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }
    const stored = localStorage.getItem('et_theme');
    if (stored === 'dark' || stored === 'light') applyTheme(stored);

    function syncThemeButton() {
        const btn = document.getElementById('themeToggle');
        if (!btn) return;
        const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        btn.innerHTML = cur === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }

    window.toggleTheme = function () {
        const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('et_theme', next);
        syncThemeButton();
    };

    document.addEventListener('DOMContentLoaded', syncThemeButton);

    /* ============================================================
       Modal custom para confirm() y prompt() (reemplaza los nativos del browser)
       ============================================================ */
    function ensureUxModal() {
        let modal = document.getElementById('uxModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'uxModal';
        modal.className = 'ux-modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="ux-modal-content">
                <div class="ux-modal-header">
                    <div class="ux-modal-icon ux-info"><i class="fas fa-question"></i></div>
                    <h3 class="ux-modal-title">Confirmar</h3>
                </div>
                <p class="ux-modal-message"></p>
                <input type="text" class="ux-modal-input" style="display:none;" />
                <div class="ux-modal-actions">
                    <button type="button" class="ux-modal-cancel">Cancelar</button>
                    <button type="button" class="ux-modal-ok">Aceptar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        return modal;
    }

    function openUxModal(opts) {
        return new Promise((resolve) => {
            const modal = ensureUxModal();
            const iconEl = modal.querySelector('.ux-modal-icon');
            const titleEl = modal.querySelector('.ux-modal-title');
            const msgEl = modal.querySelector('.ux-modal-message');
            const inputEl = modal.querySelector('.ux-modal-input');
            const okBtn = modal.querySelector('.ux-modal-ok');
            const cancelBtn = modal.querySelector('.ux-modal-cancel');

            const ICONS = {
                info:    { cls: 'ux-info',    icon: 'fa-circle-info' },
                warning: { cls: 'ux-warning', icon: 'fa-triangle-exclamation' },
                danger:  { cls: 'ux-danger',  icon: 'fa-circle-exclamation' },
                success: { cls: 'ux-success', icon: 'fa-circle-check' },
                question:{ cls: 'ux-info',    icon: 'fa-question' },
            };
            const variant = ICONS[opts.variant || 'question'] || ICONS.question;
            iconEl.className = 'ux-modal-icon ' + variant.cls;
            iconEl.innerHTML = `<i class="fas ${variant.icon}"></i>`;
            titleEl.textContent = opts.title || 'Confirmar';
            msgEl.textContent = opts.message || '';

            okBtn.textContent = opts.okLabel || 'Aceptar';
            cancelBtn.textContent = opts.cancelLabel || 'Cancelar';
            okBtn.className = 'ux-modal-ok' + (opts.danger ? ' ux-danger-btn' : '');
            cancelBtn.style.display = opts.hideCancel ? 'none' : '';

            if (opts.prompt) {
                inputEl.style.display = '';
                inputEl.value = opts.defaultValue || '';
                inputEl.placeholder = opts.placeholder || '';
                inputEl.type = opts.inputType || 'text';
                setTimeout(() => inputEl.focus(), 60);
            } else {
                inputEl.style.display = 'none';
                inputEl.value = '';
                setTimeout(() => okBtn.focus(), 60);
            }

            modal.style.display = 'flex';

            function close(result) {
                modal.style.display = 'none';
                okBtn.onclick = null;
                cancelBtn.onclick = null;
                modal.onclick = null;
                document.removeEventListener('keydown', onKey);
                resolve(result);
            }
            function onKey(e) {
                if (e.key === 'Escape') close(opts.prompt ? null : false);
                else if (e.key === 'Enter' && opts.prompt) close(inputEl.value);
            }

            okBtn.onclick = () => close(opts.prompt ? inputEl.value : true);
            cancelBtn.onclick = () => close(opts.prompt ? null : false);
            modal.onclick = (e) => { if (e.target === modal) close(opts.prompt ? null : false); };
            document.addEventListener('keydown', onKey);
        });
    }

    window.uxConfirm = function (message, opts = {}) {
        return openUxModal({
            message,
            title: opts.title || 'Confirmar',
            variant: opts.variant || (opts.danger ? 'danger' : 'question'),
            okLabel: opts.okLabel,
            cancelLabel: opts.cancelLabel,
            danger: !!opts.danger,
        });
    };

    window.uxPrompt = function (message, opts = {}) {
        return openUxModal({
            message,
            title: opts.title || 'Ingresar dato',
            variant: opts.variant || 'info',
            prompt: true,
            defaultValue: opts.defaultValue || '',
            placeholder: opts.placeholder || '',
            inputType: opts.inputType || 'text',
            okLabel: opts.okLabel || 'Guardar',
            cancelLabel: opts.cancelLabel,
        });
    };

    /* ============================================================
       Auto-grow para textareas (se queda en el tamaño del contenido)
       ============================================================ */
    function autoGrowTextarea(ta) {
        if (!ta || ta.classList.contains('ux-no-grow')) return;
        ta.style.height = 'auto';
        const min = parseInt(getComputedStyle(ta).minHeight, 10) || 80;
        const next = Math.max(min, ta.scrollHeight);
        ta.style.height = next + 'px';
    }
    window.attachAutoGrow = function (ta) {
        if (!ta || ta._autoGrowBound) return;
        ta._autoGrowBound = true;
        ta.addEventListener('input', () => autoGrowTextarea(ta));
        autoGrowTextarea(ta);
    };
    function applyAutoGrowAll() {
        document.querySelectorAll('textarea').forEach(window.attachAutoGrow);
    }
    document.addEventListener('DOMContentLoaded', applyAutoGrowAll);
    // Cuando se inserta nuevo HTML dinámico, también se pueden auto-grow:
    const _mo = new MutationObserver((muts) => {
        muts.forEach(m => {
            m.addedNodes.forEach(n => {
                if (n.nodeType !== 1) return;
                if (n.tagName === 'TEXTAREA') window.attachAutoGrow(n);
                else if (n.querySelectorAll) n.querySelectorAll('textarea').forEach(window.attachAutoGrow);
            });
        });
    });
    _mo.observe(document.documentElement, { childList: true, subtree: true });

    window.uxAlert = function (message, opts = {}) {
        return openUxModal({
            message,
            title: opts.title || 'Aviso',
            variant: opts.variant || 'info',
            okLabel: opts.okLabel || 'Entendido',
            hideCancel: true,
        });
    };

    /* ============================================================
       Socket.io para tiempo real (chat + bell)
       ============================================================ */
    let _socket = null;
    window.connectSocket = function () {
        const tk = token();
        if (!tk) return;
        if (_socket && _socket.connected) return _socket;
        if (typeof io === 'undefined') {
            console.warn('socket.io client no cargado');
            return;
        }
        _socket = io({ auth: { token: tk } });
        _socket.on('connect', () => console.debug('socket connected'));
        _socket.on('disconnect', () => console.debug('socket disconnected'));
        _socket.on('new-message', (msg) => {
            window.refreshBell && window.refreshBell();
            if (typeof window.onIncomingMessage === 'function') window.onIncomingMessage(msg);
        });
        return _socket;
    };

    /* ============================================================
       Foros (compartido docente + estudiante + admin)
       Requiere en la página: #forosLista, #foroDetalle.
       Y opcionalmente: form con id foroNuevo (campos materia/titulo/contenido).
       ============================================================ */
    const FORO_ROLE_COLOR = { ESTUDIANTE: '#10b981', DOCENTE: '#3498db', PADRE: '#f59e0b', ADMIN: '#8b5cf6' };

    window.cargarForos = async function () {
        const cont = document.getElementById('forosLista');
        const det = document.getElementById('foroDetalle');
        if (det) det.innerHTML = '';
        if (!cont) return;
        const data = await window.apiGet('/api/forum');
        if (!data.exito || !data.posts.length) {
            cont.innerHTML = '<p style="color:#94a3b8; text-align:center;">Sin temas todavía. Abrí el primero.</p>';
            return;
        }
        cont.innerHTML = data.posts.map(p => `
            <div class="campus-card" style="cursor:pointer; border-left: 4px solid ${FORO_ROLE_COLOR[p.autorRol] || '#3498db'};" onclick="window.abrirForo(${p.id})">
                <h4 class="campus-card-title">${p.isPinned ? '<i class="fas fa-thumbtack" style="color:#f59e0b;"></i> ' : ''}${window.escapeHtml(p.titulo)}</h4>
                <div class="campus-card-meta">
                    <span><i class="fas fa-book"></i> ${window.escapeHtml(p.materia)}</span>
                    <span><i class="fas fa-user"></i> ${window.escapeHtml(p.autor)}</span>
                    <span><i class="fas fa-comments"></i> ${p.replies} respuestas</span>
                    <span><i class="fas fa-clock"></i> ${window.formatFecha(p.createdAt)}</span>
                </div>
                <div class="campus-card-body" style="max-height:60px; overflow:hidden; text-overflow:ellipsis;">${window.escapeHtml(p.contenido)}</div>
            </div>
        `).join('');
    };

    window.abrirForo = async function (id) {
        const det = document.getElementById('foroDetalle');
        const lista = document.getElementById('forosLista');
        if (!det) return;
        const data = await window.apiGet('/api/forum/' + id);
        if (!data.exito) { window.toastError && window.toastError(data.mensaje || 'Error'); return; }
        const me = JSON.parse(localStorage.getItem('usuarioActual') || 'null');
        const puedoPin = me && (me.tipo === 'docente' || me.tipo === 'admin');
        if (lista) lista.style.display = 'none';
        det.innerHTML = `
            <button onclick="window.cerrarForo()" style="background:#64748b; color:#fff; border:none; padding:6px 14px; border-radius:4px; cursor:pointer; margin-bottom:14px;"><i class="fas fa-arrow-left"></i> Volver</button>
            <div class="campus-card" style="border-left: 4px solid ${FORO_ROLE_COLOR[data.post.autorRol] || '#3498db'};">
                <h3 class="campus-card-title">${data.post.isPinned ? '<i class="fas fa-thumbtack" style="color:#f59e0b;"></i> ' : ''}${window.escapeHtml(data.post.titulo)}</h3>
                <div class="campus-card-meta">
                    <span><i class="fas fa-book"></i> ${window.escapeHtml(data.post.materia)}</span>
                    <span><i class="fas fa-user"></i> ${window.escapeHtml(data.post.autor)} (${data.post.autorRol})</span>
                    <span><i class="fas fa-clock"></i> ${window.formatFechaHora(data.post.createdAt)}</span>
                </div>
                <div class="campus-card-body">${window.escapeHtml(data.post.contenido)}</div>
                ${puedoPin ? `<button onclick="window.pinForo(${data.post.id})" style="background:#f59e0b; color:#fff; border:none; padding:5px 11px; border-radius:4px; cursor:pointer; font-size:0.82rem; margin-top:10px;"><i class="fas fa-thumbtack"></i> ${data.post.isPinned ? 'Desfijar' : 'Fijar'}</button>` : ''}
            </div>

            <h4 style="margin: 20px 0 10px; color:#475569;">Respuestas (${data.respuestas.length})</h4>
            ${data.respuestas.length === 0 ? '<p style="color:#94a3b8;">Sé el primero en responder.</p>' : ''}
            ${data.respuestas.map(r => `
                <div class="campus-card" style="margin-bottom:10px; border-left: 3px solid ${FORO_ROLE_COLOR[r.autorRol] || '#3498db'};">
                    <div class="campus-card-meta" style="margin-bottom:6px;">
                        <span><b>${window.escapeHtml(r.autor)}</b> (${r.autorRol})</span>
                        <span>${window.formatFechaHora(r.createdAt)}</span>
                    </div>
                    <div>${window.escapeHtml(r.contenido)}</div>
                </div>
            `).join('')}

            <form onsubmit="window.responderForo(event, ${data.post.id})" style="margin-top:18px;">
                <textarea id="foroRespuesta" placeholder="Escribí tu respuesta..." rows="3" required style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;"></textarea>
                <button type="submit" class="btn-action" style="margin-top:10px;"><i class="fas fa-paper-plane"></i> Responder</button>
            </form>
        `;
    };

    window.cerrarForo = function () {
        const det = document.getElementById('foroDetalle');
        const lista = document.getElementById('forosLista');
        if (det) det.innerHTML = '';
        if (lista) lista.style.display = '';
    };

    window.responderForo = async function (e, id) {
        e.preventDefault();
        const text = document.getElementById('foroRespuesta').value.trim();
        if (!text) return;
        const r = await window.apiPost('/api/forum/' + id + '/reply', { contenido: text });
        if (r.exito) { window.toastSuccess && window.toastSuccess('Respuesta publicada.'); window.abrirForo(id); }
        else window.toastError && window.toastError(r.mensaje || 'Error.');
    };

    window.pinForo = async function (id) {
        const r = await window.apiPost('/api/forum/' + id + '/pin');
        if (r.exito) { window.toastSuccess && window.toastSuccess(r.isPinned ? 'Tema fijado.' : 'Tema desfijado.'); window.abrirForo(id); }
        else window.toastError && window.toastError(r.mensaje || 'Error.');
    };

    window.crearTemaForo = async function (e) {
        e.preventDefault();
        const body = {
            materia: document.getElementById('foroMateria').value,
            titulo: document.getElementById('foroTitulo').value,
            contenido: document.getElementById('foroContenido').value,
        };
        const r = await window.apiPost('/api/forum', body);
        if (r.exito) { window.toastSuccess && window.toastSuccess('Tema publicado.'); e.target.reset(); window.cargarForos(); }
        else window.toastError && window.toastError(r.mensaje || 'Error.');
    };
})();
