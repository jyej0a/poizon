"use server";

import { mapWithConcurrency } from "@/lib/api/retry";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  clearSourceOfferCache,
  probeSourceMall,
  reorderSourceMalls,
  setSourceMallActive,
  syncSourceMalls,
  type SourceMallProbeResult,
} from "@/lib/sourcing/source-malls";
import type { SourceMallView } from "@/types/source-mall";

async function requireUser() {
  await getCurrentUserId();
}

export async function listSourceMalls(): Promise<{
  success: boolean;
  data?: SourceMallView[];
  error?: string;
}> {
  try {
    await requireUser();
    const data = await syncSourceMalls();
    return { success: true, data };
  } catch (error: unknown) {
    console.error("[listSourceMalls] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function toggleSourceMallActive(
  key: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireUser();
    await setSourceMallActive(key, isActive);
    return { success: true };
  } catch (error: unknown) {
    console.error("[toggleSourceMallActive] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function moveSourceMall(
  key: string,
  direction: "up" | "down"
): Promise<{ success: boolean; data?: SourceMallView[]; error?: string }> {
  try {
    await requireUser();
    await reorderSourceMalls(key, direction);
    const data = await syncSourceMalls();
    return { success: true, data };
  } catch (error: unknown) {
    console.error("[moveSourceMall] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function checkSourceMall(
  key: string,
  articleNumber: string
): Promise<{ success: boolean; data?: SourceMallProbeResult; error?: string }> {
  try {
    await requireUser();
    const data = await probeSourceMall(key, articleNumber);
    return { success: true, data };
  } catch (error: unknown) {
    console.error("[checkSourceMall] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function checkAllSourceMalls(
  articleNumber: string,
  keys: string[]
): Promise<{ success: boolean; data?: SourceMallProbeResult[]; error?: string }> {
  try {
    await requireUser();
    const data = await mapWithConcurrency(keys, 3, (key) => probeSourceMall(key, articleNumber));
    return { success: true, data };
  } catch (error: unknown) {
    console.error("[checkAllSourceMalls] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function purgeSourceOfferCache(): Promise<{
  success: boolean;
  deleted?: number;
  error?: string;
}> {
  try {
    await requireUser();
    const deleted = await clearSourceOfferCache();
    return { success: true, deleted };
  } catch (error: unknown) {
    console.error("[purgeSourceOfferCache] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
