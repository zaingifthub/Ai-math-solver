/* Cron-friendly cleanup: `npm run cleanup:uploads` (or call GET /api/cron/cleanup with the CRON_SECRET). */
const url = process.env.CLEANUP_URL ?? `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/cron/cleanup`;

async function main() {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` } });
  const body = await res.text();
  console.log(res.status, body);
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
