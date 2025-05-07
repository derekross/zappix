import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Laptop, Moon, Sun } from "lucide-react";
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
      {(theme === "system" || theme == null) && <Laptop className="h-4 w-4" />}
      {theme === "light" && <Moon className="h-4 w-4" />}
      {theme === "dark" && <Sun className="h-4 w-4" />}
      <span className="ml-2">{getLabel()}</span>
    </DropdownMenuItem>
  );
};
