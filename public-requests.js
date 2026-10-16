// Public submission does not require an account. Names and contact details remain private.
const { BloodRequest } = require("./database");
const v = require("./validation");
const { BANGLADESH_LOCATIONS } = require("./locations");
const { UPAZILAS } = require("./upazilas");
module.exports = (app, requireRole, wrap) => {
    const submissions = new Map();
    app.post("/api/requests/public", wrap(async (req, res) => {
        const now = Date.now();
        for (const [ip, timestamps] of submissions) {
            const recent = timestamps.filter(time => time > now - 600000);
            if (recent.length) submissions.set(ip, recent); else submissions.delete(ip);
        }
        const recent = submissions.get(req.ip) || [];
        if (recent.length >= 10) v.fail("Too Many Requests. Please Try Again In A Few Minutes.", 429);
        const d = req.body;
        const division = v.text(d, "division"), district = v.text(d, "district"), upazila = v.text(d, "upazila");
        if (!BANGLADESH_LOCATIONS[division]?.includes(district) || !UPAZILAS[district]?.includes(upazila)) v.fail("Select A Valid Division, District And Upazila / Thana.");
        if (!Object.hasOwn(v.CAN_RECEIVE, d.bloodGroup) || !["Critical", "Serious", "Stable"].includes(d.condition)) v.fail("Choose A Valid Blood Group And Condition.");
        const postalCode = v.text(d, "postalCode", false, 4);
        if (postalCode && !/^\d{4}$/.test(postalCode)) v.fail("Postcode Must Have Four Digits.");
        const request = await BloodRequest.create({
            hospital: v.text(d, "hospital"), division, district, upazila,
            area: v.text(d, "area"), addressDetails: v.text(d, "addressDetails", false, 500), postalCode,
            patient: { name: v.text(d, "name") }, bloodGroup: d.bloodGroup,
            units: v.number(d.units, "units", 1, 20), condition: d.condition,
            conditionNote: v.text(d, "conditionNote", false, 1000),
            neededBy: v.date(d.neededBy, true),
            contactPhone: v.phone(d.contactPhone), source: "public", status: "open"
        });
        recent.push(now); submissions.set(req.ip, recent);
        res.status(201).json({ message: "Your Blood Request Has Been Published.", requestId: request._id });
    }));
    app.get("/api/public-requests/manage", requireRole("admin", "staff"), wrap(async (req, res) => {
        res.json(await BloodRequest.find({ source: "public" }).select("hospital patient area division district upazila addressDetails postalCode bloodGroup units condition conditionNote neededBy contactPhone status createdAt").sort({ createdAt: -1 }).limit(200).lean());
    }));
    app.put("/api/public-requests/:id/status", requireRole("admin"), wrap(async (req, res) => {
        if (!["fulfilled", "cancelled", "open"].includes(req.body.status)) v.fail("Invalid Request Status.");
        const result = await BloodRequest.updateOne({ _id: req.params.id, source: "public" }, { $set: { status: req.body.status } });
        if (!result.matchedCount) v.fail("Request Not Found.", 404);
        res.json({ message: "Request Status Updated." });
    }));
};
