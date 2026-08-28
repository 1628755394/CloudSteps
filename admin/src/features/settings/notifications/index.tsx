import { ContentSection } from '../components/content-section'
import { SettingsInboxList } from './inbox-list'

export function SettingsNotifications() {
  return (
    <ContentSection
      wide
      title='通知'
      desc='查看当前登录管理员的站内信通知，可标记已读或删除。'
    >
      <SettingsInboxList />
    </ContentSection>
  )
}
