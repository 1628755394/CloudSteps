"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      richColors
      closeButton
      duration={3500}
      className="toaster group"
      style={
        {
          "--normal-bg": "#ffffff",
          "--normal-text": "#2D3748",
          "--normal-border": "#E2E8F0",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
