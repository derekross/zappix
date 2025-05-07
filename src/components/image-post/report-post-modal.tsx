import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Flag } from "lucide-react";
import { Loader } from "../ui/icons";
import { NDKEvent } from "@nostr-dev-kit/ndk";

interface ReportPostDialogProps {
  event: NDKEvent;
  onSubmit: (reportType: string, reasonText: string) => Promise<void>;
  onClose: () => void;
}

const reportTypes = [
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate Content" },
  { value: "harassment", label: "Harassment" },
  { value: "other", label: "Other" },
];

export function ReportPostDialog({ onSubmit, onClose }: ReportPostDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const [reasonText, setReasonText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType) return;

    setIsSubmitting(true);
    try {
      await onSubmit(selectedType, reasonText);
      setIsOpen(false);
      onClose();
    } catch (error) {
      console.error("Error submitting report:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setIsOpen(false);
          onClose();
        }
      }}
      open={isOpen}
    >
      <DialogTrigger asChild>
        <button
          className="flex w-full items-center text-sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(true);
          }}
        >
          <Flag className="text-red-500" />
          <span className="ml-2">Report Post</span>
        </button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Report Post</DialogTitle>
          <DialogDescription>Please select a reason for reporting this post.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <label className="text-brand-purple text-sm font-medium">Reason *</label>
            <div className="flex flex-col gap-2">
              {reportTypes.map((type) => (
                <label key={type.value} className="flex items-center gap-2">
                  <input
                    checked={selectedType === type.value}
                    className="text-brand-purple focus:ring-brand-purple h-4 w-4 border-gray-300"
                    name="reportType"
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedType(e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    type="radio"
                    value={type.value}
                  />
                  <span className="text-brand-purple text-sm">{type.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-brand-purple text-sm font-medium">Additional Details</label>
            <textarea
              className="min-h-[100px] w-full rounded-md border border-gray-300 p-2 text-sm"
              onChange={(e) => setReasonText(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Please provide any additional context..."
              value={reasonText}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            className="bg-brand-purple hover:bg-brand-purple/90 text-white"
            disabled={!selectedType || isSubmitting}
            onClick={(e) => {
              e.stopPropagation();
              handleSubmit();
            }}
          >
            {isSubmitting ? <Loader /> : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
