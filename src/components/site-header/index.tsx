import { Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import { DropdownMenuItem } from "../ui/dropdown-menu";

// ... existing imports ...

// Inside the dropdown menu items, between Logout and Settings
<Link to="/bookmarks">
  <DropdownMenuItem className="[&_svg]:!m-0 [&_svg]:!mr-0 [&_svg]:!ml-0">
    <Bookmark className="!m-0 !mr-0 !ml-0 h-4 w-4" />
    <span className="ml-2">Bookmarks</span>
  </DropdownMenuItem>
</Link>;
