import cx from "classnames";
import * as React from "react";

export type FormInputProps = React.DetailedHTMLProps<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  HTMLSelectElement
> & {
  label?: string;
  leading?: React.ReactNode;
  options: Array<{ label: string; value: string }>;
  trailing?: React.ReactNode;
};

export const FormInputSelect: React.FC<FormInputProps> = (props) => {
  const { className, label, leading, options, trailing, ...inputProps } = props;

  return (
    <label className={cx("flex cursor-pointer flex-col gap-1", className)}>
      {label != null && <span className="text-gray-700 dark:text-gray-400">{label}</span>}
      <div className="flex rounded border-1 border-gray-500 p-2">
        {leading != null && leading}
        <select {...inputProps} className="flex-1">
          {options.map((option) => {
            const { label, value } = option;

            return (
              <option key={value} value={value}>
                {label}
              </option>
            );
          })}
        </select>
        {trailing != null && trailing}
      </div>
    </label>
  );
};
