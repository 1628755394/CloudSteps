import { createFileRoute } from '@tanstack/react-router'
import { WechatMpArticlesPage } from '@/features/wechat-mp-articles'

export const Route = createFileRoute('/_authenticated/wechat-mp-articles/')({
  component: WechatMpArticlesPage,
})
