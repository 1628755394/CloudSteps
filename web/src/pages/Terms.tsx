import { Link } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import {
  LegalBulletList,
  LegalDocumentLayout,
  LegalParagraphs,
  LegalSection,
} from "../components/LegalDocumentLayout";

export default function Terms() {
  const { t } = useTranslation();
  const intro = t("legal.terms.intro", { returnObjects: true }) as string[];
  const section1Items = t("legal.terms.section1.items", { returnObjects: true }) as string[];
  const section2Body = t("legal.terms.section2.body", { returnObjects: true }) as string[];
  const section3Items = t("legal.terms.section3.items", { returnObjects: true }) as string[];
  const section4Items = t("legal.terms.section4.items", { returnObjects: true }) as string[];

  return (
    <LegalDocumentLayout title={t("legal.terms.title")} subtitle={t("legal.terms.subtitle")}>
      <LegalParagraphs paragraphs={intro} />

      <LegalSection title={t("legal.terms.section1.title")}>
        <LegalBulletList items={section1Items} />
      </LegalSection>

      <LegalSection title={t("legal.terms.section2.title")}>
        <LegalParagraphs paragraphs={section2Body} />
      </LegalSection>

      <LegalSection title={t("legal.terms.section3.title")}>
        <p>{t("legal.terms.section3.intro")}</p>
        <LegalBulletList items={section3Items} />
        <p>{t("legal.terms.section3.footer")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.section4.title")}>
        <p>{t("legal.terms.section4.intro")}</p>
        <LegalBulletList items={section4Items} />
        <p>{t("legal.terms.section4.footer")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.section5.title")}>
        <p>{t("legal.terms.section5.body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.section6.title")}>
        <p>{t("legal.terms.section6.body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.section7.title")}>
        <p>{t("legal.terms.section7.body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.section8.title")}>
        <p>{t("legal.terms.section8.body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.section9.title")}>
        <p>{t("legal.terms.section9.body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.section10.title")}>
        <p>{t("legal.terms.section10.body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.terms.section11.title")}>
        <p>
          <Trans
            i18nKey="legal.terms.section11.body"
            components={[
              <Link to="/privacy" className="text-primary underline-offset-2 hover:underline" />,
            ]}
          />
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
