import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ApiNotification,
} from "../api/notifications";
import { CloudButton } from "../components/cloudsteps";
import { MarkdownView } from "../components/MarkdownView";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { stripMarkdown } from "../utils/stripMarkdown";
import { formatApiMessage } from "../utils/apiMessage";

type NotificationItem = {
  id: number;
  title: string;
  content: string;
  time: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
};

function toItem(n: ApiNotification, locale: string): NotificationItem {
  const date = new Date(n.createdAt);
  const time = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(locale === "zh-CN" ? "zh-CN" : "en-US");

  return {
    id: n.id,
    title: n.title,
    content: n.content,
    time,
    read: !!n.read,
    actionUrl: n.actionUrl,
    actionLabel: n.actionLabel,
  };
}

export default function Notifications() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page] = useState(1);
  const [size] = useState(50);
  const [totalUnread, setTotalUnread] = useState(0);
  const [detail, setDetail] = useState<NotificationItem | null>(null);

  const unreadCount = useMemo(() => totalUnread, [totalUnread]);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listNotifications({ page, size });
      const data = res.data;
      setTotalUnread(data.totalUnread ?? 0);
      setItems((data.list ?? []).map((n) => toItem(n, i18n.language)));
    } catch (e: unknown) {
      const apiMsg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : e instanceof Error
            ? e.message
            : undefined;
      setError(formatApiMessage(apiMsg, "notifications.load_failed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
      setTotalUnread(0);
      setDetail((d) => (d ? { ...d, read: true } : d));
      window.dispatchEvent(new CustomEvent("notifications:unread-changed"));
    } catch (e: unknown) {
      const apiMsg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : e instanceof Error
            ? e.message
            : undefined;
      setError(formatApiMessage(apiMsg, "notifications.mark_all_failed"));
    }
  };

  const markOneRead = async (id: number) => {
    if (!Number.isFinite(id) || id <= 0) return;
    const target = items.find((i) => i.id === id);
    if (target?.read) return;
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
      setTotalUnread((prev) => Math.max(0, prev - 1));
      setDetail((d) => (d?.id === id ? { ...d, read: true } : d));
      window.dispatchEvent(new CustomEvent("notifications:unread-changed"));
    } catch (e: unknown) {
      const apiMsg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : e instanceof Error
            ? e.message
            : undefined;
      setError(formatApiMessage(apiMsg, "notifications.mark_read_failed"));
    }
  };

  const openDetail = (item: NotificationItem) => {
    setDetail(item);
    if (!item.read) void markOneRead(item.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] md:text-[28px] font-semibold text-[#2D3748]">
            {t("notifications.title")}
          </h1>
          <p className="text-[#718096] mt-1 text-sm md:text-base">
            {unreadCount > 0
              ? t("notifications.unread_count", { count: unreadCount })
              : t("notifications.no_unread")}
          </p>
        </div>

        <CloudButton
          type="button"
          variant="outline"
          onClick={markAllRead}
          disabled={loading || items.length === 0 || unreadCount === 0}
        >
          {t("notifications.mark_all_read")}
        </CloudButton>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
        {loading ? (
          <div className="px-5 py-6 text-sm text-[#718096]">{t("notifications.loading")}</div>
        ) : error ? (
          <div className="px-5 py-6 text-sm text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-6 text-sm text-[#718096]">{t("notifications.empty")}</div>
        ) : (
          items.map((n) => (
            <CloudButton
              key={n.id}
              type="button"
              variant="ghost"
              className="w-full h-auto justify-start rounded-none px-5 py-4 border-b border-[#E2E8F0] last:border-b-0"
              onClick={() => openDetail(n)}
            >
              <div className="flex items-start justify-between gap-4 w-full text-left">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!n.read && (
                      <span className="inline-block w-2 h-2 rounded-full bg-[#4ECDC4]" />
                    )}
                    <div className="text-[#2D3748] font-medium truncate">
                      {n.title}
                    </div>
                  </div>
                  <div className="text-sm text-[#718096] mt-1 line-clamp-2">
                    {stripMarkdown(n.content)}
                  </div>
                </div>
                <div className="text-xs text-[#A0AEC0] whitespace-nowrap">
                  {n.time}
                </div>
              </div>
            </CloudButton>
          ))
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-left pr-6">{detail?.title}</DialogTitle>
            <DialogDescription className="text-left">
              {detail?.time}
              {detail && !detail.read ? ` · ${t("notifications.unread")}` : detail ? ` · ${t("notifications.read")}` : ""}
            </DialogDescription>
          </DialogHeader>
          <MarkdownView content={detail?.content ?? ""} />
          {detail?.actionUrl ? (
            <DialogFooter className="sm:justify-start">
              <a
                href={detail.actionUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-[#E2E8F0] text-sm font-medium text-[#2D3748] hover:border-[#4ECDC4] hover:text-[#4ECDC4] transition-colors"
              >
                <ExternalLink size={16} />
                {detail.actionLabel || t("notifications.view_details")}
              </a>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
