import { getServiceRoleClient } from "./lib/supabase/service-role";

async function checkTable() {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("skipped_items")
    .select("count", { count: 'exact', head: true });
  
  if (error) {
    console.error("Table check failed:", error.message);
  } else {
    console.log("Table exists!");
  }
}

checkTable();
