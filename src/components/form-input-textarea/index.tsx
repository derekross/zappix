import * as React from "react";
import { Textarea, TextareaProps } from "../ui/textarea";
import { Label } from "../ui/label";

export type FormInputTextareaProps = TextareaProps & {
  label?: string;
};

export const FormInputTextarea: React.FC<FormInputTextareaProps> = (props) => {
  const { label, ...inputProps } = props;

  return (
    <Label className="flex cursor-pointer flex-col items-start gap-1">
      {label != null && <span>{label}</span>}
      <Textarea {...inputProps} />
    </Label>
  );
};
