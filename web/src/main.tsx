import { createRoot } from "react-dom/client";
import "@arco-design/web-react/dist/css/arco.css";
import App from "./App";
import "./i18n"; // 初始化 i18n（必须在 App 之前）
import "./styles/index.css";
import "./styles/arco-popup.css";
import "./styles/iconfont.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ArcoAppProvider } from "./providers/ArcoAppProvider";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ArcoAppProvider>
      <App />
    </ArcoAppProvider>
  </ErrorBoundary>,
);