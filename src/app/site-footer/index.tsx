import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bookmark,
  EllipsisVertical,
  Home,
  LogIn,
  LogOut,
  PersonStanding,
  Settings,
  SquarePen,
  User,
} from "lucide-react";
import * as React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Container } from "../../components/container";
import { useNdk } from "../../contexts/NdkContext";
import { LoginModal } from "./login-modal";
import { SignUpModal } from "./signup-modal";
import { ThemeToggle } from "./theme-toggle";

export const SiteFooter: React.FC = () => {
  //* State
  const { logout, user } = useNdk();
  const navigate = useNavigate();

  //* Variables
  const navigationItems: Array<{ icon: React.ReactNode; label: string; path: string }> = [
    { icon: <Home />, label: "Feed", path: "/feed" },
    user != null ? { icon: <SquarePen />, label: "Create", path: "/create" } : null,
    user != null ? { icon: <User />, label: "Profile", path: `/profile/${user.npub}` } : null,
  ].filter((x) => x != null);

  const handleLogout = () => {
    logout();
    navigate("/");
    toast.success("Logged out successfully.");
  };

  return (
    <footer className="border-brand-purple dark:border-brand-yellow mt-auto border-t">
      <Container>
        <nav>
          <ul className="flex justify-between gap-4 p-4">
            {navigationItems.map(({ icon, label, path }) => {
              return (
                <li key={path}>
                  <NavLink
                    className={({ isActive }) =>
                      isActive
                        ? "text-brand-purple dark:text-brand-yellow"
                        : "transition-color hover:text-brand-purple dark:hover:text-brand-yellow duration-300 ease-in-out dark:text-gray-300"
                    }
                    to={path}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      {icon}
                      <span className="text-xs"> {label}</span>
                    </div>
                  </NavLink>
                </li>
              );
            })}
            <li className="relative flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <EllipsisVertical />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {user != null && (
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="h-4 w-4" />
                      <span className="ml-2">Logout</span>
                    </DropdownMenuItem>
                  )}
                  {user == null && (
                    <>
                      <LoginModal
                        trigger={
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <LogIn className="h-4 w-4" />
                            <span className="ml-2">Login</span>
                          </DropdownMenuItem>
                        }
                      />
                      <SignUpModal
                        trigger={
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <PersonStanding className="h-4 w-4" />
                            <span className="ml-2">Sign Up</span>
                          </DropdownMenuItem>
                        }
                      />
                    </>
                  )}
                  <Link to="settings">
                    <DropdownMenuItem>
                      <Settings className="h-4 w-4" />
                      <span className="ml-2">Settings</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link to="bookmarks">
                    <DropdownMenuItem>
                      <Bookmark className="h-4 w-4" />
                      <span className="ml-2">Bookmarks</span>
                    </DropdownMenuItem>
                  </Link>
                  <ThemeToggle />
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          </ul>
        </nav>
      </Container>
    </footer>
  );
};
