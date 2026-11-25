import { factoryRows } from "./landingContent";
import { SectionHeading } from "./LandingPrimitives";

export function FactorySection() {
  return (
    <section className="bs-section" aria-labelledby="bs-factory-title">
      <SectionHeading
        id="bs-factory-title"
        eyebrow="01 / THE FACTORY"
        title="An agent builds the issue. A person still merges."
        body="bun run factory works one issue at a time, in its own stack. Nothing counts as done until the verify gate passes at the current commit. The table shows what runs where, what is switched on in a fresh clone, and what stays with a person."
      />
      <div className="bs-factory-table-wrap">
        <table className="bs-factory-table">
          <caption className="sr-only">
            What runs in the software factory and around it
          </caption>
          <thead>
            <tr>
              <th scope="col">What runs</th>
              <th scope="col">Where</th>
              <th scope="col">In a fresh clone</th>
              <th scope="col">A person still decides</th>
            </tr>
          </thead>
          <tbody>
            {factoryRows.map((row) => (
              <tr key={row.what}>
                <th scope="row" data-label="What runs">
                  {row.what}
                </th>
                <td data-label="Where">{row.where}</td>
                <td data-label="In a fresh clone">{row.state}</td>
                <td data-label="A person still decides">{row.person}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bs-factory-links">
        <a className="bs-text-link" href="/factory/">
          Read the factory guide <span aria-hidden="true">↗</span>
        </a>
        <a className="bs-text-link" href="/factory/remote-agents/">
          Run agents in the cloud or from a phone{" "}
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}
