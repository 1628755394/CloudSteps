import { useNavigate } from "react-router";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  LegalBulletList,
  LegalDocumentLayout,
  LegalParagraphs,
  LegalSection,
} from "../components/LegalDocumentLayout";
import { CloudButton } from "../components/cloudsteps";

export default function About() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const intro = t("legal.about.intro", { returnObjects: true }) as string[];
  const features = t("legal.about.features.items", { returnObjects: true }) as string[];

  return (
    <LegalDocumentLayout
      title={t("legal.about.title")}
      subtitle={t("legal.about.subtitle")}
      hero={
        <div className="flex flex-col items-center text-center px-2 pt-2 pb-1">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="CloudSteps"
            className="size-16 rounded-2xl shadow-sm border border-border bg-card object-cover"
          />
          <p className="mt-3 text-base font-semibold text-foreground">{t("legal.about.hero.name")}</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">{t("legal.about.hero.tagline")}</p>
        </div>
      }
    >
      <LegalParagraphs paragraphs={intro} />

      <LegalSection title={t("legal.about.features.title")}>
        <LegalBulletList items={features} />
      </LegalSection>

      <LegalSection title={t("legal.about.serviceScope.title")}>
        <p>{t("legal.about.serviceScope.body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.about.compliance.title")}>
        <p>{t("legal.about.compliance.body")}</p>
      </LegalSection>

      <div className="pt-1 flex flex-col sm:flex-row gap-2">
        <CloudButton
          type="button"
          variant="brand"
          className="w-full sm:flex-1"
          onClick={() => navigate("/feedback")}
        >
          <MessageCircle size={16} />
          {t("legal.about.contact")}
        </CloudButton>
        <CloudButton
          type="button"
          variant="outline"
          className="w-full sm:flex-1"
          onClick={() => navigate("/terms")}
        >
          {t("legal.links.terms")}
        </CloudButton>
      </div>
    </LegalDocumentLayout>
  );
}
