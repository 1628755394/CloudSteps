import { Badge } from '@/components/ui/badge'
import { parseCoverMeta } from './cover-meta'

export function CoverMetaBadges({
  description,
  className,
}: {
  description?: string
  className?: string
}) {
  const { meta, plainText } = parseCoverMeta(description)

  if (!meta) {
    if (plainText) {
      return (
        <p
          className={`line-clamp-2 text-sm text-muted-foreground ${className ?? ''}`}
        >
          {plainText}
        </p>
      )
    }
    return (
      <span className={`text-sm text-muted-foreground ${className ?? ''}`}>
        暂无标签
      </span>
    )
  }

  const items: {
    key: string
    label: string
    variant: 'default' | 'secondary' | 'outline'
  }[] = []
  if (meta.cat) items.push({ key: 'cat', label: meta.cat, variant: 'default' })
  if (meta.t1) items.push({ key: 't1', label: meta.t1, variant: 'secondary' })
  if (meta.t2) items.push({ key: 't2', label: meta.t2, variant: 'outline' })
  if (meta.tag) items.push({ key: 'tag', label: meta.tag, variant: 'outline' })

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ''}`}>
      {items.map((item) => (
        <Badge key={item.key} variant={item.variant} className='font-normal'>
          {item.label}
        </Badge>
      ))}
    </div>
  )
}
