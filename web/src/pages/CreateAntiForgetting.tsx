import { CloudButton } from "../components/cloudsteps";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { useState } from "react";
import { CloudCard, CloudDatePicker, CloudTimePicker } from "../components/cloudsteps/arco";

function todayYMD() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CreateAntiForgetting() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(todayYMD);
  const [selectedTime, setSelectedTime] = useState("09:00");

  const handleConfirm = () => {
    navigate("/");
  };

  const setRelativeDate = (days: number, time = "09:00") => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, "0");
    setSelectedDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setSelectedTime(time);
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="bg-card sticky top-0 z-10 border-b border-border">
        <div className="flex items-center px-4 h-14">
          <CloudButton
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="-ml-1"
          >
            <ArrowLeft size={22} className="text-charcoal" />
          </CloudButton>
          <h1 className="flex-1 text-center text-base font-semibold text-foreground -ml-8">
            创建抗遗忘
          </h1>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4 max-w-lg mx-auto">
        <div className="rounded-xl bg-primary-soft px-4 py-3">
          <p className="text-sm text-charcoal leading-relaxed">
            根据艾宾浩斯遗忘曲线，科学设置复习时间可以帮助您更好地记忆单词。
            系统将在您设定的时间提醒您复习今天学习的单词。
          </p>
        </div>

        <CloudCard className="p-5 space-y-4">
          <CloudDatePicker
            label="复习日期"
            value={selectedDate}
            allowClear={false}
            onChange={(v) => v && setSelectedDate(v)}
          />
          <CloudTimePicker
            label="复习时间"
            value={selectedTime}
            allowClear={false}
            onChange={(v) => v && setSelectedTime(v)}
          />

          <div>
            <label className="text-sm text-charcoal font-medium mb-1.5 block">快捷选择</label>
            <div className="grid grid-cols-2 gap-2.5">
              <CloudButton variant="outline" onClick={() => setRelativeDate(1)}>
                明天 09:00
              </CloudButton>
              <CloudButton variant="outline" onClick={() => setRelativeDate(3)}>
                3天后 09:00
              </CloudButton>
              <CloudButton variant="outline" onClick={() => setRelativeDate(7)}>
                1周后 09:00
              </CloudButton>
              <CloudButton variant="outline" onClick={() => setRelativeDate(14)}>
                2周后 09:00
              </CloudButton>
            </div>
          </div>
        </CloudCard>

        <CloudButton variant="brand" className="w-full h-11" onClick={handleConfirm}>
          确定
        </CloudButton>
      </div>
    </div>
  );
}
