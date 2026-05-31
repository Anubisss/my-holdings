import { useEffect, useState } from 'react';

// Tailwind's `sm` breakpoint. Above it we assume a pointer device without an
// on-screen keyboard.
const DESKTOP_QUERY = '(min-width: 640px)';

// Whether the viewport is at least the `sm` breakpoint. Used to gate behaviour
// that's only desirable with a physical keyboard — chiefly auto-focusing a form
// field, which on touch devices pops the on-screen keyboard over the modal
// before the browser has settled its (visual) viewport.
export const useIsDesktop = (): boolean => {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const handleChange = () => setIsDesktop(query.matches);
    handleChange();
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return isDesktop;
};
