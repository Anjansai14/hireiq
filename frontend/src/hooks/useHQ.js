import { useEffect, useState } from 'react';
import { HQ } from '../data/hireData';

export function useHQ() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = HQ.sub(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  return {
    s: HQ.s,
    state: HQ.s,
    HQ,
    currentCourse: HQ.film(),
    currentRoute: HQ.s?.route || { name: 'dashboard' },
    go: (name, params) => HQ.go(name, params),
    set: (fn) => HQ.set(fn),
    toast: (msg, type) => HQ.toast(msg, type)
  };
}
