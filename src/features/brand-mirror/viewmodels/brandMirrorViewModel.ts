import { clampTokenValues, cloneTokens, contrastRatio, normalizeColor, themeTokens, validateTokens } from '../domain/brandRules'
import { nudgeGroupValues, recalcGroupFromBase, scaleGroupValues, SCALE_LABELS, SCALE_LIMITS, SCALE_STEPS, type ClampedLevel, type ScaleAdjustment, type ScaleField } from '../domain/scaleOps'
import type { BrandRepository } from '../repositories/brandRepository'
import type { BrandGuidelinesExporter } from '../services/exportService'
import { INITIAL_TOKENS, type BrandDocument, type BrandMirrorSnapshot, type BrandTheme, type SavedVersion } from '../models/brandMirrorModels'

type Listener = () => void

function formatFactor(factor: number): string {
  return String(Math.round(factor * 1000) / 1000)
}

function buildClampNotice(field: ScaleField, clamped: ClampedLevel[]): string | null {
  if (clamped.length === 0) return null
  const label = SCALE_LABELS[field]
  const limit = SCALE_LIMITS[field]
  const names = (bound: ClampedLevel['bound']) => clamped.filter((level) => level.bound === bound).map((level) => `${label} ${level.index + 1}`).join('、')
  const parts: string[] = []
  const atMin = names('min')
  const atMax = names('max')
  if (atMin) parts.push(`${atMin} 已按下限 ${limit.min}px`)
  if (atMax) parts.push(`${atMax} 已按上限 ${limit.max}px`)
  return `${parts.join('；')}，其余层级按顺序排开`
}

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

  updateScale(field: 'radiusScale' | 'spacingScale' | 'typeScale', index: number, value: number): void {
    const values = [...this.snapshot.tokens[field]]
    values[index] = Number.isFinite(value) ? value : values[index]
    this.update({ tokens: clampTokenValues({ ...this.snapshot.tokens, [field]: values }) }, '令牌已更新')
  }

  scaleGroup(field: ScaleField, factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      this.fail('缩放倍数需大于 0')
      return
    }
    const adjustment = scaleGroupValues(this.snapshot.tokens[field], field, factor)
    this.applyGroupAdjustment(field, adjustment, `${SCALE_LABELS[field]}整组缩放 ×${formatFactor(factor)}`)
  }

  recalcGroupFromBase(field: ScaleField, anchorIndex: number, baseValue: number): void {
    const adjustment = recalcGroupFromBase(this.snapshot.tokens[field], field, anchorIndex, baseValue)
    if (!adjustment) {
      this.fail('基准值无效，无法重算整组')
      return
    }
    this.applyGroupAdjustment(field, adjustment, `${SCALE_LABELS[field]}按第 ${anchorIndex + 1} 级 = ${Math.round(baseValue)}px 重算`)
  }

  nudgeGroup(field: ScaleField, direction: 1 | -1): void {
    const step = SCALE_STEPS[field]
    const adjustment = nudgeGroupValues(this.snapshot.tokens[field], field, direction)
    this.applyGroupAdjustment(field, adjustment, `${SCALE_LABELS[field]}整组 ${direction > 0 ? '+' : '−'}${step}px`)
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

  private applyGroupAdjustment(field: ScaleField, adjustment: ScaleAdjustment, action: string): void {
    const tokens = { ...this.snapshot.tokens, [field]: adjustment.values }
    const notice = buildClampNotice(field, adjustment.clamped)
    const message = notice ? `${action} · ${adjustment.clamped.length} 个层级触及边界` : `${action} · 层级关系保持不变`
    this.update({ tokens }, message, notice)
  }

  private fail(message: string): void {
    this.snapshot = { ...this.snapshot, status: 'error', message }
    this.emit()
  }

  private update(partial: Partial<Pick<BrandDocument, 'tokens' | 'theme'>>, message: string, adjustmentNotice: string | null = null): void {
    const tokens = partial.tokens ?? this.snapshot.tokens
    this.snapshot = this.makeSnapshot({ tokens, theme: partial.theme ?? this.snapshot.theme, versions: this.snapshot.versions }, message, 'editing', adjustmentNotice)
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

  private makeSnapshot(document: Omit<BrandDocument, 'version'>, message = '', status: BrandMirrorSnapshot['status'] = 'ready', adjustmentNotice: string | null = null): BrandMirrorSnapshot {
    const ratio = contrastRatio(document.tokens.primary, document.tokens.secondary)
    const latestVersion = document.versions[document.versions.length - 1]
    return { status, tokens: cloneTokens(document.tokens), theme: document.theme, versions: document.versions, compareMode: false, activeVersionId: latestVersion?.id ?? null, contrastRatio: ratio, contrastWarning: ratio < 3, message, adjustmentNotice }
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener())
  }
}
