'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type CreateProjectResponse = {
  project: {
    id: string;
  };
};

export function CreateProjectForm() {
  const router = useRouter();
  const [userPrompt, setUserPrompt] = useState('Build a simple to-do app with a tiny API.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const createResponse = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userPrompt }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create project.');
      }

      const createPayload = (await createResponse.json()) as CreateProjectResponse;
      const projectId = createPayload.project.id;

      const generateResponse = await fetch(`/api/projects/${projectId}/generate`, {
        method: 'POST',
      });

      if (!generateResponse.ok) {
        throw new Error('Project was created, but generation failed to start.');
      }

      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unknown error.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="stack" onSubmit={handleCreateProject}>
      <label className="stack">
        <span className="label">What should the builder generate?</span>
        <textarea
          className="textarea"
          value={userPrompt}
          onChange={(event) => setUserPrompt(event.target.value)}
          placeholder="Build a simple to-do app with a landing page and an API route."
          required
        />
      </label>

      <div className="inline">
        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Launching workflow…' : 'Create project'}
        </button>
        <span className="muted">The dashboard will start polling for live progress.</span>
      </div>

      {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}
    </form>
  );
}
