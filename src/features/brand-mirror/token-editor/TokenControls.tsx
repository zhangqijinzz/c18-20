import { useEffect, useState } from 'react'
import { SCALE_LIMITS } from '../domain/brandRules'
import type { BrandMirrorSnapshot, BrandTheme, BulkScaleField, ScaleField, ScaleLimitedValue } from '../models/brandMirrorModels'

interface TokenControlsProps {
  snapshot: BrandMirrorSnapshot
  onThemeChange: (theme: BrandTheme) => void
  onColorChange: (field: 'primary' | 'secondary', value: string) => void
  onScaleChange: (field: ScaleField, index: number, value: number) => void
  onGroupScale: (field: BulkScaleField, direction: 'up' | 'down') => void
  onGroupShift: (field: BulkScaleField, direction: 'up' | 'down') => void
  onGroupRebase: (field: BulkScaleField, baseIndex: number, baseValue: number) => void
  onReset: () => void
}

const themes: { id: BrandTheme; label: string; note: string }[] = [
  { id: 'studio', label: 'Studio warm', note: '热烈 · 友好' },
  { id: 'editorial', label: 'Editorial green', note: '克制 · 自然' },
  { id: 'night', label: 'Night signal', note: '锐利 · 数字' },
]

export function TokenControls({ snapshot, onThemeChange, onColorChange, onScaleChange, onGroupScale, onGroupShift, onGroupRebase, onReset }: TokenControlsProps) {
  return (
    <aside className="control-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">01 / TOKENS</span>
          <h2>视觉令牌</h2>
        </div>
        <button className="text-button" type="button" onClick={onReset}>恢复默认</button>
      </div>

      <section className="control-section">
        <div className="section-label"><span>基础主题</span><span className="muted">快速起点</span></div>
        <div className="theme-list">
          {themes.map((theme) => (
            <button className={`theme-option ${snapshot.theme === theme.id ? 'selected' : ''}`} key={theme.id} onClick={() => onThemeChange(theme.id)} type="button">
              <span className={`theme-dot ${theme.id}`} />
              <span><strong>{theme.label}</strong><small>{theme.note}</small></span>
              {snapshot.theme === theme.id && <span className="check-mark">✓</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="control-section">
        <div className="section-label"><span>品牌色</span><span className="muted">HEX / 6 位</span></div>
        <div className="color-fields">
          <ColorField label="主色" value={snapshot.tokens.primary} onChange={(value) => onColorChange('primary', value)} />
          <ColorField label="辅助色" value={snapshot.tokens.secondary} onChange={(value) => onColorChange('secondary', value)} />
        </div>
        <div className={`contrast-note ${snapshot.contrastWarning ? 'warning' : ''}`}>
          <span className="contrast-icon">◐</span>
          <span>对比度 <strong>{snapshot.contrastRatio.toFixed(1)}:1</strong> · {snapshot.contrastWarning ? '建议提高对比度' : '适合界面使用'}</span>
        </div>
      </section>

      <ScaleControl label="圆角尺度" hint="px" values={snapshot.tokens.radiusScale} field="radiusScale" onChange={onScaleChange} />
      <ScaleControl
        label="间距体系"
        hint="px"
        values={snapshot.tokens.spacingScale}
        field="spacingScale"
        onChange={onScaleChange}
        notice={snapshot.scaleNotice}
        onGroupScale={onGroupScale}
        onGroupShift={onGroupShift}
        onGroupRebase={onGroupRebase}
      />
      <ScaleControl
        label="字号体系"
        hint="px"
        values={snapshot.tokens.typeScale}
        field="typeScale"
        onChange={onScaleChange}
        notice={snapshot.scaleNotice}
        onGroupScale={onGroupScale}
        onGroupShift={onGroupShift}
        onGroupRebase={onGroupRebase}
      />

      <div className="panel-footer"><span className="live-dot" />所有调整实时同步到预览</div>
    </aside>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="color-field"><span>{label}</span><div className="color-input"><input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} /><input aria-label={`${label} HEX`} value={value} onChange={(event) => onChange(event.target.value)} /></div></label>
}

interface ScaleControlProps {
  label: string
  hint: string
  values: number[]
  field: ScaleField
  onChange: (field: ScaleField, index: number, value: number) => void
  notice?: BrandMirrorSnapshot['scaleNotice']
  onGroupScale?: (field: BulkScaleField, direction: 'up' | 'down') => void
  onGroupShift?: (field: BulkScaleField, direction: 'up' | 'down') => void
  onGroupRebase?: (field: BulkScaleField, baseIndex: number, baseValue: number) => void
}

function ScaleControl({ label, hint, values, field, onChange, notice, onGroupScale, onGroupShift, onGroupRebase }: ScaleControlProps) {
  const limit = SCALE_LIMITS[field]
  const activeNotice = notice?.field === field ? notice : null
  return (
    <section className="control-section scale-section">
      <div className="section-label"><span>{label}</span><span className="muted">{limit.min}–{limit.max}{hint}</span></div>
      <div className={`scale-inputs ${field === 'typeScale' ? 'six-columns' : ''}`}>
        {values.map((value, index) => (
          <label key={`${field}-${index}`}>
            <span>{index + 1}</span>
            <input aria-label={`${label}${index + 1}`} type="number" min={limit.min} max={limit.max} value={value} onChange={(event) => onChange(field, index, Number(event.target.value))} />
          </label>
        ))}
      </div>
      {onGroupScale && onGroupShift && onGroupRebase && (
        <BulkScaleTools
          field={field as BulkScaleField}
          values={values}
          onGroupScale={onGroupScale}
          onGroupShift={onGroupShift}
          onGroupRebase={onGroupRebase}
        />
      )}
      {activeNotice && <ScaleLimitNotice label={label} notice={activeNotice} />}
    </section>
  )
}

interface BulkScaleToolsProps {
  field: BulkScaleField
  values: number[]
  onGroupScale: (field: BulkScaleField, direction: 'up' | 'down') => void
  onGroupShift: (field: BulkScaleField, direction: 'up' | 'down') => void
  onGroupRebase: (field: BulkScaleField, baseIndex: number, baseValue: number) => void
}

function BulkScaleTools({ field, values, onGroupScale, onGroupShift, onGroupRebase }: BulkScaleToolsProps) {
  const limit = SCALE_LIMITS[field]
  const [baseIndex, setBaseIndex] = useState(limit.defaultBaseIndex)
  const [baseValue, setBaseValue] = useState(String(values[limit.defaultBaseIndex]))

  useEffect(() => {
    setBaseValue(String(values[baseIndex]))
  }, [values, baseIndex])

  const downFactor = (1 / limit.scaleFactor).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  const submitRebase = () => onGroupRebase(field, baseIndex, Number(baseValue))

  return (
    <div className="bulk-scale-tools">
      <div className="bulk-action-row">
        <button type="button" onClick={() => onGroupShift(field, 'down')} aria-label={`${limit.label}单步减少${limit.step}px`}>单步 −{limit.step}</button>
        <button type="button" onClick={() => onGroupScale(field, 'down')} aria-label={`${limit.label}等比缩小`}>×{downFactor}</button>
        <button type="button" onClick={() => onGroupScale(field, 'up')} aria-label={`${limit.label}整体放大一档`}>×{limit.scaleFactor}</button>
        <button type="button" onClick={() => onGroupShift(field, 'up')} aria-label={`${limit.label}单步增加${limit.step}px`}>单步 +{limit.step}</button>
      </div>
      <div className="rebase-row">
        <select aria-label={`${limit.label}基准层级`} value={baseIndex} onChange={(event) => setBaseIndex(Number(event.target.value))}>
          {values.map((_, index) => <option key={index} value={index}>第 {index + 1} 级</option>)}
        </select>
        <input aria-label={`${limit.label}基准值`} type="number" min={limit.min} max={limit.max} value={baseValue} onChange={(event) => setBaseValue(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submitRebase()} />
        <button type="button" onClick={submitRebase}>按基准重算</button>
      </div>
    </div>
  )
}

function ScaleLimitNotice({ label, notice }: { label: string; notice: NonNullable<BrandMirrorSnapshot['scaleNotice']> }) {
  return (
    <div className="scale-limit-note" role="alert">
      <strong>{label}有值被限制</strong>
      <div className="limit-value-list">
        {notice.limitedValues.map((limited) => <LimitChip key={limited.index} limited={limited} />)}
      </div>
      <span>已保持原有层级顺序；界面、预览、版本和导出均使用当前实际值。</span>
    </div>
  )
}

function LimitChip({ limited }: { limited: ScaleLimitedValue }) {
  const reason = limited.reason === 'min' ? '下限' : limited.reason === 'max' ? '上限' : '层级'
  return <span>第 {limited.index + 1} 级：{limited.requested}px → {limited.actual}px（{reason}）</span>
}
