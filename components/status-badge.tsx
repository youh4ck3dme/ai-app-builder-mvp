import type { ProjectStatus } from '@/types/project';

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`badge ${status}`}>{status.replace(/-/g, ' ')}</span>;
}
