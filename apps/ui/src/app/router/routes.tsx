import { type FC, Suspense, lazy } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { AppShell } from "@/components/core/AppShell";

import { ProtectedRoute } from "./ProtectedRoute";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

const LoginPage = lazy(() =>
  import("@/features/auth/components/LoginPage").then((m) => ({
    default: m.LoginPage
  }))
);

const SignUpPage = lazy(() =>
  import("@/features/auth/components/SignUpPage").then((m) => ({
    default: m.SignUpPage
  }))
);

const ForgotPasswordPage = lazy(() =>
  import("@/features/auth/components/ForgotPasswordPage").then((m) => ({
    default: m.ForgotPasswordPage
  }))
);

const ResetPasswordPage = lazy(() =>
  import("@/features/auth/components/ResetPasswordPage").then((m) => ({
    default: m.ResetPasswordPage
  }))
);

const DashboardPage = lazy(() =>
  import("@/features/dashboard/components/DashboardPage").then((m) => ({
    default: m.DashboardPage
  }))
);

const WidgetsPage = lazy(() =>
  import("@/features/widgets/components/WidgetsPage").then((m) => ({
    default: m.WidgetsPage
  }))
);

const NotificationsPage = lazy(() =>
  import("@/features/notifications/components/NotificationsPage").then((m) => ({
    default: m.NotificationsPage
  }))
);

const NotificationsPreferencesPage = lazy(() =>
  import("@/features/notifications/components/NotificationsPreferencesPage").then(
    (m) => ({
      default: m.NotificationsPreferencesPage
    })
  )
);

const OAuthCallbackPage = lazy(() =>
  import("@/features/auth/components/OAuthCallbackPage").then((m) => ({
    default: m.OAuthCallbackPage
  }))
);

const VerifyEmailPage = lazy(() =>
  import("@/features/auth/components/VerifyEmailPage").then((m) => ({
    default: m.VerifyEmailPage
  }))
);

const InvitationsPage = lazy(() =>
  import("@/features/accounts/components/InvitationsPage").then((m) => ({
    default: m.InvitationsPage
  }))
);

const AuditLogPage = lazy(() =>
  import("@/features/accounts/components/AuditLogPage").then((m) => ({
    default: m.AuditLogPage
  }))
);

const SettingsPage = lazy(() =>
  import("@/features/accounts/components/SettingsPage").then((m) => ({
    default: m.SettingsPage
  }))
);

const ProfilePage = lazy(() =>
  import("@/features/accounts/components/ProfilePage").then((m) => ({
    default: m.ProfilePage
  }))
);

const BillingPage = lazy(() =>
  import("@/features/billing/components/BillingPage").then((m) => ({
    default: m.BillingPage
  }))
);

const NotFoundPage = lazy(() =>
  import("@/components/global/NotFoundPage").then((m) => ({
    default: m.NotFoundPage
  }))
);

const Fallback: FC = () => {
  const { t } = useTranslation();

  return (
    <div
      role='status'
      aria-live='polite'
      className='flex min-h-screen items-center justify-center'
    >
      <span className='sr-only'>{t("common.loading")}</span>
      <div className='border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent' />
    </div>
  );
};

/*
 * Every route gets the same RouteErrorBoundary as its `errorElement`. When a
 * page-level component (or a query) throws, the boundary renders inside the
 * router so the rest of the app shell stays interactive. The global
 * `ErrorBoundaryProvider` in src/app/providers is the final fallback.
 */
const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={<Fallback />}>
        <LoginPage />
      </Suspense>
    )
  },
  {
    path: "/login",
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={<Fallback />}>
        <LoginPage />
      </Suspense>
    )
  },
  {
    path: "/signup",
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={<Fallback />}>
        <SignUpPage />
      </Suspense>
    )
  },
  {
    path: "/forgot-password",
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={<Fallback />}>
        <ForgotPasswordPage />
      </Suspense>
    )
  },
  {
    path: "/reset-password",
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={<Fallback />}>
        <ResetPasswordPage />
      </Suspense>
    )
  },
  {
    path: "/dashboard",
    errorElement: <RouteErrorBoundary />,
    element: (
      <ProtectedRoute>
        <AppShell>
          <Suspense fallback={<Fallback />}>
            <DashboardPage />
          </Suspense>
        </AppShell>
      </ProtectedRoute>
    )
  },
  {
    path: "/notifications",
    errorElement: <RouteErrorBoundary />,
    element: (
      <ProtectedRoute>
        <AppShell>
          <Suspense fallback={<Fallback />}>
            <NotificationsPage />
          </Suspense>
        </AppShell>
      </ProtectedRoute>
    )
  },
  {
    path: "/widgets",
    errorElement: <RouteErrorBoundary />,
    element: (
      <ProtectedRoute>
        <AppShell>
          <Suspense fallback={<Fallback />}>
            <WidgetsPage />
          </Suspense>
        </AppShell>
      </ProtectedRoute>
    )
  },
  {
    path: "/notifications/preferences",
    errorElement: <RouteErrorBoundary />,
    element: (
      <ProtectedRoute>
        <AppShell>
          <Suspense fallback={<Fallback />}>
            <NotificationsPreferencesPage />
          </Suspense>
        </AppShell>
      </ProtectedRoute>
    )
  },
  {
    path: "/account/invitations",
    errorElement: <RouteErrorBoundary />,
    element: (
      <ProtectedRoute>
        <AppShell>
          <Suspense fallback={<Fallback />}>
            <InvitationsPage />
          </Suspense>
        </AppShell>
      </ProtectedRoute>
    )
  },
  {
    path: "/account/audit-log",
    errorElement: <RouteErrorBoundary />,
    element: (
      <ProtectedRoute>
        <AppShell>
          <Suspense fallback={<Fallback />}>
            <AuditLogPage />
          </Suspense>
        </AppShell>
      </ProtectedRoute>
    )
  },
  {
    path: "/account/settings",
    errorElement: <RouteErrorBoundary />,
    element: (
      <ProtectedRoute>
        <AppShell>
          <Suspense fallback={<Fallback />}>
            <SettingsPage />
          </Suspense>
        </AppShell>
      </ProtectedRoute>
    )
  },
  {
    path: "/account/profile",
    errorElement: <RouteErrorBoundary />,
    element: (
      <ProtectedRoute>
        <AppShell>
          <Suspense fallback={<Fallback />}>
            <ProfilePage />
          </Suspense>
        </AppShell>
      </ProtectedRoute>
    )
  },
  {
    path: "/account/billing",
    errorElement: <RouteErrorBoundary />,
    element: (
      <ProtectedRoute>
        <AppShell>
          <Suspense fallback={<Fallback />}>
            <BillingPage />
          </Suspense>
        </AppShell>
      </ProtectedRoute>
    )
  },
  {
    path: "/oauth/success",
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={<Fallback />}>
        <OAuthCallbackPage />
      </Suspense>
    )
  },
  {
    path: "/verify-email",
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={<Fallback />}>
        <VerifyEmailPage />
      </Suspense>
    )
  },
  {
    path: "*",
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={<Fallback />}>
        <NotFoundPage />
      </Suspense>
    )
  }
]);

export const AppRoutes: FC = () => <RouterProvider router={router} />;
