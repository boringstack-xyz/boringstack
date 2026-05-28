import type { FC } from "react";

import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

import { LoginCredentialsForm } from "./LoginCredentialsForm";
import { useLoginPage } from "./LoginPage.hooks";
import type { ILoginPageProps } from "./LoginPage.types";
import { MfaChallengeForm } from "./MfaChallengeForm";

const LoginPage: FC<ILoginPageProps> = (props) => {
  const { t } = useTranslation();
  const view = useLoginPage(props);

  return (
    <main className='bg-background flex min-h-screen items-center justify-center px-6 py-12'>
      <Helmet>
        <title>
          {t("auth.login.title")} · {t("app.name")}
        </title>
      </Helmet>

      {view.mfaChallengeToken === null ? (
        <LoginCredentialsForm
          register={view.register}
          errors={view.errors}
          isSubmitting={view.isSubmitting}
          submit={view.submit}
          oauthProviders={view.oauthProviders}
          oauthButtons={view.oauthButtons}
          oauthPending={view.oauthPending}
          pendingEmail={view.pendingEmail}
          onResendVerification={view.onResendVerification}
          isResending={view.isResending}
        />
      ) : (
        <MfaChallengeForm
          mode={view.mfaMode}
          code={view.mfaCode}
          error={view.mfaError}
          isSubmitting={view.isMfaSubmitting}
          onCodeChange={view.onMfaCodeChange}
          onSubmit={view.onMfaSubmit}
          onModeToggle={view.onMfaModeToggle}
        />
      )}
    </main>
  );
};

LoginPage.displayName = "LoginPage";

export default LoginPage;
export { LoginPage };
