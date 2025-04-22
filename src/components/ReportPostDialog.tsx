// src/components/ReportPostDialog.tsx
import React, { useState, useEffect } from 'react';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface ReportPostDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (reportType: string, reasonText: string) => void; // Passes selection back
    event: NDKEvent;
}

// NIP-56 Recommended Report Types
const reportTypes = [
    { value: 'nudity', label: 'Nudity or sexual content' },
    { value: 'profanity', label: 'Profanity or hate speech' },
    { value: 'illegal', label: 'Illegal content or activity' },
    { value: 'spam', label: 'Spam' },
    { value: 'impersonation', label: 'Impersonation' },
    // { value: 'malware', label: 'Malware or phishing' }, // Less common for image posts?
    { value: 'other', label: 'Other (please specify below)' }
];

export const ReportPostDialog: React.FC<ReportPostDialogProps> = ({
    open,
    onClose,
    onSubmit,
    event,
}) => {
    const [selectedType, setSelectedType] = useState<string>('');
    const [otherReason, setOtherReason] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false); // Placeholder if submission takes time

    useEffect(() => {
        // Reset state when dialog opens
        if (open) {
            setSelectedType('');
            setOtherReason('');
            setIsSubmitting(false);
        }
    }, [open]);

    const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedType(event.target.value);
    };

    const handleOtherReasonChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setOtherReason(event.target.value);
    };

    const handleSubmitClick = () => {
        // Basic validation
        if (!selectedType) {
            // Consider showing an error message
            return;
        }
        if (selectedType === 'other' && !otherReason.trim()) {
            // Consider showing an error message
             return;
        }
        
        // Pass data back to parent component for NIP-56 event creation
        onSubmit(selectedType, otherReason.trim());
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Report Post</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Why are you reporting this post by {event.author.profile?.displayName || event.author.npub.substring(0, 10)}...?
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
                    
                    {selectedType === 'other' && (
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
                <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                <Button 
                    onClick={handleSubmitClick} 
                    variant="contained" 
                    disabled={isSubmitting || !selectedType || (selectedType === 'other' && !otherReason.trim())}
                >
                    {isSubmitting ? <CircularProgress size={24} /> : 'Submit Report'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
