import { useCallback, useEffect, useState } from 'react';
import { notificationsService } from '../services/api/notificationsService';
import { useAuth } from './useAuth';

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    const data = await notificationsService.list();
    if (data.exito) {
      setItems(data.notificaciones);
      setUnread(data.noLeidas);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [user, refresh]);

  const markRead = useCallback(async (id) => {
    await notificationsService.markRead(id);
    refresh();
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    await notificationsService.markAllRead();
    refresh();
  }, [refresh]);

  return { items, unread, refresh, markRead, markAllRead };
}
