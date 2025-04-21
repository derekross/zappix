import React from 'react';
import { useParams } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

export const ThreadPage: React.FC = () => {
    const { nevent } = useParams<{ nevent: string }>();

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Event Thread</Typography>
            <Typography sx={{ wordBreak: 'break-all' }}>Thread content for nevent: {nevent} will go here.</Typography>
            {/* TODO: Implement thread view logic */}
        </Box>
    );
};
