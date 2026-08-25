"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyableArticleNumber({ articleNumber }: { articleNumber: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(articleNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1 group/copy">
      <span className="font-mono text-primary/70">{articleNumber}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="p-0.5 text-muted-foreground/30 opacity-0 group-hover/copy:opacity-100 hover:text-primary transition-all rounded hover:bg-primary/10"
        title="품번 복사"
        aria-label="품번 복사"
      >
        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
      </button>
    </div>
  );
}
