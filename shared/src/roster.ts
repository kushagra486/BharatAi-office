import type { Agent } from './hive-types';

// The 11-seat roster (Nova + 10 employees) from PRD section 8.
// home_x / home_y are percentage coordinates (0-100) on the office floor,
// numerically aligned with the SVG wire-overlay viewBox (0 0 100 100).

// Each agent gets its own hue spread widely around the color wheel (see
// TOKEN_TINT in CharacterSprite.ts for the hex values) so all 11 are
// distinguishable by color alone, not just by badge shape — no two agents
// share a color the way the old 5-color palette forced several to.
export const ROSTER: Agent[] = [
  { id: 'nova', name: 'Nova', role: 'Orchestrator', dept: 'orchestrator', color: '--violet', shape: 'octagon', home_x: 50, home_y: 12 },
  { id: 'kael', name: 'Kael', role: 'Solutions Architect', dept: 'eng', color: '--red', shape: 'hex', home_x: 14, home_y: 30 },
  { id: 'priya', name: 'Priya', role: 'Backend Developer', dept: 'eng', color: '--orange', shape: 'hex', home_x: 30, home_y: 30 },
  { id: 'devraj', name: 'Devraj', role: 'Frontend Developer', dept: 'eng', color: '--gold', shape: 'hex', home_x: 46, home_y: 30 },
  { id: 'simran', name: 'Simran', role: 'UI/UX Designer', dept: 'design', color: '--lime', shape: 'diamond', home_x: 62, home_y: 30 },
  { id: 'arjun', name: 'Arjun', role: 'QA Engineer', dept: 'eng', color: '--emerald', shape: 'hex', home_x: 78, home_y: 30 },
  { id: 'meera', name: 'Meera', role: 'Data/Analytics', dept: 'data', color: '--cyan', shape: 'circle', home_x: 14, home_y: 62 },
  { id: 'raghav', name: 'Raghav', role: 'Security Reviewer', dept: 'eng', color: '--sky', shape: 'hex', home_x: 30, home_y: 62 },
  { id: 'tanya', name: 'Tanya', role: 'Technical Writer', dept: 'data', color: '--blue', shape: 'circle', home_x: 46, home_y: 62 },
  { id: 'farhan', name: 'Farhan', role: 'DevOps Engineer', dept: 'ops', color: '--pink', shape: 'rounded-sq', home_x: 62, home_y: 62 },
  { id: 'isha', name: 'Isha', role: 'Project Coordinator', dept: 'ops', color: '--rose', shape: 'rounded-sq', home_x: 78, home_y: 62 },
];

export const EMPLOYEE_ROSTER = ROSTER.filter((a) => a.id !== 'nova');

export const REVIEW_TABLE_POSITION = { x: 50, y: 46 };

export const ROLE_SCOPE: Record<string, string> = {
  kael: 'System design, database schema, and API contracts. Do not implement business logic yourself — hand designs to Priya and Devraj.',
  priya: 'Server implementation, endpoints, and business logic. Stay within the backend; do not touch UI code.',
  devraj: 'UI implementation from the design spec. Stay within the frontend; do not touch server/business logic.',
  simran: 'Design tokens, component states, and UX flows. Produce specs and assets, not production backend code.',
  arjun: 'Test plans, test execution, and bug reports. Do not fix bugs yourself — report them back to the owning employee via the Hive.',
  meera: 'Queries, metrics, and aggregation logic. Stay within data/analytics concerns.',
  raghav: 'Auth review and vulnerability flags. Review and report — do not silently patch code outside your own working directory.',
  tanya: 'Docs, READMEs, and onboarding guides. Do not modify application code.',
  farhan: 'CI/CD, deploy pipelines, and infra. Never force-push or run destructive operations directly — escalate instead.',
  isha: 'Task breakdown assistance, dependency mapping, and timeline tracking. Coordinate, do not implement.',
};
