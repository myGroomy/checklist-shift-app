import * as React from "react";

import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("size-5 animate-spin rounded-full border-2 border-ink-muted border-t-transparent", className)}
      {...props}
    />
  )
);
Spinner.displayName = "Spinner";

export { Spinner };
