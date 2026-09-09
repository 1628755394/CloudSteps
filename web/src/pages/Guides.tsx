import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageBackHeader } from "../components/PageBackHeader";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "../components/ui/carousel";
import { GUIDE_SECTIONS, type GuideImage } from "../data/guides";
import { cn } from "../components/ui/utils";

function caption(t: (key: string, opts?: Record<string, unknown>) => string, img: GuideImage) {
  if (img.step != null) return t(img.labelKey, { n: img.step });
  return t(img.labelKey);
}

export default function Guides() {
  const { t } = useTranslation();
  const [sectionId, setSectionId] = useState(GUIDE_SECTIONS[0]?.id ?? "");
  const section = GUIDE_SECTIONS.find((s) => s.id === sectionId) ?? GUIDE_SECTIONS[0];
  const images = section?.images ?? [];

  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);
  const filmRef = useRef<HTMLDivElement>(null);

  const onSelect = useCallback((carousel: CarouselApi) => {
    if (!carousel) return;
    setIndex(carousel.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!api) return;
    onSelect(api);
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api, onSelect]);

  useEffect(() => {
    setIndex(0);
    api?.scrollTo(0, true);
  }, [sectionId, api]);

  // Keep active thumbnail visible in the filmstrip
  useEffect(() => {
    const root = filmRef.current;
    if (!root) return;
    const thumb = root.querySelector<HTMLElement>(`[data-thumb="${index}"]`);
    thumb?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index, sectionId]);

  const current = images[index];
  const total = images.length;
  const canPrev = index > 0;
  const canNext = index < total - 1;

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PageBackHeader
        title={t("guides.title")}
        fallbackTo="/"
        maxWidthClass="max-w-4xl"
        extra={
          <span className="text-xs font-medium text-muted-foreground tabular-nums tracking-wide pr-1.5">
            {total > 0 ? `${index + 1} / ${total}` : ""}
          </span>
        }
      />

      {/* Section switch — text tabs, no chunky card */}
      <div className="shrink-0 w-full max-w-4xl mx-auto px-4 pt-3">
        <div className="flex items-end gap-5 border-b border-border" role="tablist">
          {GUIDE_SECTIONS.map((s) => {
            const active = s.id === sectionId;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSectionId(s.id)}
                className={cn(
                  "relative pb-2.5 text-sm font-medium transition-colors",
                  "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30 rounded-sm",
                  active ? "text-foreground" : "text-muted-foreground hover:text-charcoal",
                )}
              >
                {t(s.titleKey)}
                <span
                  className={cn(
                    "absolute left-0 right-0 -bottom-px h-0.5 rounded-full transition-colors",
                    active ? "bg-primary" : "bg-transparent",
                  )}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage */}
      <div className="flex-1 w-full max-w-4xl mx-auto px-3 sm:px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] min-h-0 flex flex-col gap-3">
        <div className="relative flex-1 min-h-0 flex flex-col">
          <Carousel
            key={sectionId}
            setApi={setApi}
            opts={{ align: "center", loop: false, duration: 22 }}
            className="w-full flex-1 min-h-0"
          >
            <CarouselContent className="-ml-0 h-full">
              {images.map((img, i) => (
                <CarouselItem key={img.id} className="pl-0 basis-full h-full">
                  <div
                    className={cn(
                      "h-full min-h-[min(52dvh,420px)] sm:min-h-[min(58dvh,520px)]",
                      "rounded-xl overflow-hidden bg-surface-soft",
                      "ring-1 ring-border/80",
                      "flex items-center justify-center",
                    )}
                  >
                    <img
                      src={img.src}
                      alt={caption(t, img)}
                      draggable={false}
                      loading={i === 0 ? "eager" : "lazy"}
                      decoding="async"
                      className="block max-w-full max-h-[min(62dvh,640px)] w-auto h-auto object-contain select-none"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          {/* Floating side controls */}
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => api?.scrollPrev()}
            aria-label={t("guides.prev")}
            className={cn(
              "absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10",
              "size-10 sm:size-11 rounded-full",
              "bg-card/90 backdrop-blur-sm border border-border text-charcoal",
              "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
              "inline-flex items-center justify-center",
              "transition-[opacity,background-color,border-color] hover:border-primary/50 hover:text-primary",
              "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30",
              "disabled:opacity-0 disabled:pointer-events-none",
            )}
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => api?.scrollNext()}
            aria-label={t("guides.next")}
            className={cn(
              "absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10",
              "size-10 sm:size-11 rounded-full",
              "bg-card/90 backdrop-blur-sm border border-border text-charcoal",
              "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
              "inline-flex items-center justify-center",
              "transition-[opacity,background-color,border-color] hover:border-primary/50 hover:text-primary",
              "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30",
              "disabled:opacity-0 disabled:pointer-events-none",
            )}
          >
            <ChevronRight size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Caption + progress */}
        <div className="shrink-0 space-y-2.5 px-0.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-charcoal truncate">
              {current ? caption(t, current) : ""}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums shrink-0">
              {t("guides.counter", { current: index + 1, total })}
            </p>
          </div>
          <div className="h-1 rounded-full bg-border/80 overflow-hidden" aria-hidden>
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: total > 0 ? `${((index + 1) / total) * 100}%` : "0%" }}
            />
          </div>
        </div>

        {/* Filmstrip */}
        <div
          ref={filmRef}
          className={cn(
            "shrink-0 flex gap-2 overflow-x-auto overscroll-x-contain touch-pan-x pb-1 -mx-0.5 px-0.5",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
          style={{ WebkitOverflowScrolling: "touch" }}
          role="listbox"
          aria-label={t("guides.title")}
        >
          {images.map((img, i) => {
            const active = i === index;
            return (
              <button
                key={img.id}
                type="button"
                role="option"
                aria-selected={active}
                data-thumb={i}
                onClick={() => api?.scrollTo(i)}
                className={cn(
                  "relative shrink-0 w-[4.5rem] sm:w-20 aspect-[16/9] rounded-lg overflow-hidden",
                  "bg-surface-soft transition-[box-shadow,opacity,ring-color]",
                  "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30",
                  active
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100"
                    : "ring-1 ring-border/70 opacity-70 hover:opacity-100",
                )}
              >
                <img
                  src={img.src}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover object-top select-none"
                />
                <span
                  className={cn(
                    "absolute bottom-0.5 right-0.5 min-w-[1.1rem] h-[1.1rem] px-1",
                    "rounded text-[10px] leading-[1.1rem] font-semibold tabular-nums text-center",
                    active ? "bg-primary text-white" : "bg-card/90 text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
