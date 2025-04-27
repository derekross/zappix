import cx from "classnames";
import * as React from "react";
import { Checkbox, CheckboxProps } from "../ui/checkbox";

export type FormInputCheckboxProps = CheckboxProps & {
  label?: string;
};

export const FormInputCheckbox: React.FC<FormInputCheckboxProps> = (props) => {
  const { label, ...inputProps } = props;

  return (
    <label
      className={cx("flex cursor-pointer items-center gap-1", {
        "flex-row-reverse justify-end": label != null,
      })}
    >
      {label != null && <span className="text-gray-700 dark:text-gray-400">{label}</span>}
      <Checkbox {...inputProps} />
    </label>
  );
};
