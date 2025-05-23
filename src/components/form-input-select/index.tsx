import cx from "classnames";
import * as React from "react";

export type FormInputSelectProps = React.DetailedHTMLProps<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  HTMLSelectElement
> & {
  label?: string;
  leading?: React.ReactNode;
  options: Array<{ label: string; value: string }>;
  trailing?: React.ReactNode;
};

export const FormInputSelect: React.FC<FormInputSelectProps> = (props) => {
  const { className, label, leading, options, trailing, ...inputProps } = props;

  return (
    <label className={cx("flex cursor-pointer flex-col gap-1", className)}>
      {label != null && <span className="text-gray-700 dark:text-gray-400">{label}</span>}
      <div className="flex rounded border-1 border-gray-500 p-2">
        {leading != null && leading}
        <select
          {...inputProps}
          className="focus:ring-brand-purple flex-1 bg-transparent text-gray-900 focus:ring-2 focus:outline-none dark:text-gray-100"
        >
          {options.map((option) => {
            const { label, value } = option;

            return (
              <option
                key={value}
                value={value}
                className="bg-white text-gray-900 dark:bg-black dark:text-gray-100"
              >
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
