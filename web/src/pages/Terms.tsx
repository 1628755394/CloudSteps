import { Link } from "react-router";
import { PageBackHeader } from "../components/PageBackHeader";

export default function Terms() {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PageBackHeader title="用户协议" subtitle="生效日期：2026-08-29" fallbackTo="/settings" />
      <div className="flex-1 w-full py-5">
        <div className="border-y border-border bg-card p-5 space-y-5 text-charcoal leading-relaxed text-sm sm:border sm:rounded-xl">
          <p>
            欢迎使用解忧（CloudSteps，以下称「本产品」或「本服务」）。本协议由你与解忧平台运营方（以下称「我们」）共同缔结，具有合同效力。
            你注册、登录、浏览或以其他方式使用本服务，即视为已阅读、理解并同意接受本协议全部内容。
            如你不同意本协议任何条款，请立即停止注册或使用。
          </p>
          <p className="text-muted-foreground">
            本产品面向语言学习与教练陪练场景，提供词库学习、词汇测试、单词训练、复习计划、学习记录、学员管理、课程预约、情景口语等功能（具体以产品实际提供为准）。
          </p>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">1. 协议范围与定义</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>「用户」指注册、登录或使用本服务的自然人，含学习者与教练/陪练等角色。</li>
              <li>「账户」指你为使用本服务而创建的账号及关联的身份认证信息。</li>
              <li>「内容」指你在本服务中上传、生成、存储或传输的文字、音频、学习记录、备注等信息。</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">2. 账户与使用资格</h2>
            <p className="text-muted-foreground">
              你应具备完全民事行为能力；若你为未成年人，请在监护人陪同下阅读本协议，并在监护人同意后使用本服务。
              你应保证注册信息真实、准确、完整，并在变更时及时更新。一人原则上仅使用一个账户；禁止冒用他人身份注册或转让、出借账户。
            </p>
            <p className="text-muted-foreground">
              你应妥善保管账户、密码、验证码、登录令牌等认证信息。因保管不善、共享账户或授权他人使用导致的损失，由你自行承担，法律法规另有规定的除外。
              如发现账户被盗用或异常登录，请立即通过产品内反馈渠道通知我们。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">3. 服务内容与变更</h2>
            <p className="text-muted-foreground">我们向你提供与语言学习、训练管理相关的产品功能与技术服务，可能包括但不限于：</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>词书库浏览、单词识记与复习、抗遗忘计划、学习记录查询；</li>
              <li>词汇量/词汇测试、教练对学员的管理、课时额度与课程预约；</li>
              <li>语音合成（TTS）、情景口语对话及相关分析能力；</li>
              <li>消息通知、设置与账户管理、意见反馈等辅助功能。</li>
            </ul>
            <p className="text-muted-foreground">
              我们有权基于业务发展、合规要求或技术升级对服务进行新增、调整、中断或终止，并将以产品内提示、公告或其他合理方式告知。
              部分功能可能依赖网络、设备性能、第三方服务（如语音、存储、登录渠道）的可用性。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">4. 用户行为规范</h2>
            <p className="text-muted-foreground">你在使用服务过程中不得从事以下行为：</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>违反法律法规、监管政策或公序良俗的行为；</li>
              <li>侵害他人合法权益，包括但不限于名誉权、隐私权、肖像权、知识产权等；</li>
              <li>未经授权访问、干扰、破坏系统或数据（含恶意爬虫、注入、漏洞探测与利用等）；</li>
              <li>制作、发布、传播违法、欺诈、骚扰或不良信息；</li>
              <li>利用本服务从事作弊、刷量、倒卖学习数据或干扰其他用户正常使用；</li>
              <li>逆向工程、反编译或以其他方式试图获取本产品源代码（法律法规允许的除外）。</li>
            </ul>
            <p className="text-muted-foreground">
              如你违反本协议，我们有权视情节采取警告、限制功能、暂停或终止服务、删除违规内容等措施，并保留依法追究责任的权利。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">5. 学习内容与用户生成内容</h2>
            <p className="text-muted-foreground">
              词库、教材释义、语音等学习材料可能来自我们或第三方授权。你仅可在本服务约定范围内个人学习使用，不得擅自复制、传播、出售或以其他方式用于商业目的。
              你对自行上传或录入的内容（如自定义词书、备注、反馈）依法享有相应权利，并保证该等内容不侵犯第三方权益；你授予我们为提供与改进服务所必需的非独占、可分许可的使用权（含存储、展示、技术处理）。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">6. 教练与学员关系</h2>
            <p className="text-muted-foreground">
              若你以教练/陪练身份使用学员管理、排课、分配词库等功能，你应确保已获得学员或其监护人的合法授权，并对你向学员展示或处理的学习数据负责。
              我们仅为技术平台提供方，不对教练与学员之间的线下约定、教学质量或费用纠纷承担保证责任，法律法规另有规定的除外。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">7. 知识产权</h2>
            <p className="text-muted-foreground">
              本产品的界面设计、图形、标识、软件、文档、词库编排与相关技术成果的知识产权归我们或相关权利人所有。
              未经书面许可，你不得复制、修改、传播、出租、出售或以其他方式使用上述内容。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">8. 免责声明</h2>
            <p className="text-muted-foreground">
              我们将尽力保障服务稳定与可用，但不对服务的不中断、无错误、完全满足你的特定学习目标作出保证。
              学习效果因个人基础、练习时长与方法而异，本产品不构成任何考试通过或成绩提升的承诺。
              因不可抗力、基础电信故障、第三方服务异常、设备或系统兼容性问题等导致的服务中断或数据异常，我们在法律允许范围内依法免责或减轻责任。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">9. 协议变更与终止</h2>
            <p className="text-muted-foreground">
              我们可根据法律法规或业务需要更新本协议。更新后的协议自公布或产品内提示之日起生效。
              若你继续使用服务，视为接受更新后的协议；若不同意，应停止使用并可申请注销账户。
              你可随时停止使用本服务；我们亦可在你严重违约或依法需终止服务时中止或终止向你提供服务。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">10. 法律适用与争议解决</h2>
            <p className="text-muted-foreground">
              本协议的订立、效力、解释、履行与争议解决均适用中华人民共和国法律（不含冲突法规则）。
              因本协议产生的争议，双方应友好协商；协商不成的，任何一方可向我们住所地有管辖权的人民法院提起诉讼。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">11. 联系我们</h2>
            <p className="text-muted-foreground">
              如对本协议有疑问，可通过产品内「意见反馈」与我们联系。你也可查阅我们的{" "}
              <Link to="/privacy" className="text-primary underline-offset-2 hover:underline">
                《隐私政策》
              </Link>
              ，了解个人信息处理规则。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
