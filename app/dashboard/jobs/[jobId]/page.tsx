import { SearchBoard } from "@/components/dashboard/search-board";

export default async function SearchJobResultPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  return (
    <div className="flex flex-col h-full min-h-0">
      <SearchBoard variant="job" jobId={jobId} />
    </div>
  );
}
