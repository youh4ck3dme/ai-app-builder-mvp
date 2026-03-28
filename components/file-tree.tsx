import type { GeneratedFile } from '@/types/project';

type FileTreeProps = {
  files: GeneratedFile[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
};

export function FileTree({ files, selectedPath, onSelect }: FileTreeProps) {
  if (files.length === 0) {
    return <p className="muted">No generated files yet.</p>;
  }

  return (
    <div className="file-list">
      {files.map((file) => (
        <button
          key={file.path}
          type="button"
          className={`file-button ${selectedPath === file.path ? 'active' : ''}`}
          onClick={() => onSelect(file.path)}
        >
          <div>{file.path}</div>
          <div className="meta">{file.updatedAt}</div>
        </button>
      ))}
    </div>
  );
}
