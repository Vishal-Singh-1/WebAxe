import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    console.error(`MongoDB diagnostic: ${err.name || "unknown error"}${err.code ? ` (${err.code})` : ""}`);

    const servers = err.reason?.servers;
    if (servers instanceof Map) {
      for (const [address, server] of servers) {
        const cause = server.error;
        console.error(
          `MongoDB server ${address}: ${cause?.name || "unavailable"}${cause?.code ? ` (${cause.code})` : ""}${cause?.message ? ` — ${cause.message}` : ""}`
        );
      }
    }
    process.exit(1);
  }
};

export default connectDB;
