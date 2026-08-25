"use client";

import { Loader2, Save, X } from "lucide-react";

interface RowMemoPopoverProps {
  title: string;
  value: string;
  placeholder: string;
  saving?: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function RowMemoPopover({
  title,
  value,
  placeholder,
  saving,
  onChange,
  onClose,
  onSave,
}: RowMemoPopoverProps) {
  return (
    <div className="absolute left-2 top-full mt-1 z-[70] w-64 glass-panel border border-border rounded-lg p-2.5 text-left animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold text-foreground">{title}</span>
        <button type="button" onClick={onClose} className="text-muted-foreground/50 hover:text-foreground">
          <X size={13} />
        </button>
      </div>
      <textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-20 text-[11px] p-2 bg-secondary/20 border border-border/50 rounded-md outline-none focus:ring-1 focus:ring-primary/30 resize-none"
      />
      <div className="flex justify-end gap-1.5 mt-1.5">
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground rounded-md"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!!saving}
          className="px-2.5 py-1 text-[11px] font-bold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-1 disabled:opacity-40"
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
          저장
        </button>
      </div>
    </div>
  );
}
