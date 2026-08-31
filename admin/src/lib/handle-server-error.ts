import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { formatAdminApiMessage } from '@/lib/api-message'

export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(error)
  }

  let errMsg = 'Something went wrong!'

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = 'No content.'
  }

  if (error && typeof error === 'object' && 'msg' in error) {
    const msg = (error as { msg?: unknown }).msg
    if (typeof msg === 'string' && msg.length > 0) {
      errMsg = formatAdminApiMessage(msg)
    }
  }

  if (error instanceof AxiosError) {
    const payload = error.response?.data
    const apiReason = payload?.data?.reason
    const apiMsg = payload?.msg
    const title = payload?.title
    if (typeof apiReason === 'string' && apiReason.length > 0) {
      errMsg = apiReason
    } else if (typeof apiMsg === 'string' && apiMsg.length > 0) {
      errMsg = formatAdminApiMessage(apiMsg)
    } else if (typeof title === 'string' && title.length > 0) {
      errMsg = title
    }
  }

  toast.error(errMsg)
}
