"use client";

import { cn } from "@/lib/utils";

interface MetricLineProps {
  label: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  ariaLabel?: string;
}

export function MetricLine({
  label,
  children,
  className,
  onClick,
  title,
  ariaLabel,
}: MetricLineProps) {
  const inner = (
    <>
      <span className="text-[8px] font-semibold text-muted-foreground/50 w-7 shrink-0 text-right">
        {label}
      </span>
      <span className="min-w-0">{children}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
        className={cn("inline-flex items-center justify-center gap-1 hover:underline", className)}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={cn("inline-flex items-center justify-center gap-1", className)} title={title}>
      {inner}
    </div>
  );
}

export function StackedMetricCell({
  ariaLabel,
  children,
}: {
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center leading-none gap-0.5"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
