import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        mtg: {
          w: '#fffbd5',
          u: '#aae0fa',
          b: '#cbc2bf',
          r: '#f9aa8f',
          g: '#9bd3ae',
          c: '#cac5c0',
        },
      },
    },
  },
  plugins: [],
};

export default config;
