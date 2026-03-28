import Link from 'next/link';

import { CreateProjectForm } from '@/components/create-project-form';
import { StatusBadge } from '@/components/status-badge';
import { fetchProjects } from '@/lib/mock-services';

export default async function HomePage() {
  const projects = await fetchProjects();

  return (
    <main>
      <div className="page-header">
        <span className="kicker">AI builder MVP</span>
        <h1>Generate small full-stack apps with a durable workflow.</h1>
        <p>
          This is your launchpad for a live app builder: plan files, generate code file-by-file,
          persist progress, and keep the UX honest while the machine cooks.
        </p>
      </div>

      <section className="grid grid-2">
        <div className="panel">
          <h2>Create a new build</h2>
          <p className="muted">
            Example prompts: “Build a simple to-do app”, “Create a notes app with an API”, or
            “Make a tiny CRM starter”.
          </p>
          <CreateProjectForm />
        </div>

        <div className="panel">
          <div className="inline" style={{ justifyContent: 'space-between' }}>
            <h2>Recent projects</h2>
            <span className="meta">{projects.length} total</span>
          </div>

          {projects.length > 0 ? (
            <ul className="list">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link href={`/projects/${project.id}`} className="project-link">
                    <div className="inline" style={{ justifyContent: 'space-between' }}>
                      <strong>{project.prompt}</strong>
                      <StatusBadge status={project.status} />
                    </div>
                    <span className="meta">
                      {project.files.length} files · created {new Date(project.createdAt).toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No projects yet. Time to wake the robot up.</p>
          )}
        </div>
      </section>
    </main>
  );
}
