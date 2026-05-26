import type { FC } from "react";
import { Link } from "react-router-dom";

import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

const NotFoundPage: FC = () => {
  const { t } = useTranslation();

  return (
    <main className='bg-background flex min-h-screen items-center justify-center px-6 py-12'>
      <Helmet>
        <title>
          {t("errors.notFound.title")} · {t("app.name")}
        </title>
      </Helmet>
      <div className='bg-panel border-border-strong/40 flex w-full max-w-md flex-col gap-6 rounded-2xl border p-8'>
        <span className='text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase'>
          404
        </span>
        <h1 className='text-foreground text-4xl leading-[1.05] font-bold tracking-tight md:text-5xl'>
          {t("errors.notFound.title")}
        </h1>
        <Button asChild size='lg' className='w-full'>
          <Link to='/'>{t("errors.notFound.back")}</Link>
        </Button>
      </div>
    </main>
  );
};

NotFoundPage.displayName = "NotFoundPage";

export default NotFoundPage;
export { NotFoundPage };
