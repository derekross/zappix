import Button from "@mui/material/Button";
// FIX: Import CircularProgress
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { NDKEvent } from "@nostr-dev-kit/ndk";
// src/components/ReportPostDialog.tsx
import React, { useEffect, useState } from "react";

interface ReportPostDialogProps {
  event: NDKEvent;
  open: boolean;
  onClose: () => void;
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

export const ReportPostDialog: React.FC<ReportPostDialogProps> = ({
  event,
  onClose,
  onSubmit,
  open,
}) => {
  const [selectedType, setSelectedType] = useState<string>("");
  const [otherReason, setOtherReason] = useState<string>("");
  // isSubmitting might be controlled by the parent if the onSubmit is async
  const [isSubmitting] = useState(false); // Assuming parent controls async state for now

  useEffect(() => {
    // Reset state when dialog opens
    if (open) {
      setSelectedType("");
      setOtherReason("");
      // setIsSubmitting(false); // Parent should control this if onSubmit is async
    }
  }, [open]);

  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedType(event.target.value);
  };

  const handleOtherReasonChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    <Dialog fullWidth maxWidth="xs" onClose={onClose} open={open}>
      <DialogTitle>Report Post</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography color="text.secondary" variant="body2">
            Why are you reporting this post by {authorName}?
          </Typography>
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
            <TextField
              fullWidth
              label="Please specify reason"
              multiline
              onChange={handleOtherReasonChange}
              required
              rows={2}
              value={otherReason}
              variant="outlined"
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={isSubmitting} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={
            isSubmitting || !selectedType || (selectedType === "other" && !otherReason.trim())
          }
          onClick={handleSubmitClick}
          variant="contained"
        >
          {/* Use the imported CircularProgress */}
          {isSubmitting ? <CircularProgress color="inherit" size={24} /> : "Submit Report"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
