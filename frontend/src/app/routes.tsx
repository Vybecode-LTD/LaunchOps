import { Navigate, type RouteObject } from "react-router";
import { RequireAuth } from "@/lib/auth/RequireAuth";
import { AppShell } from "@/components/shell/AppShell";
import { LoginPage } from "@/pages/auth/LoginPage";
import { PortfolioPage } from "@/pages/portfolio/PortfolioPage";
import { ProjectLayout } from "@/pages/project/ProjectLayout";
import { OverviewPage } from "@/pages/project/OverviewPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RouteError } from "@/pages/RouteError";

// The first screens load eagerly; the rest (Markdown, reports, forms) load when first visited.
// The router keeps the current page on screen until the next one is ready.

export const routeObjects: RouteObject[] = [
  { path: "/login", element: <LoginPage mode="login" /> },
  { path: "/register", element: <LoginPage mode="register" /> },
  { path: "/forgot-password", lazy: () => import("@/pages/auth/PasswordResetPages").then((m) => ({ Component: m.ForgotPasswordPage })) },
  { path: "/reset-password/:token", lazy: () => import("@/pages/auth/PasswordResetPages").then((m) => ({ Component: m.ResetPasswordPage })) },
  { path: "/invite/:token", lazy: () => import("@/pages/auth/InvitePage").then((m) => ({ Component: m.InvitePage })), errorElement: <RouteError /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            // Page errors render inside the shell so navigation keeps working.
            errorElement: <RouteError />,
            children: [
          { index: true, element: <Navigate to="/portfolio" replace /> },
          { path: "portfolio", element: <PortfolioPage /> },
          {
            path: "projects/:projectId",
            element: <ProjectLayout />,
            children: [
              { index: true, element: <OverviewPage /> },
              { path: "operations", lazy: () => import("@/pages/project/OperationsPage").then((m) => ({ Component: m.OperationsPage })) },
              { path: "reports", lazy: () => import("@/pages/project/ReportsPage").then((m) => ({ Component: m.ReportsPage })) },
              { path: "reports/:reportSlug", lazy: () => import("@/pages/project/ReportsPage").then((m) => ({ Component: m.ReportsPage })) },
              { path: "review", lazy: () => import("@/pages/review/ReviewPage").then((m) => ({ element: <m.ReviewPage scope="project" /> })) },
              { path: "review/:itemId", lazy: () => import("@/pages/review/ReviewPage").then((m) => ({ element: <m.ReviewPage scope="project" /> })) },
              { path: "outbox", lazy: () => import("@/pages/outbox/OutboxPage").then((m) => ({ element: <m.OutboxPage scope="project" /> })) },
              { path: "plan", lazy: () => import("@/pages/project/PlanPage").then((m) => ({ Component: m.PlanPage })) },
              { path: "settings", lazy: () => import("@/pages/project/ProjectSettingsPage").then((m) => ({ Component: m.ProjectSettingsPage })) },
            ],
          },
          { path: "review", lazy: () => import("@/pages/review/ReviewPage").then((m) => ({ element: <m.ReviewPage scope="all" /> })) },
          { path: "review/:itemId", lazy: () => import("@/pages/review/ReviewPage").then((m) => ({ element: <m.ReviewPage scope="all" /> })) },
          { path: "outbox", lazy: () => import("@/pages/outbox/OutboxPage").then((m) => ({ element: <m.OutboxPage scope="all" /> })) },
          { path: "calendar", lazy: () => import("@/pages/calendar/CalendarPage").then((m) => ({ Component: m.CalendarPage })) },
          { path: "library", lazy: () => import("@/pages/library/LibraryPage").then((m) => ({ Component: m.LibraryPage })) },
          {
            path: "settings",
            lazy: () => import("@/pages/settings/SettingsLayout").then((m) => ({ Component: m.SettingsLayout })),
            children: [
              { index: true, lazy: () => import("@/pages/settings/GeneralSettings").then((m) => ({ Component: m.GeneralSettings })) },
              { path: "voice", lazy: () => import("@/pages/settings/VoiceSettings").then((m) => ({ Component: m.VoiceSettings })) },
              { path: "companies", lazy: () => import("@/pages/settings/CompaniesSettings").then((m) => ({ Component: m.CompaniesSettings })) },
              { path: "channels", lazy: () => import("@/pages/settings/ChannelsSettings").then((m) => ({ Component: m.ChannelsSettings })) },
              { path: "organisation", lazy: () => import("@/pages/settings/OrganisationSettings").then((m) => ({ Component: m.OrganisationSettings })) },
              { path: "activity", lazy: () => import("@/pages/settings/ActivitySettings").then((m) => ({ Component: m.ActivitySettings })) },
              { path: "usage", lazy: () => import("@/pages/settings/UsageSettings").then((m) => ({ Component: m.UsageSettings })) },
              { path: "team", lazy: () => import("@/pages/settings/TeamSettings").then((m) => ({ Component: m.TeamSettings })) },
            ],
          },
          { path: "*", element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];
