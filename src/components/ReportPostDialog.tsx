// src/components/ReportPostDialog.tsx
import React, { useState, useEffect } from "react";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
// FIX: Import CircularProgress
import CircularProgress from "@mui/material/CircularProgress";

interface ReportPostDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (reportType: string, reasonText: string) => void; // Passes selection back
  event: NDKEvent;
}

// NIP-56 Recommended Report Types
const reportTypes = [
  { value: "nudity", label: "Nudity or sexual content" },
  { value: "profanity", label: "Profanity or hate speech" },
  { value: "illegal", label: "Illegal content or activity" },
  { value: "spam", label: "Spam" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other (please specify below)" },
];

export const ReportPostDialog: React.FC<ReportPostDialogProps> = ({
  open,
  onClose,
  onSubmit,
  event,
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Report Post</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Why are you reporting this post by {authorName}?
          </Typography>
          <FormControl component="fieldset" required>
            <FormLabel component="legend">Reason</FormLabel>
            <RadioGroup
              aria-label="report-reason"
              name="reportReason"
              value={selectedType}
              onChange={handleTypeChange}
            >
              {reportTypes.map((type) => (
                <FormControlLabel
                  key={type.value}
                  value={type.value}
                  control={<Radio size="small" />}
                  label={type.label}
                />
              ))}
            </RadioGroup>
          </FormControl>

          {selectedType === "other" && (
            <TextField
              label="Please specify reason"
              variant="outlined"
              fullWidth
              multiline
              rows={2}
              value={otherReason}
              onChange={handleOtherReasonChange}
              required
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmitClick}
          variant="contained"
          disabled={
            isSubmitting || !selectedType || (selectedType === "other" && !otherReason.trim())
          }
        >
          {/* Use the imported CircularProgress */}
          {isSubmitting ? <CircularProgress size={24} color="inherit" /> : "Submit Report"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
