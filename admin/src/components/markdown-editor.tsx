import MDEditor from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import { useTheme } from '@/context/theme-provider'
import { cn } from '@/lib/utils'

type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
}

function parseHeight(minHeight: string): number {
  const n = Number.parseInt(minHeight, 10)
  return Number.isFinite(n) && n > 0 ? n : 480
}

/** Markdown 语法编辑器（工具栏 + 分栏预览），非代码编辑器。 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = '支持 Markdown 语法',
  className,
  minHeight = '480px',
}: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme()
  const height = parseHeight(minHeight)

  return (
    <div
      className={cn('md-editor-wrap overflow-hidden rounded-md border', className)}
      data-color-mode={resolvedTheme}
    >
      <MDEditor
        value={value}
        onChange={(next) => onChange(next ?? '')}
        height={height}
        preview='live'
        visibleDragbar={false}
        textareaProps={{
          placeholder,
        }}
      />
    </div>
  )
}
