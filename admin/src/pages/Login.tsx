import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, Lock as LockIcon, Shield, User } from 'lucide-react'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import Modal from '@/components/UI/Modal'
import Captcha from '@/components/Auth/Captcha'
import { useAuthStore } from '@/stores/authStore'
import { showAlert } from '@/utils/notification'
import { post } from '@/utils/request'
import { getApiBaseURL } from '@/config/apiConfig'
import faviconUrl from '/favicon.png'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const [showCaptchaModal, setShowCaptchaModal] = useState(false)
  const [captchaId, setCaptchaId] = useState('')
  const [captchaType, setCaptchaType] = useState('')
  const [captchaCode, setCaptchaCode] = useState<any>(null)

  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')

  const { login } = useAuthStore()
  const navigate = useNavigate()

  const performLogin = async (cId: string, cType: string, cData: any) => {
    setLoading(true)
    try {
      const loginData: any = {
        username,
        password,
        captchaId: cId,
        captchaType: cType,
        captchaValue: cData,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        remember: true,
      }

      if (requiresTwoFactor && twoFactorCode) {
        loginData.twoFactorCode = twoFactorCode
      }

      const response = await post(`${getApiBaseURL()}/auth/login/password`, loginData)

      if (response.code !== 200) {
        throw new Error(response.msg || '登录失败')
      }

      if (response.data?.requiresTwoFactor) {
        setRequiresTwoFactor(true)
        setLoading(false)
        return
      }

      const { token, user: userData } = response.data

      if (!token) throw new Error('登录失败：未获取到 token')

      if (userData?.role !== 'admin') {
        throw new Error('权限不足，仅管理员可登录后台')
      }

      await login(token, {
        id: userData.id,
        email: userData.email,
        displayName: userData.displayName || username,
        role: userData.role,
        avatar: userData.avatar,
        isStaff: userData.isStaff,
      })

      showAlert('登录成功', 'success', '欢迎回来')
      navigate('/wordbooks')
    } catch (error: any) {
      showAlert(error?.msg || error?.message || '登录失败，请检查用户名和密码', 'error', '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCaptchaVerify = (id: string, type: string, data: any) => {
    setCaptchaId(id)
    setCaptchaType(type)
    setCaptchaCode(data)
    setShowCaptchaModal(false)
    performLogin(id, type, data)
  }

  const handleCaptchaError = (error: string) => {
    showAlert(error, 'error', '验证码错误')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      showAlert('请输入用户名和密码', 'error', '登录失败')
      return
    }

    if (requiresTwoFactor && twoFactorCode && captchaId) {
      await performLogin(captchaId, captchaType, captchaCode)
      return
    }

    setShowCaptchaModal(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-xl p-8 bg-card border border-border shadow-rest">
        <div className="mb-8">
          <img
            src={faviconUrl}
            alt="云阶"
            className="w-12 h-12 rounded-xl object-contain mb-5"
          />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">云阶</h1>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            管理后台 · 登录以继续
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            label="用户名"
            placeholder="请输入用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            size="lg"
            required
            disabled={loading}
          />

          <Input
            type={showPassword ? 'text' : 'password'}
            label="密码"
            placeholder="请输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<LockIcon className="w-4 h-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            size="lg"
            required
            disabled={loading}
          />

          {requiresTwoFactor && (
            <div className="space-y-3 p-4 rounded-xl bg-accent border border-border">
              <div className="flex items-center gap-2 text-primary">
                <Shield className="w-5 h-5" />
                <p className="text-sm font-medium text-foreground">两步验证</p>
              </div>
              <Input
                type="text"
                label="验证码"
                placeholder="请输入6位验证码"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                leftIcon={<Shield className="w-4 h-4" />}
                size="lg"
                required
                disabled={loading}
                maxLength={6}
              />
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            leftIcon={<LogIn className="w-4 h-4" />}
            className="mt-2"
            animation="none"
          >
            {loading ? '登录中...' : requiresTwoFactor ? '验证并登录' : '登录'}
          </Button>
        </form>
      </div>

      <Modal
        isOpen={showCaptchaModal}
        onClose={() => setShowCaptchaModal(false)}
        title="安全验证"
        size="md"
        closeOnOverlayClick={false}
      >
        <Captcha onVerify={handleCaptchaVerify} onError={handleCaptchaError} />
      </Modal>
    </div>
  )
}

export default Login
