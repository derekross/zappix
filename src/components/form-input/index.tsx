import cx from "classnames";
import * as React from "react";
import { Input, InputProps } from "../ui/input";
import { Label } from "../ui/label";

export type FormInputProps = InputProps & {
  label?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
};

export const FormInput: React.FC<FormInputProps> = (props) => {
  const { className, label, leading, trailing, ...inputProps } = props;

  return (
    <Label className={cx("flex w-full cursor-pointer flex-col items-start gap-1", className)}>
      {label != null && <span>{label}</span>}
      <div className="flex w-full gap-1">
        {leading != null && leading}
        <Input {...inputProps} />
        {trailing != null && trailing}
      </div>
    </Label>
  );
};
