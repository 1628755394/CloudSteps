import { RouterProvider } from "react-router";
import { router } from "./router/routes";
import { CoachingClassReminder } from "./components/CoachingClassReminder";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <>
      <CoachingClassReminder />
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}