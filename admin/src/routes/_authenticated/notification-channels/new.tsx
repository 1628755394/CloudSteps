import { createFileRoute } from '@tanstack/react-router'
import { ChannelEditPage } from '@/features/notification-channels/channel-edit'

export const Route = createFileRoute('/_authenticated/notification-channels/new')({
  component: () => <ChannelEditPage />,
})
