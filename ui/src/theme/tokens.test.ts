import { describe, expect, it } from 'vitest'
import { contrastRatio, tokens } from './tokens'

describe('theme tokens', () => {
  it('computes known contrast ratios correctly', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
  })

  it('keeps body text readable on every dark surface (>= 4.5:1)', () => {
    for (const surface of [tokens.background, tokens.surface, tokens.elevated]) {
      expect(contrastRatio(tokens.text, surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(tokens.muted, surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(tokens.accent, surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(tokens.error, surface)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps button text readable on the primary and hover colors (>= 4.5:1)', () => {
    expect(contrastRatio(tokens.primaryText, tokens.primary)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(tokens.primaryText, tokens.primaryHover)).toBeGreaterThanOrEqual(4.5)
  })
})
