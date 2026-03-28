'use workflow';

// Global step function provided by the workflow environment
declare const step: any;

import {
  appendEvent,
  callLLM,
  saveArchitecturePlan,
  saveFile,
  setProjectError,
  updateProjectStatus,
} from '@/lib/mock-services';
import type { PlannedFile } from '@/types/project';

export type AppGeneratorWorkflowInput = {
  projectId: string;
  userPrompt: string;
};

export type AppGeneratorWorkflowResult = {
  projectId: string;
  generatedFiles: string[];
};

function buildArchitecturePrompt(userPrompt: string): string {
  return [
    'You are planning the file architecture for a new Next.js App Router application.',
    'Return ONLY a JSON array.',
    'Each item must match this shape:',
    '{ "path": "string", "description": "string" }',
    'Do not include markdown fences or any extra commentary.',
    'Keep the plan minimal but complete for a working starter app with frontend + backend when appropriate.',
    '',
    `User request: ${userPrompt}`,
  ].join('\n');
}

function buildFilePrompt(
  userPrompt: string,
  file: PlannedFile,
  architecture: readonly PlannedFile[],
): string {
  return [
    'You are generating one file for a Next.js App Router application.',
    'Return ONLY the file contents with no markdown fences and no explanation.',
    'Generate production-style starter code that is minimal, coherent, and consistent with the requested app.',
    '',
    `User request: ${userPrompt}`,
    `Current file path: ${file.path}`,
    `Current file purpose: ${file.description}`,
    '',
    'Full architecture plan:',
    JSON.stringify(architecture, null, 2),
  ].join('\n');
}

function stripCodeFences(value: string): string {
  const fencedMatch = value.match(/```(?:json|ts|tsx|js|jsx)?\s*([\s\S]*?)```/i);
  return fencedMatch?.[1]?.trim() ?? value.trim();
}

function isPlannedFile(value: unknown): value is PlannedFile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.path === 'string' &&
    candidate.path.trim().length > 0 &&
    typeof candidate.description === 'string' &&
    candidate.description.trim().length > 0
  );
}

function parseArchitecturePlan(raw: string): PlannedFile[] {
  const cleaned = stripCodeFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error(
      `generate-architecture returned invalid JSON: ${
        error instanceof Error ? error.message : 'Unknown parse error'
      }`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error('generate-architecture must return a JSON array of files.');
  }

  const uniqueFiles = new Map<string, PlannedFile>();

  for (const item of parsed) {
    if (!isPlannedFile(item)) {
      throw new Error(
        'generate-architecture returned an invalid file entry. Each entry must include non-empty "path" and "description" strings.',
      );
    }

    const normalized: PlannedFile = {
      path: item.path.trim(),
      description: item.description.trim(),
    };

    if (!uniqueFiles.has(normalized.path)) {
      uniqueFiles.set(normalized.path, normalized);
    }
  }

  const files = [...uniqueFiles.values()];

  if (files.length === 0) {
    throw new Error('generate-architecture returned an empty plan.');
  }

  return files;
}

function sanitizeStepSegment(value: string): string {
  const normalized = value
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/[\\/]+/g, '_')
    .replace(/-+/g, '-')
    .replace(/_+/g, '_')
    .replace(/^[-_]+|[-_]+$/g, '');

  return normalized.length > 0 ? normalized.slice(0, 100) : 'file';
}

function buildFileStepName(index: number, path: string): string {
  return `generate-file-${index + 1}-${sanitizeStepSegment(path)}`;
}

export async function appGeneratorWorkflow(
  input: AppGeneratorWorkflowInput,
): Promise<AppGeneratorWorkflowResult> {
  'use workflow';

  const { projectId, userPrompt } = input;

  try {
    await step('status-planning-started', async (): Promise<void> => {
      await setProjectError(projectId, null);
      await updateProjectStatus(projectId, 'planning');
      await appendEvent(projectId, 'status', 'Planning workflow started.');
    });

    const architecture = await step(
      'generate-architecture',
      { retry: { count: 3, delay: '10s' } },
      async (): Promise<PlannedFile[]> => {
        const response = await callLLM(buildArchitecturePrompt(userPrompt));
        const plan = parseArchitecturePlan(response);

        await saveArchitecturePlan(projectId, plan);
        await appendEvent(projectId, 'plan', 'Architecture plan saved.');

        return plan;
      },
    );

    await step('status-planning-done', async (): Promise<void> => {
      await updateProjectStatus(projectId, 'generating-code');
      await appendEvent(projectId, 'status', 'Planning finished. Code generation started.');
    });

    for (const [index, file] of architecture.entries()) {
      await step(
        buildFileStepName(index, file.path),
        { retry: { count: 3, delay: '10s' } },
        async (): Promise<void> => {
          await appendEvent(projectId, 'file', `Generating ${file.path}...`, {
            path: file.path,
          });

          const code = await callLLM(buildFilePrompt(userPrompt, file, architecture));

          await saveFile(projectId, file.path, stripCodeFences(code), file.description);
        },
      );
    }

    await step('status-completed', async (): Promise<void> => {
      await updateProjectStatus(projectId, 'completed');
      await appendEvent(projectId, 'status', 'Workflow completed successfully.');
    });

    return {
      projectId,
      generatedFiles: architecture.map((file: PlannedFile) => file.path),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown workflow error while generating the app.';

    await step('status-failed', async (): Promise<void> => {
      await setProjectError(projectId, message);
      await updateProjectStatus(projectId, 'failed');
      await appendEvent(projectId, 'error', 'Workflow failed after retries were exhausted.', {
        error: message,
      });
    });

    throw error;
  }
}
