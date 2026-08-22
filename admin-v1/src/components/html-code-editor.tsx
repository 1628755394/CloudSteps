import { html } from '@codemirror/lang-html'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { cn } from '@/lib/utils'

type HtmlCodeEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
}

const editorTheme = EditorView.theme({
  '&': { fontSize: '13px' },
  '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  '.cm-scroller': { overflow: 'auto' },
})

export function HtmlCodeEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = '320px',
}: HtmlCodeEditorProps) {
  return (
    <div
      className={cn('overflow-hidden rounded-md border', className)}
      style={{ minHeight }}
    >
      <CodeMirror
        value={value}
        height={minHeight}
        placeholder={placeholder}
        extensions={[html(), editorTheme]}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
        }}
      />
    </div>
  )
}
