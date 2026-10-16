// Admin page: account approvals, add users and password approvals.
document.addEventListener("DOMContentLoaded", async () =>
{
    fillGroups();
    try
    {
        const user = await setupDashboard(["admin"]);
        if (!user) return;
        setupAccountForm(true);
        const hospitalForm = document.getElementById("hospitalForm");
        document.getElementById("resetHospitalForm").addEventListener("click", () =>
        {
            hospitalForm.reset();
            document.getElementById("editHospitalId").value = "";
            document.getElementById("facilityDivision").dispatchEvent(new Event("change"));
            document.getElementById("hospitalEditLabel").textContent =
                "Add a new hospital or clinic.";
        });
        hospitalForm.addEventListener("submit", async (e) =>
        {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(hospitalForm));
            try
            {
                const result = await api(
                    data.id ? "admin/hospitals/" + data.id : "admin/hospitals",
                    data.id ? "PUT" : "POST",
                    data,
                );
                showMessage(result.message);
                await loadHospitalDirectory(user, hospitalPage);
            } catch (error)
            {
                showMessage(error.message, true);
            }
        });

        const filter = document.getElementById("statusFilter");
        ["pending", "active", "rejected", "suspended", "all"].forEach((value) =>
            filter.append(new Option(displayLabel(value), value)),
        );
        async function loadAccounts()
        {
            const accounts = await api(
                filter.value === "pending" ? "admin/pending" : "admin/users",
            );
            const list = document.getElementById("accountList");
            list.replaceChildren();
            const filtered = accounts.filter(
                (account) => filter.value === "all" || account.status === filter.value,
            );
            if (!filtered.length) list.append(element("p", "No accounts with this status."));
            filtered.forEach((account) =>
            {
                const card = element("article", undefined, "card card-body");
                card.append(
                    element("h4", account.name + " (" + displayLabel(account.role) + ")"),
                    element("p", account.username + " · " + account.email),
                    element("p", account.phone + " · " + account.area + " · " + displayLabel(account.status)),
                );
                if (account.role === "staff")
                    card.append(
                        element(
                            "p",
                            account.hospital +
                                " · " +
                                account.designation +
                                " · Staff ID: " +
                                account.staffId,
                        ),
                    );
                if (account._id !== user._id)
                {
                    const buttons = element("div", undefined, "actions");
                    ["active", "rejected", "suspended"]
                        .filter((status) => status !== account.status)
                        .forEach((status) =>
                            buttons.append(
                                action(
                                    status === "active"
                                        ? "Approve / Activate"
                                        : status === "rejected"
                                          ? "Reject"
                                          : "Suspend",
                                    async () =>
                                    {
                                        const result = await api(
                                            "admin/users/" + account._id + "/status",
                                            "PUT",
                                            { status },
                                        );
                                        showMessage(result.message);
                                        await loadAccounts();
                                    },
                                ),
                            ),
                        );
                    card.append(buttons);
                }
                list.append(card);
            });
        }
        async function loadApprovals()
        {
            const requests = await api("admin/password-requests");
            const list = document.getElementById("approvalList");
            list.replaceChildren();
            if (!requests.length) list.append(element("p", "No password change requests."));
            requests.forEach((request) =>
            {
                const card = element("article", undefined, "card card-body");
                card.append(
                    element("h4", request.user?.name || "Deleted account"),
                    element("p", (request.user?.username || "") + " · " + displayLabel(request.status)),
                );
                if (request.status === "pending")
                {
                    const buttons = element("div", undefined, "actions");
                    ["approved", "rejected"].forEach((status) =>
                        buttons.append(
                            action(status === "approved" ? "Approve" : "Reject", async () =>
                            {
                                const result = await api(
                                    "admin/password-requests/" + request._id,
                                    "PUT",
                                    { status },
                                );
                                showMessage(result.message);
                                await loadApprovals();
                            }),
                        ),
                    );
                    card.append(buttons);
                }
                list.append(card);
            });
        }
        filter.addEventListener("change", () =>
            loadAccounts().catch((error) => showMessage(error.message, true)),
        );
        document
            .querySelector('[data-view="accounts"]')
            .addEventListener("click", () =>
                loadAccounts().catch((error) => showMessage(error.message, true)),
            );
        document
            .querySelector('[data-view="passwordApprovals"]')
            .addEventListener("click", () =>
                loadApprovals().catch((error) => showMessage(error.message, true)),
            );
        await loadAccounts();
        await loadApprovals();
    } catch (error)
    {
        showMessage(error.message, true);
    }
});
