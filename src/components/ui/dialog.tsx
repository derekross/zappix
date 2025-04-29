import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import * as React from "react";

export type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root>;

export const Dialog: React.FC<DialogProps> = (props) => {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
};

export type DialogTriggerProps = React.ComponentProps<typeof DialogPrimitive.Trigger>;

export const DialogTrigger: React.FC<DialogTriggerProps> = (props) => {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
};

export type DialogPortalProps = React.ComponentProps<typeof DialogPrimitive.Portal>;

export const DialogPortal: React.FC<DialogPortalProps> = (props) => {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
};

export type DialogCloseProps = React.ComponentProps<typeof DialogPrimitive.Close>;

export const DialogClose: React.FC<DialogCloseProps> = (props) => {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
};

export type DialogOverlayProps = React.ComponentProps<typeof DialogPrimitive.Overlay>;

export const DialogOverlay: React.FC<DialogOverlayProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <DialogPrimitive.Overlay
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      data-slot="dialog-overlay"
      {...componentProps}
    />
  );
};

export type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content>;

export const DialogContent: React.FC<DialogContentProps> = (props) => {
  const { children, className, ...componentProps } = props;

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className,
        )}
        data-slot="dialog-content"
        {...componentProps}
      >
        {children}
        <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
};

export type DialogHeaderProps = React.ComponentProps<"div">;

export const DialogHeader: React.FC<DialogHeaderProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <div
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      data-slot="dialog-header"
      {...componentProps}
    />
  );
};

export type DialogFooterProps = React.ComponentProps<"div">;

export const DialogFooter: React.FC<DialogFooterProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      data-slot="dialog-footer"
      {...componentProps}
    />
  );
};

export type DialogTitleProps = React.ComponentProps<typeof DialogPrimitive.Title>;

export const DialogTitle: React.FC<DialogTitleProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <DialogPrimitive.Title
      className={cn("text-lg leading-none font-semibold", className)}
      data-slot="dialog-title"
      {...componentProps}
    />
  );
};

export type DialogDescriptionProps = React.ComponentProps<typeof DialogPrimitive.Description>;

export const DialogDescription: React.FC<DialogDescriptionProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <DialogPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="dialog-description"
      {...componentProps}
    />
  );
};
