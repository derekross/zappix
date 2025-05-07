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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Loader } from "../ui/icons";

interface ReportPostDialogProps {
  event: NDKEvent;
  onSubmit: (reportType: string, reasonText: string) => void;
  onClose?: () => void;
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

export const ReportPostDialog: React.FC<ReportPostDialogProps> = ({ event, onSubmit, onClose }) => {
  const [selectedType, setSelectedType] = useState<string>("");
  const [otherReason, setOtherReason] = useState<string>("");
  const [isSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    setSelectedType(event.target.value);
  };

  const handleOtherReasonChange: FormInputTextareaProps["onChange"] = (event) => {
    event.stopPropagation();
    setOtherReason(event.target.value);
  };

  const handleSubmitClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedType) {
      console.warn("Report type not selected");
      return;
    }
    if (selectedType === "other" && !otherReason.trim()) {
      console.warn("Other reason not provided");
      return;
    }
    onSubmit(selectedType, otherReason.trim());
    setIsOpen(false);
    onClose?.();
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      onClose?.();
    }
  };

  const authorName =
    event.author.profile?.displayName ||
    event.author.profile?.name ||
    event.author.npub.substring(0, 10) + "...";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="flex w-full items-center gap-1 px-2 py-1.5 text-sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(true);
          }}
        >
          <Flag className="text-red-500" />
          Report Post
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" onClick={handleContentClick}>
        <DialogHeader>
          <DialogTitle>Report Post</DialogTitle>
          <DialogDescription>
            Select a reason for reporting this post. Your report will be reviewed by moderators.
          </DialogDescription>
        </DialogHeader>
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
            <button
              className="bg-secondary ring-offset-background hover:bg-secondary/80 focus-visible:ring-ring inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              onClick={(e) => e.stopPropagation()}
            >
              Cancel
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
