import * as React from "react";

export type CardHeaderProps = {
  author: React.ReactNode;
  avatar: React.ReactNode;
  createdAt: React.ReactNode;
};

export const CardHeaderContent: React.FC<CardHeaderProps> = (props) => {
  const { author, avatar, createdAt } = props;

  return (
    <div className="grid grid-cols-[max-content_1fr] gap-x-2 gap-y-1">
      <div className="row-span-2">{avatar}</div>
      <div>{author}</div>
      <div>{createdAt}</div>
    </div>
  );
};
