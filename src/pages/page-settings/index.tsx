import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, Loader, SuccessIcon, WarningIcon } from "@/components/ui/icons";
import { Delete, History, RotateCw, Save } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { FormInput } from "../../components/form-input";
import { FormInputSelect, FormInputSelectProps } from "../../components/form-input-select";
import { Button } from "../../components/ui/button";
import { useNdk } from "../../contexts/NdkContext";
import { useNwc } from "../../contexts/NwcContext";

const LS_DEFAULT_ZAP_AMOUNT_KEY = "nostrImageAppDefaultZapAmount";
const LS_BLOSSOM_SERVER_URL_KEY = "nostrImageAppBlossomServerUrl";

// Predefined Blossom Servers
const PREDEFINED_BLOSSOM_SERVERS: { [key: string]: string } = {
  custom: "Custom URL",
  "https://blossom.band": "blossom.band (Default)",
  "https://blossom.primal.net": "blossom.primal.net",
  "https://nostr.download": "nostr.download",
};

const NwcSettings: React.FC = () => {
  const { nwcClient, isConnected, error, connect, disconnect } = useNwc();
  const [connectionString, setConnectionString] = React.useState(() => {
    return localStorage.getItem("nwc_connection_string") || "";
  });
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [defaultZapAmount, setDefaultZapAmount] = React.useState(() => {
    const saved = localStorage.getItem("default_zap_amount");
    return saved ? parseInt(saved, 10) : 21; // Default to 1000 sats
  });

  // Debug effect to log state changes
  React.useEffect(() => {
    console.log("NWC Settings State:", {
      hasClient: !!nwcClient,
      isConnected,
      error,
      hasConnectionString: !!connectionString,
    });
  }, [nwcClient, isConnected, error, connectionString]);

  const handleConnect = async () => {
    if (!connectionString.trim()) {
      toast.error("Please enter a connection string");
      return;
    }

    try {
      setIsConnecting(true);
      console.log("Attempting to connect to NWC...");

      // Attempt to connect first
      await connect(connectionString);

      // Only show success toast if we get here (no error thrown)
      toast.success("Successfully connected to NWC!");
    } catch (err) {
      console.error("Failed to connect to NWC:", err);

      // Show a more specific error message
      const errorMessage = err instanceof Error ? err.message : "Failed to connect to NWC";
      toast.error(errorMessage);

      // Clear the connection string on failure
      setConnectionString("");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    try {
      disconnect();
      setConnectionString("");
      toast.success("Disconnected from NWC");
    } catch (err) {
      console.error("Error disconnecting:", err);
      toast.error("Failed to disconnect");
    }
  };

  const handleDefaultZapAmountChange = (amount: number) => {
    localStorage.setItem(LS_DEFAULT_ZAP_AMOUNT_KEY, amount.toString());
    setDefaultZapAmount(amount);
    toast.success("Default zap amount saved!");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Nostr Wallet Connect</h2>

      {error && (
        <Alert variant="error">
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isConnected ? (
        <div className="space-y-2">
          <FormInput
            label="NWC Connection String"
            onChange={(e) => setConnectionString(e.target.value)}
            placeholder="nostrwalletconnect:// or nostr+walletconnect://"
            type="password"
            value={connectionString}
          />
          <Button
            className="flex items-center justify-center gap-1"
            disabled={!connectionString.trim() || isConnecting}
            onClick={handleConnect}
            variant="secondary"
          >
            {isConnecting ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save</span>
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Alert>
            <SuccessIcon className="h-4 w-4" />
            <AlertTitle>Connected to NWC</AlertTitle>
            <AlertDescription>Your wallet is connected and ready to use</AlertDescription>
          </Alert>
          <Button
            className="flex items-center justify-center gap-1"
            onClick={handleDisconnect}
            variant="secondary"
          >
            <Delete className="h-4 w-4" />
            <span>Disconnect</span>
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-xl">Default Zap Amount</h3>
        <p>Set the default amount (in Sats) used when you click the Zap button.</p>
        <FormInput
          label="Default Sats per Zap"
          min="1"
          onChange={(e) => handleDefaultZapAmountChange(parseInt(e.target.value, 10))}
          type="number"
          value={defaultZapAmount}
        />
        <Button onClick={() => handleDefaultZapAmountChange(defaultZapAmount)} variant="secondary">
          Save Default Zap Amount
        </Button>
      </div>
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useNdk();
  const {
    defaultRelays,
    fetchNip65Relays,
    isPublishingNip65,
    nip65Event,
    publishNip65Relays,
    readRelays,
    relaySource,
    writeRelays,
  } = useNdk();

  // Redirect to home if not logged in
  React.useEffect(() => {
    if (!user) {
      toast.error("Please log in to access settings");
      navigate("/");
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  // Local state for editable relay lists
  const [editableReadRelays, setEditableReadRelays] = React.useState<string[]>(readRelays || []);
  const [editableWriteRelays, setEditableWriteRelays] = React.useState<string[]>(writeRelays || []);
  const [newReadRelay, setNewReadRelay] = React.useState("");
  const [newWriteRelay, setNewWriteRelay] = React.useState("");

  // Blossom Server State
  const [selectedBlossomOption, setSelectedBlossomOption] =
    React.useState<string>("https://blossom.band");
  const [customBlossomUrl, setCustomBlossomUrl] = React.useState<string>("");

  // Sync editable relay lists with context when context changes
  React.useEffect(() => {
    setEditableReadRelays(readRelays || []);
  }, [readRelays]);

  React.useEffect(() => {
    setEditableWriteRelays(writeRelays || []);
  }, [writeRelays]);

  // Load Blossom server setting
  React.useEffect(() => {
    const storedUrl = localStorage.getItem(LS_BLOSSOM_SERVER_URL_KEY) || "https://blossom.band";
    if (PREDEFINED_BLOSSOM_SERVERS[storedUrl]) {
      setSelectedBlossomOption(storedUrl);
    } else if (storedUrl) {
      setSelectedBlossomOption("custom");
      setCustomBlossomUrl(storedUrl);
    } else {
      setSelectedBlossomOption("https://blossom.band");
    }
  }, []);

  // --- Editable Relay List Handlers ---
  const handleAddEditableReadRelay = React.useCallback(() => {
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

  const handleRemoveEditableReadRelay = React.useCallback((relayToRemove: string) => {
    setEditableReadRelays((prev) => prev.filter((r) => r !== relayToRemove));
  }, []);

  const handleAddEditableWriteRelay = React.useCallback(() => {
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

  const handleRemoveEditableWriteRelay = React.useCallback((relayToRemove: string) => {
    setEditableWriteRelays((prev) => prev.filter((r) => r !== relayToRemove));
  }, []);

  const handleRestoreEditableDefaults = React.useCallback(() => {
    setEditableReadRelays(defaultRelays);
    setEditableWriteRelays(defaultRelays);
    toast.success("Editable lists reset to defaults. Publish to save.");
  }, [defaultRelays]);

  const handleDiscardChanges = React.useCallback(() => {
    setEditableReadRelays(readRelays || []);
    setEditableWriteRelays(writeRelays || []);
    toast("Changes discarded."); // Use base toast
  }, [readRelays, writeRelays]);

  // --- NIP-65 Handlers ---
  const handlePublishRelays = React.useCallback(async () => {
    if (!user) {
      toast.error("Please log in to publish a relay list.");
      return;
    }
    await publishNip65Relays(editableReadRelays, editableWriteRelays);
  }, [user, editableReadRelays, editableWriteRelays, publishNip65Relays]);

  const handleRefreshRelays = React.useCallback(async () => {
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

  // --- Blossom Server Handlers ---
  const handleBlossomSelectChange: FormInputSelectProps["onChange"] = (event) => {
    const value = event.target.value;
    setSelectedBlossomOption(value);
    if (value !== "custom") {
      setCustomBlossomUrl("");
    }
  };

  const handleSaveBlossomServer = React.useCallback(() => {
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
    <div className="flex flex-col gap-2">
      <h4 className="text-semibold text-lg">{title}</h4>

      <ul className="flex flex-col gap-1">
        {(editableList || []).map((relay) => (
          <li className="flex items-center justify-between" key={relay}>
            {relay}
            <Button
              className="text-xs text-gray-400"
              onClick={() => {
                removeHandler(relay);
              }}
              variant="tertiary"
            >
              <Delete />
            </Button>
          </li>
        ))}
        {(editableList || []).length === 0 && (
          <li className="text-center text-gray-400">List is empty.</li>
        )}
      </ul>

      <div className="flex items-center gap-2">
        <FormInput
          className="flex-1"
          label={`Add to ${title} (wss://...)`}
          onChange={(e) => setNewRelayValue(e.target.value)}
          value={newRelayValue}
        />
        <Button className="mt-6.5" onClick={addHandler} variant="secondary">
          Add
        </Button>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <div className="space-y-8">
        <NwcSettings />
        <div className="flex flex-col gap-6">
          <h2 className="text-2xl">Settings</h2>

          <div className="flex flex-col gap-2">
            <h3 className="text-xl">Media Upload Server (Blossom)</h3>
            <p>Choose the Blossom server (NIP-96/NIP-98 compliant) to upload images to.</p>

            <FormInputSelect
              label="Blossom Server"
              onChange={handleBlossomSelectChange}
              options={Object.entries(PREDEFINED_BLOSSOM_SERVERS).map(([value, label]) => ({
                label,
                value,
              }))}
              value={selectedBlossomOption}
            />

            {selectedBlossomOption === "custom" && (
              <FormInput
                label="Custom Blossom Server URL"
                onChange={(e) => setCustomBlossomUrl(e.target.value)}
                placeholder="https://your-blossom-server.com"
                value={customBlossomUrl}
              />
            )}
            <Button onClick={handleSaveBlossomServer} variant="secondary">
              Save Blossom Server Setting
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xl">Relay Management (NIP-65)</h3>
              {user && (
                <div className="group relative">
                  <Button onClick={handleRefreshRelays} variant="tertiary">
                    <RotateCw />
                  </Button>
                  <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 transform rounded bg-gray-800 px-2 py-1 text-sm whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">
                    Refresh NIP-65 List
                  </div>
                </div>
              )}
            </div>

            {relaySource === "loading" && (
              <Alert>
                <Loader />
                <AlertTitle>Relays</AlertTitle>
                <AlertDescription>Loading relay list.</AlertDescription>
              </Alert>
            )}
            {relaySource === "nip65" && nip65Event && (
              <Alert>
                <SuccessIcon />
                <AlertTitle>Relays</AlertTitle>
                <AlertDescription>
                  Using relays from your published NIP-65 list (updated:
                  {new Date(nip65Event.created_at! * 1000).toLocaleString()}).
                </AlertDescription>
              </Alert>
            )}
            {relaySource === "default" && user && (
              <Alert>
                <WarningIcon />
                <AlertTitle>Relays</AlertTitle>
                <AlertDescription>
                  No NIP-65 list found or list was empty. Using default relays. Publish a list below
                  to customize or refresh to try again.
                </AlertDescription>
              </Alert>
            )}
            {(relaySource === "logged_out" || (relaySource === "default" && !user)) && (
              <Alert>
                <InfoIcon />
                <AlertTitle>Relays</AlertTitle>
                <AlertDescription>
                  Using default relays. Log in to manage your personal relay list (NIP-65).
                </AlertDescription>
              </Alert>
            )}

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

            <div className="flex flex-col gap-2">
              <Button
                className="flex items-center justify-center gap-1"
                onClick={handleRestoreEditableDefaults}
                variant="secondary"
              >
                <History />
                Defaults
              </Button>
              <Button
                disabled={!hasUnpublishedChanges}
                onClick={handleDiscardChanges}
                variant="secondary"
              >
                Discard
              </Button>
              <Button
                className="flex items-center justify-center gap-1"
                disabled={
                  !user ||
                  isPublishingNip65 ||
                  (editableReadRelays.length === 0 && editableWriteRelays.length === 0) ||
                  !hasUnpublishedChanges
                }
                onClick={handlePublishRelays}
              >
                {isPublishingNip65 ? <Loader /> : <Save />}
                {isPublishingNip65 ? "Publishing..." : "Save & Publish Lists"}
              </Button>
            </div>

            {!user && <p>Log in to save and publish your relay lists.</p>}
            {user && !hasUnpublishedChanges && relaySource === "nip65" && (
              <p>No unpublished changes.</p>
            )}
            {user && hasUnpublishedChanges && <p>You have unpublished changes.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
