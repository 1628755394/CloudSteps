import { useState } from "react";
import { UserPlus } from "lucide-react";
import { CloudButton } from "./cloudsteps";
import { CloudCard, CloudInput } from "./cloudsteps/arco";
import {
  addTeacherCoachingStudent,
  searchCoachingStudents,
  type CoachingStudentSearchResult,
} from "../api/coaching";
import { showToast } from "../utils/toast";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
};

/** 搜索并添加陪练学员（配额） */
export function AddStudentPanel({ open, onClose, onAdded }: Props) {
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CoachingStudentSearchResult[]>([]);
  const [picked, setPicked] = useState<CoachingStudentSearchResult | null>(null);
  const [quotaMinutes, setQuotaMinutes] = useState("120");
  const [adding, setAdding] = useState(false);

  if (!open) return null;

  const onSearch = async () => {
    const q = searchQ.trim();
    if (!q) {
      showToast.warning("请输入搜索关键词");
      return;
    }
    setSearching(true);
    try {
      const res = await searchCoachingStudents(q);
      setSearchResults(Array.isArray(res.data) ? res.data : []);
      if (!res.data?.length) showToast.info("未找到用户");
    } catch {
      showToast.error("搜索失败");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const onAdd = async () => {
    if (!picked) {
      showToast.warning("请先选择学员");
      return;
    }
    const mins = Number(quotaMinutes);
    if (Number.isNaN(mins) || mins < 0) {
      showToast.warning("剩余分钟数无效");
      return;
    }
    setAdding(true);
    try {
      const res = await addTeacherCoachingStudent({
        studentId: picked.id,
        remainingMinutes: mins,
      });
      if (res.code !== 200) {
        showToast.error(res.msg || "添加失败");
        return;
      }
      showToast.success("已添加学员");
      setPicked(null);
      setSearchQ("");
      setSearchResults([]);
      onAdded?.();
      onClose();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "msg" in e ? String((e as { msg: string }).msg) : "添加失败";
      showToast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  return (
    <CloudCard className="p-4 space-y-3 border-primary/30">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <UserPlus size={16} className="text-primary" />
          添加学员
        </h3>
        <CloudButton type="button" variant="ghost" size="sm" onClick={onClose}>
          收起
        </CloudButton>
      </div>
      <div className="flex gap-2 items-center">
        <div className="flex-1 min-w-0">
          <CloudInput
            value={searchQ}
            onChange={setSearchQ}
            placeholder="搜索用户名、昵称或手机号"
            onPressEnter={() => void onSearch()}
          />
        </div>
        <CloudButton
          variant="brand"
          size="pill"
          loading={searching}
          onClick={() => void onSearch()}
          className="shrink-0 h-10 px-4"
        >
          搜索
        </CloudButton>
      </div>
      {searchResults.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {searchResults.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setPicked(u)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                picked?.id === u.id
                  ? "border-primary bg-primary-soft"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="text-sm font-medium text-foreground">
                {u.displayName || u.username}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {[u.username, u.phone, u.email].filter(Boolean).join(" · ")}
              </div>
            </button>
          ))}
        </div>
      )}
      {picked && (
        <>
          <CloudInput
            label="初始陪练额度（分钟）"
            value={quotaMinutes}
            onChange={setQuotaMinutes}
            inputMode="numeric"
          />
          <CloudButton
            variant="brand"
            size="pill"
            loading={adding}
            onClick={() => void onAdd()}
            className="w-full"
          >
            确认添加
          </CloudButton>
        </>
      )}
    </CloudCard>
  );
}
