/** Demo / how-to guide images under `web/public/guides`. */
export type GuideImage = {
  id: string;
  src: string;
  /** i18n key for caption */
  labelKey: string;
  /** When labelKey is `guides.step_n`, pass as `t(key, { n: step })` */
  step?: number;
};

export type GuideSection = {
  id: string;
  titleKey: string;
  images: GuideImage[];
};

const base = `${import.meta.env.BASE_URL}guides`;

function stepImages(folder: string, count: number): GuideImage[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const pad = String(n).padStart(2, "0");
    return {
      id: `${folder}-step-${pad}`,
      src: `${base}/${folder}/step-${pad}.jpg`,
      labelKey: "guides.step_n",
      step: n,
    };
  });
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "word-training",
    titleKey: "guides.word_training.title",
    images: stepImages("word-training", 19),
  },
  {
    id: "student-management",
    titleKey: "guides.student_management.title",
    images: stepImages("student-management", 6),
  },
];
