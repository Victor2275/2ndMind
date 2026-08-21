import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Scaffold smoke test. Replaced on day 7 by the real Home / About page.
 * Exists so the theme, fonts, and shadcn wiring are visibly verifiable.
 */
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
        Scaffold verified
      </p>

      <h1 className="mt-4 text-5xl font-extrabold tracking-tight">
        2ndMind
      </h1>

      <p className="mt-4 max-w-prose text-muted-foreground">
        Public portfolio and private second brain, both reading the same markdown
        vault. This page is a placeholder that proves the theme is wired up.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        <Badge>Gold primary</Badge>
        <Badge variant="secondary">Rose secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Theme check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Headings use Bricolage Grotesque, body uses Instrument Sans, and data
            uses IBM Plex Mono.
          </p>
          <p className="tabular font-mono text-sm">
            500m PR 2:17.0 &middot; 5k 18:50.0 &middot; split 1:53.0
          </p>
          <div className="flex gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
