import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import RestoreIcon from "@mui/icons-material/Restore";
import SaveIcon from "@mui/icons-material/Save";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid"; // Standard Grid import
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNdk } from "../contexts/NdkContext";

const LS_DEFAULT_ZAP_AMOUNT_KEY = "nostrImageAppDefaultZapAmount";
const LS_BLOSSOM_SERVER_URL_KEY = "nostrImageAppBlossomServerUrl";

// Predefined Blossom Servers
const PREDEFINED_BLOSSOM_SERVERS: { [key: string]: string } = {
  custom: "Custom URL",
  "https://blossom.band": "blossom.band (Default)",
  "https://blossom.primal.net": "blossom.primal.net",
  "https://nostr.download": "nostr.download",
};

export const SettingsPage: React.FC = () => {
  const {
    defaultRelays,
    fetchNip65Relays,
    isPublishingNip65,
    nip65Event,
    publishNip65Relays,
    readRelays,
    relaySource,
    user,
    writeRelays,
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
    let urlToSave: null | string = null;

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
      <Typography gutterBottom sx={{ fontWeight: "bold" }} variant="subtitle1">
        {title}:
      </Typography>
      <List dense disablePadding>
        {(editableList || []).map((relay) => (
          <ListItem
            key={relay}
            secondaryAction={
              <IconButton
                aria-label={`delete from ${title}`}
                edge="end"
                onClick={() => removeHandler(relay)}
                size="small"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            }
            sx={{ pl: 1, pr: 4 }}
          >
            <Typography sx={{ wordBreak: "break-all" }} variant="body2">
              {relay}
            </Typography>
          </ListItem>
        ))}
        {(editableList || []).length === 0 && (
          <ListItem sx={{ pl: 1 }}>
            <Typography color="text.secondary" variant="body2">
              List is empty.
            </Typography>
          </ListItem>
        )}
      </List>
      <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
        <TextField
          fullWidth
          label={`Add to ${title} (wss://...)`}
          onChange={(e) => setNewRelayValue(e.target.value)}
          size="small"
          value={newRelayValue}
          variant="outlined"
        />
        <Tooltip title={`Add relay to ${title}`}>
          <IconButton aria-label={`add relay to ${title}`} color="primary" onClick={addHandler}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", p: { sm: 2, xs: 1 } }}>
      <Typography gutterBottom variant="h4">
        Settings
      </Typography>

      {/* Default Zap Amount Section */}
      <Paper elevation={2} sx={{ mb: 3, p: 2 }}>
        <Typography gutterBottom variant="h6">
          Default Zap Amount
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
          Set the default amount (in Sats) used when you click the Zap button.
        </Typography>
        <TextField
          InputProps={{ inputProps: { min: 1 } }}
          disabled={!user}
          fullWidth
          label="Default Sats per Zap"
          onChange={(e) => setDefaultZapAmount(e.target.value)}
          size="small"
          sx={{ mb: 1 }}
          type="number"
          value={defaultZapAmount}
          variant="outlined"
        />
        <Button onClick={handleSaveDefaultZapAmount} variant="contained">
          Save Default Zap Amount
        </Button>
      </Paper>

      {/* Blossom Media Server Section */}
      <Paper elevation={2} sx={{ mb: 3, p: 2 }}>
        <Typography gutterBottom variant="h6">
          Media Upload Server (Blossom)
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
          Choose the Blossom server (NIP-96/NIP-98 compliant) to upload images to.
        </Typography>
        <FormControl fullWidth sx={{ mb: selectedBlossomOption === "custom" ? 1 : 2 }}>
          <InputLabel id="blossom-server-select-label">Blossom Server</InputLabel>
          <Select
            id="blossom-server-select"
            label="Blossom Server"
            labelId="blossom-server-select-label"
            onChange={handleBlossomSelectChange}
            size="small"
            value={selectedBlossomOption}
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
            onChange={(e) => setCustomBlossomUrl(e.target.value)}
            placeholder="https://your-blossom-server.com"
            size="small"
            sx={{ mb: 2 }}
            value={customBlossomUrl}
            variant="outlined"
          />
        )}
        <Button onClick={handleSaveBlossomServer} variant="contained">
          Save Blossom Server Setting
        </Button>
      </Paper>

      {/* Relay Settings Section */}
      <Paper elevation={2} sx={{ p: 2 }}>
        <Box
          sx={{
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
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
            <Alert icon={<CircularProgress size={20} />} severity="info">
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
          <Grid sm={6} xs={12}>
            {" "}
            {/* REMOVED item */}
            <Button
              disabled={
                !user ||
                isPublishingNip65 ||
                (editableReadRelays.length === 0 && editableWriteRelays.length === 0) ||
                !hasUnpublishedChanges
              }
              fullWidth
              onClick={handlePublishRelays}
              startIcon={
                isPublishingNip65 ? <CircularProgress color="inherit" size={20} /> : <SaveIcon />
              }
              variant="contained"
            >
              {isPublishingNip65 ? "Publishing..." : "Save & Publish Lists"}
            </Button>
          </Grid>
          <Grid sm={3} xs={6}>
            {" "}
            {/* REMOVED item */}
            <Button
              fullWidth
              onClick={handleRestoreEditableDefaults}
              startIcon={<RestoreIcon />}
              variant="outlined"
            >
              Defaults
            </Button>
          </Grid>
          <Grid sm={3} xs={6}>
            {" "}
            {/* REMOVED item */}
            <Button
              disabled={!hasUnpublishedChanges}
              fullWidth
              onClick={handleDiscardChanges}
              variant="outlined"
            >
              Discard
            </Button>
          </Grid>
        </Grid>
        {!user && (
          <Typography color="text.secondary" sx={{ display: "block", mt: 1 }} variant="caption">
            Log in to save and publish your relay lists.
          </Typography>
        )}
        {user && !hasUnpublishedChanges && relaySource === "nip65" && (
          <Typography color="text.secondary" sx={{ display: "block", mt: 1 }} variant="caption">
            No unpublished changes.
          </Typography>
        )}
        {user && hasUnpublishedChanges && (
          <Typography color="text.secondary" sx={{ display: "block", mt: 1 }} variant="caption">
            You have unpublished changes.
          </Typography>
        )}
      </Paper>
    </Box>
  );
};
