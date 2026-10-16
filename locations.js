// District-to-division mapping: Bangladesh National Portal, bangladesh.gov.bd/views/district-list.
const BANGLADESH_LOCATIONS = {
    Barishal: ["Barguna", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"],
    Chattogram: [
        "Bandarban",
        "Brahmanbaria",
        "Chandpur",
        "Chattogram",
        "Cumilla",
        "Cox's Bazar",
        "Feni",
        "Khagrachhari",
        "Lakshmipur",
        "Noakhali",
        "Rangamati",
    ],
    Dhaka: [
        "Dhaka",
        "Faridpur",
        "Gazipur",
        "Gopalganj",
        "Kishoreganj",
        "Madaripur",
        "Manikganj",
        "Munshiganj",
        "Narayanganj",
        "Narsingdi",
        "Rajbari",
        "Shariatpur",
        "Tangail",
    ],
    Khulna: [
        "Bagerhat",
        "Chuadanga",
        "Jashore",
        "Jhenaidah",
        "Khulna",
        "Kushtia",
        "Magura",
        "Meherpur",
        "Narail",
        "Satkhira",
    ],
    Mymensingh: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"],
    Rajshahi: [
        "Bogura",
        "Chapainawabganj",
        "Joypurhat",
        "Naogaon",
        "Natore",
        "Pabna",
        "Rajshahi",
        "Sirajganj",
    ],
    Rangpur: [
        "Dinajpur",
        "Gaibandha",
        "Kurigram",
        "Lalmonirhat",
        "Nilphamari",
        "Panchagarh",
        "Rangpur",
        "Thakurgaon",
    ],
    Sylhet: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
};
const CITY_CORPORATIONS = {
    Dhaka: ["Dhaka North", "Dhaka South"],
    Chattogram: ["Chattogram"],
    Cumilla: ["Cumilla"],
    Gazipur: ["Gazipur"],
    Narayanganj: ["Narayanganj"],
    Khulna: ["Khulna"],
    Barishal: ["Barishal"],
    Rajshahi: ["Rajshahi"],
    Rangpur: ["Rangpur"],
    Sylhet: ["Sylhet"],
    Mymensingh: ["Mymensingh"],
};
const COUNTRY_CODES = {
    "+880": "Bangladesh",
    "+91": "India",
    "+92": "Pakistan",
    "+977": "Nepal",
    "+44": "United Kingdom",
    "+1": "USA / Canada",
    "+966": "Saudi Arabia",
    "+971": "United Arab Emirates",
    "+60": "Malaysia",
};
function rankLocations(rows, postalCode = "", area = "")
{
    const targetArea = String(area).trim().toLowerCase();
    return rows.sort((a, b) =>
    {
        const postcodeRank =
            Number(Boolean(postalCode) && b.postalCode === postalCode) -
            Number(Boolean(postalCode) && a.postalCode === postalCode);
        const areaRank =
            Number(
                Boolean(targetArea) &&
                    String(b.area || "")
                        .trim()
                        .toLowerCase() === targetArea,
            ) -
            Number(
                Boolean(targetArea) &&
                    String(a.area || "")
                        .trim()
                        .toLowerCase() === targetArea,
            );
        return (
            postcodeRank ||
            areaRank ||
            String(a.postalCode || "9999").localeCompare(String(b.postalCode || "9999")) ||
            String(a.area || "").localeCompare(String(b.area || "")) ||
            String(a.hospital || a.name || "").localeCompare(String(b.hospital || b.name || ""))
        );
    });
}
// District ranges supplied for this project; a range does not confirm a specific post office.
const POSTCODE_RANGES = {
    "Dhaka": [
        1000,
        1399
    ],
    "Narayanganj": [
        1400,
        1499
    ],
    "Munshiganj": [
        1500,
        1599
    ],
    "Narsingdi": [
        1600,
        1699
    ],
    "Gazipur": [
        1700,
        1799
    ],
    "Manikganj": [
        1800,
        1899
    ],
    "Tangail": [
        1900,
        1999
    ],
    "Jamalpur": [
        2000,
        2099
    ],
    "Sherpur": [
        2100,
        2199
    ],
    "Mymensingh": [
        2200,
        2299
    ],
    "Kishoreganj": [
        2300,
        2399
    ],
    "Netrokona": [
        2400,
        2499
    ],
    "Sunamganj": [
        3000,
        3099
    ],
    "Sylhet": [
        3100,
        3199
    ],
    "Moulvibazar": [
        3200,
        3299
    ],
    "Habiganj": [
        3300,
        3399
    ],
    "Brahmanbaria": [
        3400,
        3499
    ],
    "Cumilla": [
        3500,
        3599
    ],
    "Chandpur": [
        3600,
        3699
    ],
    "Lakshmipur": [
        3700,
        3799
    ],
    "Noakhali": [
        3800,
        3899
    ],
    "Feni": [
        3900,
        3999
    ],
    "Chattogram": [
        4000,
        4399
    ],
    "Khagrachhari": [
        4400,
        4499
    ],
    "Rangamati": [
        4500,
        4599
    ],
    "Bandarban": [
        4600,
        4699
    ],
    "Cox's Bazar": [
        4700,
        4799
    ],
    "Panchagarh": [
        5000,
        5099
    ],
    "Thakurgaon": [
        5100,
        5199
    ],
    "Dinajpur": [
        5200,
        5299
    ],
    "Nilphamari": [
        5300,
        5399
    ],
    "Rangpur": [
        5400,
        5499
    ],
    "Lalmonirhat": [
        5500,
        5599
    ],
    "Kurigram": [
        5600,
        5699
    ],
    "Gaibandha": [
        5700,
        5799
    ],
    "Bogura": [
        5800,
        5899
    ],
    "Joypurhat": [
        5900,
        5999
    ],
    "Rajshahi": [
        6000,
        6299
    ],
    "Chapainawabganj": [
        6300,
        6399
    ],
    "Natore": [
        6400,
        6499
    ],
    "Naogaon": [
        6500,
        6599
    ],
    "Pabna": [
        6600,
        6699
    ],
    "Sirajganj": [
        6700,
        6799
    ],
    "Kushtia": [
        7000,
        7099
    ],
    "Meherpur": [
        7100,
        7199
    ],
    "Chuadanga": [
        7200,
        7299
    ],
    "Jhenaidah": [
        7300,
        7399
    ],
    "Jashore": [
        7400,
        7499
    ],
    "Narail": [
        7500,
        7599
    ],
    "Magura": [
        7600,
        7699
    ],
    "Rajbari": [
        7700,
        7799
    ],
    "Faridpur": [
        7800,
        7899
    ],
    "Madaripur": [
        7900,
        7999
    ],
    "Shariatpur": [
        8000,
        8099
    ],
    "Gopalganj": [
        8100,
        8199
    ],
    "Barishal": [
        8200,
        8299
    ],
    "Bhola": [
        8300,
        8399
    ],
    "Jhalokati": [
        8400,
        8499
    ],
    "Pirojpur": [
        8500,
        8599
    ],
    "Patuakhali": [
        8600,
        8699
    ],
    "Barguna": [
        8700,
        8799
    ],
    "Khulna": [
        9000,
        9299
    ],
    "Bagerhat": [
        9300,
        9399
    ],
    "Satkhira": [
        9400,
        9499
    ]
};
if (typeof module !== "undefined")
    module.exports = { BANGLADESH_LOCATIONS, CITY_CORPORATIONS, COUNTRY_CODES, POSTCODE_RANGES, rankLocations };
if (typeof window !== "undefined")
    Object.assign(window, { BANGLADESH_LOCATIONS, CITY_CORPORATIONS, COUNTRY_CODES, POSTCODE_RANGES });
