"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { Check, Minus } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const checkboxVariants = cva(
  "peer inline-flex shrink-0 items-center justify-center rounded-[4px] border shadow-sm transition-colors outline-none cursor-pointer focus-visible:ring-[2px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-border bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary-foreground",
        skip: "border-border bg-background data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 data-[state=checked]:text-white data-[state=indeterminate]:bg-amber-500 data-[state=indeterminate]:border-amber-500 data-[state=indeterminate]:text-white",
      },
      size: {
        default: "h-4 w-4",
        sm: "h-3.5 w-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Checkbox({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> &
  VariantProps<typeof checkboxVariants>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(checkboxVariants({ variant, size }), className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        {props.checked === "indeterminate" ? (
          <Minus className="h-3 w-3" strokeWidth={3.5} />
        ) : (
          <Check className="h-3 w-3" strokeWidth={3.5} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
