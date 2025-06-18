import { useRelayList } from "@/hooks/useRelayList";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface RelaySelectorProps {
  className?: string;
}

export function RelaySelector({ className }: RelaySelectorProps) {
  const { user } = useCurrentUser();
  const relayList = useRelayList(user?.pubkey);

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="py-6 text-center">
          <p className="text-muted-foreground">
            Please log in to select relays.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (relayList.isLoading) {
    return (
      <div className={className}>
        <Skeleton className="h-10 w-full rounded" />
      </div>
    );
  }

  if (!relayList.data || relayList.data.relays.length === 0) {
    return (
      <div className={className}>
        <p className="text-muted-foreground text-sm">No relays configured.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-2">
        <p className="text-sm font-medium mb-2">Your Relays:</p>
        {relayList.data.relays.map((relay) => (
          <div
            key={relay.url}
            className="flex items-center justify-between border rounded px-3 py-2"
          >
            <span className="truncate text-xs">{relay.url}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {relay.read && relay.write
                ? "Read & Write"
                : relay.read
                ? "Read Only"
                : relay.write
                ? "Write Only"
                : "Disabled"}
            </span>
          </div>
        ))}
      </div>
      {/* In a full implementation, you could add relay switching here */}
    </div>
  );
}
