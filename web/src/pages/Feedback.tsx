import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, Plus } from "lucide-react";
import { CloudButton } from "../components/cloudsteps";
import { CloudCard, CloudSpin } from "../components/cloudsteps/arco";
import { EmptyState } from "../components/EmptyState";
import { PageBackHeader } from "../components/PageBackHeader";
import { showToast } from "../utils/toast";
import { formatApiMessage } from "../utils/apiMessage";
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

function formatTime(iso: string | undefined, locale: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale === "zh-CN" ? "zh-CN" : "en-US");
}

function statusLabel(ticket: FeedbackTicket, t: (key: string) => string) {
  if (ticket.status === "closed") return t("feedback.status.closed");
  if (ticket.lastReplierRole === "admin") return t("feedback.status.replied");
  return t("feedback.status.pending");
}

function statusClass(ticket: FeedbackTicket) {
  if (ticket.status === "closed") return "bg-muted text-muted-foreground";
  if (ticket.lastReplierRole === "admin") return "bg-primary-soft text-primary";
  return "bg-tint-sky text-secondary-brand";
}

export default function Feedback() {
  const { t, i18n } = useTranslation();
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
          const apiMsg =
            e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : undefined;
          showToast.error(formatApiMessage(apiMsg, "feedback.load_failed"));
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
      const apiMsg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : undefined;
      showToast.error(formatApiMessage(apiMsg, "feedback.load_ticket_failed"));
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
      showToast.success(t("feedback.submitted_success"));
      setContent("");
      setContact("");
      setComposing(false);
      setTickets((prev) => [res.data, ...prev.filter((ticket) => ticket.id !== res.data.id)]);
      await openTicket(res.data.id);
    } catch (e: unknown) {
      const apiMsg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : undefined;
      showToast.error(formatApiMessage(apiMsg, "feedback.submit_failed"));
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
        prev.map((ticket) => (ticket.id === res.data.id ? { ...ticket, ...res.data, replies: undefined } : ticket)),
      );
      showToast.success(t("feedback.reply_success"));
    } catch (e: unknown) {
      const apiMsg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : undefined;
      showToast.error(formatApiMessage(apiMsg, "feedback.reply_failed"));
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
        title={t("feedback.page_title")}
        subtitle={t("feedback.subtitle")}
        fallbackTo="/coach-center"
        extra={
          activeId ? null : composing ? (
            <CloudButton variant="ghost" size="sm" onClick={() => setComposing(false)}>
              {t("feedback.cancel")}
            </CloudButton>
          ) : (
            <CloudButton size="sm" onClick={() => setComposing(true)}>
              <Plus size={14} />
              {t("feedback.new_ticket")}
            </CloudButton>
          )
        }
      />
      <div className="flex-1 w-full py-5 space-y-4">
        {activeId ? (
          <div className="space-y-4">
            <CloudButton variant="ghost" size="sm" onClick={() => { setActiveId(null); setActive(null); }}>
              {t("feedback.back_to_list")}
            </CloudButton>
            {detailLoading || !active ? (
              <CloudSpin tip={t("feedback.loading_thread")} />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">{t("feedback.ticket_no", { id: active.id })}</h2>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusClass(active)}`}>
                    {statusLabel(active, t)}
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
                            {mine ? t("feedback.me") : t("feedback.team")} · {formatTime(item.createdAt, i18n.language)}
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{item.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {active.status === "closed" ? (
                  <p className="text-xs text-muted-foreground text-center py-2">{t("feedback.ticket_closed")}</p>
                ) : (
                  <CloudCard className="p-3 space-y-2">
                    <textarea
                      className={`${fieldClass} min-h-[96px] resize-y`}
                      placeholder={t("feedback.reply_placeholder")}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      maxLength={2000}
                    />
                    <div className="flex justify-end">
                      <CloudButton loading={replying} disabled={!reply.trim()} onClick={() => void submitReply()}>
                        {t("feedback.send_reply")}
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
                    <h2 className="text-sm font-semibold text-foreground">{t("feedback.new_ticket_title")}</h2>
                    <p className="text-[11px] text-muted-foreground">{t("feedback.new_ticket_hint")}</p>
                  </div>
                </div>
                <textarea
                  className={`${fieldClass} min-h-[120px] resize-y`}
                  placeholder={t("feedback.content_placeholder")}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={2000}
                />
                <input
                  className={fieldClass}
                  placeholder={t("feedback.contact_placeholder")}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={128}
                />
                <div className="flex justify-end">
                  <CloudButton loading={submitting} disabled={content.trim().length < 4} onClick={() => void submitTicket()}>
                    {t("feedback.submit_ticket")}
                  </CloudButton>
                </div>
              </CloudCard>
            ) : null}

            <div>
              <h2 className="text-xs font-semibold text-muted-foreground px-1 pb-2">{t("feedback.my_tickets")}</h2>
              {loading ? (
                <CloudSpin tip={t("feedback.loading_tickets")} />
              ) : tickets.length === 0 ? (
                <EmptyState icon="icon-zu" description={t("feedback.no_tickets")} />
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
                            {statusLabel(ticket, t)}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          #{ticket.id} · {formatTime(ticket.lastRepliedAt || ticket.createdAt, i18n.language)}
                          {ticket.replyCount > 0 ? t("feedback.reply_count", { count: ticket.replyCount }) : ""}
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
            <h2 className="text-sm font-semibold text-foreground">{t("feedback.no_reply_title")}</h2>
            <p className="text-[12px] text-muted-foreground mt-1">{t("feedback.add_business")}</p>
          </div>
          <img
            src={`${import.meta.env.BASE_URL}wechat-biz-qr.png`}
            alt={t("feedback.qr_alt")}
            className="w-44 h-44 mx-auto rounded-xl border border-border bg-white object-contain"
          />
          <p className="text-[11px] text-muted-soft">{t("feedback.scan_wechat")}</p>
        </CloudCard>
      </div>
    </div>
  );
}
