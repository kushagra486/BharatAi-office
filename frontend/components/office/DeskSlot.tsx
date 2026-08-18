import type { Agent, TaskStatus } from '@bharat-ai-office/shared';
import { REVIEW_TABLE_POSITION } from '@bharat-ai-office/shared';
import { WalkerAvatar } from './WalkerAvatar';

export interface DeskSlotProps {
  agent: Agent;
  status: TaskStatus;
  walking: boolean;
  onSelect: () => void;
}

export function DeskSlot({ agent, status, walking, onSelect }: DeskSlotProps) {
  const left = walking ? REVIEW_TABLE_POSITION.x : agent.home_x;
  const top = walking ? REVIEW_TABLE_POSITION.y : agent.home_y;
  const flipped = walking && REVIEW_TABLE_POSITION.x < agent.home_x;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-[left,top] duration-[1400ms] ease-in-out"
      style={{ left: `${left}%`, top: `${top}%` }}
      aria-label={`${agent.name} — ${agent.role}`}
    >
      <WalkerAvatar agent={agent} status={status} flipped={flipped} />
      <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] uppercase tracking-wide text-[#6B7686] group-hover:text-cyan">
        {agent.name}
      </span>
    </button>
  );
}
