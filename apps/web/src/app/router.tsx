import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./layouts/app-shell";
import { LoginPage } from "../pages/login/page";
import { ExplorerPage } from "../pages/explorer/page";
import { JobsPage } from "../pages/jobs/page";
import { SettingsPage } from "../pages/settings/page";

export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/explorer" replace />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        path: "/explorer",
        element: <ExplorerPage />,
      },
      {
        path: "/jobs",
        element: <JobsPage />,
      },
      {
        path: "/settings",
        element: <SettingsPage />,
      },
    ],
  },
]);
