import { SearchBoard } from "@/components/dashboard/search-board";

export default async function DiscoverJobResultPage({
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
        jobsListHref="/dashboard/discover"
        jobResultLabel="발굴 결과"
        initialView="profitable"
        initialSort={{ key: "profit", dir: "desc" }}
      />
    </div>
  );
}
