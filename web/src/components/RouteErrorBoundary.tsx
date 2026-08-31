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
        {/* 迷路小猫插画 */}
        <div className="mb-5 flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-[#EDF2F7] to-[#E2E8F0]">
          <svg
            width="72"
            height="72"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 小猫身体 */}
            <ellipse cx="60" cy="78" rx="26" ry="20" fill="#F6B042" />
            {/* 小猫头部 */}
            <circle cx="60" cy="52" r="22" fill="#F6B042" />
            {/* 耳朵 */}
            <path d="M42 40 L38 24 L52 36 Z" fill="#F6B042" />
            <path d="M78 40 L82 24 L68 36 Z" fill="#F6B042" />
            <path d="M43 37 L41 28 L49 35 Z" fill="#FFD9A0" />
            <path d="M77 37 L79 28 L71 35 Z" fill="#FFD9A0" />
            {/* 眼睛（迷茫的小圆点） */}
            <circle cx="51" cy="52" r="2.5" fill="#2D3748" />
            <circle cx="69" cy="52" r="2.5" fill="#2D3748" />
            {/* 鼻子 */}
            <path d="M58 58 L60 61 L62 58 Z" fill="#E8718E" />
            {/* 嘴巴（困惑的小表情） */}
            <path d="M60 61 Q56 65 53 63" stroke="#2D3748" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            <path d="M60 61 Q64 65 67 63" stroke="#2D3748" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            {/* 胡须 */}
            <line x1="40" y1="56" x2="48" y2="57" stroke="#D4A032" strokeWidth="1" strokeLinecap="round" />
            <line x1="40" y1="60" x2="48" y2="60" stroke="#D4A032" strokeWidth="1" strokeLinecap="round" />
            <line x1="80" y1="56" x2="72" y2="57" stroke="#D4A032" strokeWidth="1" strokeLinecap="round" />
            <line x1="80" y1="60" x2="72" y2="60" stroke="#D4A032" strokeWidth="1" strokeLinecap="round" />
            {/* 头顶问号 */}
            <text x="60" y="20" textAnchor="middle" fontSize="16" fontWeight="700" fill="#A0AEC0">?</text>
            {/* 小地图 */}
            <rect x="88" y="70" width="20" height="16" rx="2" fill="#fff" stroke="#CBD5E0" strokeWidth="1.2" />
            <path d="M92 78 L98 74 L104 78" stroke="#4ECDC4" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <circle cx="98" cy="74" r="1.5" fill="#E8718E" />
            {/* 尾巴 */}
            <path d="M86 82 Q96 78 94 68" stroke="#F6B042" strokeWidth="6" strokeLinecap="round" fill="none" />
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
