import * as React from "react";
import { cn } from "@/lib/utils";

export type SkeletonProps = React.ComponentProps<"div">;

export const Skeleton: React.FC<SkeletonProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...componentProps}
    />
  );
};
