import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { SignOutDialog } from './sign-out-dialog'

const navigate = vi.fn()
const reset = vi.fn()
const getMock = vi.hoisted(() => vi.fn())

const MOCK_PATH = '/dashboard'
const MOCK_SEARCH = '?tab=1'

vi.mock('@/lib/api', () => ({
  get: getMock,
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    auth: { reset },
  }),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigate,
    useLocation: () => ({
      pathname: MOCK_PATH,
      search: { tab: '1' },
      searchStr: MOCK_SEARCH,
      href: `${MOCK_PATH}${MOCK_SEARCH}`,
    }),
  }
})

describe('SignOutDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockResolvedValue({ code: 200 })
  })

  it('calls auth.reset and navigates to sign-in with current location as redirect', async () => {
    const { getByRole } = await render(
      <SignOutDialog open onOpenChange={vi.fn()} />
    )

    await userEvent.click(getByRole('button', { name: /^退出登录$/ }))

    await vi.waitFor(() => expect(reset).toHaveBeenCalledOnce())
    expect(getMock).toHaveBeenCalledWith('/auth/logout')
    expect(navigate).toHaveBeenCalledWith({
      to: '/sign-in',
      search: { redirect: `${MOCK_PATH}${MOCK_SEARCH}` },
      replace: true,
    })
  })

  it('does not call reset or navigate when Cancel is clicked', async () => {
    const { getByRole } = await render(
      <SignOutDialog open onOpenChange={vi.fn()} />
    )

    await userEvent.click(getByRole('button', { name: /^取消$/ }))

    expect(reset).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
