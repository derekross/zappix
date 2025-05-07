import { Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import { DropdownMenuItem } from "../ui/dropdown-menu";

// ... existing imports ...

// Inside the dropdown menu items, between Logout and Settings
<DropdownMenuItem asChild>
  <Link to="/bookmarks">
    <Bookmark className="mr-2 h-4 w-4" />
    Bookmarks
  </Link>
</DropdownMenuItem>;
