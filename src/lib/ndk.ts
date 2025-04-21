import NDK, { NDKNip07Signer } from "@nostr-dev-kit/ndk"; // Corrected import name

// Define a list of default relays to connect to
const defaultRelays = [
    "wss://relay.damus.io",
    "wss://relay.primal.net",
    "wss://relay.snort.social",
];

// Create the NDK instance with explicit relays
const ndk = new NDK({
    explicitRelayUrls: defaultRelays,
});

// Optional: Create a NIP-07 signer instance.
// We don't assign it to ndk.signer here; the Login component will do that.
export const nip07signer = new NDKNip07Signer(); // Corrected instantiation

// Attempt to connect to the relays automatically upon instantiation
ndk.connect()
    .then(() => console.log("NDK connected"))
    .catch((error) => console.error("NDK connection error:", error));

export default ndk;
