import { PrismaClient } from '@prisma/client';
import type {
  GeneratedFile,
  PlannedFile,
  ProjectEvent,
  ProjectRecord,
  ProjectStatus,
} from '@/types/project';

// Prisma singleton
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Helpers to convert between Prisma and domain models
 */
function mapProject(dbProject: any): ProjectRecord {
  return {
    ...dbProject,
    createdAt: dbProject.createdAt.toISOString(),
    updatedAt: dbProject.updatedAt.toISOString(),
    plan: JSON.parse(dbProject.plan),
    files: JSON.parse(dbProject.files),
    events: dbProject.events?.map(mapEvent) || [],
  };
}

function mapEvent(dbEvent: any): ProjectEvent {
  return {
    id: dbEvent.id,
    kind: dbEvent.kind as any,
    message: dbEvent.message,
    metadata: dbEvent.metadata ? JSON.parse(dbEvent.metadata) : undefined,
    createdAt: dbEvent.createdAt.toISOString(),
  };
}

export async function createProject(prompt: string): Promise<ProjectRecord> {
  const project = await prisma.project.create({
    data: {
      prompt,
      status: 'queued',
      plan: '[]',
      files: '[]',
      events: {
        create: {
          kind: 'status',
          message: 'Project created and queued.',
        },
      },
    },
    include: {
      events: true,
    },
  });

  return mapProject(project);
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      events: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return projects.map(mapProject);
}

export async function getProject(projectId: string): Promise<ProjectRecord | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      events: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!project) return null;
  return mapProject(project);
}

export async function updateProject(
  projectId: string,
  patch: Partial<Omit<ProjectRecord, 'id' | 'createdAt' | 'events' | 'files' | 'plan'>>,
): Promise<ProjectRecord | null> {
  const project = await prisma.project.update({
    where: { id: projectId },
    data: patch as any,
    include: {
      events: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return mapProject(project);
}

export async function deleteProject(projectId: string): Promise<void> {
  await prisma.project.delete({
    where: { id: projectId },
  });
}

export async function appendProjectEvent(
  projectId: string,
  kind: ProjectEvent['kind'],
  message: string,
  metadata?: any,
): Promise<ProjectEvent> {
  const event = await prisma.event.create({
    data: {
      projectId,
      kind,
      message,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });

  return mapEvent(event);
}

export async function saveArchitecturePlan(
  projectId: string,
  plan: PlannedFile[],
): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: {
      plan: JSON.stringify(plan),
    },
  });
}

export async function saveGeneratedFile(
  projectId: string,
  path: string,
  content: string,
  description?: string,
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { files: true },
  });

  if (!project) return;

  const currentFiles: GeneratedFile[] = JSON.parse(project.files);
  const existingIndex = currentFiles.findIndex((f) => f.path === path);

  const newFile: GeneratedFile = {
    path,
    content,
    description,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    currentFiles[existingIndex] = newFile;
  } else {
    currentFiles.push(newFile);
  }

  // Sort files for consistent UI
  currentFiles.sort((a, b) => a.path.localeCompare(b.path));

  await prisma.project.update({
    where: { id: projectId },
    data: {
      files: JSON.stringify(currentFiles),
    },
  });
}

export async function attachRunId(projectId: string, runId: string): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { runId },
  });
}

export async function setProjectError(projectId: string, error: string | null): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { error },
  });
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { status },
  });
}
