import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { CloudCard, CloudEmpty, CloudSpin } from "../components/cloudsteps/arco";
import { PageBackHeader } from "../components/PageBackHeader";
import { listAnnouncements, markAnnouncementRead, type Announcement } from "../api/announcements";
import { MarkdownView } from "../components/MarkdownView";
import { formatApiMessage } from "../utils/apiMessage";

const PAGE_SIZE = 20;

export default function Announcements() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await listAnnouncements({ page: 1, pageSize: PAGE_SIZE });
      if (res.code !== 200) {
        setErr(formatApiMessage(res.msg, "announcements.load_failed"));
        setItems([]);
        return;
      }
      setItems(Array.isArray(res.data.list) ? res.data.list : []);
    } catch (e: unknown) {
      const apiMsg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : undefined;
      setErr(formatApiMessage(apiMsg, "announcements.load_failed"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleExpand = (item: Announcement) => {
    const isOpening = expandedId !== item.id;
    setExpandedId(isOpening ? item.id : null);
    if (isOpening && !item.read) {
      void markAnnouncementRead(item.id).catch(() => {});
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PageBackHeader title={t("announcements.title")} fallbackTo="/settings" maxWidthClass="max-w-2xl" />
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-4 space-y-4 min-w-0">
      {err && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {loading ? (
        <CloudCard className="p-10">
          <CloudSpin tip={t("announcements.loading")} />
        </CloudCard>
      ) : items.length === 0 ? (
        <CloudCard className="p-8">
          <CloudEmpty description={t("announcements.empty")} />
        </CloudCard>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const expanded = expandedId === item.id;
            return (
              <CloudCard
                key={item.id}
                interactive
                className="p-0 overflow-hidden cursor-pointer"
                onClick={() => toggleExpand(item)}
              >
                <div className="flex items-start gap-3 px-4 py-3.5">
                  {!item.read && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                        {item.title || t("announcements.default_title")}
                      </h3>
                      <ChevronRight
                        size={16}
                        className={`text-muted-soft shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                      />
                    </div>
                    {item.publishedAt && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(item.publishedAt).toLocaleDateString(
                          i18n.language === "zh-CN" ? "zh-CN" : "en-US"
                        )}
                      </p>
                    )}
                    {expanded && (
                      <div className="text-sm text-foreground leading-relaxed mt-2.5">
                        {item.content ? (
                          <MarkdownView content={item.content} />
                        ) : (
                          <p className="text-muted-foreground">{t("announcements.no_content")}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CloudCard>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
