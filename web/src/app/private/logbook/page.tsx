import { LogbookForm } from "@/components/site/logbook-form";

export const dynamic = "force-dynamic";

export default function LogbookPage() {
  return (
    <main className="py-10">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-highlight">
        Append only
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Logbook</h1>
      <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">
        One line per thing that happened. Dated and formatted on the way in, so there is no
        markdown to type and nothing to get wrong at 11pm.
      </p>
      <LogbookForm />
    </main>
  );
}
