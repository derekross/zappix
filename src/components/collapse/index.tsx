import cx from "classnames";
import * as React from "react";

export type CollapseProps = React.PropsWithChildren<
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>
> & {
  isOpen: boolean;
};

export const Collapse: React.FC<CollapseProps> = (props) => {
  const { children, className, isOpen, ...divProps } = props;

  return (
    <div
      className={cx(
        "overflow-hidden transition-all duration-300",
        {
          "max-h-0": !isOpen,
          "max-h-96": isOpen,
        },
        className,
      )}
      {...divProps}
    >
      {isOpen ? children : null}
    </div>
  );
};
