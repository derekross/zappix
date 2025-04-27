import cx from "classnames";
import * as React from "react";

export type FormInputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
> & {
  label?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
};

export const FormInput: React.FC<FormInputProps> = (props) => {
  const { className, label, leading, trailing, ...inputProps } = props;

  return (
    <label className={cx("flex cursor-pointer flex-col gap-1", className)}>
      {label != null && <span className="text-gray-700 dark:text-gray-400">{label}</span>}
      <div className="flex rounded border-1 border-gray-500 p-2">
        {leading != null && leading}
        <input {...inputProps} className="flex-1" />
        {trailing != null && trailing}
      </div>
    </label>
  );
};
