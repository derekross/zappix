import cx from "classnames";
import * as React from "react";

export type FormInputTextProps = React.DetailedHTMLProps<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  HTMLTextAreaElement
> & {
  label?: string;
};

export const FormInputTextarea: React.FC<FormInputTextProps> = (props) => {
  const { className, label, ...inputProps } = props;

  return (
    <label className="flex cursor-pointer flex-col gap-1">
      {label != null && <span className="text-gray-700 dark:text-gray-400">{label}</span>}
      <textarea
        {...inputProps}
        className={cx("w-full rounded border-1 border-gray-500 p-2", className)}
      />
    </label>
  );
};
