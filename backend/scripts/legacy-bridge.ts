/**
 * Bridge the developer's existing data to the new customer app.
 *
 *   npx tsx scripts/legacy-bridge.ts slots                      dry run: report what would be created
 *   npx tsx scripts/legacy-bridge.ts slots --apply              create the booking-slot rows
 *   npx tsx scripts/legacy-bridge.ts loyalty --voucher-period=Day [--reference-period=Day]
 *   npx tsx scripts/legacy-bridge.ts loyalty --voucher-period=Day --apply
 *
 * Dry run is the default. Nothing existing is changed or deleted. Run it against a COPY of the real database first.
 * Against a non-local database, --apply also needs --i-have-a-backup so it cannot be run by accident.
 */
import "dotenv/config";
import { backfillBookingSlots, importLegacyLoyalty } from "../src/services/legacyBridge";
import { Period } from "../src/utils/loyaltyPoints";

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const apply = args.includes("--apply");

function host(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "(unknown)";
  }
}

async function main() {
  const h = host();
  const local = ["localhost", "127.0.0.1", "::1"].includes(h);
  console.log(`Database host: ${h}${local ? " (local)" : "  <-- NOT local"}`);
  if (apply && !local && !args.includes("--i-have-a-backup")) {
    console.error("Refusing to --apply on a non-local database without --i-have-a-backup. Take a backup first.");
    process.exit(2);
  }
  if (cmd === "slots") {
    console.log(JSON.stringify(await backfillBookingSlots({ apply, fromDate: flag("from") }), null, 2));
  } else if (cmd === "loyalty") {
    console.log(JSON.stringify(await importLegacyLoyalty({ apply, voucherPeriod: flag("voucher-period") as Period | undefined, referencePeriod: flag("reference-period") as Period | undefined }), null, 2));
  } else {
    console.error("Usage: legacy-bridge.ts slots|loyalty [--apply] [--voucher-period=Morning|Day|Evening]");
    process.exit(1);
  }
  if (!apply) console.log("\nDRY RUN: nothing was changed. Add --apply to do it.");
}

main().finally(() => process.exit(0));
