import { SCALE_LIMITS, cloneTokens, contrastRatio, normalizeColor, rebaseScaleGroup, scaleGroupByFactor, shiftScaleGroup, themeTokens, updateSingleScaleValue, validateTokens } from '../domain/brandRules'
import type { BrandRepository } from '../repositories/brandRepository'
import type { BrandGuidelinesExporter } from '../services/exportService'
import { INITIAL_TOKENS, type BrandDocument, type BrandMirrorSnapshot, type ScaleAdjustmentNotice, type ScaleField, type ScaleLimitedValue, type BrandTheme, type SavedVersion } from '../models/brandMirrorModels'

type Listener = () => void

export class BrandMirrorViewModel {
  private snapshot: BrandMirrorSnapshot = this.makeSnapshot({ tokens: INITIAL_TOKENS, theme: 'studio', versions: [] })
  private readonly listeners = new Set<Listener>()
  private readonly repository: BrandRepository
  private readonly exporter?: BrandGuidelinesExporter

  constructor(repository: BrandRepository, exporter?: BrandGuidelinesExporter) {
    this.repository = repository
    this.exporter = exporter
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): BrandMirrorSnapshot {
    return this.snapshot
  }

  initialize(): void {
    const stored = this.repository.load()
    if (stored) {
      this.snapshot = this.makeSnapshot(stored, '已恢复最近一次工作状态')
    } else {
      this.snapshot = this.makeSnapshot({ tokens: INITIAL_TOKENS, theme: 'studio', versions: [] }, '从 Studio warm 开始探索')
    }
    this.emit()
  }

  selectTheme(theme: BrandTheme): void {
    this.update({ tokens: themeTokens(theme), theme }, '已切换基础主题')
  }

  updateColor(field: 'primary' | 'secondary', value: string): void {
    const color = normalizeColor(value)
    this.update({ tokens: { ...this.snapshot.tokens, [field]: color } }, '令牌已更新')
  }

  updateScale(field: ScaleField, index: number, value: number): void {
    const result = updateSingleScaleValue(this.snapshot.tokens, field, index, value)
    if (!result) return
    const scaleNotice = result.limitedValue
      ? { field, limitedValues: [result.limitedValue] }
      : null
    this.update({ tokens: result.tokens }, result.limitedValue ? this.limitMessage(field, [result.limitedValue]) : '令牌已更新', 'editing', scaleNotice)
  }

  scaleScaleGroup(field: ScaleField, direction: 'up' | 'down'): void {
    const factor = SCALE_LIMITS[field].scaleFactor ** (direction === 'up' ? 1 : -1)
    const result = scaleGroupByFactor(this.snapshot.tokens[field], field, factor, SCALE_LIMITS[field].defaultBaseIndex)
    if (!result) return
    const label = direction === 'up' ? '放大一档' : '缩小一档'
    this.applyGroupResult(field, result.values, result.limitedValues, `${SCALE_LIMITS[field].label}已${label}`)
  }

  shiftScaleGroup(field: ScaleField, direction: 'up' | 'down'): void {
    const delta = SCALE_LIMITS[field].step * (direction === 'up' ? 1 : -1)
    const result = shiftScaleGroup(this.snapshot.tokens[field], field, delta)
    if (!result) return
    const label = direction === 'up' ? '增加一档' : '减少一档'
    this.applyGroupResult(field, result.values, result.limitedValues, `${SCALE_LIMITS[field].label}已${label}`)
  }

  rebaseScaleGroup(field: ScaleField, baseIndex: number, baseValue: number): void {
    const result = rebaseScaleGroup(this.snapshot.tokens[field], field, baseIndex, baseValue)
    if (!result) {
      this.snapshot = { ...this.snapshot, status: 'error', message: '请输入有效的基准数值' }
      this.emit()
      return
    }
    const baseText = `${SCALE_LIMITS[field].label} 第 ${baseIndex + 1} 级基准为 ${result.actualBase}px`
    this.applyGroupResult(field, result.values, result.limitedValues, baseText)
  }

  reset(): void {
    this.update({ tokens: cloneTokens(INITIAL_TOKENS), theme: 'studio' }, '已恢复默认令牌')
  }

  saveVersion(): void {
    const validationError = validateTokens(this.snapshot.tokens)
    if (validationError) {
      this.snapshot = { ...this.snapshot, status: 'error', message: validationError }
      this.emit()
      return
    }
    const nextVersion: SavedVersion = {
      id: `version-${Date.now()}`,
      label: this.snapshot.versions.length === 0 ? 'Version A' : `Version ${String.fromCharCode(65 + this.snapshot.versions.length)}`,
      tokens: cloneTokens(this.snapshot.tokens),
      createdAt: new Date().toISOString(),
    }
    const versions = [...this.snapshot.versions, nextVersion]
    this.persist({ tokens: this.snapshot.tokens, theme: this.snapshot.theme, versions }, '版本已保存')
  }

  toggleCompare(): void {
    this.snapshot = { ...this.snapshot, compareMode: !this.snapshot.compareMode, message: this.snapshot.compareMode ? '已退出对比模式' : '正在对比最近两个版本' }
    this.emit()
  }

  exportBrandGuidelines(): void {
    if (!this.exporter) return
    try {
      this.exporter.export(this.snapshot)
      this.snapshot = { ...this.snapshot, message: '品牌规范已导出' }
    } catch {
      this.snapshot = { ...this.snapshot, status: 'error', message: '导出失败，请稍后重试' }
    }
    this.emit()
  }

  private applyGroupResult(field: ScaleField, values: number[], limitedValues: ScaleLimitedValue[], baseMessage: string): void {
    const message = limitedValues.length ? this.limitMessage(field, limitedValues) : baseMessage
    const scaleNotice = limitedValues.length ? { field, limitedValues } : null
    this.update({ tokens: { ...this.snapshot.tokens, [field]: values } }, message, 'editing', scaleNotice)
  }

  private update(partial: Partial<Pick<BrandDocument, 'tokens' | 'theme'>>, message: string, status: BrandMirrorSnapshot['status'] = 'editing', scaleNotice: ScaleAdjustmentNotice | null = null): void {
    const tokens = partial.tokens ?? this.snapshot.tokens
    this.snapshot = this.makeSnapshot({ tokens, theme: partial.theme ?? this.snapshot.theme, versions: this.snapshot.versions }, message, status, scaleNotice)
    this.persistCurrent()
  }

  private persistCurrent(): void {
    try {
      this.repository.save({ version: 1, tokens: this.snapshot.tokens, theme: this.snapshot.theme, versions: this.snapshot.versions })
    } catch {
      this.snapshot = { ...this.snapshot, status: 'error', message: '本地保存失败，但当前编辑仍保留在页面中' }
    }
    this.emit()
  }

  private persist(document: Omit<BrandDocument, 'version'>, message: string): void {
    try {
      this.repository.save({ version: 1, ...document })
      this.snapshot = this.makeSnapshot(document, message, 'ready')
    } catch {
      this.snapshot = { ...this.snapshot, status: 'error', message: '版本保存失败，请稍后重试' }
    }
    this.emit()
  }

  private makeSnapshot(document: Omit<BrandDocument, 'version'>, message = '', status: BrandMirrorSnapshot['status'] = 'ready', scaleNotice: ScaleAdjustmentNotice | null = null): BrandMirrorSnapshot {
    const ratio = contrastRatio(document.tokens.primary, document.tokens.secondary)
    const latestVersion = document.versions[document.versions.length - 1]
    return { status, tokens: cloneTokens(document.tokens), theme: document.theme, versions: document.versions, compareMode: false, activeVersionId: latestVersion?.id ?? null, contrastRatio: ratio, contrastWarning: ratio < 3, message, scaleNotice }
  }

  private limitMessage(field: ScaleField, limitedValues: ScaleLimitedValue[]): string {
    const limit = SCALE_LIMITS[field]
    const levels = limitedValues.map((value) => `第${value.index + 1}级`).join('、')
    const hasMin = limitedValues.some((value) => value.reason === 'min')
    const hasMax = limitedValues.some((value) => value.reason === 'max')
    const hasHierarchy = limitedValues.some((value) => value.reason === 'hierarchy')
    const boundary = hasMin && hasMax ? `${limit.min}–${limit.max}px ` : hasMin ? `下限 ${limit.min}px ` : hasMax ? `上限 ${limit.max}px ` : ''
    return `${limit.label}${levels}已受${boundary}${hasHierarchy ? '层级' : ''}限制，层级顺序保持不变`
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener())
  }
}
