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
        background: '#faf8f5',
        'surface-low': '#ffffff',
        surface: '#ffffff',
        'surface-high': '#f3eee7',
        'surface-highest': '#eae2d7',
        'surface-bright': '#ffffff',
        'on-surface': '#201712',
        'on-surface-muted': '#5c4c40',
        primary: '#ea580c',
        'primary-container': '#f97316',
        outline: '#e5ddd0',
        'outline-variant': '#cdbeaa',
        'crowd-low': '#15803d',
        'crowd-medium': '#d97706',
        'crowd-high': '#dc2626',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease forwards',
        'pulse-glow': 'pulseGlow 2s infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 4px rgba(234, 88, 12, 0.4)' },
          '50%': { opacity: '0.6', boxShadow: '0 0 12px rgba(234, 88, 12, 0.6), 0 0 20px rgba(234, 88, 12, 0.3)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
