import { createRoot } from "react-dom/client";
import "@arco-design/web-react/dist/css/arco.css";
import App from "./App";
import "./styles/index.css";
import "./styles/arco-popup.css";
import "./styles/iconfont.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ArcoAppProvider } from "./providers/ArcoAppProvider";
import { NoteProvider } from "./components/NoteContext";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ArcoAppProvider>
      <NoteProvider>
        <App />
      </NoteProvider>
    </ArcoAppProvider>
  </ErrorBoundary>,
);