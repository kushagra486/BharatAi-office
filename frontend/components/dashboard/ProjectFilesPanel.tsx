'use client';

import { useState } from 'react';
import type { ProjectFile } from '@bharat-ai-office/shared';
import { formatRelativeTime } from '@/lib/format';
import { getProjectFileDownloadUrl } from '@/lib/daemonApi';

export interface ProjectFilesPanelProps {
  files: ProjectFile[];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "kael/index.html" -> { agentId: "kael", name: "index.html" } */
function splitPath(path: string): { agentId: string; name: string } {
  const slash = path.indexOf('/');
  return slash === -1 ? { agentId: '', name: path } : { agentId: path.slice(0, slash), name: path.slice(slash + 1) };
}

function FileRow({ file }: { file: ProjectFile }) {
  const [downloading, setDownloading] = useState(false);
  const { agentId, name } = splitPath(file.path);

  async function handleDownload() {
    setDownloading(true);
    try {
      const url = await getProjectFileDownloadUrl(file.path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('failed to get download URL for', file.path, err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-2 border-b border-line/60 py-1.5 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[12px] text-ink-muted">{name}</span>
        <span className="font-mono text-[10px] text-ink-faint">
          {agentId} · {formatSize(file.size)} · {formatRelativeTime(file.updatedAt)}
        </span>
      </span>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="shrink-0 rounded border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-cyan transition-colors hover:bg-line/30 disabled:opacity-50"
      >
        {downloading ? '…' : 'Download'}
      </button>
    </li>
  );
}

/**
 * Every file an agent has actually committed, mirrored from the worker's
 * git repo into Supabase Storage (upload-on-commit — see
 * AgentRunner.uploadChangedFiles). This is the deliverable, not just
 * status — the whole point of the project.
 */
export function ProjectFilesPanel({ files }: ProjectFilesPanelProps) {
  if (files.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-elevated">
        <p className="text-[13px] font-semibold text-ink-faint">Files</p>
        <p className="mt-2 text-sm text-ink-faint">
          No committed files yet — they appear here as agents finish tasks and commit their work.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-elevated">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink-faint">Files</p>
        <span className="font-mono text-[10px] text-ink-faint">{files.length}</span>
      </div>
      <ul className="mt-2 max-h-72 overflow-y-auto">
        {files.map((file) => (
          <FileRow key={file.path} file={file} />
        ))}
      </ul>
    </div>
  );
}
