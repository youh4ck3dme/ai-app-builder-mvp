import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProject, fetchProjects } from '@/lib/mock-services';

const createProjectSchema = z.object({
  userPrompt: z.string().min(1).max(4_000),
});

export async function GET() {
  const projects = await fetchProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid payload.',
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const project = await createProject(parsed.data.userPrompt);

  return NextResponse.json(
    {
      project,
    },
    { status: 201 },
  );
}
