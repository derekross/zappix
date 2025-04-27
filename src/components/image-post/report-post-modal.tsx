import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { Flag } from "lucide-react";
import React, { useState } from "react";
import { FormInputTextarea, FormInputTextareaProps } from "../form-input-textarea";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Loader } from "../ui/icons";

interface ReportPostDialogProps {
  event: NDKEvent;
  onSubmit: (reportType: string, reasonText: string) => void; // Passes selection back
}

// NIP-56 Recommended Report Types
const reportTypes = [
  { label: "Nudity or sexual content", value: "nudity" },
  { label: "Profanity or hate speech", value: "profanity" },
  { label: "Illegal content or activity", value: "illegal" },
  { label: "Spam", value: "spam" },
  { label: "Impersonation", value: "impersonation" },
  { label: "Other (please specify below)", value: "other" },
];

export const ReportPostDialog: React.FC<ReportPostDialogProps> = ({ event, onSubmit }) => {
  const [selectedType, setSelectedType] = useState<string>("");
  const [otherReason, setOtherReason] = useState<string>("");
  // isSubmitting might be controlled by the parent if the onSubmit is async
  const [isSubmitting] = useState(false); // Assuming parent controls async state for now

  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedType(event.target.value);
  };

  const handleOtherReasonChange: FormInputTextareaProps["onChange"] = (event) => {
    setOtherReason(event.target.value);
  };

  const handleSubmitClick = () => {
    if (!selectedType) {
      // TODO: Consider showing an inline error or toast
      console.warn("Report type not selected");
      return;
    }
    if (selectedType === "other" && !otherReason.trim()) {
      // TODO: Consider showing an inline error or toast
      console.warn("Other reason not provided");
      return;
    }

    // Pass data back to parent component for NIP-56 event creation
    // Parent component will handle the actual submission logic and async state
    onSubmit(selectedType, otherReason.trim());

    // Optionally close immediately or let parent close after successful submission
    // onClose();
  };

  // Determine author display name
  const authorName =
    event.author.profile?.displayName ||
    event.author.profile?.name ||
    event.author.npub.substring(0, 10) + "...";

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) {
          setSelectedType("");
          setOtherReason("");
          // setIsSubmitting(false); // Parent should control this if onSubmit is async
        }
      }}
    >
      <DialogTrigger className="flex gap-1">
        <Flag />
        Report Post
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Report Post</DialogTitle>
        <div className="flex flex-col gap-2">
          <p>Why are you reporting this post by {authorName}?</p>
          <FormControl component="fieldset" required>
            <FormLabel component="legend">Reason</FormLabel>
            <RadioGroup
              aria-label="report-reason"
              name="reportReason"
              onChange={handleTypeChange}
              value={selectedType}
            >
              {reportTypes.map((type) => (
                <FormControlLabel
                  control={<Radio size="small" />}
                  key={type.value}
                  label={type.label}
                  value={type.value}
                />
              ))}
            </RadioGroup>
          </FormControl>

          {selectedType === "other" && (
            <FormInputTextarea
              label="Specify reason"
              onChange={handleOtherReasonChange}
              required
              rows={2}
              value={otherReason}
            />
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={
              isSubmitting || !selectedType || (selectedType === "other" && !otherReason.trim())
            }
            onClick={handleSubmitClick}
          >
            {isSubmitting ? <Loader /> : "Submit Report"}
          </Button>
          <DialogClose asChild>
            <Button disabled={isSubmitting} variant="secondary">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
