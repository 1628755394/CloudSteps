import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminPage } from '@/components/admin-page'
import { CoachingAppointmentsPanel } from './appointments-panel'
import { StudentQuotasPanel } from './student-quotas-panel'
import { TeacherPoolPanel } from './teacher-pool-panel'
import { TeacherUsagePanel } from './teacher-usage-panel'

export function CoachingPage() {
  return (
    <AdminPage title='一对一陪练' description='排课、学员学时与老师授课总池'>
      <Tabs defaultValue='appointments' className='w-full'>
        <TabsList className='mb-4 h-auto flex-wrap'>
          <TabsTrigger value='appointments'>排课记录</TabsTrigger>
          <TabsTrigger value='student-quotas'>学员学时</TabsTrigger>
          <TabsTrigger value='teacher-pool'>老师授课池</TabsTrigger>
          <TabsTrigger value='teacher-usage'>月度统计</TabsTrigger>
        </TabsList>
        <TabsContent value='appointments' className='mt-0'>
          <CoachingAppointmentsPanel />
        </TabsContent>
        <TabsContent value='student-quotas' className='mt-0'>
          <StudentQuotasPanel />
        </TabsContent>
        <TabsContent value='teacher-pool' className='mt-0'>
          <TeacherPoolPanel />
        </TabsContent>
        <TabsContent value='teacher-usage' className='mt-0'>
          <TeacherUsagePanel />
        </TabsContent>
      </Tabs>
    </AdminPage>
  )
}
