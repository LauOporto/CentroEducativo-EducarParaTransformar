const TOKEN_KEY = 'et_token';

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

// Debe coincidir con USER_KEY en AuthContext.jsx. No se importa de ahí
// para evitar un ciclo (AuthContext ya importa de este archivo).
const USER_KEY = 'et_user';

let refreshing = null;

// Si el refresh falla de verdad (sesión inválida/vencida/por inactividad,
// no un error de red transitorio), la sesión del lado del servidor ya no
// existe: limpiar el estado local y mandar a login en vez de dejar al
// usuario viendo páginas privadas sin datos, sin ningún aviso.
function invalidarSesionLocal() {
  setToken(null);
  localStorage.removeItem(USER_KEY);
  if (window.location.pathname !== '/') window.location.href = '/';
}

async function tryRefresh() {
  if (refreshing) return refreshing;
  refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((r) => r.json())
    .then((data) => {
      if (data.exito && data.usuario?.token) {
        setToken(data.usuario.token);
        return data.usuario;
      }
      invalidarSesionLocal();
      return null;
    })
    .catch(() => null)
    .finally(() => {
      setTimeout(() => {
        refreshing = null;
      }, 0);
    });
  return refreshing;
}

async function request(path, { method = 'GET', body, isFormData = false, skipAuthRetry = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData && body !== undefined) headers['Content-Type'] = 'application/json';

  const opts = {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  };

  let res = await fetch(path, opts);

  if (res.status === 401 && !skipAuthRetry && path !== '/api/auth/refresh' && path !== '/api/auth/login') {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${getToken()}` };
      res = await fetch(path, { ...opts, headers: retryHeaders });
    }
  }

  const data = await res.json().catch(() => ({}));
  return data;
}

export const httpClient = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  put: (path, body) => request(path, { method: 'PUT', body: body ?? {} }),
  patch: (path, body) => request(path, { method: 'PATCH', body: body ?? {} }),
  delete: (path) => request(path, { method: 'DELETE' }),
  upload: (path, formData) => request(path, { method: 'POST', body: formData, isFormData: true }),
};
