import { Lightbulb, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { CloudButton } from "../components/cloudsteps";
import { CloudSelect } from "../components/cloudsteps/arco";
import { FlowPageShell } from "../components/PageTransition";

import { listWordBooks } from "../api/wordbooks";
import { TopBar } from "../components/TopBar";
import { useAuthStore } from "../stores/authStore";
import {
  fetchLighthouse,
  getCachedLighthouse,
  prefetchLighthouses,
  revalidateLighthouse,
} from "../utils/lighthouseCache";

type LighthouseDay = { id: string; count: number; label: string };

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtYMD = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export default function WordTraining() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const displayName =
    (user as { displayName?: string; username?: string } | null)?.displayName ||
    (user as { username?: string } | null)?.username ||
    (user as { email?: string } | null)?.email ||
    "-";
  const [wordBooks, setWordBooks] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedWordBookId, setSelectedWordBookId] = useState<number>(0);
  const [memoryData, setMemoryData] = useState<LighthouseDay[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [masteredCount, setMasteredCount] = useState<number>(0);
  const [todayNewLearned, setTodayNewLearned] = useState<number>(0);

  const todayLabel = useMemo(() => fmtYMD(new Date()), []);

  const handleBack = () => {
    navigate("/lesson-prep");
  };

  const applyLighthouse = (data: {
    days?: LighthouseDay[];
    pendingCount?: number;
    masteredCount?: number;
    todayNewLearned?: number;
  }) => {
    setMemoryData(Array.isArray(data.days) ? data.days : []);
    setPendingCount(Number(data.pendingCount || 0));
    setMasteredCount(Number(data.masteredCount || 0));
    setTodayNewLearned(Number(data.todayNewLearned ?? 0));
  };

  const pickWordBook = (wb: { id: number; name: string }) => {
    const cached = getCachedLighthouse(wb.id);
    if (cached) applyLighthouse(cached);
    setSelectedWordBookId(wb.id);
    sessionStorage.setItem("lb_wordbook_id", String(wb.id));
    sessionStorage.setItem("lb_wordbook_name", wb.name);
    revalidateLighthouse(wb.id);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await listWordBooks({ pageSize: 1000 });
        const list = res.data?.list;
        const wbs = Array.isArray(list) ? (list as Array<{ id: number; name: string }>) : [];
        if (!mounted) return;
        setWordBooks(wbs);
        prefetchLighthouses(wbs.map((w) => w.id));

        const cachedName = sessionStorage.getItem("lb_wordbook_name") || "";
        const cachedId = Number(sessionStorage.getItem("lb_wordbook_id") || 0);
        const found = wbs.find((x) => x.id === cachedId) || wbs.find((x) => x.name === cachedName);
        const pick = found || wbs[0];
        if (pick) {
          setSelectedWordBookId(pick.id);
          sessionStorage.setItem("lb_wordbook_id", String(pick.id));
          sessionStorage.setItem("lb_wordbook_name", pick.name);
          const cached = getCachedLighthouse(pick.id);
          if (cached) applyLighthouse(cached);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!selectedWordBookId) return;

    const cached = getCachedLighthouse(selectedWordBookId);
    if (cached) applyLighthouse(cached);

    (async () => {
      try {
        const data = await fetchLighthouse(selectedWordBookId);
        if (!mounted) return;
        applyLighthouse(data);
      } catch {
        if (!mounted) return;
        if (!cached) {
          setMemoryData([]);
          setPendingCount(0);
          setMasteredCount(0);
          setTodayNewLearned(0);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedWordBookId]);

  const wordBookOptions = wordBooks.map((w) => ({
    label: w.name,
    value: String(w.id),
  }));

  return (
    <FlowPageShell className="min-h-dvh bg-gray-50 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <TopBar title="单词训练" onBack={handleBack} />

      <div className="px-4 mt-3 space-y-3 pb-4">
        <CloudSelect
          value={selectedWordBookId ? String(selectedWordBookId) : undefined}
          onChange={(v) => {
            const id = Number(v);
            const wb = wordBooks.find((x) => x.id === id);
            if (wb) pickWordBook(wb);
          }}
          options={wordBookOptions}
          placeholder={wordBooks.length ? "选择词库" : "加载词库中…"}
          disabled={!wordBooks.length}
          showSearch
          allowClear={false}
          sheetTitle="选择词库"
        />

        <div className="bg-white rounded-xl px-4 py-3 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#718096]">训练日期</span>
            <span className="text-[#2D3748] font-medium tabular-nums">{todayLabel}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#718096]">今日训新</span>
            <span className="text-[#2D3748] font-medium">{todayNewLearned} 词</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#718096]">用户信息</span>
            <span className="text-[#2D3748] font-medium truncate max-w-[60%] text-right">
              {displayName}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div
            onClick={() => navigate("/lighthouse-words?step=today")}
            className="bg-white rounded-xl p-3 text-center shadow-sm cursor-pointer hover:bg-gray-50 active:scale-95 transition-all"
          >
            <div className="text-xl font-bold text-[#4ECDC4] mb-0.5">{todayNewLearned}</div>
            <div className="text-xs text-[#718096]">今日训新</div>
          </div>
          <div
            onClick={() => navigate("/lighthouse-words?step=01")}
            className="bg-white rounded-xl p-3 text-center shadow-sm cursor-pointer hover:bg-gray-50 active:scale-95 transition-all"
          >
            <div className="text-xl font-bold text-[#FF9800] mb-0.5">{memoryData[0]?.count ?? 0}</div>
            <div className="text-xs text-[#718096]">今日复习目标</div>
          </div>
          <div
            onClick={() => navigate("/lighthouse-words?step=mastered")}
            className="bg-white rounded-xl p-3 text-center shadow-sm cursor-pointer hover:bg-gray-50 active:scale-95 transition-all"
          >
            <div className="text-xl font-bold text-[#66BB6A] mb-0.5">{masteredCount}</div>
            <div className="text-xs text-[#718096]">累计识词</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex flex-col items-center gap-1 mb-3">
            <div className="flex items-center justify-center gap-2">
              <Lightbulb className="text-[#FFD700]" size={22} />
              <h3 className="text-base font-semibold text-[#2D3748]">智能记忆灯塔</h3>
            </div>
            <p className="text-[11px] text-[#A0AEC0] text-center px-2">
              按艾宾浩斯复习阶段（第 1～7 步）统计当前词库词汇量
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2.5">
              {memoryData.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/lighthouse-words?step=${item.id}`)}
                  className="aspect-square bg-gradient-to-br from-[#4ECDC4] to-[#45b8b0] rounded-xl flex flex-col items-center justify-center text-white cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                >
                  <div className="text-xs opacity-80 mb-0.5">{item.id}</div>
                  <div className="text-xl font-bold">{item.count}</div>
                  <div className="text-[10px] sm:text-xs opacity-90 mt-0.5 text-center leading-tight px-0.5 line-clamp-3">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {memoryData.slice(3, 6).map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/lighthouse-words?step=${item.id}`)}
                  className="aspect-square bg-gradient-to-br from-[#66BB6A] to-[#5ca860] rounded-xl flex flex-col items-center justify-center text-white cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                >
                  <div className="text-xs opacity-80 mb-0.5">{item.id}</div>
                  <div className="text-xl font-bold">{item.count}</div>
                  <div className="text-[10px] sm:text-xs opacity-90 mt-0.5 text-center leading-tight px-0.5 line-clamp-3">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {memoryData.slice(6, 7).map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/lighthouse-words?step=${item.id}`)}
                  className="aspect-square bg-gradient-to-br from-[#FF9800] to-[#e68900] rounded-xl flex flex-col items-center justify-center text-white cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                >
                  <div className="text-xs opacity-80 mb-0.5">{item.id}</div>
                  <div className="text-xl font-bold">{item.count}</div>
                  <div className="text-[10px] sm:text-xs opacity-90 mt-0.5 text-center leading-tight px-0.5 line-clamp-3">
                    {item.label}
                  </div>
                </div>
              ))}
              <div
                onClick={() => navigate("/lighthouse-words?step=pending")}
                className="aspect-square bg-gray-100 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 active:scale-95 transition-all"
              >
                <div className="text-xl font-bold text-[#718096]">{pendingCount}</div>
                <div className="text-xs text-[#718096] mt-0.5">待学</div>
              </div>
              <div
                onClick={() => navigate("/lighthouse-words?step=mastered")}
                className="aspect-square bg-gradient-to-br from-[#FFD700] to-[#e6c200] rounded-xl flex flex-col items-center justify-center text-white cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              >
                <div className="text-xl font-bold">{masteredCount}</div>
                <div className="text-xs opacity-80 mt-0.5">掌握</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <CloudButton
            variant="brandOutline"
            size="pillLg"
            className="flex-1"
            onClick={() => navigate("/review-check")}
          >
            开始复习
          </CloudButton>
          <CloudButton
            variant="brand"
            size="pillLg"
            className="flex-1"
            onClick={() => navigate("/pre-training-check")}
          >
            继续练习
          </CloudButton>
        </div>
      </div>

      <div className="fixed bottom-5 right-5 z-30">
        <CloudButton
          variant="brand"
          size="iconRound"
          className="size-12 shadow-lg"
          onClick={() => navigate("/pre-training-check")}
          aria-label="进入训前检测"
        >
          <ArrowRight size={22} />
        </CloudButton>
      </div>
    </FlowPageShell>
  );
}
