import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const attachmentVariants = cva(
  "flex gap-3 rounded-lg border border-border bg-surface p-3 text-sm shadow-sm transition-colors",
  {
    variants: {
      orientation: {
        horizontal: "flex-row items-center",
        vertical: "flex-col",
      },
      state: {
        default: "",
        uploading: "border-dashed border-amber-300 bg-amber-50/50",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
      state: "default",
    },
  }
);

export interface AttachmentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof attachmentVariants> {}

const Attachment = React.forwardRef<HTMLDivElement, AttachmentProps>(
  ({ className, orientation, state, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(attachmentVariants({ orientation, state }), className)}
      {...props}
    />
  )
);
Attachment.displayName = "Attachment";

const AttachmentGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-3", className)}
    {...props}
  />
));
AttachmentGroup.displayName = "AttachmentGroup";

const attachmentMediaVariants = cva(
  "flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-canvas text-ink-muted",
  {
    variants: {
      variant: {
        default: "size-10",
        image: "size-16",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface AttachmentMediaProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof attachmentMediaVariants> {}

const AttachmentMedia = React.forwardRef<HTMLDivElement, AttachmentMediaProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(attachmentMediaVariants({ variant }), className)}
      {...props}
    />
  )
);
AttachmentMedia.displayName = "AttachmentMedia";

const AttachmentContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}
    {...props}
  />
));
AttachmentContent.displayName = "AttachmentContent";

const AttachmentTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("truncate font-medium text-ink", className)}
    {...props}
  />
));
AttachmentTitle.displayName = "AttachmentTitle";

const AttachmentDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-ink-muted", className)}
    {...props}
  />
));
AttachmentDescription.displayName = "AttachmentDescription";

const AttachmentActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-1", className)}
    {...props}
  />
));
AttachmentActions.displayName = "AttachmentActions";

export interface AttachmentActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const AttachmentAction = React.forwardRef<HTMLButtonElement, AttachmentActionProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
          className
        )}
        {...props}
      />
    );
  }
);
AttachmentAction.displayName = "AttachmentAction";

export {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
};
