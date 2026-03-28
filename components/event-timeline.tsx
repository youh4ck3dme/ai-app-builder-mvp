import type { ProjectEvent } from '@/types/project';

export function EventTimeline({ events }: { events: ProjectEvent[] }) {
  if (events.length === 0) {
    return <p className="muted">No timeline events yet.</p>;
  }

  const latestFirst = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="timeline">
      {latestFirst.map((event) => (
        <div key={event.id} className="timeline-item">
          <strong>{event.message}</strong>
          <div className="meta">
            {event.kind} · {new Date(event.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
