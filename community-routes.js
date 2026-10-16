// Community features inspired by the public Badhan website, using this project's own data.
const { User, BloodRequest, CommunityPost, CommunityUnit, ContactMessage, DonationRecord, Hospital } = require("./database");
const v = require("./validation");
const { rankLocations, BANGLADESH_LOCATIONS } = require("./locations");
module.exports = function addCommunityRoutes(app, requireRole, wrap)
{
    app.get("/api/community", wrap(async (req, res) =>
    {
        const posts = await CommunityPost.find({ published: true }).sort({ date: -1, createdAt: -1 }).lean();
        const units = await CommunityUnit.find({ active: true }).populate("parent", "name").sort({ name: 1 }).lean();
        const stats = { members: await User.countDocuments({ status: "active", role: { $in: ["donor", "volunteer"] } }), donors: await User.countDocuments({ status: "active", role: "donor" }), donations: await DonationRecord.countDocuments(), units: units.filter(unit => unit.kind === "unit").length };
        res.json({ posts, units, stats });
    }));
    app.get("/api/donors/search", wrap(async (req, res) =>
    {
        const group = String(req.query.group || "");
        if (!Object.hasOwn(v.CAN_RECEIVE, group)) v.fail("Select a recipient blood group.");
        const filter = { status: "active", role: { $in: ["donor", "volunteer"] }, available: true, bloodGroup: { $in: v.CAN_RECEIVE[group] }, $or: [{ lastDonation: null }, { lastDonation: { $lte: new Date(Date.now() - 120 * 86400000) } }] };
        if (req.query.district) filter.district = String(req.query.district);
        const donors = await User.find(filter).select("name bloodGroup area district postalCode").limit(200).lean();
        rankLocations(donors, String(req.query.postalCode || ""), String(req.query.area || ""));
        res.json({ donors, note: "Contact details stay private. Approved medical staff coordinate donor contact." });
    }));
    const limits = new Map();
    app.post("/api/contact", wrap(async (req, res) =>
    {
        if ((limits.get(req.ip) || 0) > Date.now() - 60000) v.fail("Wait a minute before sending another message.", 429);
        const email = v.text(req.body, "email").toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) v.fail("Enter a valid email.");
        await ContactMessage.create({ name: v.text(req.body, "name"), email, subject: v.text(req.body, "subject"), message: v.text(req.body, "message", true, 3000) });
        limits.set(req.ip, Date.now()); res.status(201).json({ message: "Your message has been saved for administrator review." });
    }));
    app.get("/api/admin/community", requireRole("admin"), wrap(async (req, res) => res.json({ posts: await CommunityPost.find().sort({ createdAt: -1 }).lean(), units: await CommunityUnit.find().populate("parent", "name").lean(), messages: await ContactMessage.find().sort({ createdAt: -1 }).lean() })));
    app.post("/api/admin/community/posts", requireRole("admin"), wrap(async (req, res) =>
    {
        if (!["news", "activity"].includes(req.body.kind)) v.fail("Invalid content type.");
        await CommunityPost.create({ title: v.text(req.body, "title", true, 180), body: v.text(req.body, "body", true, 5000), kind: req.body.kind, date: req.body.date ? v.date(req.body.date) : new Date(), published: true, author: req.user._id });
        res.status(201).json({ message: "Community update published." });
    }));
    app.put("/api/admin/community/posts/:id", requireRole("admin"), wrap(async (req, res) =>
    {
        if (typeof req.body.published !== "boolean") v.fail("Choose a publication status.");
        const result = await CommunityPost.updateOne({ _id: req.params.id }, { $set: { published: req.body.published } });
        if (!result.matchedCount) v.fail("Post not found.", 404); res.json({ message: "Publication status updated." });
    }));
    app.post("/api/admin/community/units", requireRole("admin"), wrap(async (req, res) =>
    {
        const kind = req.body.kind, division = v.text(req.body, "division");
        if (!["zone", "unit"].includes(kind) || !Object.hasOwn(BANGLADESH_LOCATIONS, division)) v.fail("Choose a valid zone/unit and division.");
        const district = v.text(req.body, "district", false);
        if (district && !BANGLADESH_LOCATIONS[division].includes(district)) v.fail("District must match the division.");
        let parent = null;
        if (req.body.parent) { parent = await CommunityUnit.findOne({ _id: req.body.parent, kind: "zone", active: true }); if (!parent || parent.division !== division) v.fail("Choose a zone in the same division."); }
        const contactEmail = v.text(req.body, "contactEmail", false);
        if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) v.fail("Enter a valid contact email.");
        await CommunityUnit.create({ name: v.text(req.body, "name"), kind, division, parent: parent?._id || null, district, contactEmail });
        res.status(201).json({ message: "Community zone/unit added." });
    }));
    app.put("/api/admin/community/messages/:id", requireRole("admin"), wrap(async (req, res) =>
    {
        if (!["reviewed", "resolved"].includes(req.body.status)) v.fail("Invalid status.");
        const result = await ContactMessage.updateOne({ _id: req.params.id }, { $set: { status: req.body.status } });
        if (!result.matchedCount) v.fail("Message not found.", 404); res.json({ message: "Message status updated." });
    }));
    app.get("/api/users/me/donations", requireRole("donor", "volunteer"), wrap(async (req, res) =>
    {
        const records = await DonationRecord.find({ donor: req.user._id }).populate("request", "hospital bloodGroup").sort({ donationDate: -1 }).lean();
        res.json({ records, nextDate: req.user.lastDonation ? new Date(req.user.lastDonation.getTime() + 120 * 86400000) : null });
    }));
    app.post("/api/staff/donations", requireRole("staff"), wrap(async (req, res) =>
    {
        const request = await BloodRequest.findOne({ _id: req.body.request, createdBy: req.user._id });
        if (!request) v.fail("Choose one of your patient requests.");
        const donor = await User.findOne({ _id: req.body.donor, status: "active", role: { $in: ["donor", "volunteer"] } });
        if (!donor || !request.pledges.some(id => id.equals(donor._id))) v.fail("Donor must have pledged to the selected request.");
        const donationDate = v.date(req.body.donationDate);
        if (donationDate > Date.now()) v.fail("Donation date cannot be in the future.");
        await DonationRecord.create({ donor: donor._id, request: request._id, recordedBy: req.user._id, donationDate, notes: v.text(req.body, "notes", false, 1000) });
        await User.updateOne({ _id: donor._id }, { $max: { lastDonation: donationDate } });
        res.status(201).json({ message: "Donation verified and recorded." });
    }));
    app.get("/api/admin/reports", requireRole("admin"), wrap(async (req, res) => res.json({ accounts: await User.aggregate([{ $group: { _id: "$role", total: { $sum: 1 } } }]), requests: await BloodRequest.aggregate([{ $group: { _id: "$status", total: { $sum: 1 } } }]), donations: await DonationRecord.countDocuments(), hospitals: await Hospital.countDocuments({ active: true }), pendingAccounts: await User.countDocuments({ status: "pending" }) })));
};
