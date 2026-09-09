import { useId, useState } from "react";
import { stackLayers } from "./landingContent";
import { SectionHeading } from "./LandingPrimitives";

export function StackFlowSection() {
  const [selected, setSelected] = useState(1);
  const panelId = useId();
  const layer = stackLayers[selected];
  return (
    <section className="bs-section" aria-labelledby="bs-compose-title">
      <SectionHeading
        id="bs-compose-title"
        eyebrow="02 / INSIDE THE STACK"
        title="One repo. All the moving parts."
        body="Explore the layers. Auth, billing, queues, and deploys are already connected, with explicit contracts between them."
      />
      <div className="bs-repo">
        <div className="bs-panel-bar">
          <span>
            <span className="bs-status-dot" /> BORINGSTACK / REPOSITORY
          </span>
          <span>FOUR LAYERS. ONE SYSTEM.</span>
        </div>
        <div className="bs-repo-workspace">
          <div className="bs-repo-tree" aria-label="Explore repository layers">
            <div className="bs-repo-root">⌂ boringstack/</div>
            {stackLayers.map((item, index) => (
              <button
                key={item.path}
                type="button"
                aria-pressed={selected === index}
                aria-controls={panelId}
                onClick={() => setSelected(index)}
              >
                <span className="bs-tree-branch" aria-hidden="true">
                  {index === 3 ? "└" : "├"}─
                </span>
                <span>
                  <strong>{item.path}/</strong>
                  <small>{item.name}</small>
                </span>
                <span className="bs-tree-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            ))}
            <a className="bs-repo-manifest" href="/scaffold-manifest.json">
              <span aria-hidden="true">{"{ }"}</span> scaffold-manifest.json ↗
            </a>
            <p>
              Configuration is part of the contract. Your agent can read it,
              too.
            </p>
          </div>
          <div
            className="bs-repo-detail"
            id={panelId}
            role="region"
            aria-label={`${layer.name} layer`}
          >
            <div className="bs-repo-meta">
              <span>LAYER / {layer.symbol}</span>
              <span>{layer.technology}</span>
            </div>
            <h3>{layer.title}</h3>
            <p className="bs-repo-description">{layer.description}</p>
            <div className="bs-layer-features">
              {layer.features.map(([title, detail]) => (
                <div key={title}>
                  <span aria-hidden="true">+</span>
                  <div>
                    <h4>{title}</h4>
                    <p>{detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bs-layer-route" aria-label="Layer connection">
              {layer.connection.map((name, index) => (
                <span key={name}>
                  {index > 0 && <i aria-hidden="true">→</i>}
                  {name}
                </span>
              ))}
            </div>
            <a className="bs-text-link" href={layer.href}>
              Explore {layer.path} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
