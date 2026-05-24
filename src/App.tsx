import { RouterProvider } from "react-router";
import { router } from "@/router/routes";
import { CoachingClassReminder } from "@/components/CoachingClassReminder";

export default function App() {
  return (
    <>
      <CoachingClassReminder />
      <RouterProvider router={router} />
    </>
  );
}