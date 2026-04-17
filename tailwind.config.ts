import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0e1322',
        'surface-low': '#161b2b',
        surface: '#1a1f2f',
        'surface-high': '#25293a',
        'surface-highest': '#2f3445',
        'surface-bright': '#343949',
        'on-surface': '#dee1f7',
        'on-surface-muted': '#c3c6d7',
        primary: '#b4c5ff',
        'primary-container': '#2563eb',
        outline: '#8d90a0',
        'outline-variant': '#434655',
        'crowd-low': '#10B981',
        'crowd-medium': '#F59E0B',
        'crowd-high': '#EF4444',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease forwards',
        'pulse-glow': 'pulseGlow 2s infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 4px #ffb596' },
          '50%': { opacity: '0.6', boxShadow: '0 0 10px #ffb596, 0 0 20px #ffb596' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
