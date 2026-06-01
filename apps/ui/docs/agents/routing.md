# Routing

Read when adding a route, wrapping one in auth, or wiring it into
the sidebar.

`src/app/router/routes.tsx` declares every route as a lazy import.
Protected routes wrap their element with `<ProtectedRoute>` and
`<AppShell>`. `<ProtectedRoute>` uses `useMe()` from auth queries;
while loading it renders a spinner; if unauthenticated it
`<Navigate to="/login" state={{ from }} />` so the user returns to
the original page after login.

## Route inventory

| Route                        | Page                           | Auth      |
| ---------------------------- | ------------------------------ | --------- |
| `/` and `/login`             | `LoginPage`                    | public    |
| `/signup`                    | `SignUpPage`                   | public    |
| `/verify-email`              | `VerifyEmailPage`              | public    |
| `/oauth/success`             | `OAuthCallbackPage`            | public    |
| `/dashboard`                 | `DashboardPage`                | protected |
| `/notifications`             | `NotificationsPage`            | protected |
| `/notifications/preferences` | `NotificationsPreferencesPage` | protected |
| `/account/invitations`       | `InvitationsPage`              | protected |
| `/account/settings`          | `SettingsPage`                 | protected |
| `/account/profile`           | `ProfilePage`                  | protected |
| `*`                          | `NotFoundPage`                 | public    |

## AppShell and the sidebar

Authenticated routes render inside `<AppShell>`: a left `AppSidebar`
rail (desktop) or a `Sheet` drawer (mobile), a sticky header
(account switcher · notification bell · theme toggle · logout), and
your page content as `children`. The sidebar's nav inventory lives
in `src/components/core/AppSidebar/AppSidebar.constants.ts` —
`APP_SIDEBAR_NAV_ITEMS`. Active state is driven by react-router's
`NavLink` + the `aria-[current=page]:` Tailwind variant, not a
JS callback.

## Adding a route

1. Add the lazy import + the route entry in `routes.tsx`.
2. Wrap with `<ProtectedRoute><AppShell>…</AppShell></ProtectedRoute>`
   if the page is authenticated.
3. If the route should appear in the sidebar, add an entry to
   `APP_SIDEBAR_NAV_ITEMS` and an icon mapping in
   `AppSidebar.hooks.ts` (`icons` record by id).
4. Add the route's i18n entries (title, body, eyebrow) under
   `src/lib/i18n/locales/{en,de}/common.json` — every user-facing
   string ships in both locales from day one.
5. Add an E2E spec to `e2e/` if the route is on the critical path
   (auth, billing, dashboard nav).
