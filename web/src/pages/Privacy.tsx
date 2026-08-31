import { Link } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import {
  LegalBulletList,
  LegalDocumentLayout,
  LegalParagraphs,
  LegalSection,
} from "../components/LegalDocumentLayout";

type LabeledItem = { label: string; body: string };

export default function Privacy() {
  const { t } = useTranslation();
  const intro = t("legal.privacy.intro", { returnObjects: true }) as string[];
  const section1Items = t("legal.privacy.section1.items", { returnObjects: true }) as LabeledItem[];
  const section2Items = t("legal.privacy.section2.items", { returnObjects: true }) as string[];
  const section3Body = t("legal.privacy.section3.body", { returnObjects: true }) as string[];
  const section4Items = t("legal.privacy.section4.items", { returnObjects: true }) as string[];
  const section7Items = t("legal.privacy.section7.items", { returnObjects: true }) as string[];

  return (
    <LegalDocumentLayout title={t("legal.privacy.title")} subtitle={t("legal.privacy.subtitle")}>
      <LegalParagraphs paragraphs={intro} />

      <LegalSection title={t("legal.privacy.section1.title")}>
        <p>{t("legal.privacy.section1.intro")}</p>
        <ul className="list-disc pl-5 space-y-1">
          {section1Items.map((item) => (
            <li key={item.label}>
              <span className="text-foreground font-medium">{item.label}</span>
              {item.body}
            </li>
          ))}
        </ul>
        <p>{t("legal.privacy.section1.footer")}</p>
      </LegalSection>

      <LegalSection title={t("legal.privacy.section2.title")}>
        <LegalBulletList items={section2Items} />
      </LegalSection>

      <LegalSection title={t("legal.privacy.section3.title")}>
        <LegalParagraphs paragraphs={section3Body} />
      </LegalSection>

      <LegalSection title={t("legal.privacy.section4.title")}>
        <p>{t("legal.privacy.section4.intro")}</p>
        <LegalBulletList items={section4Items} />
      </LegalSection>

      <LegalSection title={t("legal.privacy.section5.title")}>
        <p>{t("legal.privacy.section5.body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.privacy.section6.title")}>
        <p>{t("legal.privacy.section6.body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.privacy.section7.title")}>
        <p>{t("legal.privacy.section7.intro")}</p>
        <LegalBulletList items={section7Items} />
        <p>{t("legal.privacy.section7.footer")}</p>
      </LegalSection>

      <LegalSection title={t("legal.privacy.section8.title")}>
        <p>{t("legal.privacy.section8.body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.privacy.section9.title")}>
        <p>
          <Trans
            i18nKey="legal.privacy.section9.body"
            components={[
              <Link to="/terms" className="text-primary underline-offset-2 hover:underline" />,
            ]}
          />
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
