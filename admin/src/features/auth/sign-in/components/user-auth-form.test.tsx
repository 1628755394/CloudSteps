import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { UserAuthForm } from './user-auth-form'

const FORM_MESSAGES = {
  usernameEmpty: 'Please enter your username or email.',
  passwordEmpty: 'Please enter your password.',
} as const

const navigate = vi.fn()
const locationAssign = vi.hoisted(() => vi.fn())
const setUserMock = vi.fn()
const setAccessTokenMock = vi.fn()
const postMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => ({
  post: (...args: unknown[]) => postMock(...args),
  get: vi.fn(),
}))

vi.mock('./captcha-challenge', () => ({
  CaptchaChallenge: ({
    onChange,
  }: {
    onChange: (value: {
      captchaId: string
      captchaType: string
      captchaValue: string
    }) => void
  }) => (
    <button
      type='button'
      onClick={() =>
        onChange({
          captchaId: 'cid',
          captchaType: 'image',
          captchaValue: 'abcd',
        })
      }
    >
      Complete captcha
    </button>
  ),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    auth: {
      setUser: setUserMock,
      setAccessToken: setAccessTokenMock,
    },
  }),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigate,
    Link: ({
      children,
      to,
      className,
      ...rest
    }: {
      children?: React.ReactNode
      to: string
      className?: string
    }) => (
      <a href={to} className={className} {...rest}>
        {children}
      </a>
    ),
  }
})

vi.mock('@/lib/utils', async (orig) => ({
  ...(await orig()),
  sleep: vi.fn(() => Promise.resolve()),
}))

describe('UserAuthForm', () => {
  describe('Rendering without redirectTo', () => {
    let screen: RenderResult
    let usernameInput: Locator
    let passwordInput: Locator
    let signInButton: Locator
    let forgotPasswordLink: Locator

    beforeEach(async () => {
      vi.clearAllMocks()
      locationAssign.mockReset()
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: { assign: locationAssign },
      })
      postMock.mockResolvedValue({
        code: 200,
        msg: 'ok',
        data: {
          token: 'mock-access-token',
          user: { id: 1, email: 'a@b.com', role: 'admin' },
        },
      })
      screen = await render(<UserAuthForm />)
      usernameInput = screen.getByRole('textbox', {
        name: /username or email/i,
      })
      passwordInput = screen.getByLabelText(/^Password$/i)
      signInButton = screen.getByRole('button', { name: /^Sign in$/i })
      forgotPasswordLink = screen.getByText(/^Forgot password\?$/i)
    })

    it('renders fields, submit button, and forgot password link', async () => {
      await expect.element(usernameInput).toBeInTheDocument()
      await expect.element(passwordInput).toBeInTheDocument()
      await expect.element(signInButton).toBeInTheDocument()
      await expect.element(forgotPasswordLink).toBeInTheDocument()
    })

    it('shows validation messages when submitting empty form', async () => {
      await userEvent.click(signInButton)

      await expect
        .element(screen.getByText(FORM_MESSAGES.usernameEmpty))
        .toBeInTheDocument()
      await expect
        .element(screen.getByText(FORM_MESSAGES.passwordEmpty))
        .toBeInTheDocument()
    })

    it('authenticates and navigates to default route on success', async () => {
      await userEvent.fill(usernameInput, 'admin')
      await userEvent.fill(passwordInput, '1234567')
      await userEvent.click(
        screen.getByRole('button', { name: 'Complete captcha' })
      )

      await userEvent.click(signInButton)

      await vi.waitFor(() => expect(setUserMock).toHaveBeenCalledOnce())
      expect(setUserMock).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'admin',
          accountNo: expect.any(String),
          role: expect.any(Array),
          exp: expect.any(Number),
        })
      )
      expect(setAccessTokenMock).toHaveBeenCalledOnce()
      expect(setAccessTokenMock).toHaveBeenCalledWith('mock-access-token')

      await vi.waitFor(() => expect(locationAssign).toHaveBeenCalledWith('/'))
    })
  })

  it('navigates to redirectTo when provided', async () => {
    vi.clearAllMocks()
    locationAssign.mockReset()
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { assign: locationAssign },
    })
    postMock.mockResolvedValue({
      code: 200,
      msg: 'ok',
      data: {
        token: 'mock-access-token',
        user: { id: 1, email: 'a@b.com', role: 'admin' },
      },
    })

    const { getByRole, getByLabelText } = await render(
      <UserAuthForm redirectTo='/settings' />
    )

    await userEvent.fill(
      getByRole('textbox', { name: /username or email/i }),
      'admin'
    )
    await userEvent.fill(getByLabelText('Password'), '1234567')
    await userEvent.click(getByRole('button', { name: 'Complete captcha' }))

    await userEvent.click(getByRole('button', { name: /Sign in/i }))

    await vi.waitFor(() => expect(setUserMock).toHaveBeenCalledOnce())
    expect(setAccessTokenMock).toHaveBeenCalledOnce()

    await vi.waitFor(() =>
      expect(locationAssign).toHaveBeenCalledWith('/settings')
    )
  })
})
