import { useState } from "react";
import { Copy, Gift, Ticket, Users } from "lucide-react";
import { PageBackHeader } from "../components/PageBackHeader";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard } from "../components/cloudsteps/arco";
import { showToast } from "../utils/toast";

const mockRecords = [
  { name: "138****2041", date: "2026-08-30", status: "已激活" },
  { name: "159****7762", date: "2026-08-28", status: "已激活" },
  { name: "小马同学", date: "2026-08-25", status: "已注册" },
  { name: "186****1190", date: "2026-08-21", status: "已激活" },
];

export default function InviteCode() {
  const [code, setCode] = useState("CLOUD-7K9F2A");
  const link = `https://cloudsteps.example.com/i/${code.split("-")[1]}`;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast.success(`${label}已复制`);
    } catch {
      showToast.error("复制失败，请手动复制");
    }
  };

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      <PageBackHeader title="邀请码" subtitle="邀请好友一起学习云阶" fallbackTo="/coach-center" />
      <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
        <div className="mx-auto max-w-2xl space-y-3 pb-6">
          <CloudCard tint="mint" className="p-5 text-center">
            <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Ticket size={22} /></div>
            <p className="text-xs text-muted-foreground">我的专属邀请码</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-foreground">{code}</p>
            <div className="mt-4 flex justify-center gap-2">
              <CloudButton size="sm" onClick={() => void copy(code, "邀请码")}><Copy size={14} />复制邀请码</CloudButton>
              <CloudButton size="sm" variant="secondary" onClick={() => setCode(`CLOUD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)}>换一个</CloudButton>
            </div>
          </CloudCard>

          <CloudCard className="p-4">
            <p className="text-xs text-muted-foreground">邀请链接</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">{link}</span>
              <CloudButton size="sm" variant="ghost" onClick={() => void copy(link, "邀请链接")}><Copy size={14} /></CloudButton>
            </div>
          </CloudCard>

          <div className="grid grid-cols-2 gap-3">
            <CloudCard tint="sky" className="p-4"><Users size={18} className="text-secondary-brand" /><p className="mt-2 text-xs text-muted-foreground">累计邀请</p><p className="text-2xl font-bold">8</p></CloudCard>
            <CloudCard tint="cream" className="p-4"><Gift size={18} className="text-warning" /><p className="mt-2 text-xs text-muted-foreground">已激活</p><p className="text-2xl font-bold">5</p></CloudCard>
          </div>

          <CloudCard className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3"><Users size={16} /><h2 className="text-sm font-semibold">邀请记录</h2></div>
            <div className="divide-y divide-border">
              {mockRecords.map((record) => <div key={record.name} className="flex items-center justify-between px-4 py-3 text-sm"><span className="font-medium">{record.name}</span><span className="text-xs text-muted-foreground">{record.date}</span><span className={record.status === "已激活" ? "text-primary text-xs" : "text-muted-foreground text-xs"}>{record.status}</span></div>)}
            </div>
          </CloudCard>
        </div>
      </main>
    </div>
  );
}
