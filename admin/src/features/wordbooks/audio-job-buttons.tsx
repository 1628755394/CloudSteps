import { Loader2, VolumeX, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  type AudioJob,
  batchAudioButtonLabel,
  isBatchAudioActive,
  isPurgeAudioActive,
  purgeAudioButtonLabel,
} from './audio-jobs'

type AudioJobButtonsProps = {
  job?: AudioJob
  onBatch: () => void
  onPurge: () => void
  size?: 'sm' | 'default'
}

export function AudioJobButtons({
  job,
  onBatch,
  onPurge,
  size = 'sm',
}: AudioJobButtonsProps) {
  const batchActive = job?.kind === 'batch' && isBatchAudioActive(job.status)
  const purgeActive = job?.kind === 'purge' && isPurgeAudioActive(job.status)

  return (
    <>
      <Button
        size={size}
        variant={batchActive ? 'destructive' : 'outline'}
        disabled={purgeActive}
        onClick={onBatch}
      >
        {batchActive ? <Loader2 className='animate-spin' /> : <Wand2 />}
        {batchAudioButtonLabel(job)}
      </Button>
      <Button
        size={size}
        variant='outline'
        disabled={purgeActive || batchActive}
        onClick={onPurge}
      >
        {purgeActive ? <Loader2 className='animate-spin' /> : <VolumeX />}
        {purgeAudioButtonLabel(job)}
      </Button>
    </>
  )
}
