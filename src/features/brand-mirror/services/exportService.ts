import type { BrandTokens, BrandMirrorSnapshot } from '../models/brandMirrorModels'

export interface BrandGuidelinesExporter {
  export(snapshot: BrandMirrorSnapshot): void
}

function scaleList(tokens: BrandTokens, key: keyof Pick<BrandTokens, 'radiusScale' | 'spacingScale' | 'typeScale'>, prefix: string, indent = ''): string {
  return tokens[key].map((value, index) => `${indent}- \`${prefix}.${index + 1}\`: ${value}px`).join('\n')
}

function tokenSummary(tokens: BrandTokens): string {
  return [
    `  - 主色：\`${tokens.primary}\``,
    `  - 辅助色：\`${tokens.secondary}\``,
    `  - 圆角：${tokens.radiusScale.join(' / ')}px`,
    `  - 间距：${tokens.spacingScale.join(' / ')}px`,
    `  - 字号：${tokens.typeScale.join(' / ')}px`,
  ].join('\n')
}

export function buildBrandGuidelinesMarkdown(snapshot: BrandMirrorSnapshot): string {
  const { tokens } = snapshot
  const versions = snapshot.versions.length === 0
    ? '- 暂无保存版本'
    : snapshot.versions.map((version) => `- ${version.label} · ${version.createdAt.slice(0, 10)}\n${tokenSummary(version.tokens)}`).join('\n')
  return `# BrandMirror 品牌规范\n\n> 导出时间：${new Date().toISOString().slice(0, 10)}\n> 当前主题：${snapshot.theme}\n\n## 品牌色\n\n| 令牌 | 值 |\n| --- | --- |\n| 主色 \`primary\` | \`${tokens.primary}\` |\n| 辅助色 \`secondary\` | \`${tokens.secondary}\` |\n| 对比度 | ${snapshot.contrastRatio.toFixed(1)}:1 |\n\n## 圆角尺度\n\n${scaleList(tokens, 'radiusScale', 'radius')}\n\n## 间距体系\n\n${scaleList(tokens, 'spacingScale', 'spacing')}\n\n## 字号体系\n\n${scaleList(tokens, 'typeScale', 'type')}\n\n## 保存版本\n\n${versions}\n\n---\n由 BrandMirror 品牌视觉实验室生成。\n`
}

export class BrowserBrandGuidelinesExporter implements BrandGuidelinesExporter {
  export(snapshot: BrandMirrorSnapshot): void {
    const content = buildBrandGuidelinesMarkdown(snapshot)
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `BrandMirror-Brand-Guidelines-${new Date().toISOString().slice(0, 10)}.md`
    link.click()
    URL.revokeObjectURL(url)
  }
}
