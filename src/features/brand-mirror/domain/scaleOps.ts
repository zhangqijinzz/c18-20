export type ScaleField = 'radiusScale' | 'spacingScale' | 'typeScale'

export interface ScaleLimit {
  min: number
  max: number
}

export const SCALE_LIMITS: Record<ScaleField, ScaleLimit> = {
  radiusScale: { min: 0, max: 40 },
  spacingScale: { min: 2, max: 64 },
  typeScale: { min: 10, max: 72 },
}

export const SCALE_STEPS: Record<ScaleField, number> = {
  radiusScale: 1,
  spacingScale: 2,
  typeScale: 1,
}

export const SCALE_BASE_LEVELS: Record<ScaleField, number> = {
  radiusScale: 1,
  spacingScale: 1,
  typeScale: 2,
}

export const SCALE_LABELS: Record<ScaleField, string> = {
  radiusScale: '圆角',
  spacingScale: '间距',
  typeScale: '字体',
}

export interface ClampedLevel {
  index: number
  bound: 'min' | 'max'
}

export interface ScaleAdjustment {
  values: number[]
  clamped: ClampedLevel[]
}

const MIN_LEVEL_GAP = 1

export function clampScaleValue(value: number, limit: ScaleLimit): number {
  return Math.min(limit.max, Math.max(limit.min, Math.round(value)))
}

function toClampedList(clamped: Map<number, 'min' | 'max'>): ClampedLevel[] {
  return [...clamped.entries()].map(([index, bound]) => ({ index, bound })).sort((a, b) => a.index - b.index)
}

function enforceLevelOrder(values: number[], limit: ScaleLimit, clamped: Map<number, 'min' | 'max'>): number[] {
  const result = [...values]
  for (let index = 1; index < result.length; index += 1) {
    if (result[index] < result[index - 1] + MIN_LEVEL_GAP) result[index] = result[index - 1] + MIN_LEVEL_GAP
  }
  if (result[result.length - 1] > limit.max) {
    result[result.length - 1] = limit.max
    clamped.set(result.length - 1, 'max')
    for (let index = result.length - 2; index >= 0; index -= 1) {
      if (result[index] > result[index + 1] - MIN_LEVEL_GAP) result[index] = result[index + 1] - MIN_LEVEL_GAP
    }
    if (result[0] < limit.min) {
      result[0] = limit.min
      for (let index = 1; index < result.length; index += 1) {
        if (result[index] < result[index - 1] + MIN_LEVEL_GAP) result[index] = result[index - 1] + MIN_LEVEL_GAP
      }
    }
  }
  return result
}

function applyGroupTransform(current: number[], field: ScaleField, transform: (value: number) => number): ScaleAdjustment {
  const limit = SCALE_LIMITS[field]
  const clamped = new Map<number, 'min' | 'max'>()
  const clampedValues = current.map((value, index) => {
    const rounded = Math.round(transform(value))
    if (rounded < limit.min) {
      clamped.set(index, 'min')
      return limit.min
    }
    if (rounded > limit.max) {
      clamped.set(index, 'max')
      return limit.max
    }
    return rounded
  })
  return { values: enforceLevelOrder(clampedValues, limit, clamped), clamped: toClampedList(clamped) }
}

export function scaleGroupValues(current: number[], field: ScaleField, factor: number): ScaleAdjustment {
  return applyGroupTransform(current, field, (value) => value * factor)
}

export function recalcGroupFromBase(current: number[], field: ScaleField, anchorIndex: number, baseValue: number): ScaleAdjustment | null {
  const anchor = current[anchorIndex]
  if (!Number.isFinite(anchor) || anchor <= 0 || !Number.isFinite(baseValue) || baseValue <= 0) return null
  return applyGroupTransform(current, field, (value) => value * (baseValue / anchor))
}

export function nudgeGroupValues(current: number[], field: ScaleField, direction: 1 | -1): ScaleAdjustment {
  const step = SCALE_STEPS[field] * direction
  return applyGroupTransform(current, field, (value) => value + step)
}
