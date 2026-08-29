import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Trash2 } from "lucide-react";
import { PageBackHeader } from "../components/PageBackHeader";
import { CloudButton } from "../components/cloudsteps";
import { CloudInput } from "../components/cloudsteps/arco";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  createCustomWordBook,
  enrichCustomWordBookWords,
  type CustomParsedWord,
} from "../api/wordbooks";
import {
  downloadExcelTemplateLocal,
  parseExcelFileLocal,
  parseManualTextLocal,
} from "../utils/customWordBookLocal";
import { invalidateWordBooksCache } from "../utils/wordBooksCache";
import { showToast } from "../utils/toast";
import { cn } from "../utils/cn";

type ImportTab = "manual" | "excel";

const IMPORT_TABS: { key: ImportTab; label: string }[] = [
  { key: "manual", label: "手动输入" },
  { key: "excel", label: "Excel 导入" },
];

export default function CreateCustomWordBook() {
  const navigate = useNavigate();
  const excelRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [tab, setTab] = useState<ImportTab>("manual");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [words, setWords] = useState<CustomParsedWord[]>([]);
  const [fileLabel, setFileLabel] = useState("");

  /** 本地解析后，用词库表补全缺失释义/音标 */
  const applyWithEnrich = async (list: CustomParsedWord[]) => {
    try {
      const res = await enrichCustomWordBookWords(list);
      if (res.code === 200 && Array.isArray(res.data?.list) && res.data.list.length) {
        setWords(res.data.list);
        showToast.success(`已识别 ${res.data.total || res.data.list.length} 个单词`);
        return;
      }
    } catch {
      // 补全失败仍展示本地结果
    }
    setWords(list);
    showToast.success(`已识别 ${list.length} 个单词`);
  };

  const runParseManual = async () => {
    if (!manualText.trim()) {
      showToast.info("请输入单词，每行一个");
      return;
    }
    const list = parseManualTextLocal(manualText);
    if (!list.length) {
      showToast.error("未识别到有效单词");
      return;
    }
    setParsing(true);
    try {
      await applyWithEnrich(list);
      setManualText("");
      setManualOpen(false);
    } finally {
      setParsing(false);
    }
  };

  const runParseExcel = async (file: File) => {
    setParsing(true);
    setFileLabel(file.name);
    try {
      const list = await parseExcelFileLocal(file);
      if (!list.length) {
        showToast.error("未识别到有效单词，请检查表格格式");
        return;
      }
      await applyWithEnrich(list);
    } catch {
      showToast.error("Excel 解析失败，请使用 .xlsx 模板");
    } finally {
      setParsing(false);
    }
  };

  const updateWord = (index: number, patch: Partial<CustomParsedWord>) => {
    setWords((prev) => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  };

  const removeWord = (index: number) => {
    setWords((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    const bookName = name.trim();
    if (!bookName) {
      showToast.info("请填写词书名称");
      return;
    }
    if (!words.length) {
      showToast.info("请先导入单词");
      return;
    }
    setCreating(true);
    try {
      const res = await createCustomWordBook({ name: bookName, words });
      if (res.code !== 200) {
        showToast.error(res.msg || "创建失败");
        return;
      }
      invalidateWordBooksCache();
      showToast.success("词书已创建");
      const id = res.data?.id;
      if (id) navigate(`/word-books/${id}`, { replace: true });
      else navigate("/", { replace: true });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : "创建失败";
      showToast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PageBackHeader title="上传词书" fallbackTo="/" maxWidthClass="max-w-none" />

      <div className="flex-1 w-full py-4 space-y-4">
        <div className="border border-border bg-card p-4 space-y-4 rounded-xl">
          <div className="space-y-1.5">
            <label className="text-sm text-foreground font-medium">词书名称</label>
            <CloudInput
              value={name}
              onChange={(v: string) => setName(v)}
              placeholder="例如：初中核心词汇"
              maxLength={64}
            />
          </div>

          <div className="space-y-5">
            <div className="flex items-stretch border-b border-border">
              {IMPORT_TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "relative flex-1 pb-2.5 pt-0.5 text-sm transition-colors",
                      active
                        ? "text-primary font-semibold"
                        : "text-muted-foreground font-medium",
                    )}
                  >
                    {t.label}
                    {active ? (
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-0.5 w-5 rounded-full bg-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {tab === "manual" ? (
              <div className="space-y-2 text-center">
                <CloudButton
                  type="button"
                  className="min-w-[8.5rem]"
                  onClick={() => setManualOpen(true)}
                  disabled={parsing}
                >
                  输入单词
                </CloudButton>
                <p className="text-sm text-muted-foreground">每行输入一个单词</p>
                <p className="text-xs text-muted-foreground">
                  解析后会按词库已有数据补全释义与音标，缺的可手动改
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <input
                  ref={excelRef}
                  type="file"
                  accept=".xlsx,.xlsm,.csv,.txt,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void runParseExcel(f);
                  }}
                />
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <CloudButton
                    type="button"
                    variant="outline"
                    onClick={() =>
                      void downloadExcelTemplateLocal()
                        .then(() => showToast.success("模板已下载"))
                        .catch(() => showToast.error("下载失败"))
                    }
                  >
                    下载模板
                  </CloudButton>
                  <CloudButton
                    type="button"
                    disabled={parsing}
                    onClick={() => excelRef.current?.click()}
                  >
                    {parsing ? "解析中…" : "选择 Excel"}
                  </CloudButton>
                </div>
                <p className="text-sm text-muted-foreground">
                  首列单词，可选第 2 列释义、第 3 列音标
                </p>
                {fileLabel ? (
                  <p className="text-xs text-muted-foreground truncate">{fileLabel}</p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {words.length > 0 ? (
          <div className="border border-border bg-card overflow-hidden rounded-xl">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">预览词表</span>
              <span className="text-xs text-muted-foreground tabular-nums">{words.length} 词</span>
            </div>
            <ul className="divide-y divide-border max-h-[46vh] overflow-y-auto">
              {words.map((w, i) => (
                <li key={`${w.word}-${i}`} className="px-3 py-2.5 flex items-start gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums w-5 shrink-0 pt-2.5 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <CloudInput
                      value={w.word}
                      onChange={(v: string) => updateWord(i, { word: v })}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <CloudInput
                        value={w.translation || w.translationShort || ""}
                        onChange={(v: string) =>
                          updateWord(i, { translation: v, translationShort: v })
                        }
                        placeholder="释义"
                      />
                      <CloudInput
                        value={w.phonetic || ""}
                        onChange={(v: string) => updateWord(i, { phonetic: v })}
                        placeholder="音标"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="删除"
                    className="shrink-0 p-2 text-muted-foreground hover:text-destructive"
                    onClick={() => removeWord(i)}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="pb-8">
          <CloudButton
            type="button"
            className="w-full min-h-11"
            disabled={creating || parsing || !words.length}
            onClick={() => void handleCreate()}
          >
            {creating
              ? "创建中…"
              : words.length
                ? `确认创建（${words.length} 词）`
                : "确认创建"}
          </CloudButton>
        </div>
      </div>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>输入单词</DialogTitle>
          </DialogHeader>
          <Textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder={"每行一个，例如：\napple\nbanana\ncourage 勇气"}
            className="min-h-48 text-sm resize-none"
          />
          <DialogFooter className="gap-2">
            <CloudButton type="button" variant="ghost" onClick={() => setManualOpen(false)}>
              取消
            </CloudButton>
            <CloudButton
              type="button"
              disabled={parsing}
              onClick={() => void runParseManual()}
            >
              {parsing ? "补全中…" : "解析"}
            </CloudButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
