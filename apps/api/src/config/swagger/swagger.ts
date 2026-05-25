import { swagger } from "@elysiajs/swagger";

export const swaggerConfig = swagger({
  documentation: {
    info: {
      title: "API Template",
      version: "0.1.0",
      description:
        "Bun + Elysia + Drizzle starter API. Replace this description with your project.",
    },
    tags: [
      { name: "Health", description: "Liveness and readiness probes" },
      {
        name: "Authentication",
        description: "Registration, login, email verification, password reset",
      },
      { name: "Users", description: "Authenticated user profile" },
      { name: "Accounts", description: "Account switching and invitations" },
      { name: "Dashboard", description: "Authenticated dashboard data" },
      { name: "Widgets", description: "Example account-scoped CRUD resource" },
      { name: "Billing", description: "Stripe-backed subscription management" },
      {
        name: "Admin",
        description: "Admin-only operations (requires role=admin)",
      },
      {
        name: "Notifications",
        description:
          "Per-user notification feed, status updates, and preferences",
      },
      {
        name: "Capabilities",
        description:
          "Public, unauthenticated description of which server features and OAuth providers are wired up",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "auth_token",
        },
      },
    },
  },
});
