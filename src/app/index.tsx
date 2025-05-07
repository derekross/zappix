import { Toaster } from "@/components/ui/sonner";
import * as React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Container } from "../components/container";
import { CreatePostPage } from "../pages/page-create-post";
import { FeedPage } from "../pages/page-feed";
import { FollowingFeed } from "../pages/page-feed/following-feed";
import { GlobalFeed } from "../pages/page-feed/global-feed";
import { HashtagFeed } from "../pages/page-feed/hashtag-feed/index";
import { ProfilePage } from "../pages/page-profile";
import { SettingsPage } from "../pages/page-settings";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { BookmarksPage } from "../pages/page-bookmarks";

export const App: React.FC = () => {
  return (
    <div className="flex h-screen flex-col">
      <SiteHeader />

      <main className="h-screen flex-grow-1 overflow-y-auto">
        <Container>
          <Routes>
            <Route element={<FeedPage />} path="feed">
              <Route element={<GlobalFeed />} path="global" />
              <Route element={<FollowingFeed />} path="following" />
              <Route element={<HashtagFeed />} path="hashtag" />
              <Route element={<HashtagFeed />} path="hashtag/:hashtag" />

              <Route element={<Navigate to="global" />} index />
            </Route>

            <Route element={<CreatePostPage />} path="create" />

            <Route path="profile">
              <Route element={<ProfilePage />} path=":npub" />
            </Route>

            <Route element={<SettingsPage />} path="settings" />

            <Route element={<BookmarksPage />} path="bookmarks" />

            <Route element={<Navigate to="feed" />} index />
          </Routes>
        </Container>
      </main>

      <Toaster />
      <SiteFooter />
    </div>
  );
};
