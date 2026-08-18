// Design tokens from PRD section 7.1. Single source of truth — also wired
// into frontend/tailwind.config.ts as theme extensions.

export const TOKENS = {
  void: '#06090D',
  panel: '#0E141C',
  line: '#1D2836',
  cyan: '#2FE6D2',
  violet: '#8B7CF6',
  amber: '#FFB454',
  magenta: '#FF4D6D',
  green: '#4ADE80',
  saffron: '#FF9933',
  indiaGreen: '#138808',
} as const;

export type TokenName = keyof typeof TOKENS;

export const STATUS_COLOR: Record<'working' | 'idle' | 'blocked' | 'done', string> = {
  working: TOKENS.cyan,
  idle: '#6B7686',
  blocked: TOKENS.magenta,
  done: TOKENS.green,
};

export const MESSAGE_COLOR: Record<'task' | 'handoff' | 'escalation' | 'report', string> = {
  task: TOKENS.violet,
  handoff: TOKENS.amber,
  escalation: TOKENS.magenta,
  report: TOKENS.green,
};
