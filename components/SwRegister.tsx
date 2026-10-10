'use client';
import { useEffect } from 'react';

/** Registers /sw.js once — PWA installability + offline shell. */
export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
