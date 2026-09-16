'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Agent, HiveMessage, Task, TaskStatus } from '@bharat-ai-office/shared';
import { agentStatus, tasksByAgentMap } from '@/lib/agentStatus';
import { loadOffice3DAssets, type Office3DAssets } from './assets3d';
import { OfficeScene3D } from './OfficeScene3D';

// Same shape as the retired 2D floor's props so app/page.tsx only needed an import swap.
export interface OfficeFloor3DProps {
  agents: Agent[];
  tasks: Task[];
  messages: HiveMessage[];
  onSelectAgent: (agentId: string) => void;
}

export function OfficeFloor3D({ agents, tasks, messages, onSelectAgent }: OfficeFloor3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const assetsRef = useRef<Office3DAssets | null>(null);
  const sceneRef = useRef<OfficeScene3D | null>(null);
  const onSelectAgentRef = useRef(onSelectAgent);
  onSelectAgentRef.current = onSelectAgent;

  const [ready, setReady] = useState(false);

  // Mount: create the renderer, load assets, wire responsive resize + the
  // render loop. Guarded against React 18 StrictMode's mount->cleanup->mount
  // double-invoke via `cancelled`, same pattern as OfficeFloorPixel.tsx.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let frameId = 0;
    let renderer: THREE.WebGLRenderer | null = null;

    (async () => {
      const assets = await loadOffice3DAssets();
      if (cancelled) return;

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      rendererRef.current = renderer;
      assetsRef.current = assets;

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0 || !renderer) return;
        renderer.setSize(width, height);
        sceneRef.current?.setAspect(width, height);
      });
      resizeObserver.observe(container);

      const clock = new THREE.Clock();
      const loop = () => {
        const deltaMS = clock.getDelta() * 1000;
        const scene = sceneRef.current;
        if (scene && renderer) {
          scene.tick(deltaMS);
          renderer.render(scene.scene, scene.camera);
        }
        frameId = requestAnimationFrame(loop);
      };
      frameId = requestAnimationFrame(loop);

      setReady(true);
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      cancelAnimationFrame(frameId);
      sceneRef.current?.destroy();
      sceneRef.current = null;
      assetsRef.current = null;
      renderer?.dispose();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazily build the scene once assets are ready AND we have a real agent
  // roster — mirrors OfficeFloorPixel.tsx's effect exactly (same event
  // sources: task done -> walk to review table, message:new -> envelope).
  const prevTaskStatus = useRef<Record<string, TaskStatus>>({});
  const seenMessageIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!ready || !rendererRef.current || !assetsRef.current || !canvasRef.current) return;

    if (!sceneRef.current && agents.length > 0) {
      const scene = new OfficeScene3D(assetsRef.current, agents, (id) => onSelectAgentRef.current(id), canvasRef.current);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) scene.setAspect(rect.width, rect.height);
      sceneRef.current = scene;
    }

    const scene = sceneRef.current;
    if (!scene) return;

    const tasksByAgent = tasksByAgentMap(tasks);
    for (const agent of agents) {
      scene.setAgentStatus(agent.id, agent.id === 'nova' ? 'idle' : agentStatus(agent.id, tasksByAgent));
    }

    for (const task of tasks) {
      const prev = prevTaskStatus.current[task.id];
      if (prev && prev !== 'done' && task.status === 'done') {
        const agent = agents.find((a) => a.id === task.agent_id);
        if (agent) scene.walkAgentToReviewTable(agent.id, { x: agent.home_x, y: agent.home_y });
      }
      prevTaskStatus.current[task.id] = task.status;
    }

    const fresh = messages.filter((m) => !seenMessageIds.current.has(m.id)).slice(0, 6);
    for (const m of fresh) {
      seenMessageIds.current.add(m.id);
      const from = agents.find((a) => a.id === m.from_agent);
      const to = agents.find((a) => a.id === m.to_agent);
      if (from && to) scene.spawnEnvelope({ x: from.home_x, y: from.home_y }, { x: to.home_x, y: to.home_y }, m.type);
    }
  }, [ready, agents, tasks, messages]);

  return (
    <div ref={containerRef} className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-line bg-panel">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
