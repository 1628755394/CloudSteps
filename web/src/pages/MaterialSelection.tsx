import { Button, Typography } from "@arco-design/web-react";
import { IconCheckCircle, IconLeft, IconRight } from "@arco-design/web-react/icon";
import { useNavigate } from "react-router";
import { kickoffVocabTestPrefetch } from "../utils/vocabTestCache";
import { kickoffWordBooksPrefetch } from "../utils/wordBooksCache";

const materials = [
  { id: 1, name: "词汇测试", enabled: true, path: "/vocabulary-test" },
  { id: 2, name: "单词练习", enabled: true, path: "/word-training" },
  { id: 3, name: "解析语法", enabled: true, path: "/grammar-analysis" },
  { id: 4, name: "阅读理解", enabled: true, path: "/reading-comprehension" },
  { id: 5, name: "完形填空", enabled: true, path: "/cloze-practice" },
  { id: 6, name: "情景口语", enabled: true, path: "/scenario-dialogues" },
] as const;

type Material = (typeof materials)[number];

export default function MaterialSelection() {
  const navigate = useNavigate();

  const handleMaterialClick = (material: Material) => {
    if (!material.enabled || !("path" in material) || !material.path) return;

    if (material.name === "词汇测试") {
      kickoffVocabTestPrefetch();
    }
    if (material.path === "/word-training") {
      kickoffWordBooksPrefetch();
    }
    navigate(material.path);
  };

  return (
    <div className="h-dvh overflow-hidden bg-gray-50 flex flex-col">
      <div className="bg-white shrink-0 shadow-sm">
        <div className="flex items-center h-12 px-3">
          <Button
            type="text"
            shape="circle"
            icon={<IconLeft style={{ fontSize: 18 }} />}
            onClick={() => navigate(-1)}
            className="relative z-10 -ml-1"
          />
          <Typography.Title
            heading={6}
            className="!mb-0 flex-1 text-center !text-[#2D3748] -ml-8 pointer-events-none"
          >
            资料选择
          </Typography.Title>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-4 pt-3 pb-16 flex flex-col">
        <Typography.Paragraph
          type="secondary"
          className="!text-center !mb-2.5 !text-xs shrink-0"
        >
          为你设计有针对性的资料，迅速提高水平
        </Typography.Paragraph>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-1.5">
          {materials.map((material) => (
            <button
              key={material.id}
              type="button"
              disabled={!material.enabled}
              onClick={() => handleMaterialClick(material)}
              className={`w-full shrink-0 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all flex items-center justify-between gap-2 ${
                material.enabled
                  ? "bg-white border-[#66BB6A] cursor-pointer hover:shadow-sm active:scale-[0.99]"
                  : "bg-gray-100 border-gray-200 cursor-not-allowed opacity-55"
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  material.enabled ? "text-[#2D3748]" : "text-[#A0AEC0]"
                }`}
              >
                {material.name}
              </span>
              {material.enabled && (
                <IconCheckCircle
                  className="shrink-0"
                  style={{ fontSize: 16, color: "#66BB6A" }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="fixed bottom-5 right-5">
        <Button
          type="primary"
          shape="circle"
          icon={<IconRight style={{ fontSize: 20 }} />}
          className="!w-12 !h-12 shadow-lg"
          onClick={() => navigate("/word-training")}
        />
      </div>
    </div>
  );
}
