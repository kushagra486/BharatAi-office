'use client';

import { useState } from 'react';
import type { Agent, TaskStatus } from '@bharat-ai-office/shared';
import { STATUS_COLOR } from '@bharat-ai-office/shared';
import { agentColorHex } from '@/lib/agentColor';

export interface AgentAvatarProps {
  agent: Agent;
  status: TaskStatus;
  size?: number;
}

/**
 * A real profile photo (frontend/public/office-pixel/portraits/<agentId>.png)
 * with a Slack-style presence dot overlaid at the corner. Falls back to an
 * initial-letter badge in the agent's identity color for any agent without a
 * portrait yet (currently just Nova — see ASSETS.md) rather than a broken
 * image icon.
 */
export function AgentAvatar({ agent, status, size = 32 }: AgentAvatarProps) {
  const [failed, setFailed] = useState(false);
  const color = agentColorHex(agent.color);
  const dotSize = Math.max(8, Math.round(size * 0.32));

  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {!failed ? (
        <img
          src={`/office-pixel/portraits/${agent.id}.png`}
          alt=""
          onError={() => setFailed(true)}
          className="h-full w-full rounded-full border object-cover"
          style={{ borderColor: color }}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full border font-mono font-semibold"
          style={{ borderColor: color, color, backgroundColor: `${color}22`, fontSize: size * 0.4 }}
        >
          {agent.name.slice(0, 1)}
        </span>
      )}
      <span
        className={`absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-panel ${
          status === 'working' || status === 'blocked' ? 'animate-pulse-dot' : ''
        }`}
        style={{ width: dotSize, height: dotSize, backgroundColor: STATUS_COLOR[status] }}
      />
    </span>
  );
}
