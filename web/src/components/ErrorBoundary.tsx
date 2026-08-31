import React from "react";
import { CloudButton } from "./cloudsteps";
import i18n from "../i18n";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  copied: boolean;
};

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null,
    errorInfo: null,
    copied: false,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
  }

  private getErrorText() {
    const { error, errorInfo } = this.state;
    const parts = [
      error ? `${error.name}: ${error.message}` : "",
      errorInfo?.componentStack ? `\n${errorInfo.componentStack}` : "",
    ].filter(Boolean);
    return parts.join("\n").trim();
  }

  private copyError = async () => {
    const text = this.getErrorText();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 1200);
    } catch {
      // ignore
    }
  };

  render() {
    const { children } = this.props;
    const { error, copied } = this.state;

    if (!error) return children;

    const errorText = this.getErrorText();

    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
          <div className="text-[#2D3748] text-xl font-semibold mb-2">
            {i18n.t("error.boundary_title")}
          </div>
          <div className="text-[#718096] text-sm mb-6">{i18n.t("error.boundary_desc")}</div>

          <div className="flex flex-wrap gap-3 mb-4">
            <CloudButton type="button" variant="brand" size="sm" onClick={() => window.location.reload()}>
              {i18n.t("error.reload")}
            </CloudButton>
            <CloudButton type="button" variant="outline" size="sm" onClick={this.copyError}>
              {copied ? i18n.t("ui.copied") : i18n.t("ui.copy_error")}
            </CloudButton>
          </div>

          <pre className="text-xs leading-relaxed bg-[#0B1220] text-[#E2E8F0] rounded-xl p-4 overflow-auto max-h-[260px]">
            {errorText || i18n.t("error.no_details")}
          </pre>
        </div>
      </div>
    );
  }
}
