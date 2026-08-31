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
import { useTranslation } from "react-i18next";
import { formatApiMessage } from "../utils/apiMessage";

type ImportTab = "manual" | "excel";

export default function CreateCustomWordBook() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const excelRef = useRef<HTMLInputElement>(null);

  const importTabs: { key: ImportTab; label: string }[] = [
    { key: "manual", label: t("create_wordbook.tab_manual") },
    { key: "excel", label: t("create_wordbook.tab_excel") },
  ];

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
        showToast.success(t("create_wordbook.recognized", { count: res.data.total || res.data.list.length }));
        return;
      }
    } catch {
      // 补全失败仍展示本地结果
    }
    setWords(list);
    showToast.success(t("create_wordbook.recognized", { count: list.length }));
  };

  const runParseManual = async () => {
    if (!manualText.trim()) {
      showToast.info(t("create_wordbook.enter_words"));
      return;
    }
    const list = parseManualTextLocal(manualText);
    if (!list.length) {
      showToast.error(t("create_wordbook.no_valid_words"));
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
        showToast.error(t("create_wordbook.excel_invalid"));
        return;
      }
      await applyWithEnrich(list);
    } catch {
      showToast.error(t("create_wordbook.excel_parse_failed"));
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
      showToast.info(t("create_wordbook.enter_name"));
      return;
    }
    if (!words.length) {
      showToast.info(t("create_wordbook.import_first"));
      return;
    }
    setCreating(true);
    try {
      const res = await createCustomWordBook({ name: bookName, words });
      if (res.code !== 200) {
        showToast.error(formatApiMessage(res.msg, "common.operation_failed"));
        return;
      }
      invalidateWordBooksCache();
      showToast.success(t("create_wordbook.created"));
      const id = res.data?.id;
      if (id) navigate(`/word-books/${id}`, { replace: true });
      else navigate("/", { replace: true });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : formatApiMessage(undefined, "common.operation_failed");
      showToast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PageBackHeader title={t("create_wordbook.title")} fallbackTo="/" maxWidthClass="max-w-none" />

      <div className="flex-1 w-full py-4 space-y-4">
        <div className="border border-border bg-card p-4 space-y-4 rounded-xl">
          <div className="space-y-1.5">
            <label className="text-sm text-foreground font-medium">{t("create_wordbook.name_label")}</label>
            <CloudInput
              value={name}
              onChange={(v: string) => setName(v)}
              placeholder={t("create_wordbook.name_placeholder")}
              maxLength={64}
            />
          </div>

          <div className="space-y-5">
            <div className="flex items-stretch border-b border-border">
              {importTabs.map((tabItem) => {
                const active = tab === tabItem.key;
                return (
                  <button
                    key={tabItem.key}
                    type="button"
                    onClick={() => setTab(tabItem.key)}
                    className={cn(
                      "relative flex-1 pb-2.5 pt-0.5 text-sm transition-colors",
                      active
                        ? "text-primary font-semibold"
                        : "text-muted-foreground font-medium",
                    )}
                  >
                    {tabItem.label}
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
                  {t("create_wordbook.input_words")}
                </CloudButton>
                <p className="text-sm text-muted-foreground">{t("create_wordbook.manual_hint")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("create_wordbook.manual_hint2")}
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
                        .then(() => showToast.success(t("create_wordbook.template_downloaded")))
                        .catch(() => showToast.error(t("create_wordbook.download_failed")))
                    }
                  >
                    {t("create_wordbook.download_template")}
                  </CloudButton>
                  <CloudButton
                    type="button"
                    disabled={parsing}
                    onClick={() => excelRef.current?.click()}
                  >
                    {parsing ? t("create_wordbook.parsing") : t("create_wordbook.select_excel")}
                  </CloudButton>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("create_wordbook.excel_hint")}
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
              <span className="text-sm font-medium text-foreground">{t("create_wordbook.preview")}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{t("create_wordbook.words_count", { count: words.length })}</span>
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
                        placeholder={t("create_wordbook.meaning_ph")}
                      />
                      <CloudInput
                        value={w.phonetic || ""}
                        onChange={(v: string) => updateWord(i, { phonetic: v })}
                        placeholder={t("create_wordbook.phonetic_ph")}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={t("create_wordbook.delete_word")}
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
              ? t("create_wordbook.creating")
              : words.length
                ? t("create_wordbook.confirm_with_count", { count: words.length })
                : t("create_wordbook.confirm_create")}
          </CloudButton>
        </div>
      </div>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("create_wordbook.input_dialog_title")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder={t("create_wordbook.manual_placeholder")}
            className="min-h-48 text-sm resize-none"
          />
          <DialogFooter className="gap-2">
            <CloudButton type="button" variant="ghost" onClick={() => setManualOpen(false)}>
              {t("practice.cancel")}
            </CloudButton>
            <CloudButton
              type="button"
              disabled={parsing}
              onClick={() => void runParseManual()}
            >
              {parsing ? t("create_wordbook.enriching") : t("create_wordbook.parse")}
            </CloudButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
