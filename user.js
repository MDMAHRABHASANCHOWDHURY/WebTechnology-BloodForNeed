// User page: profile, photos, requests, pledges and password changes.
document.addEventListener("DOMContentLoaded", async () =>
{
    fillGroups();
    try
    {
        if (!(await setupDashboard(["donor", "volunteer"]))) return;
        document.querySelector('[data-view="pledges"]').addEventListener("click", async () =>
        {
            try
            {
                const pledges = await api("requests/mine");
                const list = document.getElementById("pledgeList");
                list.replaceChildren();
                if (!pledges.length) list.append(element("p", "You have not pledged yet."));
                pledges.forEach((r) => {
                    const card = element("article", undefined, "card card-body");
                    card.append(element("h3", r.hospital + " · " + r.bloodGroup), element("p", "Status: " + displayLabel(r.status)));
                    card.append(element("p", "Patient Name: " + (r.patient?.name || "Not Provided")));
                    const phone = r.contactPhone || "";
                    card.append(element("p", "Patient Contact Number: " + (phone || "Not Provided")));
                    if (/^\+?[0-9]{7,15}$/.test(phone)) {
                        const link = element("a", "Call Patient Contact", "btn btn-primary");
                        link.href = "tel:" + phone; card.append(link);
                    }
                    list.append(card);
                });
            } catch (error)
            {
                showMessage(error.message, true);
            }
        });
    } catch (error)
    {
        showMessage(error.message, true);
    }
});
