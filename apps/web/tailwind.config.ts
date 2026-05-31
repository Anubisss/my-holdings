import type { Config } from 'tailwindcss';

// Refined neutral ("slate") ramp used as the app's workhorse surface/text scale.
// It keeps Tailwind's familiar 50–950 contract (so every existing `slate-*`
// utility keeps working) but tunes both ends per modern design-system guidance:
//   - Light end is brighter and cleaner: an airy near-white body (100) with
//     white cards separated by rings/shadows.
//   - Dark end is genuinely near-black ("rich black" ~#0a0a0a, à la Material's
//     dark surface guidance) with subtle elevation steps (body 950 -> card 900
//     -> rows/borders 800 -> badges 700), each a few % lighter than the last so
//     surfaces read as layered rather than flat black.
// The faint cool tint keeps it harmonious with the indigo accent without
// reading as "blue".
const slate = {
  50: '#f9fafb',
  100: '#f5f6f8',
  200: '#e7e9ed',
  300: '#d3d7dd',
  400: '#9aa0a9',
  500: '#6b7079',
  600: '#494e57',
  700: '#34383f',
  800: '#212329',
  900: '#131318',
  950: '#08080a',
};

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Class-based so the user can force light/dark; "auto" mirrors the OS by
  // toggling the `dark` class from JS (see lib/theme.ts and the inline script
  // in index.html that applies the saved theme before first paint).
  darkMode: 'class',
  theme: {
    extend: {
      colors: { slate },
    },
  },
  plugins: [],
} satisfies Config;
