// Community content is rendered as text, never as user-provided HTML.
document.addEventListener("DOMContentLoaded", () => {
    const byId = id => document.getElementById(id);
    const status = (id, text) => { byId(id).textContent = text; };
    function cards(id, items, render, empty) {
        const target = byId(id); target.replaceChildren();
        if (!items.length) target.append(element("p", empty));
        items.forEach(item => target.append(render(item)));
    }
    function card(title, details) {
        const node = element("article", undefined, "community-card");
        node.append(element("h3", title), element("p", details)); return node;
    }
    function options(select, values, label) {
        select.replaceChildren(new Option(label, ""));
        values.forEach(value => select.add(new Option(value.name || value, value._id || value)));
    }
    function bind(formId, url, statusId, after) {
        byId(formId).addEventListener("submit", async event => {
            event.preventDefault(); const button = event.target.querySelector("button"); button.disabled = true;
            try { const result = await api(url, "POST", Object.fromEntries(new FormData(event.target))); status(statusId, result.message); event.target.reset(); if (after) await after(); }
            catch (error) { status(statusId, error.message); }
            finally { button.disabled = false; }
        });
    }
    if (byId("communityStats")) {
        options(byId("publicDistrict"), Object.values(BANGLADESH_LOCATIONS).flat().sort(), "All Districts");
        api("community").then(data => {
            const stats = data.stats || {}; const labels = { members: "Community Members", donors: "Registered Donors", donations: "Verified Donations", units: "Community Units" };
            cards("communityStats", Object.keys(labels), key => card(String(stats[key] || 0), labels[key]), "");
            ["news", "activity"].forEach(kind => cards(kind === "news" ? "newsPosts" : "activityPosts", (data.posts || []).filter(post => post.kind === kind), post => { const node = card(post.title, post.body); node.append(element("small", new Date(post.date).toLocaleDateString())); return node; }, "No Updates Published Yet."));
            cards("communityUnits", data.units || [], unit => card(unit.name, [unit.kind, unit.parent?.name, unit.division, unit.district, unit.contactEmail].filter(Boolean).join(" · ")), "No Community Units Added Yet.");
        }).catch(error => status("message", error.message));
        byId("publicDonorSearch").addEventListener("submit", async event => {
            event.preventDefault();
            try { const query = new URLSearchParams(new FormData(event.target)); const data = await api("donors/search?" + query); status("donorSearchMessage", data.note); cards("publicDonorResults", data.donors, donor => card(donor.name + " · " + donor.bloodGroup, [donor.area, donor.district, donor.postalCode].filter(Boolean).join(" · ")), "No Compatible Available Donors Found."); }
            catch (error) { status("donorSearchMessage", error.message); }
        });
        bind("contactForm", "contact", "contactStatus");
    }
    if (byId("donationHistory")) {
        document.querySelector('[data-view="donationHistory"]').addEventListener("click", async () => {
            try { const data = await api("users/me/donations"); status("nextDonationDate", data.nextDate ? "Next Donation Date Under The Project's 120-Day Rule: " + new Date(data.nextDate).toLocaleDateString() + ". Medical Staff Must Confirm Eligibility." : "No Last Donation Recorded. Medical Staff Must Confirm Eligibility."); cards("donationRecords", data.records, record => card(record.request?.hospital || "Hospital", new Date(record.donationDate).toLocaleDateString() + " · " + (record.request?.bloodGroup || "") + " · " + (record.notes || "")), "No Verified Donations Yet."); }
            catch (error) { status("nextDonationDate", error.message); }
        });
    }
    if (byId("recordDonationForm")) {
        let requests = [];
        byId("recordDate").max = new Date().toISOString().slice(0, 10);
        function donors() { const request = requests.find(item => item._id === byId("recordRequest").value); options(byId("recordDonor"), request?.pledges || [], "Select A Pledged Donor"); }
        async function load() { requests = await api("staff/requests"); options(byId("recordRequest"), requests.map(item => ({ _id: item._id, name: item.hospital + " · " + item.patient.name + " · " + item.bloodGroup })), "Select A Patient Request"); donors(); }
        document.querySelector('[data-view="recordDonation"]').addEventListener("click", () => load().catch(error => status("recordStatus", error.message)));
        byId("recordRequest").addEventListener("change", donors);
        bind("recordDonationForm", "staff/donations", "recordStatus", load);
    }
    if (byId("communityPostForm")) {
        options(byId("unitDivision"), Object.keys(BANGLADESH_LOCATIONS), "Select Division");
        byId("unitDivision").addEventListener("change", () => options(byId("unitDistrict"), BANGLADESH_LOCATIONS[byId("unitDivision").value] || [], "All Districts"));
        async function update(url, data) { try { const result = await api(url, "PUT", data); status("communityStatus", result.message); await load(); } catch (error) { status("communityStatus", error.message); } }
        async function load() {
            const [data, reports] = await Promise.all([api("admin/community"), api("admin/reports")]);
            cards("adminReports", [["Verified Donations", reports.donations], ["Hospitals / Clinics", reports.hospitals], ["Pending Accounts", reports.pendingAccounts], ...reports.accounts.map(item => [item._id + " Accounts", item.total]), ...reports.requests.map(item => [item._id + " Requests", item.total])], row => card(String(row[1]), row[0]), "No Reports.");
            cards("adminPosts", data.posts, post => { const node = card(post.title, post.body); node.append(action(post.published ? "Unpublish" : "Publish", () => update("admin/community/posts/" + post._id, { published: !post.published }))); return node; }, "No Posts Yet.");
            cards("adminUnits", data.units, unit => card(unit.name, [unit.kind, unit.parent?.name, unit.division, unit.district].filter(Boolean).join(" · ")), "No Units Yet.");
            options(byId("unitParent"), data.units.filter(unit => unit.kind === "zone"), "No Parent Zone");
            cards("contactMessages", data.messages, message => { const node = card(message.subject, message.name + " · " + message.email + " · " + message.message + " · " + message.status); ["reviewed", "resolved"].forEach(value => node.append(action(value === "reviewed" ? "Mark Reviewed" : "Mark Resolved", () => update("admin/community/messages/" + message._id, { status: value })))); return node; }, "No Contact Messages Yet.");
        }
        document.querySelector('[data-view="community"]').addEventListener("click", () => load().catch(error => status("communityStatus", error.message)));
        bind("communityPostForm", "admin/community/posts", "communityStatus", load);
        bind("communityUnitForm", "admin/community/units", "communityStatus", load);
    }
});
