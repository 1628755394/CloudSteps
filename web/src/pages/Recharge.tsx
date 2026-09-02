import { useState } from "react";
import { Check, CreditCard, Crown, Sparkles } from "lucide-react";
import { PageBackHeader } from "../components/PageBackHeader";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard } from "../components/cloudsteps/arco";
import { showToast } from "../utils/toast";

type MembershipPlan = {
  id: string;
  name: string;
  period: string;
  price: number;
  description: string;
  features: string[];
  tag?: string;
};

const plans: MembershipPlan[] = [
  {
    id: "monthly",
    name: "包月会员",
    period: "1个月",
    price: 18,
    description: "灵活订阅，随时开始学习",
    features: ["全站学习内容", "智能复习计划", "学习数据统计"],
  },
  {
    id: "yearly",
    name: "包年会员",
    period: "12个月",
    price: 168,
    description: "全年畅学，平均每月仅 ¥14",
    features: ["全站学习内容", "智能复习计划", "学习数据统计", "专属会员标识"],
    tag: "最受欢迎",
  },
  {
    id: "lifetime",
    name: "永久会员",
    period: "永久有效",
    price: 498,
    description: "一次购买，终身享受会员权益",
    features: ["全站学习内容", "智能复习计划", "学习数据统计", "专属会员标识", "后续内容持续更新"],
    tag: "超值推荐",
  },
];

const money = (value: number) => `¥${value.toFixed(0)}`;

export default function Recharge() {
  const [selectedId, setSelectedId] = useState("yearly");
  const [method, setMethod] = useState("微信支付");
  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[1];

  const submit = () => {
    showToast.success(`${selected.name}购买成功，支付方式：${method}`);
  };

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      <PageBackHeader title="会员中心" subtitle="选择适合你的会员方案" fallbackTo="/coach-center" />
      <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
        <div className="mx-auto max-w-3xl space-y-3 pb-6">
          <CloudCard tint="mint" className="relative overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-primary/15 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Crown size={22} /></div>
              <div><p className="text-xs text-muted-foreground">当前会员状态</p><p className="text-lg font-bold text-foreground">普通用户</p><p className="text-[11px] text-muted-foreground">开通会员，解锁全部学习权益</p></div>
            </div>
          </CloudCard>

          <CloudCard className="p-4">
            <div className="flex items-center gap-2"><Sparkles size={17} className="text-primary" /><h2 className="text-sm font-semibold">选择会员套餐</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">包月、包年、永久会员，按需选择。</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {plans.map((plan) => {
                const active = selected.id === plan.id;
                return <button key={plan.id} type="button" onClick={() => setSelectedId(plan.id)} className={`relative text-left rounded-2xl border-2 p-4 transition-all ${active ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/45"}`}>
                  {plan.tag ? <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{plan.tag}</span> : null}
                  <div className="flex items-start justify-between gap-2"><div><p className="text-base font-semibold">{plan.name}</p><p className="mt-1 text-xs text-muted-foreground">{plan.period}</p></div>{active ? <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check size={13} /></span> : null}</div>
                  <p className="mt-4 text-3xl font-bold">{money(plan.price)}</p><p className="mt-1 text-[11px] text-muted-foreground">{plan.description}</p>
                  <div className="mt-4 space-y-2 border-t border-border pt-3">{plan.features.map((feature) => <p key={feature} className="flex items-center gap-1.5 text-xs text-muted-foreground"><Check size={13} className="text-primary" />{feature}</p>)}</div>
                </button>;
              })}
            </div>
          </CloudCard>

          <CloudCard className="p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><CreditCard size={16} />支付方式</h2>
            <div className="mt-3 flex flex-wrap gap-2">{["微信支付", "支付宝", "银行卡"].map((item) => <button key={item} type="button" onClick={() => setMethod(item)} className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-sm ${method === item ? "border-primary bg-primary/5 text-primary" : "border-border"}`}>{method === item ? <Check size={14} /> : null}{item}</button>)}</div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4"><div><p className="text-xs text-muted-foreground">已选 {selected.name}</p><b className="text-xl">{money(selected.price)}</b></div><CloudButton onClick={submit}>立即开通</CloudButton></div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">演示页面，仅使用 mock 数据，不会真实扣款</p>
          </CloudCard>
        </div>
      </main>
    </div>
  );
}
