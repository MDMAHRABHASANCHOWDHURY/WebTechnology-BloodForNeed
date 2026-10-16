// Press F5 in VS Code. This file prepares the local database and starts the app.
const net = require("node:net");
const { spawnSync } = require("node:child_process");

function installMissingPackages()
{
    const packages = Object.keys(require("./package.json").dependencies);
    const missing = packages.some(name =>
    {
        try { require.resolve(name); return false; }
        catch (error) { return true; }
    });
    if (!missing) return;
    console.log("Installing project packages for first use. Please wait.");
    const result = process.platform === "win32"
        ? spawnSync("cmd.exe", ["/d", "/s", "/c", "npm install --no-audit --no-fund"], { cwd: __dirname, stdio: "inherit" })
        : spawnSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: __dirname, stdio: "inherit" });
    if (result.error || result.status !== 0) throw new Error("Package installation failed. Check Node.js and your internet connection, then press F5 again.");
}
async function mongoReady(uri, timeout = 1500)
{
    const { MongoClient } = require("mongoose").mongo;
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: timeout });
    try { await client.connect(); await client.db().command({ ping: 1 }); return true; }
    catch (error) { return false; }
    finally { await client.close(); }
}
async function waitForMongo(uri, attempts = 12)
{
    for (let attempt = 0; attempt < attempts; attempt++)
    {
        if (await mongoReady(uri, 1000)) return true;
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
}
async function ensureMongo(uri)
{
    if (await mongoReady(uri)) return;
    const localDefault = /^mongodb:\/\/(127\.0\.0\.1|localhost)(:27017)?\//.test(uri);
    if (process.platform !== "win32" || !localDefault)
        throw new Error("MongoDB is unavailable. Start the configured MongoDB server and press F5 again.");
    console.log("Starting the installed MongoDB Windows service.");
    const service = spawnSync("sc.exe", ["start", "MongoDB"], { encoding: "utf8", windowsHide: true });
    if (service.status === 0 && await waitForMongo(uri, 8)) return;
    if (await mongoReady(uri)) return;
    throw new Error("Windows could not start the existing MongoDB service automatically. Open services.msc, start MongoDB once, then press F5 again. Your existing database has not been changed.");
}
async function freePort(startPort)
{
    for (let port = startPort; port < startPort + 20; port++)
    {
        const available = await new Promise(resolve =>
        {
            const probe = net.createServer();
            probe.once("error", () => resolve(false));
            probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
        });
        if (available) return port;
    }
    throw new Error("No free website port was found. Stop an older debugging session and try F5 again.");
}
async function run()
{
    installMissingPackages();
    require("dotenv").config();
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/blood_donation";
    await ensureMongo(uri);
    const port = await freePort(Number(process.env.PORT) || 3000);
    console.log("Loading the hospital directory and starting Blood For Need.");
    return require("./server").start(port);
}
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { run, freePort, mongoReady };
