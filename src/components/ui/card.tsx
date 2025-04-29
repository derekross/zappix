import { cn } from "@/lib/utils";
import * as React from "react";

export type CardProps = React.ComponentProps<"div">;

export const Card: React.FC<CardProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <div
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded border py-6 shadow-sm",
        className,
      )}
      data-slot="card"
      {...componentProps}
    />
  );
};

export const CardHeader: React.FC<CardProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <div
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      data-slot="card-header"
      {...componentProps}
    />
  );
};

export const CardTitle: React.FC<CardProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <div
      className={cn("leading-none font-semibold", className)}
      data-slot="card-title"
      {...componentProps}
    />
  );
};

export const CardDescription: React.FC<CardProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <div
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="card-description"
      {...componentProps}
    />
  );
};

export const CardAction: React.FC<CardProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <div
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      data-slot="card-action"
      {...componentProps}
    />
  );
};

export const CardContent: React.FC<CardProps> = (props) => {
  const { className, ...componentProps } = props;

  return <div className={cn("px-6", className)} data-slot="card-content" {...componentProps} />;
};

export const CardFooter: React.FC<CardProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <div
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      data-slot="card-footer"
      {...componentProps}
    />
  );
};
