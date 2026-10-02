import { useState } from 'react'
import type { BrandMirrorSnapshot } from '../models/brandMirrorModels'
import { SCALE_BASE_LEVELS, SCALE_LABELS, SCALE_LIMITS, SCALE_STEPS, type ScaleField } from '../domain/scaleOps'

interface GroupScaleControlsProps {
  snapshot: BrandMirrorSnapshot
  onScaleGroup: (field: ScaleField, factor: number) => void
  onRecalcGroup: (field: ScaleField, anchorIndex: number, baseValue: number) => void
  onNudgeGroup: (field: ScaleField, direction: 1 | -1) => void
}

const GROUP_ORDER: ScaleField[] = ['typeScale', 'spacingScale', 'radiusScale']

export function GroupScaleControls({ snapshot, onScaleGroup, onRecalcGroup, onNudgeGroup }: GroupScaleControlsProps) {
  const [field, setField] = useState<ScaleField>('typeScale')
  const [factorText, setFactorText] = useState('1.25')
  const [anchorIndex, setAnchorIndex] = useState(SCALE_BASE_LEVELS.typeScale)
  const [baseText, setBaseText] = useState(String(snapshot.tokens.typeScale[SCALE_BASE_LEVELS.typeScale]))

  const values = snapshot.tokens[field]
  const limit = SCALE_LIMITS[field]
  const step = SCALE_STEPS[field]

  const selectGroup = (next: ScaleField) => {
    const anchor = SCALE_BASE_LEVELS[next]
    setField(next)
    setAnchorIndex(anchor)
    setBaseText(String(snapshot.tokens[next][anchor]))
  }

  const selectAnchor = (index: number) => {
    setAnchorIndex(index)
    setBaseText(String(snapshot.tokens[field][index]))
  }

  return (
    <section className="control-section group-adjust">
      <div className="section-label"><span>整组调整</span><span className="muted">保持层级顺序</span></div>
      <div className="filter-chips group-tabs">
        {GROUP_ORDER.map((id) => (
          <button className={field === id ? 'active' : ''} key={id} type="button" onClick={() => selectGroup(id)}>{SCALE_LABELS[id]}</button>
        ))}
      </div>

      <div className="adjust-row">
        <span className="adjust-name">等比缩放</span>
        <div className="adjust-actions">
          <button type="button" onClick={() => onScaleGroup(field, 0.9)}>×0.9</button>
          <button type="button" onClick={() => onScaleGroup(field, 1.1)}>×1.1</button>
          <input aria-label="自定义缩放倍数" inputMode="decimal" value={factorText} onChange={(event) => setFactorText(event.target.value)} />
          <button className="adjust-apply" type="button" onClick={() => onScaleGroup(field, Number(factorText))}>应用</button>
        </div>
      </div>

      <div className="adjust-row">
        <span className="adjust-name">基准重算</span>
        <div className="adjust-actions">
          <select aria-label="基准层级" value={anchorIndex} onChange={(event) => selectAnchor(Number(event.target.value))}>
            {values.map((value, index) => <option key={index} value={index}>第 {index + 1} 级 · {value}px</option>)}
          </select>
          <input aria-label="基准值" inputMode="numeric" value={baseText} onChange={(event) => setBaseText(event.target.value)} />
          <span className="adjust-unit">px</span>
          <button className="adjust-apply" type="button" onClick={() => onRecalcGroup(field, anchorIndex, Number(baseText))}>重算</button>
        </div>
      </div>

      <div className="adjust-row">
        <span className="adjust-name">单步增减</span>
        <div className="adjust-actions">
          <button type="button" onClick={() => onNudgeGroup(field, -1)}>−{step}px</button>
          <button type="button" onClick={() => onNudgeGroup(field, 1)}>＋{step}px</button>
          <span className="adjust-unit">全组同步 · {limit.min}–{limit.max}px</span>
        </div>
      </div>

      {snapshot.adjustmentNotice && (
        <div className="adjust-notice" role="status"><span className="adjust-notice-icon">⚠</span><span>{snapshot.adjustmentNotice}</span></div>
      )}
    </section>
  )
}
