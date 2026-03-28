import { NextResponse } from 'next/server';

import { fetchProject } from '@/lib/mock-services';

type ProjectRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, { params }: ProjectRouteProps) {
  const { id } = await params;
  const project = await fetchProject(id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  return NextResponse.json({ project });
}
