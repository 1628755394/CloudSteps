import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPendingAnnouncementPopup,
  markAnnouncementRead,
  type Announcement,
} from "../api/announcements";
import { useAuthStore } from "../stores/authStore";
import {
  shouldDeferSystemPopups,
  subscribeCoachOnboardingUi,
} from "../utils/coachOnboarding";
import { MarkdownView } from "./MarkdownView";
import { CloudButton } from "./cloudsteps";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

/**
 * 登录后拉取未读公告；若新手引导正在进行/待展示，则延后弹出，引导结束后再展示。
 * 点「我知道了」立即关闭，后台批量标记已读。
 */
export function AnnouncementPopupHost() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const user = useAuthStore((s) => s.user);
  const role = (user as { role?: string } | null)?.role;
  const userId = user?.id;

  const [items, setItems] = useState<Announcement[]>([]);
  const pendingRef = useRef<Announcement[] | null>(null);
  const loadedRef = useRef(false);

  const deferred = shouldDeferSystemPopups(role, userId);

  const flushPendingIfReady = useCallback(() => {
    if (shouldDeferSystemPopups(role, userId)) {
      setItems([]);
      return;
    }
    if (pendingRef.current?.length) {
      setItems(pendingRef.current);
      pendingRef.current = null;
    }
  }, [role, userId]);

  const load = useCallback(async () => {
    if (!hasHydrated || !isAuthenticated) {
      setItems([]);
      pendingRef.current = null;
      loadedRef.current = false;
      return;
    }
    try {
      const res = await getPendingAnnouncementPopup();
      const list =
        res.code === 200 && res.data
          ? (res.data.announcements?.filter((a) => a?.id) ??
            (res.data.announcement?.id ? [res.data.announcement] : []))
          : [];
      loadedRef.current = true;
      if (list.length === 0) {
        pendingRef.current = null;
        setItems([]);
        return;
      }
      if (shouldDeferSystemPopups(role, userId)) {
        pendingRef.current = list;
        setItems([]);
        return;
      }
      pendingRef.current = null;
      setItems(list);
    } catch {
      setItems([]);
      pendingRef.current = null;
    }
  }, [hasHydrated, isAuthenticated, role, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // 引导结束后放出暂存公告；若尚未拉取则补拉一次
  useEffect(() => {
    return subscribeCoachOnboardingUi(() => {
      if (shouldDeferSystemPopups(role, userId)) {
        setItems([]);
        return;
      }
      if (pendingRef.current?.length) {
        flushPendingIfReady();
        return;
      }
      if (!loadedRef.current) {
        void load();
      }
    });
  }, [role, userId, flushPendingIfReady, load]);

  useEffect(() => {
    // role/user 就绪后若不再 defer，尝试放出 pending
    flushPendingIfReady();
  }, [deferred, flushPendingIfReady]);

  const dismiss = () => {
    const ids = items.map((a) => a.id).filter(Boolean);
    setItems([]);
    pendingRef.current = null;
    for (const id of ids) {
      void markAnnouncementRead(id).catch(() => {
        // 忽略失败；下次仍可能再弹
      });
    }
  };

  const open = items.length > 0 && !deferred;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) dismiss();
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="text-base leading-snug pr-6">
            {items.length > 1 ? `系统公告（${items.length}）` : items[0]?.title || "系统公告"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-4 pb-2">
          {items.map((item, idx) => (
            <section
              key={item.id}
              className={
                items.length > 1
                  ? "rounded-xl border border-border bg-muted/30 p-3.5"
                  : undefined
              }
            >
              {items.length > 1 ? (
                <h3 className="text-sm font-semibold text-foreground mb-2 leading-snug">
                  {idx + 1}. {item.title || "公告"}
                </h3>
              ) : null}
              <div className="text-sm text-foreground leading-relaxed">
                {item.content ? (
                  <MarkdownView content={item.content} />
                ) : (
                  <p className="text-muted-foreground">暂无内容</p>
                )}
              </div>
            </section>
          ))}
        </div>
        <DialogFooter className="px-6 py-4 shrink-0 border-t border-border">
          <CloudButton type="button" onClick={dismiss} className="w-full sm:w-auto">
            我知道了
          </CloudButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
