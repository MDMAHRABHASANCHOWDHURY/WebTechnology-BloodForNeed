const mongoose = require("mongoose");

// User collection
const userSchema = new mongoose.Schema(
    {
        role: { type: String, enum: ["donor", "volunteer", "staff", "admin"], required: true },
        name: { type: String, required: true },
        username: { type: String, unique: true, required: true },
        email: { type: String, unique: true, required: true },
        phone: String,
        area: String,
        division: String,
        district: String,
        cityCorporation: String,
        postalCode: String,
        countryCode: { type: String, default: "+880" },
        passwordHash: { type: String, required: true, select: false },
        photo: String,
        status: {
            type: String,
            enum: ["pending", "active", "rejected", "suspended"],
            default: "pending",
        },
        bloodGroup: { type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
        age: Number,
        weight: Number,
        lastDonation: { type: Date, default: null },
        available: { type: Boolean, default: true },
        skills: [String],
        hospital: String,
        designation: String,
        staffId: String,
        authVersion: { type: Number, default: 0, select: false },
    },
    { timestamps: true },
);
const User = mongoose.model("User", userSchema);

// BloodRequest collection
const BloodRequest = mongoose.model(
    "BloodRequest",
    new mongoose.Schema(
        {
            hospital: String,
            hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
            area: String,
            division: String,
            district: String,
            cityCorporation: String,
            postalCode: String,
            upazila: String,
            addressDetails: String,
            source: { type: String, enum: ["staff", "public"], default: "staff" },
            patient: { name: String, age: Number, gender: String },
            bloodGroup: { type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
            units: Number,
            disease: String,
            condition: { type: String, enum: ["Critical", "Serious", "Stable"] },
            conditionNote: String,
            ward: String,
            neededBy: Date,
            contactPhone: String,
            status: { type: String, enum: ["open", "fulfilled", "cancelled"], default: "open" },
            createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            pledges: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        },
        { timestamps: true },
    ),
);

// PasswordRequest collection
const PasswordRequest = mongoose.model(
    "PasswordRequest",
    new mongoose.Schema(
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
            newPasswordHash: { type: String, required: true, select: false },
            status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
        },
        { timestamps: true },
    ),
);

const Hospital = mongoose.model(
    "Hospital",
    new mongoose.Schema(
        {
            registryCode: { type: String, unique: true, sparse: true },
            name: { type: String, required: true },
            type: String,
            division: String,
            district: String,
            cityCorporation: String,
            area: String,
            postalCode: { type: String, default: "" },
            source: String,
            sourceURL: String,
            active: { type: Boolean, default: true },
        },
        { timestamps: true },
    ),
);
const CommunityPost = mongoose.model("CommunityPost", new mongoose.Schema({
    title: { type: String, required: true }, body: { type: String, required: true },
    kind: { type: String, enum: ["news", "activity"], default: "news" },
    date: Date, published: { type: Boolean, default: true }, author: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true }));
const CommunityUnit = mongoose.model("CommunityUnit", new mongoose.Schema({
    name: { type: String, required: true }, kind: { type: String, enum: ["zone", "unit"], required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "CommunityUnit", default: null }, division: String,
    district: String, contactEmail: String, active: { type: Boolean, default: true }
}, { timestamps: true }));
const ContactMessage = mongoose.model("ContactMessage", new mongoose.Schema({
    name: String, email: String, subject: String, message: String,
    status: { type: String, enum: ["new", "reviewed", "resolved"], default: "new" }
}, { timestamps: true }));
const donationRecordSchema = new mongoose.Schema({
    donor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: "BloodRequest", required: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    donationDate: { type: Date, required: true }, notes: String
}, { timestamps: true });
donationRecordSchema.index({ donor: 1, request: 1 }, { unique: true });
const DonationRecord = mongoose.model("DonationRecord", donationRecordSchema);
module.exports = { User, BloodRequest, PasswordRequest, Hospital, CommunityPost, CommunityUnit, ContactMessage, DonationRecord };
