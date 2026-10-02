import { describe, expect, it } from 'vitest'
import { clampTokenValues, contrastRatio, rebaseScaleGroup, scaleGroupByFactor, shiftScaleGroup, validateTokens } from '../domain/brandRules'
import { INITIAL_TOKENS } from '../models/brandMirrorModels'

describe('brand token rules', () => {
  it('calculates a readable contrast ratio', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1)
    expect(contrastRatio('#F15A47', '#24324A')).toBeGreaterThan(3)
  })

  it('clamps extreme values to the supported design scale', () => {
    const clamped = clampTokenValues({ ...INITIAL_TOKENS, typeScale: [1, 80, 14, 20, 28, 40], radiusScale: [-4, 12, 18, 50], spacingScale: [0, 8, 12, 20, 99] })
    expect(clamped.typeScale).toEqual([10, 72, 14, 20, 28, 40])
    expect(clamped.radiusScale).toEqual([0, 12, 18, 40])
    expect(clamped.spacingScale).toEqual([2, 8, 12, 20, 64])
  })

  it('proportionally scales a group while preserving increasing hierarchy', () => {
    const result = scaleGroupByFactor(INITIAL_TOKENS.spacingScale, 'spacingScale', 2, 0)
    expect(result?.values).toEqual([8, 16, 24, 40, 64])
    result?.values.forEach((value, index) => {
      if (index > 0) expect(value).toBeGreaterThan(result.values[index - 1])
    })
    expect(result?.limitedValues).toEqual([])
  })

  it('uses the available group headroom and reports upper-limit values', () => {
    const result = scaleGroupByFactor(INITIAL_TOKENS.typeScale, 'typeScale', 2, 2)
    expect(result?.values[result.values.length - 1]).toBe(72)
    expect(result?.values).toEqual([22, 25, 29, 36, 50, 72])
    expect(result?.limitedValues.map((value) => value.index)).toEqual([5])
    expect(result?.limitedValues[0]).toMatchObject({ requested: 80, actual: 72, reason: 'max' })
  })

  it('recalculates all levels from a selected base value', () => {
    const result = rebaseScaleGroup(INITIAL_TOKENS.typeScale, 'typeScale', 2, 20)
    expect(result?.values[2]).toBe(20)
    expect(result?.values).toEqual([15, 18, 20, 25, 35, 50])
    expect(result?.limitedValues).toEqual([])
  })

  it('shifts spacing by one step without changing gaps', () => {
    const result = shiftScaleGroup(INITIAL_TOKENS.spacingScale, 'spacingScale', 4)
    expect(result?.values).toEqual([8, 12, 16, 24, 36])
    expect(result?.values.map((value, index) => value - INITIAL_TOKENS.spacingScale[index])).toEqual([4, 4, 4, 4, 4])
  })

  it('reports lower limits and does not move the group beyond bounds', () => {
    const result = shiftScaleGroup(INITIAL_TOKENS.spacingScale, 'spacingScale', -8)
    expect(result?.values).toEqual([2, 6, 10, 18, 30])
    expect(result?.limitedValues.map((value) => value.index)).toEqual([0, 1])
    expect(result?.limitedValues[0]).toMatchObject({ requested: -4, actual: 2, reason: 'min' })
    expect(result?.limitedValues[1]).toMatchObject({ requested: 0, actual: 6, reason: 'min' })
  })

  it('rejects invalid colors and unsupported scale lengths', () => {
    expect(validateTokens({ ...INITIAL_TOKENS, primary: 'red' })).toContain('HEX')
    expect(validateTokens({ ...INITIAL_TOKENS, typeScale: [12] })).toContain('数量')
  })
})
