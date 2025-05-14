import * as React from "react";
import { Select, SelectProps } from "../ui/select";
import { Label } from "../ui/label";

export type FormInputSelectProps = SelectProps & {
  label?: string;
};

export const FormInputSelect: React.FC<FormInputSelectProps> = (props) => {
  const { label, ...inputProps } = props;

  return (
    <Label className="flex w-full cursor-pointer flex-col items-start gap-1">
      {label != null && <span>{label}</span>}
      <Select
        selectTriggerProps={{
          className: "w-full",
        }}
        {...inputProps}
      />
    </Label>
  );
};
