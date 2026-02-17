import { useMemo } from 'react';

/**
 * Reads feature flags from the URL query string.
 * Usage: append ?features=ralph or ?features=ralph,other to the URL.
 */
export function useFeatureFlags() {
  const flags = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('features') ?? '';
    return new Set(raw.split(',').map(f => f.trim().toLowerCase()).filter(Boolean));
  }, []);

  return {
    /** Check whether a named feature flag is enabled */
    hasFlag: (name: string) => flags.has(name.toLowerCase()),
  };
}
