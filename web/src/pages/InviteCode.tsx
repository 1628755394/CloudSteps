import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, Gift, Share2, Ticket, Users } from "lucide-react";
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

const inviteUrl = (code: string) => {
  const url = new URL("login", window.location.origin + import.meta.env.BASE_URL);
  url.searchParams.set("register", "1");
  url.searchParams.set("inviteCode", code);
  return url.toString();
};

async function makePoster(code: string): Promise<Blob> {
  const size = 900;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法生成分享图片");

  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#e6f8f1");
  gradient.addColorStop(1, "#d9f0ff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  context.fillStyle = "#ffffff";
  context.roundRect(55, 55, size - 110, size - 110, 36);
  context.fill();
  context.fillStyle = "#25344a";
  context.textAlign = "center";
  context.font = "600 42px sans-serif";
  context.fillText("一起加入云阶学习", size / 2, 150);
  context.fillStyle = "#667085";
  context.font = "24px sans-serif";
  context.fillText("扫码即可使用我的邀请码", size / 2, 198);

  const qrDataUrl = await QRCode.toDataURL(inviteUrl(code), {
    width: 430,
    margin: 2,
    color: { dark: "#25344a", light: "#ffffff" },
  });
  const qrImage = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImage.onload = () => resolve();
    qrImage.onerror = () => reject(new Error("二维码生成失败"));
    qrImage.src = qrDataUrl;
  });
  context.drawImage(qrImage, 235, 245, 430, 430);
  context.fillStyle = "#25344a";
  context.font = "700 38px monospace";
  context.fillText(code, size / 2, 755);
  context.fillStyle = "#667085";
  context.font = "22px sans-serif";
  context.fillText("CloudSteps · 云阶", size / 2, 805);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("图片导出失败"))), "image/png");
  });
}

export default function InviteCode() {
  const [code, setCode] = useState("CLOUD-7K9F2A");
  const [sharing, setSharing] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const link = inviteUrl(code);

  useEffect(() => {
    if (!qrCanvasRef.current) return;
    void QRCode.toCanvas(qrCanvasRef.current, link, {
      width: 170,
      margin: 2,
      color: { dark: "#25344a", light: "#ffffff" },
    });
  }, [link]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast.success(`${label}已复制`);
    } catch {
      showToast.error("复制失败，请手动复制");
    }
  };

  const downloadQr = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        showToast.error("二维码保存失败");
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `云阶二维码-${code}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast.success("二维码已保存");
    }, "image/png");
  };

  const downloadPoster = async () => {
    setSharing(true);
    try {
      const blob = await makePoster(code);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `云阶邀请码-${code}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast.success("分享图片已生成");
    } catch {
      showToast.error("分享图片生成失败");
    } finally {
      setSharing(false);
    }
  };

  const sharePoster = async () => {
    setSharing(true);
    try {
      const blob = await makePoster(code);
      const file = new File([blob], `云阶邀请码-${code}.png`, { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: "云阶邀请码", text: "扫码加入云阶学习", files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        URL.revokeObjectURL(url);
        showToast.success("当前设备不支持直接分享，已下载图片");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) showToast.error("分享图片生成失败");
    } finally {
      setSharing(false);
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
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <CloudButton size="sm" onClick={() => void copy(code, "邀请码")}><Copy size={14} />复制邀请码</CloudButton>
              <CloudButton size="sm" variant="secondary" onClick={() => setCode(`CLOUD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)}>换一个</CloudButton>
            </div>
          </CloudCard>

          <CloudCard className="p-4">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <div className="rounded-xl border border-border bg-white p-2"><canvas ref={qrCanvasRef} aria-label="邀请码二维码" /></div>
              <div className="min-w-0 flex-1 text-center sm:text-left"><p className="text-sm font-semibold">分享图片邀请好友</p><p className="mt-1 text-xs leading-5 text-muted-foreground">生成带二维码的分享海报，适合在链接被屏蔽的地方发送。</p><div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start"><CloudButton size="sm" onClick={() => void sharePoster()} disabled={sharing}><Share2 size={14} />{sharing ? "生成中…" : "分享图片"}</CloudButton><CloudButton size="sm" variant="ghost" onClick={downloadQr}><Download size={14} />保存二维码</CloudButton><CloudButton size="sm" variant="ghost" onClick={() => void downloadPoster()} disabled={sharing}><Download size={14} />保存分享图</CloudButton></div></div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-border pt-3"><span className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">{link}</span><CloudButton size="sm" variant="ghost" onClick={() => void copy(link, "邀请链接")}><Copy size={14} /></CloudButton></div>
          </CloudCard>

          <div className="grid grid-cols-2 gap-3">
            <CloudCard tint="sky" className="p-4"><Users size={18} className="text-secondary-brand" /><p className="mt-2 text-xs text-muted-foreground">累计邀请</p><p className="text-2xl font-bold">8</p></CloudCard>
            <CloudCard tint="cream" className="p-4"><Gift size={18} className="text-warning" /><p className="mt-2 text-xs text-muted-foreground">已激活</p><p className="text-2xl font-bold">5</p></CloudCard>
          </div>

          <CloudCard className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3"><Users size={16} /><h2 className="text-sm font-semibold">邀请记录</h2></div>
            <div className="divide-y divide-border">{mockRecords.map((record) => <div key={record.name} className="flex items-center justify-between px-4 py-3 text-sm"><span className="font-medium">{record.name}</span><span className="text-xs text-muted-foreground">{record.date}</span><span className={record.status === "已激活" ? "text-primary text-xs" : "text-muted-foreground text-xs"}>{record.status}</span></div>)}</div>
          </CloudCard>
        </div>
      </main>
    </div>
  );
}
