/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050A1E',
          900: '#0A0F2E',
          800: '#0D1545',
          700: '#111B5E',
        },
        royal: {
          DEFAULT: '#1E3A8A',
          light: '#2563EB',
        },
        purpleDeep: '#4A1D96',
        violet: '#7C3AED',
        cyanLex: '#00E5FF',
        cyanMid: '#22D3EE',
        emerald: '#10B981',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        scroll: 'scroll 35s linear infinite',
        float: 'float 5s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'spin-slow': 'spin 12s linear infinite',
      },
      keyframes: {
        scroll: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-18px)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0,229,255,0.3)' },
          '50%': { boxShadow: '0 0 50px rgba(0,229,255,0.8)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
}
