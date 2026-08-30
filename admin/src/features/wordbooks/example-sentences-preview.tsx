import { Badge } from '@/components/ui/badge'
import {
  parseExampleSentences,
  splitHighlightedText,
} from './example-sentences'

function HighlightedText({ text }: { text: string }) {
  return (
    <>
      {splitHighlightedText(text).map((part, i) =>
        part.highlight ? (
          <strong key={i} className='font-semibold text-foreground'>
            {part.text}
          </strong>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  )
}

export function ExampleSentencesPreview({ raw }: { raw: string }) {
  const items = parseExampleSentences(raw)

  if (items === null) {
    return (
      <pre className='max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs break-all whitespace-pre-wrap'>
        {raw}
      </pre>
    )
  }

  if (items.length === 0) {
    return <p className='text-sm text-muted-foreground'>暂无例句</p>
  }

  return (
    <div
      id='exampleSentences'
      className='max-h-80 space-y-3 overflow-y-auto pr-1'
    >
      {items.map((ex, i) => (
        <div
          key={`${ex.en}-${i}`}
          className='border-s-2 border-primary/30 ps-3'
        >
          <div className='flex flex-wrap items-center gap-1.5'>
            <span className='text-xs text-muted-foreground'>{i + 1}</span>
            {ex.pos ? (
              <Badge variant='secondary' className='font-normal'>
                {ex.pos}
              </Badge>
            ) : null}
            {ex.para ? (
              <Badge variant='outline' className='font-normal'>
                {ex.para}
              </Badge>
            ) : null}
          </div>
          {ex.en ? (
            <p className='mt-1 text-sm leading-relaxed'>
              <HighlightedText text={ex.en} />
            </p>
          ) : null}
          {ex.cn ? (
            <p className='mt-0.5 text-xs text-muted-foreground'>{ex.cn}</p>
          ) : null}
        </div>
      ))}
    </div>
  )
}
