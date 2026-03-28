import type {
  GeneratedFile,
  PlannedFile,
  ProjectEvent,
  ProjectRecord,
  ProjectStatus,
} from '@/types/project';

type Store = {
  projects: Map<string, ProjectRecord>;
};

declare global {
  // eslint-disable-next-line no-var
  var __AI_APP_BUILDER_STORE__: Store | undefined;
}

function createStore(): Store {
  return {
    projects: new Map<string, ProjectRecord>(),
  };
}

function getStore(): Store {
  if (!globalThis.__AI_APP_BUILDER_STORE__) {
    globalThis.__AI_APP_BUILDER_STORE__ = createStore();
  }

  return globalThis.__AI_APP_BUILDER_STORE__;
}

function now(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value)) as T;
}

function sortFiles(files: GeneratedFile[]): GeneratedFile[] {
  return [...files].sort((a, b) => a.path.localeCompare(b.path));
}

export async function createProject(prompt: string): Promise<ProjectRecord> {
  const timestamp = now();
  const project: ProjectRecord = {
    id: crypto.randomUUID(),
    prompt,
    status: 'queued',
    createdAt: timestamp,
    updatedAt: timestamp,
    runId: undefined,
    error: null,
    plan: [],
    files: [],
    events: [
      {
        id: crypto.randomUUID(),
        kind: 'status',
        message: 'Project created and queued.',
        createdAt: timestamp,
      },
    ],
  };

  getStore().projects.set(project.id, project);
  return clone(project);
}

export async function listProjects(): Promise<ProjectRecord[]> {
  return [...getStore().projects.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(clone);
}

export async function getProject(projectId: string): Promise<ProjectRecord | null> {
  const project = getStore().projects.get(projectId);
  return project ? clone(project) : null;
}

export async function updateProject(
  projectId: string,
  patch: Partial<Omit<ProjectRecord, 'id' | 'createdAt' | 'events' | 'files' | 'plan'>>,
): Promise<ProjectRecord | null> {
  const store = getStore();
  const current = store.projects.get(projectId);

  if (!current) {
    return null;
  }

  const next: ProjectRecord = {
    ...current,
    ...patch,
    updatedAt: now(),
  };

  store.projects.set(projectId, next);
  return clone(next);
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
  const store = getStore();
  const current = store.projects.get(projectId);

  if (!current) {
    return null;
  }

  const next: ProjectRecord = {
    ...current,
    plan: [...plan],
    updatedAt: now(),
  };

  store.projects.set(projectId, next);
  return clone(next);
}

export async function saveGeneratedFile(
  projectId: string,
  file: GeneratedFile,
): Promise<ProjectRecord | null> {
  const store = getStore();
  const current = store.projects.get(projectId);

  if (!current) {
    return null;
  }

  const existing = current.files.findIndex((entry) => entry.path === file.path);
  const nextFiles = [...current.files];

  if (existing >= 0) {
    nextFiles[existing] = file;
  } else {
    nextFiles.push(file);
  }

  const next: ProjectRecord = {
    ...current,
    files: sortFiles(nextFiles),
    updatedAt: now(),
  };

  store.projects.set(projectId, next);
  return clone(next);
}

export async function appendProjectEvent(
  projectId: string,
  event: Omit<ProjectEvent, 'id' | 'createdAt'> &
    Partial<Pick<ProjectEvent, 'id' | 'createdAt'>>,
): Promise<ProjectRecord | null> {
  const store = getStore();
  const current = store.projects.get(projectId);

  if (!current) {
    return null;
  }

  const nextEvent: ProjectEvent = {
    id: event.id ?? crypto.randomUUID(),
    createdAt: event.createdAt ?? now(),
    kind: event.kind,
    message: event.message,
    meta: event.meta,
  };

  const next: ProjectRecord = {
    ...current,
    events: [...current.events, nextEvent],
    updatedAt: now(),
  };

  store.projects.set(projectId, next);
  return clone(next);
}
