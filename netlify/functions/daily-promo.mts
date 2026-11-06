import type { Config } from "@netlify/functions";
import { runDailyPromoCycle } from "../../src/promo-engine";

export default async () => {
  const result = await runDailyPromoCycle();
  console.log("Daily CycleCipher global promo completed:", JSON.stringify(result));
  return Response.json(result);
};

export const config: Config = {
  schedule: "0 7 * * *", // Elke dag om 07:00 UTC (08:00 CET)
};
