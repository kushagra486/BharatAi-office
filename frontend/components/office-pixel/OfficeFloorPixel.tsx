'use client';

import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import type { Agent, HiveMessage, Task, TaskStatus } from '@bharat-ai-office/shared';
import { agentStatus, tasksByAgentMap } from '@/lib/agentStatus';
import { loadOfficeAssets, type OfficeAssets } from './assets';
import { OfficeScene } from './pixiScene';
import { STAGE_H, STAGE_W } from './coords';

// Same contract as the old OfficeFloorProps (frontend/components/office/OfficeFloor.tsx)
// so app/page.tsx needs only an import swap, not a rewrite.
export interface OfficeFloorPixelProps {
  agents: Agent[];
  tasks: Task[];
  messages: HiveMessage[];
  onSelectAgent: (agentId: string) => void;
}

export function OfficeFloorPixel({ agents, tasks, messages, onSelectAgent }: OfficeFloorPixelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const assetsRef = useRef<OfficeAssets | null>(null);
  const sceneRef = useRef<OfficeScene | null>(null);
  const onSelectAgentRef = useRef(onSelectAgent);
  onSelectAgentRef.current = onSelectAgent;

  const [ready, setReady] = useState(false);

  // Mount: create the Pixi Application, load assets, wire responsive resize.
  // Guarded against React 18 StrictMode's mount->cleanup->mount double-invoke
  // via `cancelled` — Application.init() is async, so a fast unmount during
  // init must not leak a second canvas or double-init WebGL.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    // Only set once app.init() + asset loading have both fully resolved.
    // Pixi's plugin system (e.g. ResizePlugin) wires up instance state
    // during init() and assumes it's present during destroy() — calling
    // destroy() on an Application whose init() hasn't resolved yet throws
    // ("this._cancelResize is not a function"). React 18 StrictMode's
    // mount->cleanup->mount double-invoke can trigger cleanup while init()
    // is still in flight, so cleanup must defer to the branches below
    // rather than destroying `app` unconditionally.
    let initializedApp: Application | null = null;
    const app = new Application();

    (async () => {
      await app.init({
        width: STAGE_W,
        height: STAGE_H,
        background: 0xebe6d8,
        antialias: false,
        resolution: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
        autoDensity: true,
        roundPixels: true,
      });
      if (cancelled) {
        // init() itself completed, so destroying now is safe.
        app.destroy(true, { children: true, texture: true });
        return;
      }

      const assets = await loadOfficeAssets(app.renderer);
      if (cancelled) {
        app.destroy(true, { children: true, texture: true });
        return;
      }

      app.canvas.style.imageRendering = 'pixelated';
      container.appendChild(app.canvas);

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) return;
        app.renderer.resize(width, height);
        const scale = Math.min(width / STAGE_W, height / STAGE_H);
        app.stage.scale.set(scale);
        app.stage.position.set((width - STAGE_W * scale) / 2, (height - STAGE_H * scale) / 2);
      });
      resizeObserver.observe(container);

      appRef.current = app;
      assetsRef.current = assets;
      initializedApp = app;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      sceneRef.current?.destroy();
      sceneRef.current = null;
      appRef.current = null;
      assetsRef.current = null;
      if (initializedApp) {
        initializedApp.destroy(true, { children: true, texture: true });
      }
      // else: init/asset-loading is still in flight — the async function's
      // own `cancelled` branches above will destroy `app` once it's safe.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazily build the scene once assets are ready AND we have a real agent
  // roster (the socket snapshot may arrive after or before Pixi init
  // finishes — this effect re-runs on every `agents` change, so whichever
  // lands second triggers scene construction).
  const prevTaskStatus = useRef<Record<string, TaskStatus>>({});
  const seenMessageIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!ready || !appRef.current || !assetsRef.current) return;

    if (!sceneRef.current && agents.length > 0) {
      const scene = new OfficeScene(assetsRef.current, agents, (id) => onSelectAgentRef.current(id));
      scene.attachTicker(appRef.current.ticker);
      appRef.current.stage.addChild(scene.root);
      sceneRef.current = scene;
    }

    const scene = sceneRef.current;
    if (!scene) return;

    const tasksByAgent = tasksByAgentMap(tasks);
    for (const agent of agents) {
      scene.setAgentStatus(agent.id, agent.id === 'nova' ? 'idle' : agentStatus(agent.id, tasksByAgent));
    }

    // Walk-to-review-table on a real task -> 'done' transition, ported from
    // the old OfficeFloor.tsx's useEffect (not a timer).
    for (const task of tasks) {
      const prev = prevTaskStatus.current[task.id];
      if (prev && prev !== 'done' && task.status === 'done') {
        const agent = agents.find((a) => a.id === task.agent_id);
        if (agent) scene.walkAgentToReviewTable(agent.id, { x: agent.home_x, y: agent.home_y });
      }
      prevTaskStatus.current[task.id] = task.status;
    }

    // Envelope flights on message:new, ported from the old OfficeFloor.tsx.
    const fresh = messages.filter((m) => !seenMessageIds.current.has(m.id)).slice(0, 6);
    for (const m of fresh) {
      seenMessageIds.current.add(m.id);
      const from = agents.find((a) => a.id === m.from_agent);
      const to = agents.find((a) => a.id === m.to_agent);
      if (from && to) scene.spawnEnvelope({ x: from.home_x, y: from.home_y }, { x: to.home_x, y: to.home_y }, m.type);
    }
  }, [ready, agents, tasks, messages]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-line bg-panel"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
