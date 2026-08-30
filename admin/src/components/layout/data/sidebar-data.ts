import {
  LayoutDashboard,
  Settings,
  UserCog,
  Palette,
  Library,
  Brain,
  FileText,
  CalendarDays,
  ScrollText,
  Mail,
  History,
  Bell,
  HardDrive,
  BarChart3,
  MessageSquare,
  MessagesSquare,
  SpellCheck,
  Megaphone,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: '',
    email: '',
    avatar: '',
  },
  teams: [],
  navGroups: [
    {
      title: '概览',
      items: [
        {
          title: '仪表盘',
          url: '/',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: '业务',
      items: [
        {
          title: '词库管理',
          url: '/wordbooks',
          icon: Library,
        },
        {
          title: '用户单词',
          url: '/user-words',
          icon: SpellCheck,
        },
        {
          title: '词汇测评题库',
          url: '/vocab-questions',
          icon: Brain,
        },
        {
          title: '测试记录',
          url: '/vocab-records',
          icon: FileText,
        },
        {
          title: '一对一陪练',
          url: '/coaching',
          icon: CalendarDays,
        },
        {
          title: '用户管理',
          url: '/users',
          icon: UserCog,
        },
        {
          title: '用户反馈',
          url: '/user-feedback',
          icon: MessagesSquare,
        },
      ],
    },
    {
      title: '系统',
      items: [
        {
          title: '对象存储',
          url: '/storage',
          icon: HardDrive,
        },
        {
          title: '存储与 CDN 监控',
          url: '/storage-stats',
          icon: BarChart3,
        },
        {
          title: '通知',
          icon: Bell,
          items: [
            {
              title: '通知渠道',
              url: '/notification-channels',
              icon: Mail,
            },
            {
              title: '通知模板',
              url: '/notification-templates',
              icon: FileText,
            },
            {
              title: '站内信',
              url: '/inbox-notifications',
              icon: MessageSquare,
            },
            {
              title: '系统公告',
              url: '/announcements',
              icon: Megaphone,
            },
            {
              title: '邮件日志',
              url: '/mail-logs',
              icon: ScrollText,
            },
          ],
        },
        {
          title: '设置',
          icon: Settings,
          items: [
            {
              title: '个人资料',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: '通知',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: '外观',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: '登录历史',
              url: '/settings/login-history',
              icon: History,
            },
            {
              title: '操作日志',
              url: '/settings/operation-logs',
              icon: ScrollText,
            },
          ],
        },
      ],
    },
  ],
}
