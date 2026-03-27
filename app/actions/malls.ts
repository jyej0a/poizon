"use server";

import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function getMallWhitelist() {
  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("mall_whitelist")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error("[getMallWhitelist] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function toggleMallActive(id: string, isActive: boolean) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("로그인이 필요합니다.");

    const supabase = getServiceRoleClient();
    const { error } = await supabase
      .from("mall_whitelist")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("[toggleMallActive] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function addMallToWhitelist(name: string) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("로그인이 필요합니다.");

    const supabase = getServiceRoleClient();
    const { error } = await supabase
      .from("mall_whitelist")
      .insert({ name, is_active: true });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("[addMallToWhitelist] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function removeMallFromWhitelist(id: string) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("로그인이 필요합니다.");

    const supabase = getServiceRoleClient();
    const { error } = await supabase
      .from("mall_whitelist")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("[removeMallFromWhitelist] Error:", error);
    return { success: false, error: error.message };
  }
}
