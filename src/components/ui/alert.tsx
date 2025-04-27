import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        error:
          "text-error bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-error/90",
      },
    },
  },
);

export type AlertProps = React.ComponentProps<"div"> & VariantProps<typeof alertVariants>;

export const Alert: React.FC<AlertProps> = (props) => {
  const { className, variant, ...componentProps } = props;

  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      data-slot="alert"
      role="alert"
      {...componentProps}
    />
  );
};

export type AlertTitleProps = React.ComponentProps<"div">;

export const AlertTitle: React.FC<AlertTitleProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <div
      className={cn("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", className)}
      data-slot="alert-title"
      {...componentProps}
    />
  );
};

export type AlertDescriptionProps = React.ComponentProps<"div">;

export const AlertDescription: React.FC<AlertDescriptionProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <div
      className={cn(
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
        className,
      )}
      data-slot="alert-description"
      {...componentProps}
    />
  );
};
