// Local helper: record a fake goods sale for a demo customer (adds loyalty points). Local database only.
import "dotenv/config";
import { assertSafeDatabaseUrl } from "../src/config/env";
assertSafeDatabaseUrl(process.env.DATABASE_URL ?? "", "development");
import loyaltyService from "../src/modules/loyalty/loyalty.service";

const [phone, amount] = process.argv.slice(2);
loyaltyService
  .recordGoodsSale({ phone, amount: Number(amount), items: "dev sale", soldBy: "dev-script" })
  .then((r) => console.log(r))
  .finally(() => process.exit(0));
