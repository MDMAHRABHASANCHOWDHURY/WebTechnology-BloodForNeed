// Anonymous blood request form and protected coordination controls.
document.addEventListener("DOMContentLoaded", () => {
    const byId = id => document.getElementById(id);
    const form = byId("publicRequestForm");
    function options(select, values, placeholder) {
        select.replaceChildren(new Option(placeholder, ""));
        values.forEach(value => select.add(new Option(value, value)));
        select.disabled = values.length === 0;
    }
    if (form) {
        function updateMinimumDate() {
            const now = new Date();
            const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
            byId("requestNeeded").min = local.toISOString().slice(0, 16);
        }
        updateMinimumDate();
        byId("requestNeeded").addEventListener("focus", updateMinimumDate);
        options(byId("requestDivision"), Object.keys(BANGLADESH_LOCATIONS), "Select Division");
        options(byId("requestDistrict"), [], "Select District");
        options(byId("requestUpazila"), [], "Select Upazila / Thana");
        byId("requestDivision").addEventListener("change", () => {
            options(byId("requestDistrict"), BANGLADESH_LOCATIONS[byId("requestDivision").value] || [], "Select District");
            options(byId("requestUpazila"), [], "Select Upazila / Thana");
        });
        byId("requestDistrict").addEventListener("change", () => options(byId("requestUpazila"), UPAZILAS[byId("requestDistrict").value] || [], "Select Upazila / Thana"));
        form.addEventListener("submit", async event => {
            event.preventDefault(); const button = form.querySelector("button"); button.disabled = true;
            try {
                const data = Object.fromEntries(new FormData(form));
                const needed = new Date(data.neededBy);
                if (!data.neededBy || !Number.isFinite(needed.getTime()) || needed <= new Date()) throw new Error("Choose When Blood Is Needed, After The Current Time.");
                data.neededBy = needed.toISOString();
                const result = await api("requests/public", "POST", data);
                byId("publicRequestStatus").textContent = result.message;
                form.reset(); options(byId("requestDistrict"), [], "Select District"); options(byId("requestUpazila"), [], "Select Upazila / Thana");
                byId("searchRequests").click();
            } catch (error) { byId("publicRequestStatus").textContent = error.message; }
            finally { button.disabled = false; }
        });
    }
    if (byId("publicRequestsList")) {
        async function load() {
            try {
                const requests = await api("public-requests/manage"); const list = byId("publicRequestsList"); list.replaceChildren();
                if (!requests.length) list.append(element("p", "No Public Blood Requests Yet."));
                requests.forEach(request => {
                    const card = element("article", undefined, "community-card");
                    card.append(element("h3", request.hospital + " · " + request.bloodGroup), element("p", ["Name: " + request.patient.name, "Location: " + [request.area, request.upazila, request.district, request.division].join(", "), request.addressDetails, "Contact: " + request.contactPhone, "Condition: " + request.condition, request.conditionNote, "Units: " + request.units, "Needed By: " + new Date(request.neededBy).toLocaleString(), "Status: " + request.status].filter(Boolean).join("\n")));
                    if (document.getElementById("communityPostForm")) ["fulfilled", "cancelled", "open"].forEach(status => card.append(action("Mark " + displayLabel(status), async () => {
                        try { await api("public-requests/" + request._id + "/status", "PUT", { status }); await load(); }
                        catch (error) { byId("publicRequestsStatus").textContent = error.message; }
                    })));
                    list.append(card);
                });
            } catch (error) { byId("publicRequestsStatus").textContent = error.message; }
        }
        document.querySelector('[data-view="publicRequests"]').addEventListener("click", load);
    }
});
