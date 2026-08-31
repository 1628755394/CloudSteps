import type { ReactNode } from "react";
import { PageBackHeader } from "./PageBackHeader";

type LegalDocumentLayoutProps = {
  title: string;
  subtitle?: string;
  fallbackTo?: string;
  hero?: ReactNode;
  children: ReactNode;
};

export function LegalSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-2 ${className ?? ""}`}>
      <h2 className="text-foreground font-semibold text-base">{title}</h2>
      <div className="space-y-2 text-muted-foreground">{children}</div>
    </section>
  );
}

export function LegalParagraphs({ paragraphs }: { paragraphs: string[] }) {
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={paragraph.slice(0, 32)} className={index > 0 ? undefined : "text-foreground"}>
          {paragraph}
        </p>
      ))}
    </>
  );
}

export function LegalBulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalDocumentLayout({
  title,
  subtitle,
  fallbackTo = "/settings",
  hero,
  children,
}: LegalDocumentLayoutProps) {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PageBackHeader
        title={title}
        subtitle={subtitle}
        fallbackTo={fallbackTo}
        maxWidthClass="max-w-2xl"
      />
      <div className="flex-1 w-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
          {hero}
          <div className="border border-border bg-card rounded-xl p-5 sm:p-6 space-y-5 text-sm leading-relaxed text-charcoal">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
