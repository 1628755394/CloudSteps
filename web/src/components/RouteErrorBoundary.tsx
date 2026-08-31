import { useState } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { useTranslation } from "react-i18next";
import { CloudButton } from "./cloudsteps";
import notFoundImg from "../assets/illustrations/not-found.svg";

export function RouteErrorBoundary() {
  const error = useRouteError();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const is404 = isRouteErrorResponse(error) && error.status === 404;

  const title = is404 ? t("error.page_not_found") : t("error.page_error");
  const description = is404 ? t("error.page_not_found_desc") : t("error.page_error_desc");

  const rawText = (() => {
    if (isRouteErrorResponse(error)) {
      return JSON.stringify(
        {
          status: error.status,
          statusText: error.statusText,
          data: error.data,
        },
        null,
        2,
      );
    }
    if (error instanceof Error) {
      return `${error.name}: ${error.message}\n${error.stack ?? ""}`.trim();
    }
    return String(error);
  })();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col items-center text-center">
        <img
          src={notFoundImg}
          alt={t("error.page_not_found")}
          className="w-56 h-auto mb-5"
        />

        <div className="text-[#2D3748] text-lg font-semibold mb-1.5">{title}</div>
        <div className="text-[#718096] text-sm mb-6 leading-relaxed">{description}</div>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          <CloudButton type="button" variant="brand" size="sm" onClick={() => window.location.assign("/")}>
            {t("error.back_home")}
          </CloudButton>
          <CloudButton type="button" variant="outline" size="sm" onClick={() => window.history.back()}>
            {t("error.go_back")}
          </CloudButton>
        </div>

        <div className="w-full border-t border-[#E2E8F0] pt-4">
          <p className="text-[#A0AEC0] text-xs mb-2">{t("error.contact_admin")}</p>
          <CloudButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={copy}
            className="text-[#718096]"
          >
            {copied ? t("ui.copied") : t("ui.copy_error")}
          </CloudButton>
        </div>
      </div>
    </div>
  );
}
