import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PrivacyPolicy() {
  return (
    <div className="container px-4 py-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Privacy Policy</CardTitle>
          <p className="text-sm text-muted-foreground">Last updated: December 28, 2025</p>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold">Overview</h2>
            <p className="text-muted-foreground">
              Zappix is built with privacy in mind. We do not collect, store, or track any personal data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Data Collection</h2>
            <p className="text-muted-foreground">
              Zappix does not collect any user data. We do not use analytics, tracking pixels,
              cookies for tracking purposes, or any other data collection mechanisms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Nostr Protocol</h2>
            <p className="text-muted-foreground">
              Zappix is a Nostr client application. Any data you publish through Zappix is
              broadcast to the Nostr network according to the Nostr protocol. This data is
              stored on Nostr relays, which are independent servers not operated by us.
              Please be aware that information published to Nostr is public by design.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Local Storage</h2>
            <p className="text-muted-foreground">
              Zappix may store preferences and session data locally on your device using
              browser storage. This data never leaves your device and is not accessible to us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Third-Party Services</h2>
            <p className="text-muted-foreground">
              Zappix connects to Nostr relays to function. These relays are operated by
              third parties and may have their own privacy policies. We recommend reviewing
              the privacy practices of any relay you connect to.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Contact</h2>
            <p className="text-muted-foreground">
              If you have questions about this privacy policy, you can reach us through the
              Nostr network.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
