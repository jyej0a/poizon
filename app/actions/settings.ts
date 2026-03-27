"use server";

import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function savePoizonSettings(appKey: string, appSecret: string, accessToken?: string) {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new Error("로그인이 필요합니다.");
    }

    // 서버 액션 내부에서 안전하게 Service Role을 사용하여 토큰 이슈(No suitable key) 원천 차단
    const supabase = getServiceRoleClient();

    // 1. Clerk ID로 내부 테이블 users.id 획득
    let { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    // 동기화 실패 등의 이유로 유저가 없다면 즉시 강제로 생성(Sync)합니다.
    if (userError || !user) {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const { getServiceRoleClient } = await import("@/lib/supabase/service-role");
      
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userId);
      const serviceSupabase = getServiceRoleClient();
      
      const { data: newUser, error: syncError } = await serviceSupabase
        .from("users")
        .upsert(
          { 
            clerk_id: clerkUser.id, 
            name: clerkUser.fullName || clerkUser.emailAddresses[0]?.emailAddress || "Unknown" 
          },
          { onConflict: "clerk_id" }
        )
        .select("id")
        .single();
        
      if (syncError || !newUser) {
        throw new Error("서버에서 사용자 동기화를 강제 실행하는 중에 실패했습니다: " + syncError?.message);
      }
      user = newUser;
    }

    // 2. user_configs 테이블에 Upsert
    const { error: configError } = await supabase
      .from("user_configs")
      .upsert({
        user_id: user.id,
        poizon_app_key: appKey,
        poizon_app_secret: appSecret,
        ...(accessToken ? { poizon_access_token: accessToken } : {}),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (configError) {
      throw new Error("설정 저장에 실패했습니다. " + configError.message);
    }

    return { success: true };
  } catch (error: any) {
    console.error("[savePoizonSettings] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function getPoizonSettings() {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, data: null };

    const supabase = getServiceRoleClient();

    // clerk_id를 이용해 조인 후 조회하거나 간접 조회 (Server에서 직접 통제)
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (!user) return { success: false, data: null };

    const { data: config } = await supabase
      .from("user_configs")
      .select("poizon_app_key, poizon_app_secret, poizon_access_token")
      .eq("user_id", user.id)
      .single();

    return { success: true, data: config };
  } catch (error) {
    return { success: false, data: null };
  }
}

export async function getSystemSettings() {
  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("fee_percentage, min_fee, max_fee")
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("[getSystemSettings] Error:", error);
    return { success: true, data: { fee_percentage: 10, min_fee: 15000, max_fee: 45000 } };
  }
}

export async function updateSystemSettings(settings: { fee_percentage: number; min_fee: number; max_fee: number }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new Error("로그인이 필요합니다.");
    }

    const supabase = getServiceRoleClient();
    
    // system_settings는 단일 레코드만 존재하므로 첫 번째 레코드를 업데이트하거나 없으면 삽입합니다.
    const { data: existing } = await supabase.from("system_settings").select("id").limit(1).single();
    
    let result;
    if (existing) {
      result = await supabase
        .from("system_settings")
        .update({
          fee_percentage: settings.fee_percentage,
          min_fee: settings.min_fee,
          max_fee: settings.max_fee,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
    } else {
      result = await supabase
        .from("system_settings")
        .insert({
          fee_percentage: settings.fee_percentage,
          min_fee: settings.min_fee,
          max_fee: settings.max_fee
        });
    }

    if (result.error) throw result.error;
    return { success: true };
  } catch (error: any) {
    console.error("[updateSystemSettings] Error:", error);
    return { success: false, error: error.message };
  }
}
