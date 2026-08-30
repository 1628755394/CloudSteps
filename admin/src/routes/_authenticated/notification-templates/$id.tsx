import { createFileRoute } from '@tanstack/react-router'
import { TemplateEditPage } from '@/features/mail-templates/template-edit'

export const Route = createFileRoute(
  '/_authenticated/notification-templates/$id'
)({
  component: function NotificationTemplateEdit() {
    const { id } = Route.useParams()
    return <TemplateEditPage id={id} />
  },
})
