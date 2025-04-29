import { cn } from "@/lib/utils";
import { Check, CircleAlert, Info, LoaderCircle, LucideProps, TriangleAlert } from "lucide-react";
import * as React from "react";

export type IconProps = Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>;

export const Loader: React.FC<IconProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <LoaderCircle {...componentProps} className={cn("!text-primary animate-spin", className)} />
  );
};

export const SuccessIcon: React.FC<IconProps> = (props) => {
  const { className, ...componentProps } = props;

  return <Check {...componentProps} className={cn("!text-success", className)} />;
};

export const ErrorIcon: React.FC<IconProps> = (props) => {
  const { className, ...componentProps } = props;

  return <CircleAlert {...componentProps} className={cn("!text-error", className)} />;
};

export const WarningIcon: React.FC<IconProps> = (props) => {
  const { className, ...componentProps } = props;

  return <TriangleAlert {...componentProps} className={cn("!text-warning", className)} />;
};

export const InfoIcon: React.FC<IconProps> = (props) => {
  const { className, ...componentProps } = props;

  return <Info {...componentProps} className={cn("!text-info", className)} />;
};
