'use client';
import { useEffect } from 'react';

/**
 * Production only: registers /sw.js for installability + offline shell.
 * In dev it does the opposite — unregisters stale workers so Fast Refresh
 * and HMR traffic stay untouched by any previously installed worker.
 */
export function SwRegister({ enabled = process.env.NODE_ENV === 'production' }: { enabled?: boolean }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker) return;
    if (enabled) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    } else {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister().catch(() => {})))
        .catch(() => {});
    }
  }, [enabled]);
  return null;
}
