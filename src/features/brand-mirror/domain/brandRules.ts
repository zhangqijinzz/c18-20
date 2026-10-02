import type { BrandTheme, BrandTokens, ScaleField, ScaleLimitedValue } from '../models/brandMirrorModels'
import { INITIAL_TOKENS, THEME_PRESETS } from '../models/brandMirrorModels'

const HEX_COLOR = /^#[0-9A-F]{6}$/i

export interface ScaleLimit {
  label: string
  min: number
  max: number
  defaultBaseIndex: number
  step: number
  scaleFactor: number
}

export const SCALE_LIMITS: Record<ScaleField, ScaleLimit> = {
  radiusScale: { label: '圆角尺度', min: 0, max: 40, defaultBaseIndex: 0, step: 2, scaleFactor: 1.125 },
  spacingScale: { label: '间距体系', min: 2, max: 64, defaultBaseIndex: 0, step: 4, scaleFactor: 1.25 },
  typeScale: { label: '字号体系', min: 10, max: 72, defaultBaseIndex: 2, step: 1, scaleFactor: 1.125 },
}

export interface ScaleGroupResult {
  values: number[]
  limitedValues: ScaleLimitedValue[]
  effectiveFactor: number
  requestedBase?: number
  actualBase?: number
}

export function cloneTokens(tokens: BrandTokens): BrandTokens {
  return { ...tokens, radiusScale: [...tokens.radiusScale], spacingScale: [...tokens.spacingScale], typeScale: [...tokens.typeScale] }
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value)
}

export function normalizeColor(value: string): string {
  const candidate = value.trim().toUpperCase()
  return isHexColor(candidate) ? candidate : INITIAL_TOKENS.primary
}

export function clampTokenValues(tokens: BrandTokens): BrandTokens {
  return {
    ...cloneTokens(tokens),
    radiusScale: tokens.radiusScale.map((value) => clampScaleNumber(value, SCALE_LIMITS.radiusScale)),
    spacingScale: tokens.spacingScale.map((value) => clampScaleNumber(value, SCALE_LIMITS.spacingScale)),
    typeScale: tokens.typeScale.map((value) => clampScaleNumber(value, SCALE_LIMITS.typeScale)),
  }
}

export function updateSingleScaleValue(tokens: BrandTokens, field: ScaleField, index: number, value: number): { tokens: BrandTokens; limitedValue: ScaleLimitedValue | null } | null {
  if (!Number.isFinite(value)) return null
  const limit = SCALE_LIMITS[field]
  const values = [...tokens[field]]
  const requested = value
  const actual = clampScaleNumber(value, limit)
  values[index] = actual
  return {
    tokens: { ...tokens, [field]: values },
    limitedValue: requested < limit.min || requested > limit.max
      ? { index, requested, actual, reason: requested < limit.min ? 'min' : 'max' }
      : null,
  }
}

export function scaleGroupByFactor(values: number[], field: ScaleField, factor: number, baseIndex: number): ScaleGroupResult | null {
  const limit = SCALE_LIMITS[field]
  if (!Number.isFinite(factor) || factor <= 0 || !Number.isInteger(baseIndex) || baseIndex < 0 || baseIndex >= values.length) return null
  const anchor = values[baseIndex]
  if (!Number.isFinite(anchor) || anchor <= 0) return null

  const minFactor = Math.max(...values.filter((value) => value > 0).map((value) => limit.min / value))
  const maxFactor = Math.min(...values.filter((value) => value > 0).map((value) => limit.max / value))
  const effectiveFactor = Math.min(Math.max(factor, minFactor), maxFactor)
  const requestedValues = values.map((value) => value * factor)
  const effectiveValues = values.map((value) => value * effectiveFactor)
  const nextValues = strictIntegerValues(effectiveValues, limit)

  return {
    values: nextValues,
    limitedValues: findLimitedValues(requestedValues, effectiveValues, nextValues, limit),
    effectiveFactor,
  }
}

export function rebaseScaleGroup(values: number[], field: ScaleField, baseIndex: number, requestedBase: number): ScaleGroupResult | null {
  const limit = SCALE_LIMITS[field]
  if (!Number.isFinite(requestedBase) || requestedBase <= 0 || !Number.isInteger(baseIndex) || baseIndex < 0 || baseIndex >= values.length) return null
  const anchor = values[baseIndex]
  if (!Number.isFinite(anchor) || anchor <= 0) return null

  const effectiveBase = Math.round(Math.min(Math.max(requestedBase, limit.min), limit.max))
  const result = scaleGroupByFactor(values, field, effectiveBase / anchor, baseIndex)
  if (!result) return null

  const requestedValues = values.map((value) => value * (requestedBase / anchor))
  const effectiveValues = values.map((value) => value * result.effectiveFactor)
  const limitedValues = findLimitedValues(requestedValues, effectiveValues, result.values, limit)
  if (requestedBase < limit.min || requestedBase > limit.max) {
    limitedValues.push({ index: baseIndex, requested: requestedBase, actual: result.values[baseIndex], reason: requestedBase < limit.min ? 'min' : 'max' })
  }

  return { ...result, limitedValues: withActualValues(dedupeLimitedValues(limitedValues), result.values), requestedBase, actualBase: result.values[baseIndex] }
}

export function shiftScaleGroup(values: number[], field: ScaleField, delta: number): ScaleGroupResult | null {
  const limit = SCALE_LIMITS[field]
  if (!Number.isFinite(delta)) return null
  if (delta === 0) return { values: values.map((value) => clampScaleNumber(value, limit)), limitedValues: [], effectiveFactor: 1 }

  const effectiveDelta = Math.min(Math.max(delta, limit.min - values[0]), limit.max - values[values.length - 1])
  const requestedValues = values.map((value) => value + delta)
  const effectiveValues = values.map((value) => value + effectiveDelta)
  const nextValues = strictIntegerValues(effectiveValues, limit)
  return {
    values: nextValues,
    limitedValues: findLimitedValues(requestedValues, effectiveValues, nextValues, limit),
    effectiveFactor: 1,
  }
}

export function validateTokens(tokens: BrandTokens): string | null {
  if (!isHexColor(tokens.primary) || !isHexColor(tokens.secondary)) return '请输入 6 位 HEX 颜色'
  if (tokens.radiusScale.length !== 4 || tokens.spacingScale.length !== 5 || tokens.typeScale.length !== 6) return '令牌层级数量不完整'
  if (tokens.typeScale.some((value) => value < 10 || value > 72)) return '字号范围应在 10–72px'
  return null
}

function channel(value: number): number {
  const scaled = value / 255
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
}

function luminance(color: string): number {
  const red = Number.parseInt(color.slice(1, 3), 16)
  const green = Number.parseInt(color.slice(3, 5), 16)
  const blue = Number.parseInt(color.slice(5, 7), 16)
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
}

export function contrastRatio(first: string, second: string): number {
  const one = luminance(first)
  const two = luminance(second)
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05)
}

export function themeTokens(theme: BrandTheme): BrandTokens {
  return cloneTokens(THEME_PRESETS[theme].tokens)
}

function clampScaleNumber(value: number, limit: Pick<ScaleLimit, 'min' | 'max'>): number {
  return Math.min(limit.max, Math.max(limit.min, Math.round(value)))
}

function strictIntegerValues(rawValues: number[], limit: Pick<ScaleLimit, 'min' | 'max'>): number[] {
  const count = rawValues.length
  let previous = Number.NEGATIVE_INFINITY
  return rawValues.map((value, index) => {
    const lower = limit.min + index
    const upper = limit.max - (count - 1 - index)
    const rounded = Math.round(value)
    const ordered = index === 0 ? rounded : Math.max(rounded, previous + 1)
    const clamped = Math.min(Math.max(ordered, lower), upper)
    previous = clamped
    return clamped
  })
}

function findLimitedValues(requestedValues: number[], effectiveValues: number[], actualValues: number[], limit: ScaleLimit): ScaleLimitedValue[] {
  const byIndex = new Map<number, ScaleLimitedValue>()
  requestedValues.forEach((requested, index) => {
    if (requested < limit.min) {
      byIndex.set(index, { index, requested: Math.round(requested), actual: actualValues[index], reason: 'min' })
    } else if (requested > limit.max) {
      byIndex.set(index, { index, requested: Math.round(requested), actual: actualValues[index], reason: 'max' })
    }
  })
  effectiveValues.forEach((effective, index) => {
    const roundedRequested = Math.round(effective)
    if (roundedRequested !== actualValues[index] && !byIndex.has(index)) {
      byIndex.set(index, { index, requested: roundedRequested, actual: actualValues[index], reason: 'hierarchy' })
    }
  })
  return [...byIndex.values()].sort((first, second) => first.index - second.index)
}

function withActualValues(limitedValues: ScaleLimitedValue[], actualValues: number[]): ScaleLimitedValue[] {
  return limitedValues.map((value) => ({ ...value, actual: actualValues[value.index] }))
}

function dedupeLimitedValues(values: ScaleLimitedValue[]): ScaleLimitedValue[] {
  const byIndex = new Map<number, ScaleLimitedValue>()
  values.forEach((value) => byIndex.set(value.index, value))
  return [...byIndex.values()].sort((first, second) => first.index - second.index)
}
