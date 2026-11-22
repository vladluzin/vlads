// Runs the scheduler once (optionally for a simulated time): npx tsx scripts/tick.ts [ISO-datetime]
import { runTick } from "../src/lib/notify/scheduler";

const now = process.argv[2] ? new Date(process.argv[2]) : new Date();
console.log(await runTick(now));
process.exit(0);
