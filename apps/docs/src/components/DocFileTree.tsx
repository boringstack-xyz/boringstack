export interface DocFileTreeNode {
  name: string;
  detail?: string;
  children?: DocFileTreeNode[];
}

interface DocFileTreeProps {
  root: string;
  nodes: DocFileTreeNode[];
  title?: string;
  caption?: string;
}

const depthPadding = [
  "pl-[0.35rem]",
  "pl-[1.45rem]",
  "pl-[2.55rem]",
  "pl-[3.65rem]",
  "pl-[4.75rem]",
  "pl-[5.85rem]",
];

function FolderIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
      <path
        d="M3.75 6.75A1.75 1.75 0 0 1 5.5 5h4.4l1.7 2h6.9a1.75 1.75 0 0 1 1.75 1.75v8.75a1.75 1.75 0 0 1-1.75 1.75h-13A1.75 1.75 0 0 1 3.75 17.5V6.75Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 3.75h6.25L18 8.5v11.75H7V3.75Zm6.25 0V8.5H18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function NodeIcon({ node }: { node: DocFileTreeNode }) {
  if (node.children || node.name.endsWith("/")) {
    return <FolderIcon />;
  }

  return <FileIcon />;
}

function TreeNode({ node, depth = 0 }: { node: DocFileTreeNode; depth?: number }) {
  const paddingClass = depthPadding[Math.min(depth, depthPadding.length - 1)];

  return (
    <li className="relative m-0 min-w-0 list-none p-0">
      <div
        className={`grid min-w-0 grid-cols-[1.45rem_minmax(0,1fr)] items-baseline gap-2 rounded-md py-0.5 pr-1.5 text-[0.93rem] leading-tight transition-colors hover:bg-white/[0.035] ${paddingClass}`}
      >
        <span className="mt-0.5 flex items-center justify-center text-[color-mix(in_srgb,var(--sl-color-accent)_72%,#e8ddff)]">
          <NodeIcon node={node} />
        </span>
        <span className="grid min-w-0 gap-1 min-[700px]:grid-cols-[minmax(12rem,max-content)_minmax(0,1fr)] min-[700px]:gap-5">
          <span className="min-w-0 truncate font-mono font-semibold text-[var(--sl-color-white)]">
            {node.name}
          </span>
          {node.detail ? (
            <span className="min-w-0 text-[0.86rem] leading-snug text-[var(--sl-color-gray-3)]">
              {node.detail}
            </span>
          ) : null}
        </span>
      </div>

      {node.children?.length ? (
        <ul className="relative m-0 ml-[1.15rem] mt-0 grid list-none gap-0 p-0">
          {node.children.map((child) => (
            <TreeNode depth={depth + 1} key={`${node.name}-${child.name}`} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function DocFileTree({ root, nodes, title = "Repository map", caption }: DocFileTreeProps) {
  return (
    <figure className="not-content my-8 overflow-hidden rounded-xl border border-transparent bg-[linear-gradient(var(--sl-color-bg),var(--sl-color-bg))_padding-box,linear-gradient(135deg,color-mix(in_srgb,var(--sl-color-accent)_70%,transparent),color-mix(in_srgb,#67e8f9_42%,transparent),color-mix(in_srgb,var(--sl-color-accent)_16%,transparent))_border-box] shadow-[0_22px_70px_color-mix(in_srgb,var(--sl-color-accent)_13%,transparent)]">
      <figcaption className="flex min-w-0 items-center justify-between gap-4 border-b border-[var(--sl-color-gray-6)] bg-[linear-gradient(90deg,color-mix(in_srgb,var(--sl-color-accent)_12%,transparent),transparent_62%)] px-4 py-3">
        <span className="min-w-0 truncate text-[0.72rem] font-black uppercase leading-none text-[var(--sl-color-accent)]">
          {title}
        </span>
        {caption ? (
          <span className="hidden min-w-0 truncate font-mono text-[0.72rem] text-[var(--sl-color-gray-3)] min-[700px]:block">
            {caption}
          </span>
        ) : null}
      </figcaption>

      <div className="relative m-0 overflow-x-auto bg-[radial-gradient(circle_at_12%_0%,color-mix(in_srgb,var(--sl-color-accent)_12%,transparent),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.024),transparent)] p-5">
        <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--sl-color-accent)_35%,var(--sl-color-gray-5))] bg-[color-mix(in_srgb,var(--sl-color-accent)_10%,transparent)] px-3 py-1 font-mono text-[0.86rem] font-bold text-[var(--sl-color-white)]">
          <FolderIcon />
          <span>{root}</span>
        </div>
        <ul className="m-0 mt-2 grid min-w-max list-none gap-0 p-0 pb-1">
          {nodes.map((node) => (
            <TreeNode key={node.name} node={node} />
          ))}
        </ul>
      </div>
    </figure>
  );
}
