import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import { Link } from "react-router-dom";

export type AvatarProps = {
  image: AvatarImageProps["src"];
  fallback?: AvatarFallbackProps["children"];
  npub?: string;
  avatarRootProps?: Omit<AvatarRootProps, "children">;
  avatarImageProps?: Omit<AvatarImageProps, "src">;
};

export const Avatar: React.FC<AvatarProps> = (props) => {
  const { image, fallback = <User />, npub, avatarRootProps = {}, avatarImageProps = {} } = props;

  return (
    <AvatarRoot {...avatarRootProps}>
      {npub != null && (
        <Link to={`/profile/${npub}`}>
          <AvatarImage {...avatarImageProps} src={image} />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Link>
      )}
      {npub == null && (
        <>
          <AvatarImage {...avatarImageProps} src={image} />
          <AvatarFallback>{fallback}</AvatarFallback>
        </>
      )}
    </AvatarRoot>
  );
};

export type AvatarRootProps = React.ComponentProps<typeof AvatarPrimitive.Root>;

export const AvatarRoot: React.FC<AvatarRootProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full", className)}
      {...componentProps}
    />
  );
};

export type AvatarImageProps = React.ComponentProps<typeof AvatarPrimitive.Image>;

export const AvatarImage: React.FC<AvatarImageProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...componentProps}
    />
  );
};

export type AvatarFallbackProps = React.ComponentProps<typeof AvatarPrimitive.Fallback>;

export const AvatarFallback: React.FC<AvatarFallbackProps> = (props) => {
  const { className, ...componentProps } = props;

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("bg-muted flex size-full items-center justify-center rounded-full", className)}
      {...componentProps}
    />
  );
};
