import { httpClient, setToken } from './httpClient';

export const authService = {
  async login(usuario, password) {
    const data = await httpClient.post('/api/auth/login', { usuario, password });
    if (data.exito) setToken(data.usuario.token);
    return data;
  },

  async register(payload) {
    return httpClient.post('/api/auth/register', payload);
  },

  async logout() {
    await httpClient.post('/api/auth/logout');
    setToken(null);
  },

  async me() {
    return httpClient.get('/api/auth/me');
  },
};
