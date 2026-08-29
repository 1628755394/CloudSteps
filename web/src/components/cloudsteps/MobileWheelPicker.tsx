import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

type WheelColumnProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

const ITEM_H = 40;

function WheelColumn({ options, value, onChange }: WheelColumnProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const lockRef = useRef(false);
  const index = Math.max(0, options.indexOf(value));

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || lockRef.current) return;
    el.scrollTop = index * ITEM_H;
  }, [index, options]);

  const onScrollEnd = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const i = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.min(Math.max(0, i), options.length - 1);
    const next = options[clamped];
    el.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
    if (next && next !== value) onChange(next);
  }, [onChange, options, value]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let timer: number | undefined;
    const onScroll = () => {
      lockRef.current = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        lockRef.current = false;
        onScrollEnd();
      }, 80);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [onScrollEnd]);

  return (
    <div className="relative flex-1 h-[200px] overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[80px] z-10"
        style={{ background: "linear-gradient(to bottom, var(--card), transparent)" }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[80px] z-10"
        style={{ background: "linear-gradient(to top, var(--card), transparent)" }}
      />
      <div className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 h-10 border-y border-border z-[5]" />
      <div
        ref={scrollerRef}
        className="h-full overflow-y-auto snap-y snap-mandatory overscroll-contain"
        style={{
          scrollSnapType: "y mandatory",
          paddingTop: ITEM_H * 2,
          paddingBottom: ITEM_H * 2,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {options.map((opt) => (
          <div
            key={opt}
            className={`h-10 flex items-center justify-center snap-center text-base tabular-nums ${
              opt === value ? "text-foreground font-semibold" : "text-muted-soft"
            }`}
            style={{ height: ITEM_H }}
            onClick={() => onChange(opt)}
          >
            {opt}
          </div>
        ))}
      </div>
    </div>
  );
}

type SheetProps = {
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  children: ReactNode;
};

export function PickerSheet({ open, title, onCancel, onConfirm, children }: SheetProps) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="关闭" onClick={onCancel} />
      <div className="relative bg-card rounded-t-2xl shadow-xl animate-in slide-in-from-bottom duration-200 max-h-[85dvh] flex flex-col">
        <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
          <button type="button" className="text-sm text-muted-foreground px-1" onClick={onCancel}>
            取消
          </button>
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <button type="button" className="text-sm text-primary font-medium px-1" onClick={onConfirm}>
            确认
          </button>
        </div>
        <div className="px-2 py-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export type MobileTimeWheelProps = {
  value?: string;
  onChange?: (time: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  label?: string;
};

/** H5 滚轮时间选择（时:分），底部弹层 + 取消/确认 */
export function MobileTimeWheel({
  value,
  onChange,
  disabled,
  placeholder = "请选择时间",
  className,
  label,
}: MobileTimeWheelProps) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => pad2(i)), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => pad2(i)), []);
  const [open, setOpen] = useState(false);
  const normalized = value && value.length >= 5 ? value.slice(0, 5) : "";
  const [h, setH] = useState(normalized.slice(0, 2) || "09");
  const [m, setM] = useState(normalized.slice(3, 5) || "00");

  useEffect(() => {
    if (!open) return;
    setH(normalized.slice(0, 2) || "09");
    setM(normalized.slice(3, 5) || "00");
  }, [open, normalized]);

  return (
    <div className="w-full">
      {label && (
        <label className="text-sm text-charcoal font-medium mb-1.5 block">{label}</label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`w-full h-10 px-3 rounded-xl bg-card border border-input text-sm text-left outline-none transition-colors hover:border-border focus:border-primary focus:ring-[3px] focus:ring-primary/25 disabled:opacity-50 ${className ?? ""}`}
      >
        {normalized ? (
          <span className="text-charcoal tabular-nums">{normalized}</span>
        ) : (
          <span className="text-muted-soft">{placeholder}</span>
        )}
      </button>

      <PickerSheet
        open={open}
        title="选择时间"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          onChange?.(`${h}:${m}`);
          setOpen(false);
        }}
      >
        <div className="flex gap-2">
          <WheelColumn options={hours} value={h} onChange={setH} />
          <WheelColumn options={minutes} value={m} onChange={setM} />
        </div>
      </PickerSheet>
    </div>
  );
}

export type MobileDateWheelProps = {
  value?: string;
  onChange?: (date: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  label?: string;
  allowClear?: boolean;
  /** 覆盖按钮上展示的文案（仍按 value 回填滚轮） */
  displayValue?: string;
  sheetTitle?: string;
  /** 自定义触发器；不传则用默认日期按钮 */
  trigger?: ReactNode;
};

/** H5 滚轮日期选择（年/月/日） */
export function MobileDateWheel({
  value,
  onChange,
  disabled,
  placeholder = "请选择日期",
  className,
  label,
  displayValue,
  sheetTitle = "选择日期",
  trigger,
}: MobileDateWheelProps) {
  const yearNow = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 11 }, (_, i) => String(yearNow - 2 + i)),
    [yearNow]
  );
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => pad2(i + 1)), []);

  const [open, setOpen] = useState(false);
  const now = new Date();
  const parts = (value || "").split("-");
  const [y, setY] = useState(parts[0] || String(now.getFullYear()));
  const [mo, setMo] = useState(parts[1] || pad2(now.getMonth() + 1));
  const [d, setD] = useState(parts[2] || pad2(now.getDate()));

  const daysInMonth = useMemo(() => {
    const dim = new Date(Number(y), Number(mo), 0).getDate();
    return Array.from({ length: dim }, (_, i) => pad2(i + 1));
  }, [y, mo]);

  useEffect(() => {
    if (!daysInMonth.includes(d)) setD(daysInMonth[daysInMonth.length - 1] || "01");
  }, [daysInMonth, d]);

  useEffect(() => {
    if (!open) return;
    const p = (value || "").split("-");
    setY(p[0] || String(now.getFullYear()));
    setMo(p[1] || pad2(now.getMonth() + 1));
    setD(p[2] || pad2(now.getDate()));
  }, [open, value]);

  const display = displayValue || value || "";

  return (
    <div className="w-full">
      {label && (
        <label className="text-sm text-charcoal font-medium mb-1.5 block">{label}</label>
      )}
      {trigger ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="w-full text-left rounded-none outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-primary/30 disabled:opacity-50"
        >
          {trigger}
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={`w-full h-10 px-3 rounded-xl bg-card border border-input text-sm text-left outline-none transition-colors hover:border-border focus:border-primary focus:ring-[3px] focus:ring-primary/25 disabled:opacity-50 ${className ?? ""}`}
        >
          {display ? (
            <span className="text-charcoal tabular-nums">
              {displayValue ? display : display.replace(/-/g, "/")}
            </span>
          ) : (
            <span className="text-muted-soft">{placeholder}</span>
          )}
        </button>
      )}

      <PickerSheet
        open={open}
        title={sheetTitle}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          onChange?.(`${y}-${mo}-${d}`);
          setOpen(false);
        }}
      >
        <div className="flex gap-1">
          <WheelColumn options={years} value={y} onChange={setY} />
          <WheelColumn options={months} value={mo} onChange={setMo} />
          <WheelColumn options={daysInMonth} value={d} onChange={setD} />
        </div>
      </PickerSheet>
    </div>
  );
}

export type MobileSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type MobileSelectSheetProps = {
  label?: string;
  title?: string;
  value?: string;
  options: MobileSelectOption[];
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  showSearch?: boolean;
  /** 作用在外层容器（宽度等），按钮始终撑满容器 */
  className?: string;
  style?: CSSProperties;
  size?: "small" | "default";
  /** 自定义触发器；不传则用默认下拉按钮 */
  trigger?: ReactNode;
};

/** H5 底部弹层单选（取消/确认），支持搜索 */
export function MobileSelectSheet({
  label,
  title = "请选择",
  value,
  options,
  onChange,
  placeholder = "请选择",
  disabled,
  showSearch,
  className,
  style,
  size = "default",
  trigger,
}: MobileSelectSheetProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(value || "");
    setQ("");
  }, [open, value]);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(keyword) ||
        o.value.toLowerCase().includes(keyword)
    );
  }, [options, q]);

  const selectedLabel = options.find((o) => o.value === value)?.label;
  const compact = size === "small";

  return (
    <div className={className || "w-full"} style={style}>
      {label && (
        <label className="text-sm text-charcoal font-medium mb-1.5 block">{label}</label>
      )}
      {trigger ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="w-full text-left rounded-none outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-primary/30 disabled:opacity-50"
        >
          {trigger}
        </button>
      ) : (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`w-full px-2.5 bg-card border border-input text-sm text-left outline-none transition-colors hover:border-border focus:border-primary focus:ring-[3px] focus:ring-primary/25 disabled:opacity-50 flex items-center justify-between gap-2 ${
          compact ? "h-8 rounded-lg" : "h-10 px-3 rounded-xl"
        }`}
      >
        <span className={`truncate ${selectedLabel ? "text-charcoal" : "text-muted-soft"}`}>
          {selectedLabel || placeholder}
        </span>
        <span className="text-muted-soft shrink-0 text-xs">▼</span>
      </button>
      )}

      <PickerSheet
        open={open}
        title={title}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          if (draft) onChange?.(draft);
          setOpen(false);
        }}
      >
        {showSearch && (
          <div className="px-2 pt-2 pb-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索…"
              className="w-full h-9 px-3 rounded-lg bg-muted/60 border border-border text-sm outline-none focus:border-primary"
            />
          </div>
        )}
        <div className="max-h-[50dvh] overflow-y-auto overscroll-contain py-1">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-soft py-8">无匹配选项</p>
          ) : (
            filtered.map((o) => {
              const active = draft === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => setDraft(o.value)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors disabled:opacity-40 ${
                    active
                      ? "bg-primary-soft text-primary font-medium"
                      : "text-charcoal hover:bg-muted/60"
                  }`}
                >
                  {o.label}
                </button>
              );
            })
          )}
        </div>
      </PickerSheet>
    </div>
  );
}
