import "dotenv/config";
import { seedDemoData } from "./db/seedData";

seedDemoData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
