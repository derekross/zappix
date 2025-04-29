import { cn } from "@/lib/utils";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";

export type PopoverProps = React.ComponentProps<typeof PopoverPrimitive.Root>;

export const Popover: React.FC<PopoverProps> = (props) => {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
};

export type PopoverTriggerProps = React.ComponentProps<typeof PopoverPrimitive.Trigger>;

export const PopoverTrigger: React.FC<PopoverTriggerProps> = (props) => {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
};

export type PopoverContentProps = React.ComponentProps<typeof PopoverPrimitive.Content>;

export const PopoverContent: React.FC<PopoverContentProps> = (props) => {
  const { align = "center", className, sideOffset = 4, ...componentProps } = props;

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
          className,
        )}
        data-slot="popover-content"
        sideOffset={sideOffset}
        {...componentProps}
      />
    </PopoverPrimitive.Portal>
  );
};

export type PopoverAnchorProps = React.ComponentProps<typeof PopoverPrimitive.Anchor>;

export const PopoverAnchor: React.FC<PopoverAnchorProps> = (props) => {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
};
