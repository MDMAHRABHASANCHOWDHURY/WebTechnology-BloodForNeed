// Blood For Need: one backend file, divided into named sections.
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const { User, BloodRequest, PasswordRequest, Hospital } = require("./database");
const v = require("./validation");
const { rankLocations } = require("./locations");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
let httpServer;

// LOGIN AND ROLE CHECKS
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const requireRole = (...roles) =>
    wrap(async (req, res, next) =>
    {
        if (!req.session.userId) return res.status(401).json({ error: "Please log in." });
        const user = await User.findById(req.session.userId).select("+authVersion");
        if (!user || user.status !== "active" || user.authVersion !== req.session.authVersion)
            return res
                .status(401)
                .json({ error: "Your session has expired or your account is inactive." });
        if (roles.length && !roles.includes(user.role))
            return res.status(403).json({ error: "Access denied." });
        req.user = user;
        next();
    });

// PHOTO UPLOAD
const directory = __dirname;
fs.mkdirSync(directory, { recursive: true });
const upload = multer({
    storage: multer.diskStorage({
        destination: directory,
        filename: (req, file, cb) =>
            cb(
                null,
                crypto.randomBytes(16).toString("hex") +
                    (/\.png$/i.test(file.originalname) ? ".png" : ".jpg"),
            ),
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) =>
    {
        if (
            !["image/jpeg", "image/png"].includes(file.mimetype) ||
            !/\.(jpe?g|png)$/i.test(file.originalname)
        )
            return cb(new Error("Only JPEG and PNG photos are allowed."));
        cb(null, true);
    },
});
function verifyPhoto(file)
{
    if (!file) return;
    const buffer = fs.readFileSync(file.path);
    const png =
        buffer.length > 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = buffer.length > 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
    if (!((file.mimetype === "image/png" && png) || (file.mimetype === "image/jpeg" && jpeg)))
    {
        fs.unlinkSync(file.path);
        const e = new Error("Invalid image contents.");
        e.status = 400;
        throw e;
    }
}

// STARTUP: MongoDB, administrator and session storage.
async function start(port = process.env.PORT || 3000)
{
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/blood_donation";
    const production = process.env.NODE_ENV === "production";
    if (production && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32))
        throw new Error("Set SESSION_SECRET before production use.");
    let secret = process.env.SESSION_SECRET;
    if (!process.env.ADMIN_INVITE_CODE && !production) process.env.ADMIN_INVITE_CODE = "ADMIN-2026";
    await mongoose.connect(uri);
    if (!secret)
    {
        const settings = await mongoose.connection.db.collection("app_settings").findOneAndUpdate(
            { _id: "session" }, { $setOnInsert: { secret: crypto.randomBytes(32).toString("hex") } },
            { upsert: true, returnDocument: "after" }
        );
        secret = settings.secret;
    }
    await Promise.all([User.init(), BloodRequest.init(), PasswordRequest.init(), Hospital.init(), require("./database").DonationRecord.init()]);
    const registry = JSON.parse(
        fs.readFileSync(path.join(__dirname, "hospital-data.json"), "utf8"),
    );
    if ((await Hospital.countDocuments({ source: "DGHS registry" })) < registry.hospitals.length)
    {
        for (let offset = 0; offset < registry.hospitals.length; offset += 500)
            await Hospital.bulkWrite(
                registry.hospitals.slice(offset, offset + 500).map((item) => ({
                    updateOne: {
                        filter: { registryCode: item.registryCode },
                        update: { $setOnInsert: item },
                        upsert: true,
                    },
                })),
            );
    }

    if (process.env.AUTO_ADMIN !== "false" && !(await User.exists({ username: "admin" })))
    {
        await User.create({
            role: "admin",
            name: "Admin",
            username: "admin",
            email: "admin@site.test",
            passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || "admin123", 12),
            status: "active",
            available: false,
        });
        console.log("Administrator created. Username: admin.");
    }
    // Demo accounts are created once. Existing users and passwords are preserved.
    const demoRoles = ["donor", "volunteer", "staff", "admin"];
    for (const role of demoRoles)
    {
        const username = "demo_" + role;
        if (await User.exists({ username })) continue;
        const account = {
            role, username, name: "Demo " + (role === "staff" ? "Medical Staff" : role.charAt(0).toUpperCase() + role.slice(1)),
            email: username + "@bloodforneed.local", phone: "+880170000000" + demoRoles.indexOf(role),
            countryCode: "+880", area: "Gulshan", division: "Dhaka", district: "Dhaka",
            cityCorporation: "Dhaka North", postalCode: "1212", status: "active",
            passwordHash: await bcrypt.hash(username + "123", 12), available: ["donor", "volunteer"].includes(role)
        };
        if (["donor", "volunteer"].includes(role)) Object.assign(account, { bloodGroup: "O-", age: 25, weight: 65, lastDonation: null, skills: role === "volunteer" ? ["Donation Coordination"] : [] });
        if (role === "staff")
        {
            const facility = await Hospital.findOne({ district: "Dhaka", type: /Hospital/ });
            Object.assign(account, { hospital: facility?.name || "Demo Hospital", designation: "Medical Staff", staffId: "DEMO-STAFF-01" });
        }
        await User.create(account);
    }
    app.use(
        session({
            name: "bfn.sid",
            secret,
            resave: false,
            saveUninitialized: false,
            rolling: true,
            store: MongoStore.create({
                client: mongoose.connection.getClient(),
                dbName: mongoose.connection.name,
            }),
            cookie: {
                httpOnly: true,
                sameSite: "strict",
                secure: process.env.NODE_ENV === "production",
                maxAge: 8 * 3600000,
            },
        }),
    );
    app.use("/api", (req, res, next) =>
    {
        res.set("Cache-Control", "no-store");
        if (!["GET", "HEAD"].includes(req.method))
        {
            const origin = req.get("origin");
            if (origin && origin !== `${req.protocol}://${req.get("host")}`)
                return res.status(403).json({ error: "Invalid origin." });
            const publicAuth = ["/auth/login", "/auth/register", "/requests/public"].includes(req.path);
            if (!publicAuth && req.session.userId && req.get("x-csrf-token") !== req.session.csrfToken)
                return res.status(403).json({ code: "CSRF_TOKEN_MISMATCH", error: "Your form token expired. Please try again." });
        }
        next();
    });

    // AUTH PAGES AND FEATURES
    const attempts = new Map();
    app.post(
        "/api/auth/register",
        upload.single("photo"),
        wrap(async (req, res) =>
        {
            try
            {
                verifyPhoto(req.file);
                const u = v.userInput(req.body);
                if (!["true", true, "on"].includes(req.body.terms)) v.fail("Accept the terms.");
                if (u.role === "admin")
                {
                    const code = process.env.ADMIN_INVITE_CODE;
                    if (!code || req.body.inviteCode !== code)
                        v.fail("Invalid admin invite code.", 403);
                }
                u.passwordHash = await bcrypt.hash(v.password(req.body.password), 12);
                u.status = u.role === "admin" ? "active" : "pending";
                if (req.file) u.photo = req.file.filename;
                await User.create(u);
                res.status(201).json({
                    message:
                        u.status === "pending"
                            ? "Registration submitted. Wait for administrator approval."
                            : "Administrator account created. You can log in.",
                });
            } catch (e)
            {
                if (req.file) require("fs").rmSync(req.file.path, { force: true });
                throw e;
            }
        }),
    );
    app.post(
        "/api/auth/login",
        wrap(async (req, res) =>
        {
            const identity = v.text(req.body, "identity").toLowerCase();
            const a = attempts.get(identity);
            if (a?.until > Date.now()) v.fail("Too many attempts. Try again in 15 minutes.", 429);
            const user = await User.findOne({
                $or: [{ email: identity }, { username: identity }],
            }).select("+passwordHash +authVersion");
            const matches =
                user &&
                (await bcrypt.compare(
                    String(req.body.password || "").slice(0, 72),
                    user.passwordHash,
                ));
            if (!matches)
            {
                const count = a && !a.until ? a.count + 1 : 1;
                attempts.set(identity, { count, until: count >= 5 ? Date.now() + 900000 : 0 });
                v.fail("Incorrect email, username or password.", 401);
            }
            if (user.status !== "active") v.fail("Account is pending, rejected or suspended.", 403);
            attempts.delete(identity);
            await new Promise((resolve, reject) =>
                req.session.regenerate((e) => (e ? reject(e) : resolve())),
            );
            req.session.userId = String(user._id);
            req.session.authVersion = user.authVersion;
            req.session.csrfToken = crypto.randomBytes(24).toString("hex");
            await new Promise((resolve, reject) =>
                req.session.save((e) => (e ? reject(e) : resolve())),
            );
            res.json({ role: user.role, csrfToken: req.session.csrfToken });
        }),
    );
    app.post(
        "/api/auth/logout",
        wrap(async (req, res) =>
        {
            await new Promise((resolve, reject) =>
                req.session.destroy((e) => (e ? reject(e) : resolve())),
            );
            res.clearCookie("bfn.sid");
            res.json({ message: "Logged out." });
        }),
    );
    // USERS PAGES AND FEATURES
    require("./community-routes")(app, requireRole, wrap);
    require("./public-requests")(app, requireRole, wrap);
    app.use("/api/users", requireRole());
    app.get("/api/users/me", (req, res) =>
    {
        const user = req.user.toObject();
        delete user.authVersion;
        res.json({ user, csrfToken: req.session.csrfToken });
    });
    app.put(
        "/api/users/me",
        wrap(async (req, res) =>
        {
            const d = req.body,
                updates = {
                    name: v.text(d, "name"),
                    area: v.text(d, "area"),
                    phone: v.phone(d.phone, d.countryCode || "+880"),
                    countryCode: d.countryCode || "+880",
                    ...v.address(d),
                };
            if (["donor", "volunteer"].includes(req.user.role))
            {
                if (!v.CAN_RECEIVE[d.bloodGroup] || typeof d.available !== "boolean")
                    v.fail("Invalid donor details.");
                Object.assign(updates, {
                    bloodGroup: d.bloodGroup,
                    age: v.number(d.age, "age", 18, 65),
                    weight: v.number(d.weight, "weight", 45, 300),
                    available: d.available,
                    skills: v
                        .text(d, "skills", false, 255)
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    lastDonation: d.lastDonation ? v.date(d.lastDonation) : null,
                });
                if (updates.lastDonation > Date.now())
                    v.fail("Donation date cannot be in the future.");
            }
            if (req.user.role === "staff")
                Object.assign(updates, {
                    hospital: v.text(d, "hospital"),
                    designation: v.text(d, "designation"),
                    staffId: v.text(d, "staffId"),
                });
            const email = v.text(d, "email").toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) v.fail("Enter a valid email.");
            updates.email = email;
            await User.updateOne({ _id: req.user._id }, { $set: updates });
            res.json({ message: "Profile updated." });
        }),
    );
    app.post(
        "/api/users/me/photo",
        upload.single("photo"),
        wrap(async (req, res) =>
        {
            if (!req.file) v.fail("Choose a photo.");
            try
            {
                verifyPhoto(req.file);
                await User.updateOne({ _id: req.user._id }, { $set: { photo: req.file.filename } });
                if (req.user.photo)
                    require("fs").rmSync(
                        require("path").join(
                            __dirname,
                            "",
                            require("path").basename(req.user.photo),
                        ),
                        { force: true },
                    );
                res.json({ message: "Photo updated.", photo: req.file.filename });
            } catch (e)
            {
                require("fs").rmSync(req.file.path, { force: true });
                throw e;
            }
        }),
    );
    app.get(
        "/api/users/me/password-requests",
        wrap(async (req, res) =>
            res.json(
                await PasswordRequest.find({ user: req.user._id }).sort({ createdAt: -1 }).lean(),
            ),
        ),
    );
    app.post(
        "/api/users/me/password-request",
        wrap(async (req, res) =>
        {
            const user = await User.findById(req.user._id).select("+passwordHash");
            if (
                typeof req.body.currentPassword !== "string" ||
                !(await bcrypt.compare(req.body.currentPassword, user.passwordHash))
            )
                v.fail("Current password is incorrect.", 403);
            if (await PasswordRequest.exists({ user: user._id, status: "pending" }))
                v.fail("A password change is already pending.", 409);
            await PasswordRequest.create({
                user: user._id,
                newPasswordHash: await bcrypt.hash(v.password(req.body.newPassword), 12),
            });
            res.status(201).json({
                message: "Password change submitted for administrator approval.",
            });
        }),
    );
    // REQUESTS PAGES AND FEATURES
    app.get(
        "/api/hospitals",
        requireRole(),
        wrap(async (req, res) =>
        {
            const search = String(req.query.search || "")
                .trim()
                .slice(0, 100);
            const area = String(req.query.area || "")
                .trim()
                .toLowerCase();
            const postalCode = String(req.query.postalCode || "").trim();
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = 50;
            const filter = { active: true };
            if (search)
                filter.name = {
                    $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                    $options: "i",
                };
            if (req.query.district) filter.district = String(req.query.district);
            const total = await Hospital.countDocuments(filter);
            const items = await Hospital.aggregate([
                { $match: filter },
                {
                    $addFields: {
                        postcodeMatch: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: [postalCode, ""] },
                                        { $eq: ["$postalCode", postalCode] },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                        areaMatch: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: [area, ""] },
                                        { $eq: [{ $toLower: { $ifNull: ["$area", ""] } }, area] },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                        missingPostcode: {
                            $cond: [{ $eq: [{ $ifNull: ["$postalCode", ""] }, ""] }, 1, 0],
                        },
                    },
                },
                {
                    $sort: {
                        postcodeMatch: -1,
                        areaMatch: -1,
                        missingPostcode: 1,
                        postalCode: 1,
                        area: 1,
                        name: 1,
                        _id: 1,
                    },
                },
                { $skip: (page - 1) * limit },
                { $limit: limit },
                { $project: { postcodeMatch: 0, areaMatch: 0, missingPostcode: 0 } },
            ]);
            res.json({
                items,
                total,
                page,
                pages: Math.ceil(total / limit),
                coverage: registry.coverage,
            });
        }),
    );
    app.post(
        "/api/admin/hospitals",
        requireRole("admin"),
        wrap(async (req, res) =>
        {
            const item = {
                name: v.text(req.body, "name"),
                type: v.text(req.body, "type"),
                ...v.address(req.body),
                source: "Administrator supplied",
                active: true,
            };
            await Hospital.create(item);
            res.status(201).json({ message: "Hospital / clinic added." });
        }),
    );
    app.put(
        "/api/admin/hospitals/:id",
        requireRole("admin"),
        wrap(async (req, res) =>
        {
            const result = await Hospital.updateOne(
                { _id: req.params.id },
                { $set: v.address(req.body) },
            );
            if (!result.matchedCount) v.fail("Hospital not found.", 404);
            res.json({ message: "Hospital address and postcode updated." });
        }),
    );
    app.get(
        "/api/requests/open",
        wrap(async (req, res) =>
        {
            const filter = { status: "open" };
            if (req.query.group)
            {
                if (!v.CAN_RECEIVE[req.query.group]) v.fail("Invalid blood group.");
                filter.bloodGroup = req.query.group;
            }
            const rows = await BloodRequest.find(filter)
                .select(
                    "hospital area district division postalCode bloodGroup units condition neededBy",
                )
                .sort({ neededBy: 1 })
                .lean();
            rankLocations(rows, String(req.query.postalCode || ""), String(req.query.area || ""));
            const hospitals = new Map();
            for (const row of rows)
            {
                const key = row.hospital + "|" + row.area + "|" + (row.postalCode || "");
                if (!hospitals.has(key))
                    hospitals.set(key, {
                        hospital: row.hospital,
                        area: row.area,
                        district: row.district,
                        postalCode: row.postalCode,
                        requests: [],
                    });
                hospitals.get(key).requests.push(row);
            }
            res.json([...hospitals.values()]);
        }),
    );
    app.get(
        "/api/requests/all",
        requireRole(),
        wrap(async (req, res) =>
        {
            const filter = {};
            if (req.query.group)
            {
                if (!v.CAN_RECEIVE[req.query.group]) v.fail("Invalid blood group.");
                filter.bloodGroup = req.query.group;
            }
            const rows = await BloodRequest.find(filter)
                .select(
                    "hospital area district division postalCode bloodGroup units condition neededBy status",
                )
                .sort({ createdAt: -1 })
                .lean();
            rankLocations(rows, String(req.query.postalCode || ""), String(req.query.area || ""));
            const hospitals = new Map();
            for (const row of rows)
            {
                const key = row.hospital + "|" + row.area + "|" + (row.postalCode || "");
                if (!hospitals.has(key))
                    hospitals.set(key, {
                        hospital: row.hospital,
                        area: row.area,
                        district: row.district,
                        postalCode: row.postalCode,
                        requests: [],
                    });
                hospitals.get(key).requests.push(row);
            }
            res.json([...hospitals.values()]);
        }),
    );
    app.get(
        "/api/requests/mine",
        requireRole("donor", "volunteer"),
        wrap(async (req, res) =>
            res.json(
                await BloodRequest.find({ pledges: req.user._id })
                    .select("hospital area bloodGroup units status neededBy contactPhone patient.name")
                    .sort({ createdAt: -1 })
                    .lean(),
            ),
        ),
    );
    app.post(
        "/api/requests/:id/pledge",
        requireRole("donor", "volunteer"),
        wrap(async (req, res) =>
        {
            if (!/^[a-f\d]{24}$/i.test(req.params.id)) v.fail("Invalid request.");
            const r = await BloodRequest.findOne({ _id: req.params.id, status: "open" });
            if (!r) v.fail("Open request not found.", 404);
            const u = req.user;
            if (
                !u.available ||
                !v.CAN_RECEIVE[r.bloodGroup].includes(u.bloodGroup) ||
                (u.lastDonation && u.lastDonation > new Date(Date.now() - 120 * 86400000))
            )
                v.fail("Your profile does not meet matching and 120-day interval rules.");
            const result = await BloodRequest.updateOne(
                { _id: r._id, status: "open", pledges: { $ne: u._id } },
                { $addToSet: { pledges: u._id } },
            );
            if (!result.modifiedCount)
                v.fail("You already pledged or this request has closed.", 409);
            res.json({ message: "Pledge recorded. Medical staff can contact you." });
        }),
    );
    // STAFF PAGES AND FEATURES
    app.use("/api/staff", requireRole("staff"));
    app.get(
        "/api/staff/donors",
        wrap(async (req, res) =>
        {
            const { group, area } = req.query;
            if (typeof group !== "string" || !v.CAN_RECEIVE[group] || typeof area !== "string")
                v.fail("Choose blood group and area.");
            const donors = await User.find({
                role: { $in: ["donor", "volunteer"] },
                status: "active",
                available: true,
                bloodGroup: { $in: v.CAN_RECEIVE[group] },
                $or: [
                    { lastDonation: null },
                    { lastDonation: { $lte: new Date(Date.now() - 120 * 86400000) } },
                ],
            })
                .select("name phone email area district postalCode bloodGroup lastDonation photo")
                .lean();
            rankLocations(donors, String(req.query.postalCode || ""), area);
            res.json(donors);
        }),
    );
    app.get(
        "/api/staff/requests",
        wrap(async (req, res) =>
            res.json(
                await BloodRequest.find({ createdBy: req.user._id })
                    .populate("pledges", "name phone email bloodGroup area")
                    .sort({ createdAt: -1 })
                    .lean(),
            ),
        ),
    );
    app.post(
        "/api/staff/requests",
        wrap(async (req, res) =>
        {
            const d = req.body;
            if (
                !v.CAN_RECEIVE[d.bloodGroup] ||
                !["Critical", "Serious", "Stable"].includes(d.condition) ||
                !["Male", "Female", "Other"].includes(d.gender)
            )
                v.fail("Invalid patient details.");
            const facility = await Hospital.findById(d.hospitalId);
            if (!facility) v.fail("Choose a hospital or clinic from the directory.");
            const requestAddress = v.address(d);
            if (
                (facility.division && facility.division !== requestAddress.division) ||
                (facility.district && facility.district !== requestAddress.district)
            )
                v.fail("Request division and district must match the selected facility.");
            await BloodRequest.create({
                hospitalId: facility._id,
                hospital: facility.name,
                ...requestAddress,
                patient: {
                    name: v.text(d, "patientName"),
                    age: v.number(d.patientAge, "patient age", 0, 120),
                    gender: d.gender,
                },
                bloodGroup: d.bloodGroup,
                units: v.number(d.units, "units", 1, 20),
                disease: v.text(d, "disease"),
                condition: d.condition,
                conditionNote: v.text(d, "conditionNote", false, 1000),
                ward: v.text(d, "ward"),
                neededBy: v.date(d.neededBy, true),
                contactPhone: v.phone(d.contactPhone),
                createdBy: req.user._id,
            });
            res.status(201).json({ message: "Patient request created." });
        }),
    );
    app.put(
        "/api/staff/requests/:id/status",
        wrap(async (req, res) =>
        {
            if (!["fulfilled", "cancelled"].includes(req.body.status)) v.fail("Invalid status.");
            const r = await BloodRequest.updateOne(
                { _id: req.params.id, createdBy: req.user._id, status: "open" },
                { $set: { status: req.body.status } },
            );
            if (!r.modifiedCount) v.fail("Your open request was not found.", 404);
            res.json({ message: "Request updated." });
        }),
    );
    // ADMIN PAGES AND FEATURES
    app.use("/api/admin", requireRole("admin"));
    app.get(
        "/api/admin/pending",
        wrap(async (req, res) =>
            res.json(await User.find({ status: "pending" }).sort({ createdAt: 1 }).lean()),
        ),
    );
    app.get(
        "/api/admin/users",
        wrap(async (req, res) => res.json(await User.find().sort({ createdAt: -1 }).lean())),
    );
    app.post(
        "/api/admin/users",
        wrap(async (req, res) =>
        {
            const u = v.userInput(req.body);
            if (u.role === "admin") v.fail("Create administrators through invite registration.");
            await User.create({
                ...u,
                status: "active",
                passwordHash: await bcrypt.hash(v.password(req.body.password), 12),
            });
            res.status(201).json({ message: "Active account created." });
        }),
    );
    app.put(
        "/api/admin/users/:id/status",
        wrap(async (req, res) =>
        {
            if (!["active", "rejected", "suspended"].includes(req.body.status))
                v.fail("Invalid status.");
            if (req.params.id === String(req.user._id))
                v.fail("You cannot change your own account status.");
            const r = await User.updateOne(
                { _id: req.params.id },
                { $set: { status: req.body.status }, $inc: { authVersion: 1 } },
            );
            if (!r.matchedCount) v.fail("Account not found.", 404);
            res.json({ message: "Account status updated." });
        }),
    );
    app.get(
        "/api/admin/password-requests",
        wrap(async (req, res) =>
            res.json(
                await PasswordRequest.find()
                    .populate("user", "name username email")
                    .sort({ createdAt: -1 })
                    .lean(),
            ),
        ),
    );
    app.put(
        "/api/admin/password-requests/:id",
        wrap(async (req, res) =>
        {
            if (!["approved", "rejected"].includes(req.body.status)) v.fail("Invalid decision.");
            const p = await PasswordRequest.findOneAndUpdate(
                { _id: req.params.id, status: "pending" },
                { $set: { status: req.body.status } },
                { new: false },
            ).select("+newPasswordHash");
            if (!p) v.fail("Pending request not found.", 404);
            if (req.body.status === "approved")
                await User.updateOne(
                    { _id: p.user },
                    { $set: { passwordHash: p.newPasswordHash }, $inc: { authVersion: 1 } },
                );
            res.json({ message: "Password request " + req.body.status + "." });
        }),
    );
    app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
    app.use((req, res, next) =>
    {
        res.set("X-Content-Type-Options", "nosniff");
        next();
    });
    // Serve only frontend files. Backend and configuration files stay private.
    const frontendFiles = ["public-request.js", "upazilas.js", "community-ui.js", 
        "locations.js",
        "donation-bangladesh.png",
        "community-bangladesh.png",
        "register.css",
        "bootstrap.min.css",
        "role.js",
        "role.html",
        "admin.css",
        "staff.css",
        "user.js",
        "index.js",
        "admin.html",
        "login.js",
        "register.js",
        "index.css",
        "common.js",
        "common.css",
        "terms.css",
        "index.html",
        "register.html",
        "staff.html",
        "role.css",
        "user.html",
        "admin.js",
        "staff.js",
        "terms.html",
        "login.css",
        "logo.png",
        "user.css",
        "login.html",
    ];
    app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
    app.get("/:file", (req, res, next) =>
    {
        const file = req.params.file;
        const photo = /^[a-f0-9]{32}\.(jpg|png)$/.test(file);
        if (!frontendFiles.includes(file) && !photo) return next();
        res.sendFile(path.join(__dirname, file));
    });
    app.use((err, req, res, next) =>
    {
        if (err.code === 11000)
            return res.status(409).json({ error: "Username or email already registered." });
        if (
            err.name === "CastError" ||
            err.name === "ValidationError" ||
            err.name === "MulterError"
        )
            return res.status(400).json({
                error:
                    err.code === "LIMIT_FILE_SIZE"
                        ? "Photo must be smaller than 2 MB."
                        : "Invalid form data.",
            });
        if (err.message === "Only JPEG and PNG photos are allowed.") err.status = 400;
        res.status(err.status || 500).json({
            error: err.status ? err.message : "Server error. Please try again.",
        });
    });
    httpServer = app.listen(port, "127.0.0.1", () =>
        console.log(`http://localhost:${httpServer.address().port}`),
    );
    return httpServer;
}
if (require.main === module)
{
    start().catch((error) =>
    {
        console.error("Could not start: " + error.message);
        console.error("Make sure MongoDB is running, then run npm start again.");
        process.exit(1);
    });
}
module.exports = { app, start };
