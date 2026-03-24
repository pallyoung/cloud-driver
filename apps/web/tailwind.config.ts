import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: '#F3EEE6',
        canvas: '#FCFAF6',
        surface: '#F6F0E6',
        'surface-alt': '#FFFDFC',
        'ink-strong': '#16212B',
        ink: '#243240',
        muted: '#63707B',
        border: '#D8D0C4',
        line: '#D8D0C4',
        'line-strong': '#C5B8A5',
        accent: '#0E6D67',
        'accent-soft': '#D9EFEB',
        info: '#2F6EA6',
        ember: '#B86837',
        success: '#2E7D32',
        warning: '#B7791F',
        danger: '#B42318'
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'ui-sans-serif', 'system-ui'],
        display: ['Space Grotesk', 'ui-sans-serif', 'system-ui'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular']
      },
      boxShadow: {
        shell: '0 18px 36px rgba(22, 33, 43, 0.08)',
        panel: '0 8px 20px rgba(22, 33, 43, 0.05)',
        card: '0 6px 14px rgba(22, 33, 43, 0.05)',
        floating: '0 14px 30px rgba(22, 33, 43, 0.12)'
      }
    },
  },
  plugins: [],
} satisfies Config;
