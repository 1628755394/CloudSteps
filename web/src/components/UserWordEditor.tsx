import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { CloudButton } from "./cloudsteps";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  deleteUserWord,
  getUserWord,
  saveUserWord,
  type UserWordFields,
  type UserWordView,
} from "../api/wordbooks";
import { formatTranslation } from "../utils/wordFormat";

type Props = {
  wordId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (view: UserWordView) => void;
};

type FormState = {
  word: string;
  phonetic: string;
  phoneticUs: string;
  phoneticUk: string;
  partOfSpeech: string;
  translation: string;
  notes: string;
};

const emptyForm: FormState = {
  word: "",
  phonetic: "",
  phoneticUs: "",
  phoneticUk: "",
  partOfSpeech: "",
  translation: "",
  notes: "",
};

function fieldsToForm(fields: UserWordFields, notes = ""): FormState {
  return {
    word: fields.word ?? "",
    phonetic: fields.phonetic ?? "",
    phoneticUs: fields.phoneticUs ?? "",
    phoneticUk: fields.phoneticUk ?? "",
    partOfSpeech: fields.partOfSpeech ?? "",
    translation: formatTranslation(fields.translation) || (fields.translation ?? ""),
    notes,
  };
}

export function UserWordEditor({ wordId, open, onOpenChange, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<UserWordView | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (!open || !wordId) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    setView(null);
    setForm(emptyForm);
    getUserWord(wordId)
      .then((res) => {
        if (!mounted) return;
        if (res.code !== 200 || !res.data) {
          setError(res.msg || "加载失败");
          return;
        }
        setView(res.data);
        setForm(fieldsToForm(res.data.effective, res.data.overlay?.notes ?? ""));
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        const msg =
          e && typeof e === "object" && "msg" in e
            ? String((e as { msg: string }).msg)
            : "加载失败";
        setError(msg);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open, wordId]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!wordId || !view) return;
    const payload: UserWordFields = {};
    const canon = view.canonical;
    const canonTrans = formatTranslation(canon.translation) || canon.translation || "";
    if (form.word !== (canon.word || "")) payload.word = form.word;
    if (form.phonetic !== (canon.phonetic || "")) payload.phonetic = form.phonetic;
    if (form.phoneticUs !== (canon.phoneticUs || "")) payload.phoneticUs = form.phoneticUs;
    if (form.phoneticUk !== (canon.phoneticUk || "")) payload.phoneticUk = form.phoneticUk;
    if (form.partOfSpeech !== (canon.partOfSpeech || "")) payload.partOfSpeech = form.partOfSpeech;
    if (form.translation !== canonTrans) payload.translation = form.translation;
    if (form.notes) payload.notes = form.notes;
    const hasDisplay = Boolean(
      payload.word ||
        payload.phonetic ||
        payload.phoneticUs ||
        payload.phoneticUk ||
        payload.partOfSpeech ||
        payload.translation
    );
    if (!hasDisplay) {
      setError("请至少修改一项单词内容");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await saveUserWord(wordId, payload);
      if (res.code !== 200 || !res.data) {
        setError(res.msg || "保存失败");
        return;
      }
      setView(res.data);
      onSaved?.(res.data);
      onOpenChange(false);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : "保存失败";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!wordId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await deleteUserWord(wordId);
      if (res.code !== 200 || !res.data) {
        setError(res.msg || "恢复失败");
        return;
      }
      onSaved?.(res.data);
      onOpenChange(false);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e
          ? String((e as { msg: string }).msg)
          : "恢复失败";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>修正这个单词</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-[#4ECDC4]" />
          </div>
        ) : (
          <div className="grid gap-3">
            {error ? <p className="text-sm text-[#FF6B6B]">{error}</p> : null}
            <Field label="单词" value={form.word} onChange={(v) => setField("word", v)} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="音标" value={form.phonetic} onChange={(v) => setField("phonetic", v)} />
              <Field label="美音" value={form.phoneticUs} onChange={(v) => setField("phoneticUs", v)} />
              <Field label="英音" value={form.phoneticUk} onChange={(v) => setField("phoneticUk", v)} />
            </div>
            <Field
              label="词性"
              value={form.partOfSpeech}
              onChange={(v) => setField("partOfSpeech", v)}
            />
            <Field
              label="中文释义"
              value={form.translation}
              onChange={(v) => setField("translation", v)}
              textarea
            />
            <Field
              label="备注（可选，告诉我们为什么改）"
              value={form.notes}
              onChange={(v) => setField("notes", v)}
              textarea
            />
            {view?.canonical.word && view.canonical.word !== form.word ? (
              <p className="text-xs text-[#718096]">词库原文：{view.canonical.word}</p>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          {view?.hasOverlay ? (
            <CloudButton
              type="button"
              variant="ghost"
              disabled={saving || loading}
              onClick={() => void handleRestore()}
            >
              恢复词库原文
            </CloudButton>
          ) : null}
          <CloudButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </CloudButton>
          <CloudButton type="button" disabled={saving || loading} onClick={() => void handleSave()}>
            {saving ? "保存中…" : "保存"}
          </CloudButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
}) {
  const cls =
    "w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#2D3748] focus:outline-none focus:border-[#4ECDC4]";
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-[#718096]">{label}</span>
      {textarea ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${cls} resize-y min-h-[4.5rem]`}
        />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
  );
}
