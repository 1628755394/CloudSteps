import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none select-none transition-[transform,box-shadow,background-color,color,border-color,opacity] duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none active:scale-[0.98] hover:-translate-y-[1px] active:translate-y-0 hover:shadow-sm focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md",
        brand:
          "bg-[#4ECDC4] text-white hover:bg-[#45b8b0] shadow-sm hover:shadow-md focus-visible:ring-[#4ECDC4]/40",
        brandOutline:
          "border-2 border-[#4ECDC4] bg-transparent text-[#4ECDC4] hover:bg-[#4ECDC4]/8 shadow-sm hover:shadow-md focus-visible:ring-[#4ECDC4]/40",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 shadow-sm hover:shadow-md focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground shadow-sm hover:shadow-md dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm hover:shadow-md",
        ghost:
          "hover:bg-accent hover:text-accent-foreground shadow-none hover:shadow-none hover:translate-y-0 dark:hover:bg-accent/50",
        link:
          "text-primary underline-offset-4 hover:underline shadow-none hover:shadow-none hover:translate-y-0 active:scale-100",
        card:
          "h-auto w-full flex-col items-start gap-0 rounded-xl border border-slate-100 bg-white p-6 text-left shadow-sm hover:border-slate-200 hover:shadow-lg active:scale-[0.99] hover:-translate-y-0.5",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        pill: "h-9 rounded-full px-4 has-[>svg]:px-3",
        pillLg: "h-11 rounded-full px-6 text-sm",
        icon: "size-9 rounded-md",
        iconRound: "size-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
