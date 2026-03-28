'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { EventTimeline } from '@/components/event-timeline';
import { FileTree } from '@/components/file-tree';
import { StatusBadge } from '@/components/status-badge';
import type { ProjectRecord } from '@/types/project';

type ProjectDashboardProps = {
  projectId: string;
};

const TERMINAL_STATUSES = new Set(['completed', 'failed']);

export function ProjectDashboard({ projectId }: ProjectDashboardProps) {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadProject() {
    const response = await fetch(`/api/projects/${projectId}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Failed to load project.');
    }

    const payload = (await response.json()) as { project: ProjectRecord };
    setProject(payload.project);
    setSelectedPath((current) => current ?? payload.project.files[0]?.path ?? null);
  }

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      try {
        await loadProject();
      } catch {
        if (!cancelled) {
          setProject(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void initialLoad();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!project || TERMINAL_STATUSES.has(project.status)) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadProject().catch(() => undefined);
    }, 1500);

    return () => window.clearInterval(timer);
  }, [project]);

  const selectedFile = useMemo(
    () => project?.files.find((file) => file.path === selectedPath) ?? project?.files[0] ?? null,
    [project, selectedPath],
  );

  if (isLoading) {
    return (
      <main>
        <div className="page-header">
          <span className="kicker">Loading</span>
          <h1>Fetching project…</h1>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main>
        <div className="page-header">
          <span className="kicker">Missing</span>
          <h1>Project not found</h1>
          <p>The mock store probably got wiped by a restart. Welcome to MVP life.</p>
          <Link className="button secondary" href="/">
            Back home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="page-header">
        <span className="kicker">Project dashboard</span>
        <h1>{project.prompt}</h1>
        <p>
          Run durable generation, watch file-by-file progress, and inspect the output before you
          wire in a real sandbox or deployment preview.
        </p>
        <div className="inline">
          <StatusBadge status={project.status} />
          {project.runId ? <span className="meta">runId: {project.runId}</span> : null}
          <Link className="button secondary" href="/">
            New project
          </Link>
        </div>
        {project.error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{project.error}</p> : null}
      </div>

      <section className="grid grid-2">
        <div className="stack">
          <div className="panel">
            <div className="inline" style={{ justifyContent: 'space-between' }}>
              <div>
                <h2>Generated files</h2>
                <p className="muted">Each file is saved independently, so earlier successes remain.</p>
              </div>
              <div className="meta">{project.files.length} files saved</div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '280px 1fr' }}>
              <FileTree
                files={project.files}
                selectedPath={selectedFile?.path ?? null}
                onSelect={setSelectedPath}
              />
              <div>
                {selectedFile ? (
                  <>
                    <div className="inline" style={{ justifyContent: 'space-between' }}>
                      <strong>{selectedFile.path}</strong>
                      <span className="meta">{selectedFile.updatedAt}</span>
                    </div>
                    <pre className="code-block">{selectedFile.code}</pre>
                  </>
                ) : (
                  <p className="muted">No file selected yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>Architecture plan</h2>
            {project.plan.length > 0 ? (
              <ul className="list">
                {project.plan.map((file) => (
                  <li key={file.path} className="project-link">
                    <strong>{file.path}</strong>
                    <span className="muted">{file.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Planning step has not finished yet.</p>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <h2>Run timeline</h2>
            <EventTimeline events={project.events} />
          </div>

          <div className="panel">
            <h2>Next upgrades</h2>
            <ul className="list">
              <li className="project-link">
                <strong>Preview sandbox</strong>
                <span className="muted">Push generated files into a runnable workspace.</span>
              </li>
              <li className="project-link">
                <strong>Repair loop</strong>
                <span className="muted">Feed build errors back into a fixer workflow.</span>
              </li>
              <li className="project-link">
                <strong>Persistent database</strong>
                <span className="muted">Replace the mock store with Postgres or a document DB.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
