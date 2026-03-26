import { ShieldCheck, ShoppingBag } from "lucide-react";
import { SettingsForm } from "@/components/dashboard/settings-form";

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage Poizon API keys, Naver filtering whitelist, and fee configurations.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Poizon API Card (Client Component) */}
        <SettingsForm />

        {/* Mall Whitelist Card */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <div className="p-2 bg-accent rounded-lg">
              <ShoppingBag className="text-accent-foreground h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Naver Mall Whitelist</h3>
              <p className="text-sm text-muted-foreground">Manage allowed malls for price comparison.</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 mb-4">
              {["G마켓", "롯데홈쇼핑", "11번가", "옥션", "쿠팡"].map((mall) => (
                <span key={mall} className="px-3 py-1 bg-secondary text-secondary-foreground text-sm rounded-full flex items-center gap-1 border">
                  {mall}
                  <button className="ml-1 text-muted-foreground hover:text-destructive transition-colors">×</button>
                </span>
              ))}
            </div>
            
            <div className="flex gap-2">
              <input type="text" placeholder="Add mall name..." className="flex-1 px-3 py-2 bg-secondary/50 border rounded-lg outline-none focus:border-primary transition-colors" />
              <button className="px-4 py-2 bg-secondary border hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors">Add</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
