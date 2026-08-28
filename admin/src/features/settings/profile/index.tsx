import { ContentSection } from '../components/content-section'
import { ProfileForm } from './profile-form'

export function SettingsProfile() {
  return (
    <ContentSection
      title='个人资料'
      desc='编辑当前登录账号的头像与显示名。学员、教师、管理员都在同一张 users 表，用 role 区分。'
      wide
    >
      <ProfileForm />
    </ContentSection>
  )
}
