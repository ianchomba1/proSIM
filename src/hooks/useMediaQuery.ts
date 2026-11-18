import { useEffect, useState } from 'react';

/** True while the media query matches; updates when the window is resized or rotated. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Phones and narrow tablets: the admin sidebar becomes a slide-out menu below this width. */
export const MOBILE_QUERY = '(max-width: 860px)';
export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);
