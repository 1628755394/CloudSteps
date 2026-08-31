import { CloudButton } from "../components/cloudsteps";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Phone, MapPin, Shield, Award, BookOpen, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type StatCard = {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
};

export default function Profile() {
  const { t } = useTranslation();
  const [name] = useState("April Zhang");
  const [email] = useState("april@yunjiebei.com");
  const [phone] = useState("138****8888");
  const location = t("profile.demo_location");

  const stats: StatCard[] = useMemo(
    () => [
      { label: t("profile.stats.total_coaching"), value: "43h", icon: Clock, color: "#4ECDC4" },
      { label: t("profile.stats.month_coaching"), value: "12h", icon: Award, color: "#55A3FF" },
      { label: t("profile.stats.training_records"), value: "128", icon: BookOpen, color: "#FF6B6B" },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4ECDC4] to-[#55A3FF] flex items-center justify-center text-white text-xl font-bold">
              {name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="text-[#2D3748] text-xl font-semibold">{name}</div>
              <div className="mt-1 inline-flex items-center gap-2 px-3 py-1 bg-[#4ECDC4]/10 rounded-full">
                <Shield size={14} className="text-[#4ECDC4]" />
                <span className="text-xs text-[#4ECDC4] font-semibold">
                  {t("profile.demo_role")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <CloudButton type="button" variant="outline">
              {t("profile.edit")}
            </CloudButton>
            <CloudButton type="button" variant="brand">
              {t("profile.save")}
            </CloudButton>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-white rounded-2xl border border-[#E2E8F0] p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-[#718096]">{s.label}</div>
                  <div className="text-[26px] font-bold text-[#2D3748] mt-1">
                    {s.value}
                  </div>
                </div>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${s.color}15` }}
                >
                  <Icon size={20} color={s.color} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] p-6">
          <h2 className="text-[#2D3748] font-semibold text-[18px] mb-4">
            {t("profile.basic_info")}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#F7F9FC] border border-[#E2E8F0]">
              <Mail size={18} className="text-[#55A3FF]" />
              <div className="min-w-0">
                <div className="text-xs text-[#A0AEC0]">{t("profile.email")}</div>
                <div className="text-sm text-[#2D3748] truncate">{email}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#F7F9FC] border border-[#E2E8F0]">
              <Phone size={18} className="text-[#4ECDC4]" />
              <div className="min-w-0">
                <div className="text-xs text-[#A0AEC0]">{t("profile.phone")}</div>
                <div className="text-sm text-[#2D3748] truncate">{phone}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#F7F9FC] border border-[#E2E8F0] md:col-span-2">
              <MapPin size={18} className="text-[#FF6B6B]" />
              <div className="min-w-0">
                <div className="text-xs text-[#A0AEC0]">{t("profile.location")}</div>
                <div className="text-sm text-[#2D3748] truncate">{location}</div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-[#2D3748] font-semibold mb-2">{t("profile.bio_title")}</h3>
            <div className="text-sm text-[#718096] leading-relaxed">
              {t("profile.bio")}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
          <h2 className="text-[#2D3748] font-semibold text-[18px] mb-4">
            {t("profile.security_title")}
          </h2>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-[#E2E8F0]">
              <div className="text-sm font-medium text-[#2D3748]">{t("profile.login_status")}</div>
              <div className="text-xs text-[#718096] mt-1">{t("profile.last_login")}</div>
            </div>
            <div className="p-4 rounded-xl border border-[#E2E8F0]">
              <div className="text-sm font-medium text-[#2D3748]">{t("profile.two_factor")}</div>
              <div className="text-xs text-[#718096] mt-1">{t("profile.two_factor_off")}</div>
            </div>
            <div className="p-4 rounded-xl border border-[#E2E8F0]">
              <div className="text-sm font-medium text-[#2D3748]">{t("profile.permissions")}</div>
              <div className="text-xs text-[#718096] mt-1">{t("profile.permissions_desc")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
