import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { IconFacebook, IconGithub } from '@/assets/brand-icons'
import { useAuthStore } from '@/stores/auth-store'
import { post } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { CaptchaChallenge, type CaptchaValue } from './captcha-challenge'

const formSchema = z.object({
  username: z.string().min(1, 'Please enter your username or email.'),
  password: z
    .string()
    .min(1, 'Please enter your password.')
    .min(6, 'Password must be at least 6 characters long.'),
})

const AUTH_REDIRECTS = ['/sign-in', '/sign-up', '/otp', '/forgot-password']

function postLoginPath(redirectTo?: string) {
  if (!redirectTo) return '/'
  let path = redirectTo
  try {
    if (/^https?:\/\//i.test(redirectTo)) {
      path = `${new URL(redirectTo).pathname}${new URL(redirectTo).search}`
    }
  } catch {
    return '/'
  }
  if (!path.startsWith('/')) return '/'
  if (AUTH_REDIRECTS.some((p) => path === p || path.startsWith(`${p}?`))) {
    return '/'
  }
  return path
}

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [captcha, setCaptcha] = useState<CaptchaValue | null>(null)
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    if (!captcha) {
      toast.error('Please complete the captcha.')
      return
    }
    setIsLoading(true)
    try {
      const res = await post<{
        token?: string
        requiresTwoFactor?: boolean
        user?: {
          id: number
          email?: string
          displayName?: string
          username?: string
          role?: string
          avatar?: string
        }
      }>('/auth/login/password', {
        username: data.username,
        password: data.password,
        captchaId: captcha.captchaId,
        captchaType: captcha.captchaType,
        captchaValue: captcha.captchaValue,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        remember: true,
      })

      if (res.data?.requiresTwoFactor) {
        toast.error('Two-factor is enabled. Finish it in the old admin first.')
        return
      }

      const token = res.data?.token
      const userData = res.data?.user
      if (!token) throw new Error('Sign in failed.')
      if (userData?.role && userData.role !== 'admin') {
        throw new Error('Admin access required.')
      }

      auth.setAccessToken(token)
      auth.setUser({
        id: userData?.id,
        accountNo: String(userData?.username ?? userData?.id ?? data.username),
        email: String(userData?.email ?? userData?.username ?? data.username),
        displayName: userData?.displayName,
        username: userData?.username,
        avatar: userData?.avatar,
        role: [userData?.role || 'admin'],
        exp: Date.now() + 24 * 60 * 60 * 1000,
      })

      toast.success(`Welcome back, ${userData?.displayName || data.username}!`)
      window.location.assign(postLoginPath(redirectTo))
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'msg' in e
          ? String((e as { msg: string }).msg)
          : e instanceof Error
            ? e.message
            : 'Sign in failed.'
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username or email</FormLabel>
              <FormControl>
                <Input placeholder='admin' autoComplete='username' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
              <Link
                to='/forgot-password'
                className='absolute inset-e-0 -top-0.5 text-sm font-medium text-muted-foreground hover:opacity-75'
              >
                Forgot password?
              </Link>
            </FormItem>
          )}
        />
        <CaptchaChallenge onChange={setCaptcha} />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          Sign in
        </Button>

        <div className='relative my-2'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t' />
          </div>
          <div className='relative flex justify-center text-xs uppercase'>
            <span className='bg-background px-2 text-muted-foreground'>
              Or continue with
            </span>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-2'>
          <Button variant='outline' type='button' disabled={isLoading}>
            <IconGithub className='h-4 w-4' /> GitHub
          </Button>
          <Button variant='outline' type='button' disabled={isLoading}>
            <IconFacebook className='h-4 w-4' /> Facebook
          </Button>
        </div>
      </form>
    </Form>
  )
}
