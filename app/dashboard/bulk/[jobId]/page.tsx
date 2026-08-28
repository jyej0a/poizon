import { SearchBoard } from "@/components/dashboard/search-board";

export const dynamic = "force-dynamic";

export default async function BulkJobResultPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  return (
    <div className="flex flex-col h-full min-h-0">
      <SearchBoard
        variant="job"
        jobId={jobId}
        jobsListHref="/dashboard/bulk"
        jobResultLabel="대량 조회 결과"
      />
    </div>
  );
}
