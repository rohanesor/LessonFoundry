import type { Flowchart as FlowchartType } from "@/types";

export function FlowchartViewer({ data }: { data: FlowchartType }) {
  const nodeById = Object.fromEntries(data.nodes.map((n) => [n.id, n]));
  return (
    <div className="flowchart">
      <div className="flowchart-nodes">
        {data.nodes.map((n) => (
          <div key={n.id} className={`flow-node flow-node-${n.type}`}>
            <span className="flow-node-id">{n.id}</span>
            <span className="flow-node-label">{n.label}</span>
          </div>
        ))}
      </div>
      <svg
        className="flowchart-edges"
        viewBox={`0 0 ${data.nodes.length * 160} 60`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {data.edges.map((e, i) => {
          const sx = (data.nodes.findIndex((n) => n.id === e.source) + 0.5) * 160;
          const tx = (data.nodes.findIndex((n) => n.id === e.target) + 0.5) * 160;
          return (
            <g key={i}>
              <line x1={sx} y1={30} x2={tx} y2={30} />
              <polygon
                points={`${tx - 6},24 ${tx},30 ${tx - 6},36`}
                fill="currentColor"
              />
              <text x={(sx + tx) / 2} y={26} textAnchor="middle" fontSize="10">
                {e.relationship}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
