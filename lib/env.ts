import { config } from "dotenv";
// Next.js loads .env.local; CLI scripts share exactly the same configuration.
config({ path: ".env.local", quiet: true });
process.env.DATABASE_URL ||= "file:./beacon.db";
