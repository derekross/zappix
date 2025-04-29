import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";
import { ErrorIcon, InfoIcon, Loader, SuccessIcon, WarningIcon } from "./icons";

export const Toaster: React.FC<ToasterProps> = (props) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      className="toaster group"
      icons={{
        error: <ErrorIcon />,
        info: <InfoIcon />,
        loading: <Loader />,
        success: <SuccessIcon />,
        warning: <WarningIcon />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-border": "var(--border)",
          "--normal-text": "var(--popover-foreground)",
        } as React.CSSProperties
      }
      theme={theme as ToasterProps["theme"]}
      {...props}
    />
  );
};
