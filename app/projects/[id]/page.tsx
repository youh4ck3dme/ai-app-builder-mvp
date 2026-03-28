import { ProjectDashboard } from '@/components/project-dashboard';

type ProjectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  return <ProjectDashboard projectId={id} />;
}
