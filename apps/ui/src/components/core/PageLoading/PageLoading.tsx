import type { FC } from "react";

import { EdgeState } from "../EdgeState";
import { usePageLoading } from "./PageLoading.hooks";
import type { IPageLoadingProps } from "./PageLoading.types";

/*
 * The wait for a page: a compact loading state, centred in the space it is
 * given, fading in only once the wait is long enough to notice.
 */
const PageLoading: FC<IPageLoadingProps> = (props) => {
  const view = usePageLoading(props);

  return (
    <div className={view.className}>
      <EdgeState
        kind='loading'
        size='compact'
        title={view.title}
        testId='page-loading'
      />
    </div>
  );
};

PageLoading.displayName = "PageLoading";

export default PageLoading;
export { PageLoading };
