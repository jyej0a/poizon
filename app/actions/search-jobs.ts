"use server";

import { getCurrentUserId } from "@/lib/auth/current-user";
import * as jobStore from "@/lib/search/job-store";
import type {
  SearchJob,
  SearchJobItemRecord,
  SearchJobOptions,
  SearchJobType,
} from "@/types/search-job";

export interface EnqueueSearchJobInput {
  type: SearchJobType;
  keyword: string;
  options?: SearchJobOptions;
}

/**
 * 검색을 큐에 등록하고 즉시 반환한다. 실제 수집은 워커가 수행하므로
 * 사용자가 화면을 닫아도 진행된다.
 */
export async function enqueueSearchJob(
  input: EnqueueSearchJobInput
): Promise<{ success: boolean; data?: SearchJob; error?: string }> {
  try {
    const keyword = input.keyword.trim();
    if (!keyword) return { success: false, error: "검색어를 입력해 주세요." };

    const { supabase, userId } = await getCurrentUserId();
    const job = await jobStore.createJob(supabase, userId, {
      type: input.type,
      keyword,
      options: input.options ?? {},
    });

    return { success: true, data: job };
  } catch (error: any) {
    console.error("[enqueueSearchJob] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function getSearchJobs(
  limit = 30
): Promise<{ success: boolean; data: SearchJob[]; error?: string }> {
  try {
    const { supabase, userId } = await getCurrentUserId();
    const jobs = await jobStore.listJobs(supabase, userId, limit);
    return { success: true, data: jobs };
  } catch (error: any) {
    console.error("[getSearchJobs] Error:", error);
    return { success: false, data: [], error: error.message };
  }
}

export async function getSearchJobDetail(jobId: string): Promise<{
  success: boolean;
  job?: SearchJob;
  items?: SearchJobItemRecord[];
  error?: string;
}> {
  try {
    const { supabase, userId } = await getCurrentUserId();

    const job = await jobStore.getJob(supabase, userId, jobId);
    if (!job) return { success: false, error: "잡을 찾을 수 없습니다." };

    const items = await jobStore.getJobItems(supabase, jobId);
    return { success: true, job, items };
  } catch (error: any) {
    console.error("[getSearchJobDetail] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function cancelSearchJob(
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, userId } = await getCurrentUserId();
    const cancelled = await jobStore.cancelJob(supabase, userId, jobId);
    if (!cancelled) return { success: false, error: "이미 종료된 잡입니다." };
    return { success: true };
  } catch (error: any) {
    console.error("[cancelSearchJob] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function retrySearchJob(
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, userId } = await getCurrentUserId();
    const requeued = await jobStore.retryJob(supabase, userId, jobId);
    if (!requeued) return { success: false, error: "잡을 찾을 수 없습니다." };
    return { success: true };
  } catch (error: any) {
    console.error("[retrySearchJob] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteSearchJob(
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, userId } = await getCurrentUserId();
    const deleted = await jobStore.deleteJob(supabase, userId, jobId);
    if (!deleted) return { success: false, error: "잡을 찾을 수 없습니다." };
    return { success: true };
  } catch (error: any) {
    console.error("[deleteSearchJob] Error:", error);
    return { success: false, error: error.message };
  }
}
