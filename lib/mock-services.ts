import { generateText } from 'ai';

import {
  appendProjectEvent,
  createProject as createProjectRecord,
  getProject,
  listProjects,
  saveArchitecturePlan as persistArchitecturePlan,
  saveGeneratedFile,
  setProjectError as persistProjectError,
  updateProject,
  updateProjectStatus as persistProjectStatus,
} from '@/lib/mock-db';
import type { PlannedFile, ProjectEventKind, ProjectRecord, ProjectStatus } from '@/types/project';

const DEFAULT_MODEL = process.env.AI_MODEL ?? 'openai/gpt-5.2';

function now(): string {
  return new Date().toISOString();
}

function normalizePrompt(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function extractLineValue(prompt: string, label: string): string | null {
  const pattern = new RegExp(`${label}:\\s*(.+)`);
  const match = prompt.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function buildFallbackPlan(userPrompt: string): PlannedFile[] {
  const normalized = userPrompt.toLowerCase();

  if (normalized.includes('todo') || normalized.includes('task')) {
    return [
      { path: 'app/layout.tsx', description: 'Root layout for the generated app.' },
      { path: 'app/page.tsx', description: 'Home page that renders the todo experience.' },
      { path: 'components/todo-app.tsx', description: 'Client component with task interactions.' },
      { path: 'app/api/todos/route.ts', description: 'Basic API route for listing and creating todos.' },
      { path: 'lib/todo-store.ts', description: 'Simple in-memory todo data store used by the API route.' },
      { path: 'types/todo.ts', description: 'Shared todo types.' },
    ];
  }

  return [
    { path: 'app/layout.tsx', description: 'Root layout for the generated app.' },
    { path: 'app/page.tsx', description: 'Main landing page tailored to the user prompt.' },
    { path: 'app/api/health/route.ts', description: 'Simple backend route proving the stack is alive.' },
      { path: 'components/app-shell.tsx', description: 'Client UI shell for the generated experience.' },
      { path: 'lib/app-config.ts', description: 'Shared config and starter content for the generated app.' },
  ];
}

function fallbackCodeForPath(path: string, userPrompt: string): string {
  const safePrompt = userPrompt.replace(/`/g, "'");
  const generatedAt = now();

  const templates: Record<string, string> = {
    'app/layout.tsx': `import type { Metadata } from 'next';\nimport './globals.css';\n\nexport const metadata: Metadata = {\n  title: 'Generated App',\n  description: ${JSON.stringify(`Generated from prompt: ${safePrompt}`)},\n};\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}\n`,
    'app/page.tsx': `import TodoApp from '@/components/todo-app';\n\nexport default function Page() {\n  return <TodoApp />;\n}\n`,
    'components/todo-app.tsx': `'use client';\n\nimport { useMemo, useState } from 'react';\n\nconst starterItems = [\n  { id: '1', title: 'Ship MVP', done: false },\n  { id: '2', title: 'Add preview sandbox', done: false },\n  { id: '3', title: 'Build repair loop', done: true },\n];\n\nexport default function TodoApp() {\n  const [items, setItems] = useState(starterItems);\n  const [title, setTitle] = useState('');\n\n  const remaining = useMemo(() => items.filter((item) => !item.done).length, [items]);\n\n  return (\n    <main style={{ maxWidth: 760, margin: '40px auto', padding: 24, fontFamily: 'sans-serif' }}>\n      <p style={{ opacity: 0.7 }}>Prompt</p>\n      <h1 style={{ marginTop: 0 }}>${safePrompt}</h1>\n      <p>Starter app generated for a simple full-stack MVP.</p>\n\n      <form\n        onSubmit={(event) => {\n          event.preventDefault();\n          if (!title.trim()) return;\n          setItems((current) => [...current, { id: crypto.randomUUID(), title: title.trim(), done: false }]);\n          setTitle('');\n        }}\n        style={{ display: 'flex', gap: 12, margin: '24px 0' }}\n      >\n        <input\n          value={title}\n          onChange={(event) => setTitle(event.target.value)}\n          placeholder=\"Add a task\"\n          style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #d4d4d8' }}\n        />\n        <button type=\"submit\" style={{ padding: '12px 18px', borderRadius: 12 }}>\n          Add\n        </button>\n      </form>\n\n      <div style={{ marginBottom: 16 }}>Remaining tasks: {remaining}</div>\n\n      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>\n        {items.map((item) => (\n          <li key={item.id} style={{ border: '1px solid #e4e4e7', borderRadius: 16, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>\n            <input\n              type=\"checkbox\"\n              checked={item.done}\n              onChange={() =>\n                setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry))\n              }\n            />\n            <span style={{ textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.6 : 1 }}>\n              {item.title}\n            </span>\n          </li>\n        ))}\n      </ul>\n    </main>\n  );\n}\n`,
    'app/api/todos/route.ts': `import { NextResponse } from 'next/server';\nimport { listTodos, createTodo } from '@/lib/todo-store';\n\nexport async function GET() {\n  return NextResponse.json({ items: listTodos() });\n}\n\nexport async function POST(request: Request) {\n  const body = await request.json().catch(() => ({}));\n  const todo = createTodo(String(body.title ?? 'New task'));\n  return NextResponse.json({ item: todo }, { status: 201 });\n}\n`,
    'lib/todo-store.ts': `import type { Todo } from '@/types/todo';\n\nconst todos: Todo[] = [\n  { id: '1', title: 'Start building', done: false },\n  { id: '2', title: 'Make it durable', done: true },\n];\n\nexport function listTodos(): Todo[] {\n  return todos;\n}\n\nexport function createTodo(title: string): Todo {\n  const todo: Todo = {\n    id: crypto.randomUUID(),\n    title,\n    done: false,\n  };\n\n  todos.push(todo);\n  return todo;\n}\n`,
    'types/todo.ts': `export type Todo = {\n  id: string;\n  title: string;\n  done: boolean;\n};\n`,
    'app/api/health/route.ts': `import { NextResponse } from 'next/server';\n\nexport async function GET() {\n  return NextResponse.json({ ok: true, generatedAt: ${JSON.stringify(generatedAt)} });\n}\n`,
    'components/app-shell.tsx': `'use client';\n\nexport default function AppShell() {\n  return (\n    <div style={{ maxWidth: 720, margin: '48px auto', fontFamily: 'sans-serif' }}>\n      <h1>Generated starter app</h1>\n      <p>This was generated from the prompt:</p>\n      <pre style={{ whiteSpace: 'pre-wrap' }}>${JSON.stringify(safePrompt)}</pre>\n    </div>\n  );\n}\n`,
    'lib/app-config.ts': `export const appConfig = {\n  title: 'Generated starter app',\n  prompt: ${JSON.stringify(safePrompt)},\n};\n`,
  };

  return templates[path] ?? `// Generated fallback file for ${path}\n// Prompt: ${safePrompt}\nexport {};\n`;
}

function fallbackLLM(prompt: string): string {
  const userPrompt = extractLineValue(prompt, 'User request') ?? 'Build a simple app';

  if (prompt.includes('Return ONLY a JSON array')) {
    return JSON.stringify(buildFallbackPlan(userPrompt), null, 2);
  }

  const path = extractLineValue(prompt, 'Current file path') ?? 'app/page.tsx';
  return fallbackCodeForPath(path, userPrompt);
}

export async function callLLM(prompt: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: DEFAULT_MODEL,
      prompt: normalizePrompt(prompt),
    });

    if (!text.trim()) {
      return fallbackLLM(prompt);
    }

    return text;
  } catch {
    return fallbackLLM(prompt);
  }
}

export async function createProject(userPrompt: string): Promise<ProjectRecord> {
  return createProjectRecord(userPrompt);
}

export async function fetchProject(projectId: string): Promise<ProjectRecord | null> {
  return getProject(projectId);
}

export async function fetchProjects(): Promise<ProjectRecord[]> {
  return listProjects();
}

export async function attachRunId(projectId: string, runId: string): Promise<void> {
  await updateProject(projectId, { runId });
  await appendProjectEvent(projectId, {
    kind: 'run',
    message: `Workflow run started: ${runId}`,
    meta: { runId },
  });
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus,
): Promise<void> {
  await persistProjectStatus(projectId, status);
  await appendProjectEvent(projectId, {
    kind: 'status',
    message: `Status changed to ${status}.`,
    meta: { status },
  });
}

export async function saveArchitecturePlan(
  projectId: string,
  plan: PlannedFile[],
): Promise<void> {
  await persistArchitecturePlan(projectId, plan);
  await appendProjectEvent(projectId, {
    kind: 'plan',
    message: `Architecture planned: ${plan.length} files.`,
    meta: { files: plan.map((file) => file.path) },
  });
}

export async function saveFile(
  projectId: string,
  path: string,
  code: string,
  description?: string,
): Promise<void> {
  await saveGeneratedFile(projectId, {
    path,
    code,
    description,
    updatedAt: now(),
  });

  await appendProjectEvent(projectId, {
    kind: 'file',
    message: `Saved ${path}.`,
    meta: { path },
  });
}

export async function setProjectError(projectId: string, message: string | null): Promise<void> {
  await persistProjectError(projectId, message);

  if (message) {
    await appendProjectEvent(projectId, {
      kind: 'error',
      message,
    });
  }
}

export async function appendEvent(
  projectId: string,
  kind: ProjectEventKind,
  message: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await appendProjectEvent(projectId, {
    kind,
    message,
    meta,
  });
}
