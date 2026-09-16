import type { Agent, TaskStatus } from '@bharat-ai-office/shared';

type WalkerStatus = TaskStatus;

const TOKEN_HEX: Record<string, string> = {
  '--violet': '#8B7CF6',
  '--red': '#FF4D4D',
  '--orange': '#FF9433',
  '--gold': '#FFD23F',
  '--lime': '#A8E62E',
  '--emerald': '#2ECC71',
  '--cyan': '#2FE6D2',
  '--sky': '#38BDF8',
  '--blue': '#5B7FFF',
  '--pink': '#FF4FC3',
  '--rose': '#FF4D79',
  '--amber': '#FFB454',
  '--magenta': '#FF4D6D',
  '--green': '#4ADE80',
};

const STATUS_DOT_CLASS: Record<WalkerStatus, string> = {
  working: 'bg-cyan animate-pulse-dot',
  idle: 'bg-[#6B7686]',
  blocked: 'bg-magenta animate-pulse-dot',
  done: 'bg-green',
};

// Role-shaped tokens (PRD 7.2): hexagon = engineering, diamond = design,
// circle = data, rounded-square = ops, octagon = orchestrator. All shapes
// are drawn here as plain SVG polygons — original geometry, no imported
// tileset or sprite assets (PRD section 2).
function ShapePath({ shape }: { shape: Agent['shape'] }) {
  switch (shape) {
    case 'hex':
      return <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" />;
    case 'diamond':
      return <polygon points="16,1 31,16 16,31 1,16" />;
    case 'circle':
      return <circle cx={16} cy={16} r={14} />;
    case 'rounded-sq':
      return <rect x={3} y={3} width={26} height={26} rx={7} />;
    case 'octagon':
    default:
      return <polygon points="10,2 22,2 30,10 30,22 22,30 10,30 2,22 2,10" />;
  }
}

export interface WalkerAvatarProps {
  agent: Agent;
  status: WalkerStatus;
  flipped?: boolean;
}

export function WalkerAvatar({ agent, status, flipped = false }: WalkerAvatarProps) {
  const color = TOKEN_HEX[agent.color] ?? TOKEN_HEX['--cyan'];

  return (
    <div
      className="relative h-8 w-8 animate-idle-bob"
      style={{ transform: flipped ? 'scaleX(-1)' : undefined }}
    >
      <svg viewBox="0 0 32 32" className="h-8 w-8 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
        <g fill={color} stroke="#06090D" strokeWidth={1.5}>
          <ShapePath shape={agent.shape} />
        </g>
      </svg>
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-void ${STATUS_DOT_CLASS[status]}`}
        aria-label={`status: ${status}`}
      />
    </div>
  );
}
