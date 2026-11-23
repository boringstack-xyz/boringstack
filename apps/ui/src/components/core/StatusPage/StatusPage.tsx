import type { FC } from "react";

import { Helmet } from "react-helmet-async";

import { EdgeState } from "../EdgeState";
import { useStatusPage } from "./StatusPage.hooks";
import type { IStatusPageProps } from "./StatusPage.types";

/*
 * A whole page that is one state: a link that has expired, a sign-in that
 * didn't finish, an invitation accepted. What happened and the way on,
 * centred on the page.
 */
const StatusPage: FC<IStatusPageProps> = ({ metaTitle, ...state }) => {
  const view = useStatusPage({ metaTitle });

  return (
    <main className='bg-background flex min-h-screen items-center justify-center px-6 py-12'>
      <Helmet>
        <title>{view.documentTitle}</title>
      </Helmet>
      <div className='w-full max-w-xl'>
        <EdgeState headingLevel={1} {...state} />
      </div>
    </main>
  );
};

StatusPage.displayName = "StatusPage";

export default StatusPage;
export { StatusPage };
