import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard, CloudSpin } from "../components/cloudsteps/arco";
import { EmptyState } from "../components/EmptyState";
import { PageBackHeader } from "../components/PageBackHeader";
import { showToast } from "../utils/toast";
import {
  createFeedback,
  getFeedback,
  listFeedback,
  replyFeedback,
  type FeedbackTicket,
} from "../api/feedback";

const POLL_MS = 4000;

const fieldClass =
  "w-full px-4 py-3 rounded-xl bg-card border border-input text-charcoal placeholder:text-muted-soft transition-colors outline-none hover:border-border focus:border-primary focus:ring-[3px] focus:ring-primary/25";

function formatTime(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function statusLabel(ticket: FeedbackTicket) {
  if (ticket.status === "closed") return "已关闭";
  if (ticket.lastReplierRole === "admin") return "已回复";
  return "待回应";
}

function statusClass(ticket: FeedbackTicket) {
  if (ticket.status === "closed") return "bg-muted text-muted-foreground";
  if (ticket.lastReplierRole === "admin") return "bg-primary-soft text-primary";
  return "bg-tint-sky text-secondary-brand";
}

export default function Feedback() {
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [active, setActive] = useState<FeedbackTicket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [composing, setComposing] = useState(false);
  const activeIdRef = useRef<number | null>(null);
  activeIdRef.current = activeId;

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const refresh = async (silent: boolean) => {
      if (inFlight) return;
      inFlight = true;
      if (!silent) setLoading(true);
      try {
        const ticketId = activeIdRef.current;
        if (ticketId) {
          const detail = await getFeedback(ticketId);
          if (!cancelled && activeIdRef.current === ticketId) setActive(detail.data);
        }
        const res = await listFeedback({ page: 1, pageSize: 50 });
        if (!cancelled) setTickets(res.data?.list ?? []);
      } catch (e: unknown) {
        if (!silent && !cancelled) {
          const msg = e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "加载失败";
          showToast.error(msg);
        }
      } finally {
        inFlight = false;
        if (!silent && !cancelled) setLoading(false);
      }
    };

    void refresh(false);
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void refresh(true);
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const openTicket = async (id: number) => {
    setActiveId(id);
    setDetailLoading(true);
    setReply("");
    try {
      const res = await getFeedback(id);
      setActive(res.data);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "加载工单失败";
      showToast.error(msg);
      setActiveId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitTicket = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await createFeedback({
        content: content.trim(),
        contact: contact.trim() || undefined,
      });
      showToast.success("已提交，我们会在工单里回复你");
      setContent("");
      setContact("");
      setComposing(false);
      setTickets((prev) => [res.data, ...prev.filter((t) => t.id !== res.data.id)]);
      await openTicket(res.data.id);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "提交失败";
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async () => {
    if (!active || replying) return;
    setReplying(true);
    try {
      const res = await replyFeedback(active.id, reply.trim());
      setActive(res.data);
      setReply("");
      setTickets((prev) =>
        prev.map((t) => (t.id === res.data.id ? { ...t, ...res.data, replies: undefined } : t)),
      );
      showToast.success("已回复");
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "回复失败";
      showToast.error(msg);
    } finally {
      setReplying(false);
    }
  };

  const thread = useMemo(() => {
    if (!active) return [];
    const opening = {
      id: 0,
      role: "user" as const,
      content: active.content,
      createdAt: active.createdAt,
    };
    return [opening, ...(active.replies ?? [])];
  }, [active]);

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PageBackHeader
        title="反馈给我们"
        subtitle="工单对话，回复会写在这里"
        fallbackTo="/coach-center"
        extra={
          activeId ? null : composing ? (
            <CloudButton variant="ghost" size="sm" onClick={() => setComposing(false)}>
              取消
            </CloudButton>
          ) : (
            <CloudButton size="sm" onClick={() => setComposing(true)}>
              <Plus size={14} />
              新建工单
            </CloudButton>
          )
        }
      />
      <div className="flex-1 w-full py-5 space-y-4">
        {activeId ? (
          <div className="space-y-4">
            <CloudButton variant="ghost" size="sm" onClick={() => { setActiveId(null); setActive(null); }}>
              返回工单列表
            </CloudButton>
            {detailLoading || !active ? (
              <CloudSpin tip="加载对话…" />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">工单 #{active.id}</h2>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusClass(active)}`}>
                    {statusLabel(active)}
                  </span>
                </div>
                <div className="space-y-3">
                  {thread.map((item) => {
                    const mine = item.role !== "admin";
                    return (
                      <div key={`${item.role}-${item.id}`} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                            mine ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"
                          }`}
                        >
                          <div className="text-[11px] opacity-80 mb-1">
                            {mine ? "我" : "解忧团队"} · {formatTime(item.createdAt)}
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{item.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {active.status === "closed" ? (
                  <p className="text-xs text-muted-foreground text-center py-2">工单已关闭</p>
                ) : (
                  <CloudCard className="p-3 space-y-2">
                    <textarea
                      className={`${fieldClass} min-h-[96px] resize-y`}
                      placeholder="继续补充，或回复我们的说明…"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      maxLength={2000}
                    />
                    <div className="flex justify-end">
                      <CloudButton loading={replying} disabled={!reply.trim()} onClick={() => void submitReply()}>
                        发送回复
                      </CloudButton>
                    </div>
                  </CloudCard>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {composing ? (
              <CloudCard className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
                    <MessageCircle size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">提交新工单</h2>
                    <p className="text-[11px] text-muted-foreground">我们会在同一条工单里回复你，并站内信提醒</p>
                  </div>
                </div>
                <textarea
                  className={`${fieldClass} min-h-[120px] resize-y`}
                  placeholder="描述你遇到的问题，或想对我们说的建议…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={2000}
                />
                <input
                  className={fieldClass}
                  placeholder="联系方式（选填，微信 / 邮箱）"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={128}
                />
                <div className="flex justify-end">
                  <CloudButton loading={submitting} disabled={content.trim().length < 4} onClick={() => void submitTicket()}>
                    提交工单
                  </CloudButton>
                </div>
              </CloudCard>
            ) : null}

            <div>
              <h2 className="text-xs font-semibold text-muted-foreground px-1 pb-2">我的工单</h2>
              {loading ? (
                <CloudSpin tip="加载工单…" />
              ) : tickets.length === 0 ? (
                <EmptyState icon="icon-zu" description="还没有工单" />
              ) : (
                <CloudCard className="p-1.5">
                  <div className="divide-y divide-border">
                    {tickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => void openTicket(ticket.id)}
                        className="w-full text-left px-3 py-3 rounded-lg hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {ticket.lastReplyPreview || ticket.content}
                          </span>
                          <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${statusClass(ticket)}`}>
                            {statusLabel(ticket)}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          #{ticket.id} · {formatTime(ticket.lastRepliedAt || ticket.createdAt)}
                          {ticket.replyCount > 0 ? ` · ${ticket.replyCount} 条回复` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                </CloudCard>
              )}
            </div>
          </>
        )}
        <CloudCard className="p-4 text-center space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">太久没有回复？</h2>
            <p className="text-[12px] text-muted-foreground mt-1">在这里可以添加您的专属商务</p>
          </div>
          <img
            src={`${import.meta.env.BASE_URL}wechat-biz-qr.png`}
            alt="微信商务二维码"
            className="w-44 h-44 mx-auto rounded-xl border border-border bg-white object-contain"
          />
          <p className="text-[11px] text-muted-soft">微信扫码添加</p>
        </CloudCard>
      </div>
    </div>
  );
}
