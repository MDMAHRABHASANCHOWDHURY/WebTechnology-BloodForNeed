const { BANGLADESH_LOCATIONS, CITY_CORPORATIONS, COUNTRY_CODES, POSTCODE_RANGES } = require("./locations");
const CAN_RECEIVE = {
    "O-": ["O-"],
    "O+": ["O+", "O-"],
    "A-": ["A-", "O-"],
    "A+": ["A+", "A-", "O+", "O-"],
    "B-": ["B-", "O-"],
    "B+": ["B+", "B-", "O+", "O-"],
    "AB-": ["AB-", "A-", "B-", "O-"],
    "AB+": ["AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"],
};
function fail(message, status = 400)
{
    const e = new Error(message);
    e.status = status;
    throw e;
}
function text(d, key, required = true, max = 120)
{
    const v = d[key];
    if (v === undefined || v === "")
    {
        if (required) fail(`Enter ${key}.`);
        return "";
    }
    if (typeof v !== "string" || v.trim().length > max || (required && !v.trim()))
        fail(`Invalid ${key}.`);
    return v.trim();
}
function phone(value, countryCode = "+880")
{
    if (!COUNTRY_CODES[countryCode]) fail("Choose a valid country code.");
    let digits = String(value || "").replace(/[\s()-]/g, "");
    if (digits.startsWith(countryCode)) digits = digits.slice(countryCode.length);
    else if (digits.startsWith(countryCode.slice(1)) && digits.length > 10)
        digits = digits.slice(countryCode.length - 1);
    digits = digits.replace(/^0/, "");
    const full = countryCode + digits;
    if (countryCode === "+880" && !/^\+8801[3-9]\d{8}$/.test(full))
        fail("Enter a valid Bangladesh mobile number.");
    if (!/^\+[1-9]\d{6,14}$/.test(full))
        fail("Enter a valid phone number for the selected country.");
    return full;
}
function address(d)
{
    const division = text(d, "division");
    const district = text(d, "district");
    if (!BANGLADESH_LOCATIONS[division]?.includes(district))
        fail("Select a district within the chosen division.");
    const cityCorporation = text(d, "cityCorporation", false);
    if (cityCorporation && !(CITY_CORPORATIONS[district] || []).includes(cityCorporation))
        fail("City corporation does not match the district.");
    const postalCode = text(d, "postalCode");
    if (!/^\d{4}$/.test(postalCode)) fail("Bangladesh postcodes must contain four digits.");
    const range = POSTCODE_RANGES[district];
    if (Number(postalCode) < range[0] || Number(postalCode) > range[1])
        fail(`Postcode for ${district} must be within ${range[0]}–${range[1]}.`);
    return { division, district, cityCorporation, postalCode, area: text(d, "area") };
}
function password(v)
{
    if (typeof v !== "string" || v.length < 8 || v.length > 72)
        fail("Password must be 8–72 characters.");
    return v;
}
function number(v, key, min, max)
{
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) fail(`Invalid ${key}.`);
    return n;
}
function date(v, future = false)
{
    if (
        typeof v !== "string" ||
        !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z?)?$/.test(v) ||
        isNaN(Date.parse(v))
    )
        fail("Invalid date.");
    const d = new Date(v);
    if (d.toISOString().slice(0, 10) !== v.slice(0, 10)) fail("Invalid date.");
    if (future && d < Date.now()) fail("Required date must be in the future.");
    return d;
}
function userInput(d)
{
    const role = text(d, "role");
    if (!["donor", "volunteer", "staff", "admin"].includes(role)) fail("Invalid account type.");
    const email = text(d, "email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Invalid email.");
    const username = text(d, "username").toLowerCase();
    if (!/^[a-z0-9_.-]{3,50}$/.test(username))
        fail("Username must be 3–50 letters, digits or . _ -");
    const u = {
        role,
        name: text(d, "name"),
        username,
        email,
        phone: phone(d.phone, d.countryCode || "+880"),
        countryCode: d.countryCode || "+880",
        ...address(d),
        area: text(d, "area"),
        available: true,
    };
    if (["donor", "volunteer"].includes(role))
    {
        if (!CAN_RECEIVE[d.bloodGroup]) fail("Choose a blood group.");
        Object.assign(u, {
            bloodGroup: d.bloodGroup,
            age: number(d.age, "age", 18, 65),
            weight: number(d.weight, "weight", 45, 300),
            skills: text(d, "skills", false, 255)
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
        });
        if (d.lastDonation)
        {
            u.lastDonation = date(d.lastDonation);
            if (u.lastDonation > Date.now()) fail("Donation date cannot be in the future.");
        }
    }
    if (role === "staff")
        Object.assign(u, {
            hospital: text(d, "hospital"),
            designation: text(d, "designation"),
            staffId: text(d, "staffId"),
        });
    return u;
}
module.exports = { CAN_RECEIVE, fail, text, phone, password, number, date, userInput, address };
