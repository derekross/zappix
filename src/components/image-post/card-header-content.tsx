import * as React from "react";

export type CardHeaderProps = {
  action?: React.ReactNode;
  author: React.ReactNode;
  avatar: React.ReactNode;
  createdAt: React.ReactNode;
};

export const CardHeaderContent: React.FC<CardHeaderProps> = (props) => {
  const { action, author, avatar, createdAt } = props;

  return (
    <div className="flex justify-between">
      <div className="grid grid-cols-[1fr_max-content] gap-x-2">
        <div className="row-span-2">{avatar}</div>
        <div>{author}</div>
        <div>{createdAt}</div>
      </div>

      {action != null && <div>{action}</div>}
    </div>
  );
};
