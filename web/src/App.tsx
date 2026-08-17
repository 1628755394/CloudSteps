import { RouterProvider } from "react-router";
import { router } from "./router/routes";
import { CoachingClassReminder } from "./components/CoachingClassReminder";
import { ClassSessionTimer } from "./components/ClassSessionTimer";
import { Toaster } from "./components/ui/sonner";
import { PageTransitionRipple } from "./components/PageTransitionRipple";

export default function App() {
  return (
    <>
      <CoachingClassReminder />
      <ClassSessionTimer />
      <RouterProvider router={router} />
      <Toaster />
      <PageTransitionRipple />
    </>
  );
}
