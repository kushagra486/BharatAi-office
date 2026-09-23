import type { Agent, HiveMessage } from '@bharat-ai-office/shared';
import { messageEdgeCounts } from '@/lib/agentWork';
import { agentColorHex } from '@/lib/agentColor';

export interface AgentMeshGraphProps {
  agents: Agent[];
  messages: HiveMessage[];
}

const SIZE = 320;
const CENTER = SIZE / 2;
const RING_RADIUS = 118;
const NODE_RADIUS = 13;
const MAX_EDGE_WIDTH = 5;

/**
 * A plain inline SVG network graph (no charting/graph library — same
 * hand-rolled approach as TokenSparkline) of who has messaged whom: Nova
 * sits at the hub since she's the coordination center, the 10 employees
 * ring around her, and edge thickness is the message count between a pair.
 * Every node is always directly labeled with its name (not just colored) —
 * see AgentsWorkGraph for why that matters with this app's palette.
 */
export function AgentMeshGraph({ agents, messages }: AgentMeshGraphProps) {
  const nova = agents.find((a) => a.id === 'nova');
  const ring = agents.filter((a) => a.id !== 'nova');
  const edges = messageEdgeCounts(messages);
  const maxCount = Math.max(...edges.map((e) => e.count), 1);

  const positions = new Map<string, { x: number; y: number }>();
  if (nova) positions.set(nova.id, { x: CENTER, y: CENTER });
  ring.forEach((agent, i) => {
    const angle = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
    positions.set(agent.id, { x: CENTER + Math.cos(angle) * RING_RADIUS, y: CENTER + Math.sin(angle) * RING_RADIUS });
  });

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-elevated">
      <p className="text-[13px] font-semibold text-ink-faint">Mesh graph — who's talking to whom</p>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mt-2 w-full" role="img" aria-label="Agent communication mesh graph">
        {edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          const width = 1 + (edge.count / maxCount) * (MAX_EDGE_WIDTH - 1);
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#8B7CF6"
              strokeOpacity={0.35}
              strokeWidth={width}
              strokeLinecap="round"
            >
              <title>
                {edge.from} ↔ {edge.to}: {edge.count} message{edge.count === 1 ? '' : 's'}
              </title>
            </line>
          );
        })}
        {agents.map((agent) => {
          const pos = positions.get(agent.id);
          if (!pos) return null;
          const color = agentColorHex(agent.color);
          return (
            <g key={agent.id}>
              <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS} fill={color} stroke="#0E141C" strokeWidth={2}>
                <title>
                  {agent.name} — {agent.role}
                </title>
              </circle>
              <text
                x={pos.x}
                y={pos.y + NODE_RADIUS + 12}
                textAnchor="middle"
                className="font-mono"
                fontSize={10}
                fill="#8B96A5"
              >
                {agent.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
