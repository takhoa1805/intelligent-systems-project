import { BrainCircuit, CheckCircle2 } from 'lucide-react';

export default function ModelStatus({ lab }) {
  const active = lab.models.find((model) => model.version === lab.active);
  return <section className="panel active-model-panel">
    <div className="panel-head"><div><span>RECOMMENDATION MODEL</span><h3>Active configuration</h3></div><span className="state-badge"><CheckCircle2 size={13} /> Active · preview</span></div>
    <div className="active-model-body"><div className="model-icon"><BrainCircuit /></div><div><h2>{active.version}</h2><p>Association rules + product embeddings</p></div></div>
    <dl className="model-details"><div><dt>Dataset version</dt><dd>{active.dataset}</dd></div><div><dt>Ranking strategy</dt><dd>Rules 60% · similarity 40%</dd></div><div><dt>Fallback</dt><dd>Popular available products</dd></div><div><dt>Serving mode</dt><dd>Hardcoded recommendation examples</dd></div></dl>
    <p className="quiet-note">Illustrative model metadata. Selection and activation are managed in the Data Science workspace.</p>
  </section>;
}
