import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Avatar,
  Button,
  Card,
  DatePicker,
  Empty,
  List,
  Spin,
  Tag,
  Typography,
} from "@arco-design/web-react";
import { IconBook, IconClockCircle, IconEye, IconLeft, IconRight } from "@arco-design/web-react/icon";
import { PageTitle } from "../components/PageTitle";
import { listReviewBooksByDate } from "../api/review";

type ReviewBookStat = { wordBookId: number; cnt: number; name: string; level: string };

type ReviewTask = {
  id: number;
  time: string;
  student: string;
  vocabularyPack: string;
  trainingTime: string;
  status: "pending" | "completed";
  wordBookId: number;
  count: number;
};

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const WEEKDAY_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function parseYMDLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function formatDateZhLong(ymd: string) {
  const d = parseYMDLocal(ymd);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAY_ZH[d.getDay()]}`;
}

export default function AntiForgetting() {
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));
  const navigate = useNavigate();

  const [bookStats, setBookStats] = useState<ReviewBookStat[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingBooks(true);
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
        const res = await listReviewBooksByDate(selectedDate, tz);
        const arr = Array.isArray(res.data) ? (res.data as ReviewBookStat[]) : [];
        if (mounted) setBookStats(arr);
      } catch {
        if (mounted) setBookStats([]);
      } finally {
        if (mounted) setLoadingBooks(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  const reviewTasks = useMemo<ReviewTask[]>(() => {
    const student = sessionStorage.getItem("lb_user_name") || "当前用户";
    const times = ["08:00", "10:00", "14:00", "16:00", "18:00"];
    return bookStats.map((b, idx) => ({
      id: idx + 1,
      time: times[idx % times.length],
      student,
      vocabularyPack: b.name,
      trainingTime: `${Math.min(60, Math.max(10, Math.ceil(b.cnt / 20) * 10))}分钟`,
      status: "pending",
      wordBookId: b.wordBookId,
      count: b.cnt,
    }));
  }, [bookStats]);

  const groupedByStudent: { [key: string]: typeof reviewTasks } = {};
  reviewTasks.forEach((task) => {
    if (!groupedByStudent[task.student]) {
      groupedByStudent[task.student] = [];
    }
    groupedByStudent[task.student].push(task);
  });

  const shiftDate = (deltaDays: number) => {
    const d = parseYMDLocal(selectedDate);
    d.setDate(d.getDate() + deltaDays);
    setSelectedDate(toDateInputValue(d));
  };

  const handleOpenTask = (task: ReviewTask) => {
    sessionStorage.setItem("lb_mode", "review");
    sessionStorage.setItem("lb_review_wordbook_id", String(task.wordBookId));
    sessionStorage.setItem("lb_review_wordbook_name", task.vocabularyPack);
    navigate(`/review-word-list?wordBookId=${task.wordBookId}`);
  };

  return (
    <div className="space-y-6">
      <PageTitle description="定期复习，巩固记忆，防止遗忘">抗遗忘复习</PageTitle>

      <Card className="!rounded-xl shadow-sm">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            type="text"
            shape="circle"
            icon={<IconLeft />}
            onClick={() => shiftDate(-1)}
            aria-label="上一天"
          />
          <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
            <Typography.Text type="secondary" className="text-xs">
              选择日期
            </Typography.Text>
            <DatePicker
              value={selectedDate || undefined}
              onChange={(dateString) => {
                if (dateString) setSelectedDate(dateString);
              }}
              style={{ width: "100%", maxWidth: 280 }}
              allowClear={false}
            />
            <Typography.Text className="!text-[#2D3748] font-semibold text-center">
              {formatDateZhLong(selectedDate)}
            </Typography.Text>
          </div>
          <Button
            type="text"
            shape="circle"
            icon={<IconRight />}
            onClick={() => shiftDate(1)}
            aria-label="下一天"
          />
        </div>
      </Card>

      {loadingBooks ? (
        <div className="flex justify-center py-16">
          <Spin size={40} tip="加载中…" />
        </div>
      ) : reviewTasks.length === 0 ? (
        <Card className="!rounded-xl shadow-sm">
          <Empty description="该日暂无待复习词库任务（或已全部完成）。可切换日期查看其它天的计划。" />
        </Card>
      ) : (
        <>
          <div className="hidden lg:block space-y-6">
            {Object.entries(groupedByStudent).map(([student, tasks]) => (
              <Card
                key={student}
                className="!rounded-xl shadow-sm"
                title={
                  <div className="flex items-center gap-3">
                    <Avatar style={{ background: "linear-gradient(135deg, #4ECDC4, #55A3FF)" }}>
                      {student.charAt(0)}
                    </Avatar>
                    <div>
                      <div className="text-[#2D3748] font-semibold text-lg">{student}</div>
                      <Typography.Text type="secondary" className="text-sm">
                        本日 {tasks.length} 个复习任务（按所选日期统计）
                      </Typography.Text>
                    </div>
                  </div>
                }
              >
                <List
                  bordered={false}
                  dataSource={tasks}
                  render={(task) => (
                    <List.Item
                      key={task.id}
                      className="!px-4 !py-3 !mb-2 !bg-[#F7F9FC] !rounded-lg"
                      actions={[
                        task.status === "completed" ? (
                          <Tag key="done" color="cyan">
                            已完成
                          </Tag>
                        ) : null,
                        <Button
                          key="action"
                          type="primary"
                          size="small"
                          icon={<IconEye />}
                          onClick={() => handleOpenTask(task)}
                        >
                          {task.status === "completed" ? "查看" : "复习"}
                        </Button>,
                      ].filter(Boolean)}
                    >
                      <div className="flex items-center gap-6 flex-wrap">
                        <span className="inline-flex items-center gap-2 min-w-[80px]">
                          <IconClockCircle style={{ color: "#4ECDC4" }} />
                          <span className="text-[#2D3748] font-medium">{task.time}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 flex-1">
                          <IconBook style={{ color: "#55A3FF" }} />
                          <span className="text-[#2D3748]">{task.vocabularyPack}</span>
                        </span>
                        <Typography.Text type="secondary" className="min-w-[80px]">
                          {task.trainingTime}
                        </Typography.Text>
                      </div>
                    </List.Item>
                  )}
                />
              </Card>
            ))}
          </div>

          <div className="lg:hidden space-y-4">
            {reviewTasks.map((task) => (
              <Card key={task.id} className="!rounded-xl shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar size={40} style={{ background: "linear-gradient(135deg, #4ECDC4, #55A3FF)" }}>
                      {task.student.charAt(0)}
                    </Avatar>
                    <div>
                      <div className="text-[#2D3748] font-medium">{task.student}</div>
                      <div className="flex items-center gap-2 text-sm text-[#718096] mt-1">
                        <IconClockCircle style={{ color: "#A0AEC0" }} />
                        <span>{task.time}</span>
                      </div>
                    </div>
                  </div>
                  {task.status === "completed" && <Tag color="cyan">已完成</Tag>}
                </div>
                <div className="space-y-3 mb-4">
                  <div className="flex items-start gap-2">
                    <IconBook style={{ color: "#55A3FF", marginTop: 2 }} />
                    <span className="text-[#2D3748] text-sm">{task.vocabularyPack}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#718096]">
                    <IconClockCircle style={{ color: "#A0AEC0" }} />
                    <span>训练时长：{task.trainingTime}</span>
                  </div>
                </div>
                <Button
                  type="primary"
                  long
                  icon={<IconEye />}
                  onClick={() => handleOpenTask(task)}
                >
                  {task.status === "completed" ? "查看" : "复习"}
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
