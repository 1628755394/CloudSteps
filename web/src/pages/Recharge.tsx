import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Crown, LockKeyhole, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard } from "../components/cloudsteps/arco";
import { showToast } from "../utils/toast";

type Plan = {
  id: string;
  tab: string;
  name: string;
  period: string;
  price: number;
  monthly: string;
  save?: string;
  tag?: string;
  features: string[];
};

const plans: Plan[] = [
  { id: "monthly", tab: "月付", name: "月度会员", period: "1个月", price: 58, monthly: "¥58 / 月", features: ["无限学习", "全部功能无限制", "开通推广返佣", "优先客服支持"] },
  { id: "quarterly", tab: "季付", name: "季度会员", period: "3个月", price: 98, monthly: "¥32.7 / 月", save: "省 ¥76", features: ["无限学习", "全部功能无限制", "开通推广返佣", "赠送 300 积分", "优先客服支持"] },
  { id: "yearly", tab: "年付", name: "年度会员", period: "12个月", price: 198, monthly: "¥16.5 / 月", save: "比月付省 72%", tag: "推荐", features: ["无限学习", "全部功能无限制", "开通推广返佣", "赠送 1200 积分", "优先客服支持"] },
  { id: "lifetime", tab: "永久会员", name: "永久会员", period: "永久有效", price: 498, monthly: "一次购买", save: "买断最划算", features: ["无限学习", "全部功能无限制", "开通推广返佣", "赠送 3000 积分", "优先客服支持", "后续内容持续更新"] },
];

const comparison = [
  ["价格", "免费", "¥58", "¥98", "¥198", "¥498"],
  ["有效期", "长期", "1个月", "3个月", "12个月", "永久"],
  ["学生数量", "1名", "无限", "无限", "无限", "无限"],
  ["核心功能", "部分可用", "全部功能", "全部功能", "全部功能", "全部功能"],
  ["开通积分", "—", "100", "300", "1200", "3000"],
  ["推广返佣", "—", "20%", "20%", "20%", "20%"],
];

const money = (value: number) => `¥${value.toFixed(0)}`;

export default function Recharge() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState("yearly");
  const [coupon, setCoupon] = useState("");
  const [couponChecked, setCouponChecked] = useState(false);
  const [method, setMethod] = useState("微信支付");
  const selected = useMemo(() => plans.find((plan) => plan.id === selectedId) ?? plans[2], [selectedId]);

  const checkCoupon = () => {
    if (coupon.length !== 6) {
      showToast.error("请输入 6 位优惠码");
      return;
    }
    setCouponChecked(true);
    showToast.success("优惠码可用，已享 9 折");
  };

  const submit = () => {
    const finalPrice = couponChecked ? selected.price * 0.9 : selected.price;
    showToast.success(`${selected.name}开通成功：${money(finalPrice)}（mock）`);
  };

  return (
    <div className="h-dvh overflow-hidden bg-background text-foreground">
      <header className="flex h-14 items-center justify-between bg-gradient-to-r from-primary to-secondary-brand px-4 text-primary-foreground shadow-sm">
        <button type="button" onClick={() => navigate("/coach-center")} className="flex size-9 items-center justify-center rounded-full hover:bg-white/15" aria-label="返回"><ArrowLeft size={22} /></button>
        <h1 className="text-lg font-semibold">会员中心</h1>
        <div className="flex size-9 items-center justify-center rounded-full bg-black/10"><span className="text-lg tracking-widest">•••</span></div>
      </header>

      <main className="h-[calc(100dvh-3.5rem)] overflow-y-auto px-3 pb-5 sm:px-5">
        <div className="mx-auto max-w-3xl space-y-4 pb-8">
          <CloudCard className="p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between"><div><h2 className="text-xl font-bold">选择会员套餐</h2><p className="mt-1 text-sm text-muted-foreground">按需选择，开通即享完整权益</p></div><span className="flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary"><LockKeyhole size={13} />安全支付</span></div>
            <div className="grid grid-cols-4 rounded-xl bg-muted p-1">{plans.map((plan) => <button key={plan.id} type="button" onClick={() => { setSelectedId(plan.id); setCouponChecked(false); }} className={`rounded-lg px-1 py-2.5 text-sm transition-all ${selected.id === plan.id ? "bg-card font-bold text-foreground shadow-sm" : "text-muted-foreground"}`}>{plan.tab}</button>)}</div>

            <div className="mt-4 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary-soft/40 to-card p-4 sm:p-5">
              <div className="flex items-start justify-between"><div><p className="text-lg font-bold">{selected.name}</p><p className="mt-1 text-sm text-muted-foreground">{selected.period}</p></div><div className="text-right">{selected.save ? <span className="rounded bg-primary-soft px-2 py-1 text-xs font-semibold text-primary">{selected.save}</span> : null}<p className="mt-2 text-4xl font-bold tracking-tight">{money(selected.price)}</p><p className="text-sm text-muted-foreground">{selected.monthly}</p></div></div>
              <div className="my-4 h-px bg-border" />
              <div className="grid gap-2 sm:grid-cols-2">{selected.features.map((feature) => <p key={feature} className="flex items-center gap-2 text-sm text-muted-foreground"><Check size={16} className="shrink-0 text-primary" />{feature}</p>)}</div>

              <div className="mt-5 rounded-xl border border-primary/20 bg-primary-soft/40 p-3"><div className="flex items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm"><span className="text-xs font-bold">券</span></div><div className="min-w-0 flex-1"><p className="font-semibold text-foreground">优惠码</p><p className="text-xs text-muted-foreground">使用有效优惠码，当前套餐可享 9 折</p></div><span className="rounded-full bg-secondary-brand px-2.5 py-1 text-xs font-bold text-white">首单 9 折</span></div><div className="mt-3 flex gap-2"><input value={coupon} maxLength={6} onChange={(event) => { setCoupon(event.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()); setCouponChecked(false); }} placeholder="输入 6 位优惠码" className="min-w-0 flex-1 rounded-lg border border-input bg-white px-3 py-2.5 text-sm outline-none focus:border-primary" /><button type="button" onClick={checkCoupon} className="rounded-lg px-4 text-sm font-medium text-muted-foreground hover:text-primary">验证</button></div><p className="mt-2 text-xs text-muted-foreground">仅限从未购买过会员的用户，续费和升级不参与</p></div>

              <CloudButton onClick={submit} className="mt-4 h-12 w-full bg-primary-soft text-base font-bold text-primary hover:bg-primary-soft">立即开通 {selected.name}</CloudButton><p className="mt-2 text-center text-xs text-muted-foreground">一次性购买，不会自动续费</p>
            </div>
          </CloudCard>

          <CloudCard className="overflow-hidden p-4 sm:p-5"><div className="mb-4 flex items-end justify-between"><div><h2 className="flex items-center gap-2 text-xl font-bold"><Sparkles size={19} className="text-primary" />会员权益对比</h2><p className="mt-1 text-sm text-muted-foreground">选择更适合你的方案</p></div><span className="text-xs text-muted-foreground">左右滑动查看全部</span></div><div className="overflow-x-auto"><table className="min-w-[680px] w-full border-collapse text-sm"><thead><tr>{comparison[0].map((item, index) => <th key={item} className={`border border-border bg-muted/40 px-3 py-3 text-left font-semibold ${index === 0 ? "w-24" : "text-center"}`}>{item}</th>)}</tr></thead><tbody>{comparison.slice(1).map((row) => <tr key={row[0]}>{row.map((item, index) => <td key={`${row[0]}-${item}`} className={`border border-border px-3 py-3 ${index === 0 ? "font-semibold text-foreground" : "text-center text-muted-foreground"}`}>{item}</td>)}</tr>)}</tbody></table></div></CloudCard>

          <CloudCard className="p-4"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Crown size={16} className="text-primary" />选择支付方式</div><div className="flex flex-wrap gap-2">{["微信支付", "支付宝", "银行卡"].map((item) => <button key={item} type="button" onClick={() => setMethod(item)} className={`rounded-lg border px-3 py-2 text-sm ${method === item ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}>{method === item ? "✓ " : ""}{item}</button>)}</div><p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">当前选择：{method}<ChevronRight size={13} /></p></CloudCard>
        </div>
      </main>
    </div>
  );
}
