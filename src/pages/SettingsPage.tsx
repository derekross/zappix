import React, { useState, useEffect, useCallback } from "react";
import { useNdk } from "../contexts/NdkContext";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import RestoreIcon from "@mui/icons-material/Restore";
import RefreshIcon from "@mui/icons-material/Refresh";
import Paper from "@mui/material/Paper";
import toast from "react-hot-toast";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Grid from "@mui/material/Grid"; // Standard Grid import
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";

const LS_DEFAULT_ZAP_AMOUNT_KEY = "nostrImageAppDefaultZapAmount";
const LS_BLOSSOM_SERVER_URL_KEY = "nostrImageAppBlossomServerUrl";

// Predefined Blossom Servers
const PREDEFINED_BLOSSOM_SERVERS: { [key: string]: string } = {
  "https://blossom.band": "blossom.band (Default)",
  "https://blossom.primal.net": "blossom.primal.net",
  "https://nostr.download": "nostr.download",
  custom: "Custom URL",
};

export const SettingsPage: React.FC = () => {
  const {
    user,
    readRelays,
    writeRelays,
    defaultRelays,
    relaySource,
    nip65Event,
    isPublishingNip65,
    publishNip65Relays,
    fetchNip65Relays,
  } = useNdk();

  // Local state for editable relay lists
  const [editableReadRelays, setEditableReadRelays] = useState<string[]>(readRelays || []);
  const [editableWriteRelays, setEditableWriteRelays] = useState<string[]>(writeRelays || []);
  const [newReadRelay, setNewReadRelay] = useState("");
  const [newWriteRelay, setNewWriteRelay] = useState("");

  const [defaultZapAmount, setDefaultZapAmount] = useState<string>("");

  // Blossom Server State
  const [selectedBlossomOption, setSelectedBlossomOption] =
    useState<string>("https://blossom.band");
  const [customBlossomUrl, setCustomBlossomUrl] = useState<string>("");

  // Sync editable relay lists with context when context changes
  useEffect(() => {
    console.log("Context read relays changed, updating editableReadRelays:", readRelays);
    setEditableReadRelays(readRelays || []);
  }, [readRelays]);

  useEffect(() => {
    console.log("Context write relays changed, updating editableWriteRelays:", writeRelays);
    setEditableWriteRelays(writeRelays || []);
  }, [writeRelays]);

  // Load default zap amount
  useEffect(() => {
    const storedAmount = localStorage.getItem(LS_DEFAULT_ZAP_AMOUNT_KEY) || "21";
    setDefaultZapAmount(storedAmount);
  }, []);

  // Load Blossom server setting
  useEffect(() => {
    const storedUrl = localStorage.getItem(LS_BLOSSOM_SERVER_URL_KEY) || "https://blossom.band";
    if (PREDEFINED_BLOSSOM_SERVERS[storedUrl]) {
      setSelectedBlossomOption(storedUrl);
    } else if (storedUrl) {
      setSelectedBlossomOption("custom");
      setCustomBlossomUrl(storedUrl);
    } else {
      setSelectedBlossomOption("https://blossom.band");
    }
    console.log(`Loaded Blossom URL setting: ${storedUrl}`);
  }, []);

  // --- Editable Relay List Handlers ---
  const handleAddEditableReadRelay = useCallback(() => {
    if (
      newReadRelay &&
      newReadRelay.startsWith("wss://") &&
      !editableReadRelays.includes(newReadRelay)
    ) {
      setEditableReadRelays((prev) => [...prev, newReadRelay]);
      setNewReadRelay("");
    } else if (editableReadRelays.includes(newReadRelay)) {
      toast.error("Relay already in the read list");
    } else {
      toast.error("Invalid relay URL (must start with wss://)");
    }
  }, [newReadRelay, editableReadRelays]);

  const handleRemoveEditableReadRelay = useCallback((relayToRemove: string) => {
    setEditableReadRelays((prev) => prev.filter((r) => r !== relayToRemove));
  }, []);

  const handleAddEditableWriteRelay = useCallback(() => {
    if (
      newWriteRelay &&
      newWriteRelay.startsWith("wss://") &&
      !editableWriteRelays.includes(newWriteRelay)
    ) {
      setEditableWriteRelays((prev) => [...prev, newWriteRelay]);
      setNewWriteRelay("");
    } else if (editableWriteRelays.includes(newWriteRelay)) {
      toast.error("Relay already in the write list");
    } else {
      toast.error("Invalid relay URL (must start with wss://)");
    }
  }, [newWriteRelay, editableWriteRelays]);

  const handleRemoveEditableWriteRelay = useCallback((relayToRemove: string) => {
    setEditableWriteRelays((prev) => prev.filter((r) => r !== relayToRemove));
  }, []);

  const handleRestoreEditableDefaults = useCallback(() => {
    setEditableReadRelays(defaultRelays);
    setEditableWriteRelays(defaultRelays);
    toast.success("Editable lists reset to defaults. Publish to save.");
  }, [defaultRelays]);

  const handleDiscardChanges = useCallback(() => {
    setEditableReadRelays(readRelays || []);
    setEditableWriteRelays(writeRelays || []);
    toast("Changes discarded."); // Use base toast
  }, [readRelays, writeRelays]);

  // --- NIP-65 Handlers ---
  const handlePublishRelays = useCallback(async () => {
    if (!user) {
      toast.error("Please log in to publish a relay list.");
      return;
    }
    await publishNip65Relays(editableReadRelays, editableWriteRelays);
  }, [user, editableReadRelays, editableWriteRelays, publishNip65Relays]);

  const handleRefreshRelays = useCallback(async () => {
    if (!user) {
      toast.error("Please log in to refresh your relay list.");
      return;
    }
    const toastId = toast.loading("Refreshing NIP-65 relay list...");
    try {
      await fetchNip65Relays(user);
      toast.success("Relay list refreshed!", { id: toastId });
    } catch (error) {
      toast.error("Failed to refresh relay list.", { id: toastId });
    }
  }, [user, fetchNip65Relays]);

  // --- Default Zap Amount Handler ---
  const handleSaveDefaultZapAmount = useCallback(() => {
    const amount = parseInt(defaultZapAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Default Zap Amount must be a positive number.");
      return;
    }
    localStorage.setItem(LS_DEFAULT_ZAP_AMOUNT_KEY, String(amount));
    toast.success("Default Zap Amount saved!");
  }, [defaultZapAmount]);

  // --- Blossom Server Handlers ---
  const handleBlossomSelectChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setSelectedBlossomOption(value);
    if (value !== "custom") {
      setCustomBlossomUrl("");
    }
  };

  const handleSaveBlossomServer = useCallback(() => {
    let urlToSave: string | null = null;

    if (selectedBlossomOption === "custom") {
      urlToSave = customBlossomUrl.trim();
    } else {
      urlToSave = selectedBlossomOption;
    }

    if (!urlToSave || !(urlToSave.startsWith("http://") || urlToSave.startsWith("https://"))) {
      toast.error("Invalid Blossom Server URL. Must start with http:// or https://");
      return;
    }
    if (urlToSave.endsWith("/")) {
      urlToSave = urlToSave.slice(0, -1);
    }

    localStorage.setItem(LS_BLOSSOM_SERVER_URL_KEY, urlToSave);
    toast.success("Blossom Server URL saved!");
  }, [selectedBlossomOption, customBlossomUrl]);

  // Determine if editable relay lists differ from the context lists
  const hasUnpublishedChanges =
    JSON.stringify((editableReadRelays || []).sort()) !==
      JSON.stringify((readRelays || []).sort()) ||
    JSON.stringify((editableWriteRelays || []).sort()) !==
      JSON.stringify((writeRelays || []).sort());

  // Helper function to render a relay list section
  const renderRelayList = (
    title: string,
    editableList: string[],
    addHandler: () => void,
    removeHandler: (relay: string) => void,
    newRelayValue: string,
    setNewRelayValue: (val: string) => void,
  ) => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: "bold" }}>
        {title}:
      </Typography>
      <List dense disablePadding>
        {(editableList || []).map((relay) => (
          <ListItem
            key={relay}
            secondaryAction={
              <IconButton
                edge="end"
                aria-label={`delete from ${title}`}
                onClick={() => removeHandler(relay)}
                size="small"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            }
            sx={{ pl: 1, pr: 4 }}
          >
            <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
              {relay}
            </Typography>
          </ListItem>
        ))}
        {(editableList || []).length === 0 && (
          <ListItem sx={{ pl: 1 }}>
            <Typography variant="body2" color="text.secondary">
              List is empty.
            </Typography>
          </ListItem>
        )}
      </List>
      <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
        <TextField
          fullWidth
          label={`Add to ${title} (wss://...)`}
          variant="outlined"
          value={newRelayValue}
          onChange={(e) => setNewRelayValue(e.target.value)}
          size="small"
        />
        <Tooltip title={`Add relay to ${title}`}>
          <IconButton color="primary" onClick={addHandler} aria-label={`add relay to ${title}`}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", p: { xs: 1, sm: 2 } }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {/* Default Zap Amount Section */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Default Zap Amount
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Set the default amount (in Sats) used when you click the Zap button.
        </Typography>
        <TextField
          fullWidth
          label="Default Sats per Zap"
          variant="outlined"
          type="number"
          value={defaultZapAmount}
          onChange={(e) => setDefaultZapAmount(e.target.value)}
          InputProps={{ inputProps: { min: 1 } }}
          sx={{ mb: 1 }}
          size="small"
          disabled={!user}
        />
        <Button variant="contained" onClick={handleSaveDefaultZapAmount}>
          Save Default Zap Amount
        </Button>
      </Paper>

      {/* Blossom Media Server Section */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Media Upload Server (Blossom)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose the Blossom server (NIP-96/NIP-98 compliant) to upload images to.
        </Typography>
        <FormControl fullWidth sx={{ mb: selectedBlossomOption === "custom" ? 1 : 2 }}>
          <InputLabel id="blossom-server-select-label">Blossom Server</InputLabel>
          <Select
            labelId="blossom-server-select-label"
            id="blossom-server-select"
            value={selectedBlossomOption}
            label="Blossom Server"
            onChange={handleBlossomSelectChange}
            size="small"
          >
            {Object.entries(PREDEFINED_BLOSSOM_SERVERS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedBlossomOption === "custom" && (
          <TextField
            fullWidth
            label="Custom Blossom Server URL"
            variant="outlined"
            value={customBlossomUrl}
            onChange={(e) => setCustomBlossomUrl(e.target.value)}
            placeholder="https://your-blossom-server.com"
            size="small"
            sx={{ mb: 2 }}
          />
        )}
        <Button variant="contained" onClick={handleSaveBlossomServer}>
          Save Blossom Server Setting
        </Button>
      </Paper>

      {/* Relay Settings Section */}
      <Paper elevation={2} sx={{ p: 2 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Typography variant="h6">Relay Management (NIP-65)</Typography>
          {user && (
            <Tooltip title="Refresh NIP-65 List">
              <IconButton onClick={handleRefreshRelays} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Relay Source Information */}
        <Box sx={{ mb: 2 }}>
          {relaySource === "loading" && (
            <Alert severity="info" icon={<CircularProgress size={20} />}>
              Loading relay list...
            </Alert>
          )}
          {relaySource === "nip65" && nip65Event && (
            <Alert severity="success">
              Using relays from your published NIP-65 list (updated:{" "}
              {new Date(nip65Event.created_at! * 1000).toLocaleString()}).
            </Alert>
          )}
          {relaySource === "default" && user && (
            <Alert severity="warning">
              No NIP-65 list found or list was empty. Using default relays. Publish a list below to
              customize.
            </Alert>
          )}
          {relaySource === "default" && !user && (
            <Alert severity="info">
              Using default relays. Log in to manage your personal relay list (NIP-65).
            </Alert>
          )}
          {relaySource === "logged_out" && (
            <Alert severity="info">
              Using default relays. Log in to manage your personal relay list (NIP-65).
            </Alert>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Editable Relay Lists (Read & Write) */}
        {renderRelayList(
          "Read Relays (Inbox)",
          editableReadRelays,
          handleAddEditableReadRelay,
          handleRemoveEditableReadRelay,
          newReadRelay,
          setNewReadRelay,
        )}
        {renderRelayList(
          "Write Relays (Outbox)",
          editableWriteRelays,
          handleAddEditableWriteRelay,
          handleRemoveEditableWriteRelay,
          newWriteRelay,
          setNewWriteRelay,
        )}

        <Divider sx={{ my: 2 }} />

        {/* Action Buttons */}
        {/* REMOVING 'item' prop AGAIN based on latest error */}
        <Grid container spacing={1}>
          <Grid xs={12} sm={6}>
            {" "}
            {/* REMOVED item */}
            <Button
              variant="contained"
              startIcon={
                isPublishingNip65 ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />
              }
              onClick={handlePublishRelays}
              disabled={
                !user ||
                isPublishingNip65 ||
                (editableReadRelays.length === 0 && editableWriteRelays.length === 0) ||
                !hasUnpublishedChanges
              }
              fullWidth
            >
              {isPublishingNip65 ? "Publishing..." : "Save & Publish Lists"}
            </Button>
          </Grid>
          <Grid xs={6} sm={3}>
            {" "}
            {/* REMOVED item */}
            <Button
              variant="outlined"
              startIcon={<RestoreIcon />}
              onClick={handleRestoreEditableDefaults}
              fullWidth
            >
              Defaults
            </Button>
          </Grid>
          <Grid xs={6} sm={3}>
            {" "}
            {/* REMOVED item */}
            <Button
              variant="outlined"
              onClick={handleDiscardChanges}
              disabled={!hasUnpublishedChanges}
              fullWidth
            >
              Discard
            </Button>
          </Grid>
        </Grid>
        {!user && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Log in to save and publish your relay lists.
          </Typography>
        )}
        {user && !hasUnpublishedChanges && relaySource === "nip65" && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            No unpublished changes.
          </Typography>
        )}
        {user && hasUnpublishedChanges && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            You have unpublished changes.
          </Typography>
        )}
      </Paper>
    </Box>
  );
};
