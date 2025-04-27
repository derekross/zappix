import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Brightness4, Brightness7, Computer } from "@mui/icons-material";
import * as React from "react";
import { useThemeContext } from "../../contexts/theme";

export const ThemeToggle: React.FC = () => {
  //* State
  const { setTheme, theme } = useThemeContext();

  //* Handlers
  const handleOnClick = () => {
    switch (theme) {
      case "light":
      case "system":
      case null:
        setTheme("dark");
        break;

      case "dark":
        setTheme("light");
        break;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case "system":
      case null:
        return "Using System Theme";

      case "light":
        return "Dark Mode";

      case "dark":
        return "Light Mode";
    }
  };

  return (
    <DropdownMenuItem onClick={handleOnClick}>
      {(theme === "system" || theme == null) && <Computer fontSize="small" />}
      {theme === "light" && <Brightness4 fontSize="small" />}
      {theme === "dark" && <Brightness7 fontSize="small" />}
      {getLabel()}
    </DropdownMenuItem>
  );
};
