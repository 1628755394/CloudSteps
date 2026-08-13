import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium outline-none select-none transition-[transform,background-color,color,border-color,opacity,box-shadow] duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-primary/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-deep",
        brand:
          "bg-primary text-primary-foreground hover:bg-primary-deep focus-visible:ring-primary/40",
        brandOutline:
          "border border-primary bg-transparent text-primary hover:bg-primary-soft focus-visible:ring-primary/40",
        /** 训练流程选词/高亮：固定薄荷绿，不跟随主题色 */
        mint:
          "bg-[#4ECDC4] text-white hover:bg-[#3DB8B0] focus-visible:ring-[#4ECDC4]/40",
        mintOutline:
          "border border-[#4ECDC4] bg-transparent text-[#4ECDC4] hover:bg-[#4ECDC4]/10 focus-visible:ring-[#4ECDC4]/40",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-input bg-card text-charcoal hover:bg-muted dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        card:
          "h-auto w-full flex-col items-start gap-0 rounded-xl border border-border bg-card p-6 text-left shadow-[var(--shadow-rest)] hover:border-primary active:scale-[0.99]",
        ghost:
          "hover:bg-muted hover:text-foreground shadow-none",
        link:
          "text-primary underline-offset-4 hover:underline shadow-none active:scale-100 h-auto",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-10 rounded-[10px] px-6 has-[>svg]:px-4",
        pill: "h-9 rounded-full px-4 has-[>svg]:px-3",
        pillLg: "h-11 rounded-full px-6 text-sm",
        icon: "size-9 rounded-lg",
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
