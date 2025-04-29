import * as React from "react";
import { Link } from "react-router-dom";
import { Container } from "../../components/container";

export const SiteHeader: React.FC = () => {
  return (
    <header className="border-brand-purple dark:border-brand-yellow border-b">
      <Container className="p-4" is="header">
        <Link className="flex items-center gap-2" to="/">
          <img alt="Zappix Logo" className="h-8" src="/zappix-logo.png" />
          <h1 className="text-brand-purple dark:text-brand-yellow text-2xl">Zappix</h1>
        </Link>
      </Container>
    </header>
  );
};
