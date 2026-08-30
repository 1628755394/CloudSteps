import { ContentSection } from '../components/content-section'
import { AppearanceForm } from './appearance-form'

export function SettingsAppearance() {
  return (
    <ContentSection title='外观' desc='调整管理后台的主题与字体。'>
      <AppearanceForm />
    </ContentSection>
  )
}
