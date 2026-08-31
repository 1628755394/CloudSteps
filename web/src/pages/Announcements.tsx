import { useEffect, useState, useCallback } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { CloudCard, CloudEmpty, CloudSpin } from "../components/cloudsteps/arco";
import { listAnnouncements, markAnnouncementRead, type Announcement } from "../api/announcements";
import { MarkdownView } from "../components/MarkdownView";

const PAGE_SIZE = 20;

export default function Announcements() {
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
        setErr(res.msg || "加载失败");
        setItems([]);
        return;
      }
      setItems(Array.isArray(res.data.list) ? res.data.list : []);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "加载失败";
      setErr(msg);
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
    // 展开时标记已读
    if (isOpening && !item.read) {
      void markAnnouncementRead(item.id).catch(() => {});
    }
  };

  return (
    <div className="space-y-4 min-w-0 w-full">
      <div className="flex items-center gap-2">
        <Bell className="text-primary" size={18} />
        <h1 className="text-base font-semibold text-foreground">系统公告</h1>
      </div>

      {err && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {loading ? (
        <CloudCard className="p-10">
          <CloudSpin tip="加载中…" />
        </CloudCard>
      ) : items.length === 0 ? (
        <CloudCard className="p-8">
          <CloudEmpty description="暂无公告" />
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
                        {item.title || "公告"}
                      </h3>
                      <ChevronRight
                        size={16}
                        className={`text-muted-soft shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                      />
                    </div>
                    {item.publishedAt && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(item.publishedAt).toLocaleDateString("zh-CN")}
                      </p>
                    )}
                    {expanded && (
                      <div className="text-sm text-foreground leading-relaxed mt-2.5">
                        {item.content ? (
                          <MarkdownView content={item.content} />
                        ) : (
                          <p className="text-muted-foreground">暂无内容</p>
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
  );
}
