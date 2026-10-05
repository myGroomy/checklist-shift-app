import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#f5f5f5',
        surface: '#ffffff',
        ink: '#292524',
        'ink-muted': '#78716c',
        'ink-light': '#a8a29e',
        border: '#e7e5e4',
        'border-strong': '#d6d3d1',
        primary: '#292524',
        'primary-hover': '#44403c',
        success: '#16a34a',
        'success-bg': '#f0fdf4',
        warning: '#ca8a04',
        'warning-bg': '#fefce8',
        error: '#dc2626',
        'error-bg': '#fef2f2',
        info: '#2563eb',
        'info-bg': '#eff6ff',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        popover: 'var(--popover)',
        'popover-foreground': 'var(--popover-foreground)',
        'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)',
        'secondary-foreground': 'var(--secondary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        destructive: 'var(--destructive)',
        'destructive-foreground': 'var(--destructive-foreground)',
        input: 'var(--input)',
        ring: 'var(--ring)',
      },
      spacing: {
        'touch': '44px',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        pill: '9999px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
