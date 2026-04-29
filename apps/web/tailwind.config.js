/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'Circular',
          '-apple-system',
          'system-ui',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      colors: {
        abnb: {
          primary: '#ff385c',
          primaryActive: '#e00b41',
          primaryDisabled: '#ffd1da',
          error: '#c13515',
          errorHover: '#b32505',
          luxe: '#460479',
          plus: '#92174d',
          ink: '#222222',
          body: '#3f3f3f',
          muted: '#6a6a6a',
          mutedSoft: '#929292',
          hairline: '#dddddd',
          hairlineSoft: '#ebebeb',
          borderStrong: '#c1c1c1',
          canvas: '#ffffff',
          surfaceSoft: '#f7f7f7',
          surfaceCard: '#ffffff',
          surfaceStrong: '#f2f2f2',
          onPrimary: '#ffffff',
          onDark: '#ffffff',
          legalLink: '#428bff',
          star: '#222222',
        },
      },
      maxWidth: {
        abnb: '1280px',
      },
      borderRadius: {
        'abnb-xs': '4px',
        'abnb-sm': '8px',
        'abnb-md': '14px',
        'abnb-lg': '20px',
        'abnb-xl': '32px',
      },
      boxShadow: {
        abnb:
          'rgba(0, 0, 0, 0.02) 0 0 0 1px, rgba(0, 0, 0, 0.04) 0 2px 6px 0, rgba(0, 0, 0, 0.1) 0 4px 8px 0',
        'abnb-lg':
          'rgba(0, 0, 0, 0.03) 0 0 0 1px, rgba(0, 0, 0, 0.06) 0 8px 24px -4px, rgba(0, 0, 0, 0.08) 0 16px 40px -8px',
        'abnb-inner':
          'inset 0 1px 0 0 rgba(255,255,255,0.85), 0 1px 2px rgba(0,0,0,0.04)',
      },
      backgroundImage: {
        'hero-radial':
          'radial-gradient(ellipse 85% 55% at 50% -8%, rgba(255, 56, 92, 0.10), transparent 55%)',
        'hero-radial-secondary':
          'radial-gradient(ellipse 50% 40% at 90% 60%, rgba(255, 56, 92, 0.06), transparent 50%)',
        'mesh-soft':
          'radial-gradient(at 40% 20%, rgba(255, 56, 92, 0.07) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(70, 4, 121, 0.04) 0px, transparent 45%), radial-gradient(at 0% 50%, rgba(255, 56, 92, 0.05) 0px, transparent 40%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
        'fade-up-delay': 'fade-up 0.65s ease-out 0.08s both',
        'fade-up-slow': 'fade-up 0.75s ease-out 0.15s both',
      },
    },
  },
  plugins: [],
}
