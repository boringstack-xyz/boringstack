import { githubOrg } from "./landingContent";

export function OpenSourceSection() {
  return (
    <nav className="bs-closing" aria-label="Project links" id="bs-oss-title">
      <a className="bs-closing-brand" href={githubOrg.url}>
        BoringStack
      </a>
      <div>
        <a href={githubOrg.url}>
          Source <span aria-hidden="true">↗</span>
        </a>
        <a href={`${githubOrg.url}/blob/main/LICENSE`}>
          MIT license <span aria-hidden="true">↗</span>
        </a>
        <a href={`${githubOrg.url}/issues`}>
          Issues <span aria-hidden="true">↗</span>
        </a>
      </div>
    </nav>
  );
}
