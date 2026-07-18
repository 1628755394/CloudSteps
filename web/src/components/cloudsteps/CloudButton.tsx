import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button, buttonVariants } from "../ui/button";
import type { VariantProps } from "class-variance-authority";

export type CloudButtonProps = React.ComponentPropsWithoutRef<typeof Button> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    loadingText?: React.ReactNode;
  };

export const CloudButton = React.forwardRef<HTMLButtonElement, CloudButtonProps>(
  (
    {
      className,
      variant = "brand",
      size,
      type = "button",
      loading = false,
      loadingText,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <Button
        ref={ref}
        type={type}
        variant={variant}
        size={size}
        disabled={isDisabled}
        className={className}
        {...props}
      >
        {loading ? <Loader2 size={16} className="animate-spin shrink-0" aria-hidden="true" /> : null}
        {loading && loadingText ? loadingText : children}
      </Button>
    );
  },
);

CloudButton.displayName = "CloudButton";
