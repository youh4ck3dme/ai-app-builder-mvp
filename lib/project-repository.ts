import { Prisma, ProjectStatus as PrismaProjectStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type {
  GeneratedFile,
  PlannedFile,
  ProjectEvent,
  ProjectRecord,
  ProjectStatus,
} from '@/types/project';


function toPrismaStatus(status: ProjectStatus): PrismaProjectStatus {
  return status === 'generating-code' ? 'generating_code' : status;
}

function fromPrismaStatus(status: PrismaProjectStatus): ProjectStatus {
  return status === 'generating_code' ? 'generating-code' : status;
}

type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: {
    plan: true;
    files: true;
    events: {
      orderBy: {
        createdAt: 'asc';
      };
    };
  };
}>;

function toProjectRecord(project: ProjectWithRelations): ProjectRecord {
  return {
    id: project.id,
    prompt: project.prompt,
    status: fromPrismaStatus(project.status),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    runId: project.runId ?? undefined,
    error: project.error,
    plan: project.plan
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((item) => ({
        path: item.path,
        description: item.description,
      })),
    files: project.files
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => ({
        path: file.path,
        code: file.code,
        description: file.description ?? undefined,
        updatedAt: file.updatedAt.toISOString(),
      })),
    events: project.events.map((event) => ({
      id: event.id,
      kind: event.kind as ProjectEvent['kind'],
      message: event.message,
      createdAt: event.createdAt.toISOString(),
      meta: (event.meta as Record<string, unknown> | null) ?? undefined,
    })),
  };
}

async function fetchProjectWithRelations(projectId: string): Promise<ProjectWithRelations | null> {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      plan: true,
      files: true,
      events: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });
}

export async function createProject(prompt: string): Promise<ProjectRecord> {
  const project = await prisma.project.create({
    data: {
      prompt,
      status: toPrismaStatus('queued'),
      events: {
        create: {
          kind: 'status',
          message: 'Project created and queued.',
        },
      },
    },
    include: {
      plan: true,
      files: true,
      events: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  return toProjectRecord(project);
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const projects = await prisma.project.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      plan: true,
      files: true,
      events: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  return projects.map(toProjectRecord);
}

export async function getProject(projectId: string): Promise<ProjectRecord | null> {
  const project = await fetchProjectWithRelations(projectId);
  return project ? toProjectRecord(project) : null;
}

export async function updateProject(
  projectId: string,
  patch: Partial<Omit<ProjectRecord, 'id' | 'createdAt' | 'events' | 'files' | 'plan'>>,
): Promise<ProjectRecord | null> {
  const updated = await prisma.project.updateMany({
    where: { id: projectId },
    data: {
      prompt: patch.prompt,
      status: patch.status ? toPrismaStatus(patch.status) : undefined,
      runId: patch.runId,
      error: patch.error,
    },
  });

  if (updated.count === 0) {
    return null;
  }

  return getProject(projectId);
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus,
): Promise<ProjectRecord | null> {
  return updateProject(projectId, { status });
}

export async function setProjectError(
  projectId: string,
  error: string | null,
): Promise<ProjectRecord | null> {
  return updateProject(projectId, { error });
}

export async function saveArchitecturePlan(
  projectId: string,
  plan: PlannedFile[],
): Promise<ProjectRecord | null> {
  const exists = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!exists) {
    return null;
  }

  await prisma.$transaction([
    prisma.plannedFile.deleteMany({ where: { projectId } }),
    prisma.plannedFile.createMany({
      data: plan.map((file) => ({
        projectId,
        path: file.path,
        description: file.description,
      })),
    }),
  ]);

  await prisma.project.update({
    where: { id: projectId },
    data: { updatedAt: new Date() },
  });

  return getProject(projectId);
}

export async function saveGeneratedFile(
  projectId: string,
  file: GeneratedFile,
): Promise<ProjectRecord | null> {
  const upserted = await prisma.generatedFile.upsert({
    where: {
      projectId_path: {
        projectId,
        path: file.path,
      },
    },
    create: {
      projectId,
      path: file.path,
      code: file.code,
      description: file.description ?? null,
      updatedAt: new Date(file.updatedAt),
    },
    update: {
      code: file.code,
      description: file.description ?? null,
      updatedAt: new Date(file.updatedAt),
    },
    select: {
      projectId: true,
    },
  }).catch((error: unknown) => {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return null;
    }

    throw error;
  });

  if (!upserted) {
    return null;
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { updatedAt: new Date() },
  });

  return getProject(projectId);
}

export async function appendProjectEvent(
  projectId: string,
  event: Omit<ProjectEvent, 'id' | 'createdAt'> &
    Partial<Pick<ProjectEvent, 'id' | 'createdAt'>>,
): Promise<ProjectRecord | null> {
  const created = await prisma.projectEvent.create({
    data: {
      id: event.id,
      projectId,
      kind: event.kind,
      message: event.message,
      createdAt: event.createdAt ? new Date(event.createdAt) : undefined,
      meta: event.meta as Prisma.InputJsonValue | undefined,
    },
    select: {
      projectId: true,
    },
  }).catch((error: unknown) => {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return null;
    }

    throw error;
  });

  if (!created) {
    return null;
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { updatedAt: new Date() },
  });

  return getProject(projectId);
}
