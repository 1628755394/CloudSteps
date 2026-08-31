import { useState } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { CloudButton } from "./cloudsteps";

export function RouteErrorBoundary() {
  const error = useRouteError();
  const [copied, setCopied] = useState(false);

  const is404 = isRouteErrorResponse(error) && error.status === 404;

  const title = is404 ? "页面不存在" : "页面出错了";
  const description = is404
    ? "你访问的页面可能已被移除或暂时不可用"
    : "页面加载时遇到了问题，请稍后重试";

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
        {/* 空状态插画 */}
        <div className="mb-5 flex items-center justify-center w-20 h-20 rounded-full bg-[#EDF2F7]">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#A0AEC0"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M8 15s1.5-2 4-2 4 2 4 2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </div>

        <div className="text-[#2D3748] text-lg font-semibold mb-1.5">{title}</div>
        <div className="text-[#718096] text-sm mb-6 leading-relaxed">{description}</div>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          <CloudButton type="button" variant="brand" size="sm" onClick={() => window.location.assign("/")}>
            回到首页
          </CloudButton>
          <CloudButton type="button" variant="outline" size="sm" onClick={() => window.history.back()}>
            返回上一页
          </CloudButton>
        </div>

        <div className="w-full border-t border-[#E2E8F0] pt-4">
          <p className="text-[#A0AEC0] text-xs mb-2">
            如果问题持续出现，请复制错误信息联系管理员处理
          </p>
          <CloudButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={copy}
            className="text-[#718096]"
          >
            {copied ? "已复制" : "复制错误信息"}
          </CloudButton>
        </div>
      </div>
    </div>
  );
}
