/** Single source of design tokens. Mirrored as CSS variables in theme.css. */
export const tokens = {
  background: '#121212',
  surface: '#181818',
  elevated: '#232323',
  border: '#2e2e2e',
  text: '#FFFFFF',
  muted: '#B3B3B3',
  primary: '#7C3AED',
  primaryHover: '#6D28D9',
  primaryText: '#FFFFFF',
  accent: '#A78BFA',
  error: '#F87171',
  success: '#4ADE80',
} as const

function channel(value: number): number {
  const v = value / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2.x contrast ratio between two #RRGGBB colors. */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground)
  const b = luminance(background)
  const [lighter, darker] = a >= b ? [a, b] : [b, a]
  return (lighter + 0.05) / (darker + 0.05)
}
