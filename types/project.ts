export type ProjectStatus =
  | 'queued'
  | 'planning'
  | 'generating-code'
  | 'completed'
  | 'failed';

export type ProjectEventKind = 'run' | 'status' | 'plan' | 'file' | 'error';

export type PlannedFile = {
  path: string;
  description: string;
};

export type GeneratedFile = {
  path: string;
  code: string;
  description?: string;
  updatedAt: string;
};

export type ProjectEvent = {
  id: string;
  kind: ProjectEventKind;
  message: string;
  createdAt: string;
  meta?: Record<string, unknown>;
};

export type ProjectRecord = {
  id: string;
  prompt: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  runId?: string;
  error?: string | null;
  plan: PlannedFile[];
  files: GeneratedFile[];
  events: ProjectEvent[];
};
