import { describe, expect, it } from 'vitest'
import { nudgeGroupValues, recalcGroupFromBase, scaleGroupValues } from '../domain/scaleOps'

const TYPE_SCALE = [12, 14, 16, 20, 28, 40]

function isStrictlyAscending(values: number[]): boolean {
  return values.every((value, index) => index === 0 || value > values[index - 1])
}

describe('scale group operations', () => {
  it('scales every level proportionally and rounds to integers', () => {
    const result = scaleGroupValues(TYPE_SCALE, 'typeScale', 1.25)
    expect(result.values).toEqual([15, 18, 20, 25, 35, 50])
    expect(result.clamped).toEqual([])
  })

  it('keeps levels strictly ordered when the lower bound collapses them', () => {
    const result = scaleGroupValues(TYPE_SCALE, 'typeScale', 0.5)
    expect(result.values).toEqual([10, 11, 12, 13, 14, 20])
    expect(result.clamped).toEqual([
      { index: 0, bound: 'min' },
      { index: 1, bound: 'min' },
      { index: 2, bound: 'min' },
    ])
    expect(isStrictlyAscending(result.values)).toBe(true)
  })

  it('reports levels limited by the upper bound and keeps the order', () => {
    const result = scaleGroupValues(TYPE_SCALE, 'typeScale', 3)
    expect(result.values).toEqual([36, 42, 48, 60, 71, 72])
    expect(result.clamped).toEqual([
      { index: 4, bound: 'max' },
      { index: 5, bound: 'max' },
    ])
    expect(isStrictlyAscending(result.values)).toBe(true)
  })

  it('recomputes the whole group from a base level while preserving ratios', () => {
    const result = recalcGroupFromBase(TYPE_SCALE, 'typeScale', 2, 24)
    expect(result?.values).toEqual([18, 21, 24, 30, 42, 60])
    expect(result?.clamped).toEqual([])
  })

  it('clamps the base level itself when the requested base exceeds the limit', () => {
    const result = recalcGroupFromBase(TYPE_SCALE, 'typeScale', 2, 100)
    expect(result?.values[2]).toBe(72)
    expect(result?.clamped).toContainEqual({ index: 2, bound: 'max' })
    expect(isStrictlyAscending(result?.values ?? [])).toBe(true)
  })

  it('returns null when the current base level is zero or the base value is invalid', () => {
    expect(recalcGroupFromBase([0, 12, 18, 28], 'radiusScale', 0, 10)).toBeNull()
    expect(recalcGroupFromBase(TYPE_SCALE, 'typeScale', 2, 0)).toBeNull()
    expect(recalcGroupFromBase(TYPE_SCALE, 'typeScale', 2, Number.NaN)).toBeNull()
  })

  it('nudges the whole group by one step and clamps at the lower bound', () => {
    const up = nudgeGroupValues([4, 8, 12, 20, 32], 'spacingScale', 1)
    expect(up.values).toEqual([6, 10, 14, 22, 34])
    expect(up.clamped).toEqual([])

    const down = nudgeGroupValues([2, 4, 6, 8, 10], 'spacingScale', -1)
    expect(down.values).toEqual([2, 3, 4, 6, 8])
    expect(down.clamped).toEqual([{ index: 0, bound: 'min' }])
    expect(isStrictlyAscending(down.values)).toBe(true)
  })

  it('restores a strict order even when the input scale was unordered', () => {
    const result = nudgeGroupValues([40, 10, 40, 10, 40, 10], 'typeScale', 1)
    expect(isStrictlyAscending(result.values)).toBe(true)
    expect(result.values[0]).toBeGreaterThanOrEqual(10)
    expect(result.values[result.values.length - 1]).toBeLessThanOrEqual(72)
  })
})
