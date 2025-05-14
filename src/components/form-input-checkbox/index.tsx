import cx from "classnames";
import * as React from "react";
import { Checkbox, CheckboxProps } from "../ui/checkbox";
import { Label } from "../ui/label";

export type FormInputCheckboxProps = CheckboxProps & {
  label?: string;
};

export const FormInputCheckbox: React.FC<FormInputCheckboxProps> = (props) => {
  const { label, ...inputProps } = props;

  return (
    <Label
      className={cx("flex cursor-pointer items-center gap-1", {
        "flex-row-reverse justify-end": label != null,
      })}
    >
      {label != null && <span>{label}</span>}
      <Checkbox {...inputProps} />
    </Label>
  );
};
