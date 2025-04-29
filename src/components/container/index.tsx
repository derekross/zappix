import cx from "classnames";
import * as React from "react";

export type ContainerProps = React.PropsWithChildren<
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>
> & {
  is?: "div" | "footer" | "header";
};

export const Container: React.FC<ContainerProps> = (props) => {
  const { className, is = "div", ...elementProps } = props;

  return React.createElement(is, {
    ...elementProps,
    className: cx(cx("mx-auto w-full max-w-7xl px-4", className)),
  });
};
