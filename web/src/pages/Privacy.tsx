import { Link } from "react-router";
import { PageBackHeader } from "../components/PageBackHeader";

export default function Privacy() {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PageBackHeader title="隐私政策" subtitle="更新日期：2026-08-29" fallbackTo="/settings" />
      <div className="flex-1 w-full py-5">
        <div className="border-y border-border bg-card p-5 space-y-5 text-charcoal leading-relaxed text-sm sm:border sm:rounded-xl">
          <p>
            解忧（CloudSteps，以下称「我们」）深知个人信息对你的重要性。本隐私政策说明我们如何收集、使用、存储、共享与保护你的个人信息，以及你如何行使相关权利。
            请在使用本服务前仔细阅读。你使用本服务，即表示你已理解本政策所述处理规则。涉及敏感个人信息或单独同意事项的，我们将依法另行征得同意。
          </p>
          <p className="text-muted-foreground">
            本政策适用于解忧 Web、小程序及相关客户端。如某功能有单独隐私说明，该说明与本政策不一致时，以针对该功能的说明为准。
          </p>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">1. 我们收集的信息</h2>
            <p className="text-muted-foreground">为实现语言学习、教练陪练与账户安全等目的，我们可能收集如下信息：</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>
                <span className="text-foreground font-medium">账户信息：</span>
                邮箱、手机号（如你绑定）、昵称、头像、角色（学习者/教练等）、登录凭证。
              </li>
              <li>
                <span className="text-foreground font-medium">学习与训练数据：</span>
                词库选择、识记/复习进度、测试结果、训练会话记录、抗遗忘计划、情景口语对话与评分相关数据。
              </li>
              <li>
                <span className="text-foreground font-medium">教练业务数据：</span>
                学员档案（在你添加或关联学员时）、课时额度、课程预约与备注等（仅对具备相应权限的用户可见）。
              </li>
              <li>
                <span className="text-foreground font-medium">设备与日志信息：</span>
                设备型号、操作系统、浏览器类型、IP 地址、网络状态、操作日志、崩溃信息，用于安全风控、故障排查与体验优化。
              </li>
              <li>
                <span className="text-foreground font-medium">你主动提供的信息：</span>
                意见反馈内容、联系方式、自定义词书或备注等你主动提交的内容。
              </li>
              <li>
                <span className="text-foreground font-medium">本地存储：</span>
                为提升体验，我们可能在你的设备本地缓存词库目录、偏好设置、登录状态等必要信息。
              </li>
            </ul>
            <p className="text-muted-foreground">
              我们不会强制收集与服务无关的个人信息。你可拒绝提供非必要信息，但可能导致部分功能无法使用。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">2. 信息的使用目的</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>创建与维护账户，完成身份验证与登录安全；</li>
              <li>提供词库学习、测试、复习、排课、学员管理等核心功能；</li>
              <li>生成学习记录、进度统计，并向你或经授权的教练展示必要信息；</li>
              <li>进行语音合成、口语对话等与学习相关的技术处理；</li>
              <li>发送服务通知（如课程提醒、重要公告）；</li>
              <li>排查故障、保障安全、预防欺诈与滥用；</li>
              <li>在匿名化或聚合后用于改进产品体验与功能设计；</li>
              <li>履行法律法规规定的义务。</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">3. 存储地点、期限与保护</h2>
            <p className="text-muted-foreground">
              我们在中华人民共和国境内存储你的个人信息。如因业务需要向境外提供，将依法履行评估、告知与同意等义务。
              我们仅在实现本政策所述目的所必需的最短期限内保留信息；超出期限后将删除或匿名化处理，法律法规另有规定的除外。
            </p>
            <p className="text-muted-foreground">
              我们采取合理可行的安全措施，包括访问控制、传输与存储加密、权限分级、审计与安全监测等。
              互联网环境并非绝对安全，请你妥善保管账户信息；如发生安全事件，我们将依法及时告知并采取补救措施。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">4. 委托处理、共享、转让与公开披露</h2>
            <p className="text-muted-foreground">我们不会出售你的个人信息。仅在以下情形可能委托处理、共享、转让或公开披露：</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>获得你的明确同意或你主动选择共享（例如教练查看经授权的学员学习数据）；</li>
              <li>为完成登录、对象存储、语音合成、消息推送等，与必要的服务提供方在最小范围内共享，并要求其按约定目的处理、保密；</li>
              <li>根据法律法规、诉讼、仲裁或行政要求；</li>
              <li>为保护你、我们或其他主体的生命、财产等重大合法权益所必需；</li>
              <li>在合并、收购、资产转让等情形下，如涉及个人信息转移，我们将要求继受方继续受本政策约束，或重新征得你的同意。</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">5. 第三方服务与 SDK</h2>
            <p className="text-muted-foreground">
              本服务可能接入第三方提供的登录、存储、语音、统计分析等能力。第三方可能按其自身隐私政策收集、使用相关信息。
              我们建议你阅读该等第三方的隐私条款。我们仅会在实现功能所必需的范围内进行对接，并督促其保护你的信息安全。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">6. 未成年人保护</h2>
            <p className="text-muted-foreground">
              若你为未成年人，请在监护人指导下阅读本政策并使用本服务。我们仅在法律法规允许、监护人同意或为保护未成年人所必需的情况下处理未成年人个人信息。
              如监护人发现我们在未经同意的情况下收集了未成年人信息，请通过反馈渠道联系我们，我们将尽快核实并处理。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">7. 你的权利</h2>
            <p className="text-muted-foreground">在适用法律允许的范围内，你享有以下权利：</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>查阅、复制你的个人信息；</li>
              <li>更正或补充不准确、不完整的信息（可通过个人资料、设置等页面操作）；</li>
              <li>删除特定信息或注销账户（注销后我们将按法规停止提供服务并删除或匿名化相关信息，法律要求保留的除外）；</li>
              <li>在同意基础上撤回同意（不影响撤回前基于同意的处理活动）；</li>
              <li>获取我们说明个人信息处理规则的解释。</li>
            </ul>
            <p className="text-muted-foreground">
              你可通过产品内设置、个人中心或「意见反馈」提出上述请求。我们将在核实身份后，于合理期限内予以答复。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">8. 政策更新</h2>
            <p className="text-muted-foreground">
              我们可能适时修订本政策。重大变更将通过弹窗、站内信、公告或其他合理方式提示。
              更新后的政策自公布之日起生效；若你继续使用本服务，即视为知悉并接受更新后的政策。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">9. 联系我们</h2>
            <p className="text-muted-foreground">
              如对本政策或个人信息处理有任何疑问、投诉或建议，请通过产品内「意见反馈」与我们联系。
              使用本服务亦请一并阅读{" "}
              <Link to="/terms" className="text-primary underline-offset-2 hover:underline">
                《用户协议》
              </Link>
              。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
