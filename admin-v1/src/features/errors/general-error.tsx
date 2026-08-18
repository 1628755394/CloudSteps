import { useNavigate, useRouter } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type GeneralErrorProps = React.HTMLAttributes<HTMLDivElement> & {
  minimal?: boolean
}

export function GeneralError({
  className,
  minimal = false,
  error,
}: GeneralErrorProps & { error?: unknown }) {
  const navigate = useNavigate()
  const { history } = useRouter()
  const isChunkError =
    error instanceof TypeError &&
    /Failed to fetch dynamically imported module|Outdated Optimize Dep/i.test(
      error.message
    )

  return (
    <div className={cn('h-svh w-full', className)}>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        {!minimal && (
          <h1 className='text-[7rem] leading-tight font-bold'>
            {isChunkError ? 'Oops' : '500'}
          </h1>
        )}
        <span className='font-medium'>
          {isChunkError
            ? 'The app needs a refresh'
            : `Oops! Something went wrong ${`:')`}`}
        </span>
        <p className='text-center text-muted-foreground'>
          {isChunkError ? (
            <>
              A development file went stale. <br /> Reload the page to continue.
            </>
          ) : (
            <>
              We apologize for the inconvenience. <br /> Please try again later.
            </>
          )}
        </p>
        {!minimal && (
          <div className='mt-6 flex gap-4'>
            {isChunkError ? (
              <Button onClick={() => window.location.reload()}>Reload</Button>
            ) : (
              <>
                <Button variant='outline' onClick={() => history.go(-1)}>
                  Go Back
                </Button>
                <Button onClick={() => navigate({ to: '/' })}>
                  Back to Home
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
