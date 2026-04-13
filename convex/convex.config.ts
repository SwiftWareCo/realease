import { defineApp } from "convex/server";
import aggregate from "@convex-dev/aggregate/convex.config.js";

const app = defineApp();
app.use(aggregate, { name: "outreachStateCounts" });
app.use(aggregate, { name: "outreachCallOutcomeCounts" });
export default app;
