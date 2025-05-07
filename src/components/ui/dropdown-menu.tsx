import { cn } from "@/lib/utils";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import * as React from "react";

export type DropdownMenuProps = React.ComponentProps<typeof DropdownMenuPrimitive.Root>;

export const DropdownMenu: React.FC<DropdownMenuProps> = (props) => {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
};

export const DropdownMenuPortal: React.FC<
  React.ComponentProps<typeof DropdownMenuPrimitive.Portal>
> = (props) => {
  return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
};

export const DropdownMenuTrigger: React.FC<
  React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>
> = (props) => {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
};

export const DropdownMenuContent: React.FC<
  React.ComponentProps<typeof DropdownMenuPrimitive.Content>
> = (props) => {
  const { className, sideOffset = 4, ...componentProps } = props;

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
          className,
        )}
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        {...componentProps}
      />
    </DropdownMenuPrimitive.Portal>
  );
};

export const DropdownMenuGroup: React.FC<
  React.ComponentProps<typeof DropdownMenuPrimitive.Group>
> = (props) => {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
};

export const DropdownMenuItem: React.FC<
  React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
    variant?: "default" | "error";
  }
> = (props) => {
  const { className, inset, variant = "default", ...componentProps } = props;

  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=error]:text-error data-[variant=error]:focus:bg-error/10 dark:data-[variant=error]:focus:bg-error/20 data-[variant=error]:focus:text-error data-[variant=error]:*:[svg]:!text-error [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-inset={inset}
      data-slot="dropdown-menu-item"
      data-variant={variant}
      {...componentProps}
    />
  );
};

export const DropdownMenuCheckboxItem: React.FC<
  React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>
> = (props) => {
  const { checked, children, className, ...componentProps } = props;

  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="dropdown-menu-checkbox-item"
      {...componentProps}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
};

export const DropdownMenuRadioGroup: React.FC<
  React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>
> = (props) => {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
};

export const DropdownMenuRadioItem: React.FC<
  React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>
> = (props) => {
  const { children, className, ...componentProps } = props;

  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="dropdown-menu-radio-item"
      {...componentProps}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
};

export const DropdownMenuLabel: React.FC<
  React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
> = (props) => {
  const { className, inset, ...componentProps } = props;

  return (
    <DropdownMenuPrimitive.Label
      className={cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className)}
      data-inset={inset}
      data-slot="dropdown-menu-label"
      {...componentProps}
    />
  );
};

export const DropdownMenuSeparator: React.FC<
  React.ComponentProps<typeof DropdownMenuPrimitive.Separator>
> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <DropdownMenuPrimitive.Separator
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      data-slot="dropdown-menu-separator"
      {...componentProps}
    />
  );
};

export const DropdownMenuShortcut: React.FC<React.ComponentProps<"span">> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <span
      className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
      data-slot="dropdown-menu-shortcut"
      {...componentProps}
    />
  );
};

export const DropdownMenuSub: React.FC<React.ComponentProps<typeof DropdownMenuPrimitive.Sub>> = (
  props,
) => {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
};

export const DropdownMenuSubTrigger: React.FC<
  React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
> = (props) => {
  const { children, className, inset, ...componentProps } = props;

  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8",
        className,
      )}
      data-inset={inset}
      data-slot="dropdown-menu-sub-trigger"
      {...componentProps}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
};

export const DropdownMenuSubContent: React.FC<
  React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>
> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <DropdownMenuPrimitive.SubContent
      className={cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg",
        className,
      )}
      data-slot="dropdown-menu-sub-content"
      {...componentProps}
    />
  );
};
