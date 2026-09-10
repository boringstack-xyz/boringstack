import { useEffect, useRef, useState } from "react";

// A 2:1 axonometric projection shared by the boards and their contents.
const board = {
  cx: 272,
  halfWidth: 112,
  halfHeight: 56,
  depth: 8,
  pitch: 136,
  firstY: 80,
};
const railX = board.cx - board.halfWidth - 20;
const labelX = 444;
const layers = [
  {
    name: "Interface",
    path: "apps/ui",
    detail: "React + Vite · generated OpenAPI client",
    wire: "typed client",
  },
  {
    name: "Application",
    path: "apps/api",
    detail: "Bun + Elysia · auth, billing, tenant boundaries",
    wire: "tenant scope",
  },
  {
    name: "Services",
    path: "infra/compose",
    detail: "Postgres + Valkey · data, queues, observability",
    wire: "data + jobs",
  },
  {
    name: "Infrastructure",
    path: "infra/bootstrap",
    detail: "OpenTofu · optional VPS provisioning and first boot",
    wire: "",
  },
].map((layer, index) => ({ ...layer, y: board.firstY + index * board.pitch }));
const stages = [
  {
    short: "Change",
    label: "accountId filter removed",
    detail: "Example: SELECT against accountPlans without tenant scope.",
  },
  {
    short: "Blocked",
    label: "ESLint: missing account scope",
    detail: "account-scoped-tables-require-where reports the query.",
  },
  {
    short: "Fixed",
    label: "accountId predicate restored",
    detail: "WHERE accountPlans.accountId = accountId",
  },
  {
    short: "Checked",
    label: "Tenant-scope check passes",
    detail: "The corrected query satisfies the account-scope rule.",
  },
];

const contentCenters = [
  [49, 46],
  [49, 47],
  [49, 46],
  [49, 46.5],
];

/** Plan-view symbols; all use the same projection as the surrounding board. */
function BoardContents({ index }: { index: number }) {
  if (index === 0)
    return (
      <g className="bs-board-ink">
        <rect
          x="8"
          y="7"
          width="82"
          height="78"
          rx="3"
          className="bs-board-device"
        />
        <path d="M8 20H90M29 20V85" />
        <circle cx="15" cy="13" r="1.6" />
        <circle cx="21" cy="13" r="1.6" />
        <circle cx="27" cy="13" r="1.6" />
        <path d="M15 30H22M15 38H22M15 46H22M15 54H22" />
        <rect x="37" y="29" width="43" height="20" className="bs-board-soft" />
        <path d="M42 42L50 37L59 40L67 33L75 36" className="bs-board-accent" />
        <path d="M38 58H76M38 64H65M38 70H72" />
        <rect x="64" y="75" width="16" height="4" className="bs-board-fill" />
      </g>
    );
  if (index === 1)
    return (
      <g className="bs-board-ink">
        <path
          d="M10 16H32V33M88 16H65V33M10 75H32V60M88 75H65V60M8 45H27M70 45H90"
          className="bs-board-trace"
        />
        <rect
          x="27"
          y="25"
          width="44"
          height="43"
          className="bs-board-device"
        />
        <rect x="32" y="30" width="34" height="33" className="bs-board-soft" />
        <path d="M38 20V25M48 20V25M58 20V25M38 68V74M48 68V74M58 68V74" />
        <text x="49" y="44" textAnchor="middle" className="bs-board-text">
          API
        </text>
        <text x="49" y="55" textAnchor="middle" className="bs-board-tiny">
          accountId
        </text>
        <circle cx="10" cy="16" r="4" />
        <circle cx="88" cy="16" r="4" />
        <circle cx="10" cy="75" r="4" />
        <circle cx="88" cy="75" r="4" />
        <path d="M14 82H83" className="bs-board-accent" />
      </g>
    );
  if (index === 2)
    return (
      <g className="bs-board-ink">
        <path d="M27 62V78H71V62" className="bs-board-trace" />
        <rect
          x="10"
          y="14"
          width="34"
          height="50"
          rx="2"
          className="bs-board-device"
        />
        <path d="M10 27H44M10 51H44M16 20H20M16 57H20" />
        <text x="27" y="42" textAnchor="middle" className="bs-board-text">
          SQL
        </text>
        {[14, 34, 54].map((y) => (
          <g key={y}>
            <rect
              x="56"
              y={y}
              width="32"
              height="12"
              className="bs-board-device"
            />
            <path d={`M62 ${y + 6}H81`} className="bs-board-accent" />
          </g>
        ))}
      </g>
    );
  return (
    <g className="bs-board-ink">
      <rect
        x="10"
        y="12"
        width="78"
        height="69"
        rx="3"
        className="bs-board-device"
      />
      {[22, 40, 58].map((y) => (
        <g key={y}>
          <rect x="17" y={y} width="64" height="13" className="bs-board-soft" />
          <circle cx="24" cy={y + 6.5} r="2" className="bs-board-led" />
          <path
            d={`M36 ${y + 4}V${y + 9}M42 ${y + 4}V${y + 9}M48 ${y + 4}V${y + 9}M54 ${y + 4}V${y + 9}M60 ${y + 4}V${y + 9}M66 ${y + 4}V${y + 9}M72 ${y + 4}V${y + 9}`}
          />
        </g>
      ))}
      <circle cx="14" cy="16" r="1" />
      <circle cx="84" cy="77" r="1" />
    </g>
  );
}

export function StackMachine() {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(1);

  useEffect(() => {
    if (!container.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPlaying(!preference.matches);
    const stopForReducedMotion = () => {
      if (preference.matches) setPlaying(false);
    };
    preference.addEventListener("change", stopForReducedMotion);
    return () => preference.removeEventListener("change", stopForReducedMotion);
  }, []);

  useEffect(() => {
    if (!playing || !visible) return;
    const timer = window.setTimeout(() => {
      if (stage === stages.length - 1) setPlaying(false);
      else setStage(stage + 1);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [playing, stage, visible]);

  return (
    <div className="bs-machine-wrap" ref={container}>
      <div className="bs-machine-toolbar">
        <span className="bs-machine-id">
          <span /> BORINGSTACK, TAKEN APART
        </span>
        <span className="bs-machine-edition">FOLLOW A CHANGE</span>
      </div>
      <div
        className="bs-machine"
        data-stage={stage}
        data-playing={playing && visible}
      >
        <div className="bs-machine-caption">
          <span>THE BORING MACHINE</span>
          <span>SMALL PARTS. EXPLICIT CONNECTIONS.</span>
        </div>
        <svg
          className="bs-machine-diagram"
          viewBox="0 0 680 576"
          role="img"
          aria-label="An illustrated stack: a browser interface, an API chip with tenant scope, a database and job queue, and a server. A missing tenant filter is blocked at the API boundary."
        >
          <defs>
            <pattern
              id="bs-machine-dots"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r=".7" fill="currentColor" />
            </pattern>
            <radialGradient id="bs-machine-fade">
              <stop offset="0" stopColor="white" />
              <stop offset="1" stopColor="black" />
            </radialGradient>
            <mask id="bs-machine-mask">
              <rect width="680" height="576" fill="url(#bs-machine-fade)" />
            </mask>
          </defs>
          <rect
            width="680"
            height="576"
            fill="url(#bs-machine-dots)"
            mask="url(#bs-machine-mask)"
            className="bs-machine-grid"
          />
          <path
            d={`M${railX} ${layers[0].y}V${layers[3].y}`}
            className="bs-machine-rail"
          />
          {layers.map((layer, index) => (
            <g
              key={layer.path}
              className="bs-machine-layer"
              data-selected={selected === index}
              data-layer={index}
            >
              <path
                d={`M${board.cx - board.halfWidth} ${layer.y} v${board.depth} l${board.halfWidth} ${board.halfHeight} l${board.halfWidth} ${-board.halfHeight} v${-board.depth} l${-board.halfWidth} ${board.halfHeight} Z`}
                className="bs-machine-edge"
              />
              <path
                d={`M${board.cx} ${layer.y - board.halfHeight} l${board.halfWidth} ${board.halfHeight} l${-board.halfWidth} ${board.halfHeight} l${-board.halfWidth} ${-board.halfHeight} Z`}
                className="bs-machine-plane"
              />
              <g transform={`matrix(1 .5 -1 .5 ${board.cx} ${layer.y})`}>
                <g
                  transform={`translate(${-contentCenters[index][0]} ${-contentCenters[index][1]})`}
                >
                  <BoardContents index={index} />
                </g>
              </g>
              <path
                d={`M${railX} ${layer.y}H${board.cx - board.halfWidth}M${board.cx + board.halfWidth} ${layer.y}H${labelX - 16}`}
                className="bs-machine-leader"
              />
              <circle
                cx={railX}
                cy={layer.y}
                r="3"
                className="bs-machine-node"
              />
              <circle
                cx={board.cx + board.halfWidth}
                cy={layer.y}
                r="3"
                className="bs-machine-node"
              />
              <text
                x={labelX}
                y={layer.y - 20}
                dominantBaseline="middle"
                className="bs-machine-label"
              >
                {layer.name}
              </text>
              <text
                x={labelX}
                y={layer.y}
                dominantBaseline="middle"
                className="bs-machine-path"
              >
                {layer.path}
              </text>
              <text
                x={labelX}
                y={layer.y + 20}
                dominantBaseline="middle"
                className="bs-machine-annotation"
                data-fault={index === 1 && stage === 1}
              >
                {index === 1 && stage === 1
                  ? "missing accountId"
                  : [
                      "React + Vite",
                      "Bun + Elysia + Drizzle",
                      "Postgres + Valkey",
                      "OpenTofu + cloud-init",
                    ][index]}
              </text>
              {layer.wire && (
                <text
                  x={railX - 36}
                  y={layer.y + board.pitch / 2}
                  dominantBaseline="middle"
                  textAnchor="end"
                  className="bs-machine-wire-label"
                >
                  {layer.wire}
                </text>
              )}
            </g>
          ))}
          <path
            d={`M${railX} ${stage === 0 ? layers[0].y : layers[1].y}V${stage === 0 ? layers[1].y : stage === 1 ? layers[1].y + board.pitch / 2 - 12 : layers[3].y}`}
            className="bs-machine-signal"
          />
          <g className="bs-machine-gate">
            <rect
              x={railX - 26}
              y={layers[1].y + board.pitch / 2 - 12}
              width="52"
              height="24"
              rx="3"
            />
            <text
              x={railX}
              y={layers[1].y + board.pitch / 2}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {stage === 1 ? "BLOCK" : stage === 0 ? "CHECK" : "SCOPED"}
            </text>
          </g>
          <text x="24" y="568" className="bs-machine-footnote">
            EXAMPLE: ACCOUNT-SCOPED QUERY VALIDATION
          </text>
          <text
            x="656"
            y="568"
            textAnchor="end"
            className="bs-machine-footnote"
          >
            ILLUSTRATION
          </text>
        </svg>
        <div className="bs-machine-layers" aria-label="Inspect a layer">
          {layers.map((layer, index) => (
            <button
              type="button"
              key={layer.path}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
              onMouseEnter={() => setSelected(index)}
              onFocus={() => setSelected(index)}
            >
              {String(index + 1).padStart(2, "0")} {layer.name}
            </button>
          ))}
        </div>
        <p className="bs-machine-layer-detail">{layers[selected].detail}</p>
        <div className="bs-machine-status">
          <div>
            <strong>{stages[stage].label}</strong>
            <p>{stages[stage].detail}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!playing && stage === 3) setStage(0);
              setPlaying(!playing);
            }}
            aria-label={
              playing
                ? "Pause animation"
                : stage === 3
                  ? "Replay animation"
                  : "Play animation"
            }
          >
            {playing ? "Ⅱ Pause" : stage === 3 ? "↻ Replay" : "▷ Play"}
          </button>
        </div>
        <div
          className="bs-machine-steps"
          aria-label="Inspect an animation step"
        >
          {stages.map((item, index) => (
            <button
              type="button"
              key={item.short}
              aria-pressed={stage === index}
              onClick={() => {
                setStage(index);
                setPlaying(false);
              }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item.short}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
