import { useMemo, useState } from "react";
import { Check, CreditCard, Wallet } from "lucide-react";
import { PageBackHeader } from "../components/PageBackHeader";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard } from "../components/cloudsteps/arco";
import { showToast } from "../utils/toast";

const packages = [
  { amount: 6, bonus: 0 },
  { amount: 18, bonus: 1, tag: "入门" },
  { amount: 68, bonus: 8, tag: "热门" },
  { amount: 128, bonus: 18, tag: "超值" },
  { amount: 298, bonus: 48 },
  { amount: 648, bonus: 128, tag: "豪华" },
];

const money = (value: number) => `¥${value.toFixed(value % 1 ? 2 : 0)}`;

export default function Recharge() {
  const [selected, setSelected] = useState(2);
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState("微信支付");
  const current = useMemo(() => selected >= 0 ? packages[selected] : { amount: Number(custom) || 0, bonus: 0 }, [selected, custom]);

  const selectCustom = (value: string) => {
    setCustom(value.replace(/[^\d]/g, ""));
    if (value) setSelected(-1);
  };

  const recharge = () => {
    if (!current.amount) return;
    showToast.success(`充值成功：${money(current.amount)}${current.bonus ? `，赠送 ${money(current.bonus)}` : ""}`);
  };

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      <PageBackHeader title="账户充值" subtitle="充值余额，享受更多学习服务" fallbackTo="/coach-center" />
      <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
        <div className="mx-auto max-w-2xl space-y-3 pb-6">
          <CloudCard tint="mint" className="p-5"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Wallet size={22} /></div><div><p className="text-xs text-muted-foreground">当前余额</p><p className="text-3xl font-bold">¥36.50</p></div></div></CloudCard>
          <CloudCard className="p-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><Wallet size={16} />选择充值套餐</h2><p className="mt-1 text-xs text-muted-foreground">部分套餐含赠送金额，到账后可用于学习服务。</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{packages.map((item, index) => <button key={item.amount} type="button" onClick={() => { setSelected(index); setCustom(""); }} className={`relative rounded-xl border-2 p-3 text-center transition-colors ${selected === index ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>{item.tag ? <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{item.tag}</span> : null}<p className="text-xl font-bold">{money(item.amount)}</p><p className="mt-1 text-xs text-muted-foreground">{item.bonus ? `送 ${money(item.bonus)}` : "标准套餐"}</p></button>)}</div><div className="mt-4 flex items-center gap-2"><span className="whitespace-nowrap text-xs text-muted-foreground">自定义金额</span><input value={custom} onChange={(event) => selectCustom(event.target.value)} inputMode="numeric" placeholder="请输入整数金额" className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary" /></div></CloudCard>
          <CloudCard className="p-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><CreditCard size={16} />支付方式</h2><div className="mt-3 flex flex-wrap gap-2">{["微信支付", "支付宝", "银行卡"].map((item) => <button key={item} type="button" onClick={() => setMethod(item)} className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-sm ${method === item ? "border-primary bg-primary/5 text-primary" : "border-border"}`}>{method === item ? <Check size={14} /> : null}{item}</button>)}</div><div className="mt-4 flex items-center justify-between border-t border-border pt-4"><div><span className="text-xs text-muted-foreground">实付 </span><b className="text-xl">{money(current.amount)}</b>{current.bonus ? <span className="ml-2 text-xs text-muted-foreground">到账 {money(current.amount + current.bonus)}</span> : null}</div><CloudButton disabled={!current.amount} onClick={recharge}>确认充值</CloudButton></div><p className="mt-2 text-center text-[10px] text-muted-foreground">演示页面，仅使用 mock 数据，不会真实扣款</p></CloudCard>
        </div>
      </main>
    </div>
  );
}
