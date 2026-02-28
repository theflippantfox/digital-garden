/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,ts,svelte}'],
  theme: {
    extend: {
      colors: {
        g: {
          bg:       '#080810',
          surface:  '#0f0f1c',
          surface2: '#161628',
          border:   'rgba(255,255,255,0.07)',
          violet:   '#b44dff',
          coral:    '#ff5c3a',
          cyan:     '#00f0ff',
          lime:     '#b8ff3a',
          text:     '#ede8ff',
          mid:      '#9992b8',
          low:      '#4e4868',
        }
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body:    ['Epilogue', 'sans-serif'],
      },
      animation: {
        'rise': 'riseIn 0.35s ease forwards',
        'breathe': 'breathe1 14s ease-in-out infinite alternate',
      },
      keyframes: {
        riseIn: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        breathe1: {
          from: { borderRadius: '58% 42% 54% 46% / 52% 48% 52% 48%' },
          to:   { borderRadius: '54% 46% 60% 40% / 48% 54% 46% 52%' },
        },
      },
      typography: (theme) => ({
        garden: {
          css: {
            '--tw-prose-body':        theme('colors.g.mid'),
            '--tw-prose-headings':    theme('colors.g.text'),
            '--tw-prose-links':       theme('colors.g.violet'),
            '--tw-prose-bold':        theme('colors.g.text'),
            '--tw-prose-counters':    theme('colors.g.low'),
            '--tw-prose-bullets':     theme('colors.g.low'),
            '--tw-prose-hr':          'rgba(255,255,255,0.07)',
            '--tw-prose-quotes':      theme('colors.g.mid'),
            '--tw-prose-quote-borders': theme('colors.g.violet'),
            '--tw-prose-captions':    theme('colors.g.low'),
            '--tw-prose-code':        theme('colors.g.violet'),
            '--tw-prose-pre-code':    theme('colors.g.mid'),
            '--tw-prose-pre-bg':      theme('colors.g.surface2'),
            '--tw-prose-th-borders':  'rgba(255,255,255,0.07)',
            '--tw-prose-td-borders':  'rgba(255,255,255,0.07)',
          }
        }
      })
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
