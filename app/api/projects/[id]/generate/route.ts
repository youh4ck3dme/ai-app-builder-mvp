import { NextResponse } from 'next/server';
import { start } from '@workflow/core/runtime';

import { attachRunId, fetchProject, setProjectError } from '@/lib/mock-services';
import { appGeneratorWorkflow } from '@/lib/workflows/app-generator';

type GenerateRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const ACTIVE_STATUSES = new Set(['planning', 'generating-code']);

export async function POST(_: Request, { params }: GenerateRouteProps) {
  const { id } = await params;
  const project = await fetchProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (ACTIVE_STATUSES.has(project.status)) {
    return NextResponse.json(
      { error: 'Generation is already running for this project.' },
      { status: 409 },
    );
  }

  await setProjectError(id, null);

  try {
    const run = await start(appGeneratorWorkflow, [
      {
        projectId: project.id,
        userPrompt: project.prompt,
      },
    ]);

    await attachRunId(project.id, run.runId);

    return NextResponse.json({
      ok: true,
      runId: run.runId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to start the workflow run right now.';

    await setProjectError(project.id, message);

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
