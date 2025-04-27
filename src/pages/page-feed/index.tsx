import { Globe, Users } from "lucide-react";
import * as React from "react";
import { NavLink, Outlet } from "react-router-dom";

export const FeedPage: React.FC = () => {
  //* Variables
  const tabs: Array<[icon: React.ReactNode, label: string, path: string]> = [
    [<Globe />, "Global", "/feed/global"],
    [<Users />, "Following", "/feed/following"],
  ];

  return (
    <>
      <div className="flex justify-center gap-3 p-2">
        {tabs.map(([icon, label, path]) => {
          return (
            <NavLink
              className={({ isActive }) =>
                isActive
                  ? "text-brand-purple dark:text-brand-yellow flex gap-1"
                  : "transition-color hover:text-brand-purple dark:hover:text-brand-yellow flex gap-1 duration-300 ease-in-out dark:text-gray-300"
              }
              key={path}
              to={path}
            >
              {icon}
              {label}
            </NavLink>
          );
        })}
      </div>

      <Outlet />
    </>
  );
};
