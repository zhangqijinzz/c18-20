import type { BrandTokens } from '../models/brandMirrorModels'

const componentNames = ['按钮', '输入框', '标签', '通知', '头像', '开关', '进度条', '选择器', '日期', '徽章', '卡片', '菜单', '分页', '工具提示', '筛选器', '上传', '骨架屏', '评价', '弹窗', '时间线']

export function ComponentGallery({ tokens }: { tokens: BrandTokens }) {
  return <section className="showcase-section"><div className="showcase-heading"><div><span className="eyebrow">02 / COMPONENTS</span><h2>组件样例</h2></div><span className="count-badge">{componentNames.length} 个响应中</span></div><div className="component-grid">{componentNames.map((name, index) => <ComponentCard key={name} name={name} index={index} tokens={tokens} />)}</div></section>
}

function ComponentCard({ name, index, tokens }: { name: string; index: number; tokens: BrandTokens }) {
  const variant = index % 4
  const spacing = tokens.spacingScale
  const font = tokens.typeScale
  return <article className="component-card" style={{ padding: spacing[2], borderRadius: spacing[2] }}><div className="sample-meta" style={{ fontSize: font[0] }}><span className="sample-index">{String(index + 1).padStart(2, '0')}</span><span>{name}</span></div><div className={`sample sample-${variant}`} style={{ minHeight: 94, paddingTop: spacing[2], gap: spacing[1] }}>
    {variant === 0 && <><button style={{ background: tokens.primary, borderRadius: tokens.radiusScale[1], padding: `${spacing[1]}px ${spacing[2]}px`, fontSize: font[1] }}>继续探索 <span>→</span></button><button className="ghost-button" style={{ borderRadius: tokens.radiusScale[1], padding: `${spacing[1]}px ${spacing[2]}px`, fontSize: font[1] }}>次要操作</button></>}
    {variant === 1 && <><div className="fake-input" style={{ borderRadius: tokens.radiusScale[0], padding: spacing[1], fontSize: font[0], gap: spacing[1] }}>搜索品牌资产 <span>⌕</span></div><div className="tag-row" style={{ gap: spacing[0] }}><span style={{ background: `${tokens.primary}18`, color: tokens.primary, borderRadius: tokens.radiusScale[3], padding: `${spacing[0]}px ${spacing[1]}px`, fontSize: font[0] }}>进行中</span><span className="neutral-tag" style={{ borderRadius: tokens.radiusScale[3], padding: `${spacing[0]}px ${spacing[1]}px`, fontSize: font[0] }}>设计系统</span></div></>}
    {variant === 2 && <><div className="avatar-row" style={{ gap: spacing[1] }}><span className="avatar" style={{ background: tokens.secondary, width: spacing[3], height: spacing[3], fontSize: font[0] }}>BM</span><div><strong style={{ fontSize: font[1] }}>BrandMirror</strong><small style={{ fontSize: font[0], marginTop: spacing[0] }}>刚刚更新视觉令牌</small></div><span className="more">•••</span></div><div className="mini-progress" style={{ marginTop: spacing[1] }}><span style={{ background: tokens.primary, width: `${55 + index * 2}%` }} /></div></>}
    {variant === 3 && <><div className="toggle-row" style={{ fontSize: font[0] }}><span>实时同步预览</span><span className="toggle" style={{ background: tokens.primary }}><i /></span></div><div className="metric-row" style={{ gap: spacing[0] }}><strong style={{ color: tokens.secondary, fontSize: font[4] }}>{index + 8}.{index}</strong><span style={{ fontSize: font[0] }}>一致性分</span></div></>}
  </div></article>
}
