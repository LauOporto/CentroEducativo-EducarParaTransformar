import { useCallback, useEffect, useState } from 'react';
import { moderationService } from '../services/api/moderationService';

export function useAdminPendingCounts() {
  const [counts, setCounts] = useState(null);

  const refresh = useCallback(async () => {
    const data = await moderationService.pendingCounts();
    if (data.exito) setCounts(data.pendientes);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { counts, refresh };
}
