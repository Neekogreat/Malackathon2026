require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const proxyRoutes = require("./routes/proxy.routes");
const apiRoutes = require("./routes/api.routes");

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "AI FinOps backend funcionando"
  });
});

app.use("/", proxyRoutes);
app.use("/api", apiRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});