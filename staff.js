// Staff page: patient requests, donor search and pledge contacts.
document.addEventListener("DOMContentLoaded", async () =>
{
    fillGroups();
    try
    {
        const user = await setupDashboard(["staff"]);
        if (!user) return;
        ["Male", "Female", "Other"].forEach((value) =>
            document.getElementById("gender").append(new Option(value, value)),
        );
        ["Critical", "Serious", "Stable"].forEach((value) =>
            document.getElementById("condition").append(new Option(value, value)),
        );
        const facilitySearch = document.getElementById("patientHospital");
        const facilityChoice = document.getElementById("hospitalChoice");
        async function searchFacilities()
        {
            const result = await api(
                "hospitals?search=" + encodeURIComponent(facilitySearch.value),
            );
            facilityChoice.replaceChildren(new Option("Select Hospital / Clinic", ""));
            result.items.forEach((item) =>
            {
                const option = new Option(item.name + " — " + item.district, item._id);
                option.dataset.facility = JSON.stringify(item);
                facilityChoice.append(option);
            });
        }
        facilitySearch.addEventListener("change", () =>
            searchFacilities().catch((error) => showMessage(error.message, true)),
        );
        document.getElementById("searchPatientHospital").addEventListener("click", () => searchFacilities().catch(error => showMessage(error.message, true)));
        facilitySearch.addEventListener("keydown", event =>
        {
            if (event.key === "Enter") { event.preventDefault(); document.getElementById("searchPatientHospital").click(); }
        });
        facilityChoice.addEventListener("change", () =>
        {
            const item = facilityChoice.selectedOptions[0]?.dataset.facility;
            if (!item) return;
            const facility = JSON.parse(item);
            document.getElementById("patientArea").value = facility.area || "";
            const division = document.getElementById("patient-division");
            division.value = facility.division || "";
            division.dispatchEvent(new Event("change"));
            const district = document.getElementById("patient-district");
            district.value = facility.district || "";
            district.dispatchEvent(new Event("change"));
            document.getElementById("patient-cityCorporation").value =
                facility.cityCorporation || "";
            document.getElementById("patient-postalCode").value = facility.postalCode || "";
            document.getElementById("patient-postalCode").dispatchEvent(new Event("input"));
        });
        await searchFacilities();
        document.getElementById("patientArea").value = user.area || "";
        document.getElementById("patientForm").addEventListener("submit", async (e) =>
        {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            data.hospital = data.patientHospital;
            data.area = data.patientArea;
            data.bloodGroup = data.patientGroup;
            data.neededBy = new Date(data.neededBy).toISOString();
            try
            {
                const result = await api("staff/requests", "POST", data);
                showMessage(result.message);
                e.target.reset();
                await loadRequests();
            } catch (error)
            {
                showMessage(error.message, true);
            }
        });
        document.getElementById("donorSearch").addEventListener("submit", async (e) =>
        {
            e.preventDefault();
            try
            {
                const group = document.getElementById("recipientGroup").value;
                const area = document.getElementById("recipientArea").value;
                const donors = await api(
                    "staff/donors?group=" +
                        encodeURIComponent(group) +
                        "&area=" +
                        encodeURIComponent(area) +
                        "&postalCode=" +
                        encodeURIComponent(document.getElementById("recipientPostalCode").value),
                );
                const list = document.getElementById("donorList");
                list.replaceChildren();
                if (!donors.length)
                    list.append(
                        element("p", "No compatible available donors meet the 120-day interval."),
                    );
                donors.forEach((donor) =>
                {
                    const column = element("div", undefined, "col-md-6");
                    const card = element("article", undefined, "card card-body");
                    card.append(
                        element("h4", donor.name),
                        element(
                            "p",
                            donor.bloodGroup +
                                " · " +
                                donor.area +
                                " · " +
                                (donor.postalCode || ""),
                        ),
                        element("p", donor.phone + " · " + donor.email),
                        element(
                            "p",
                            "Last donation: " +
                                (donor.lastDonation
                                    ? donor.lastDonation.slice(0, 10)
                                    : "Not recorded"),
                        ),
                    );
                    if (donor.photo)
                    {
                        const image = element("img", undefined, "profile-photo");
                        image.alt = "Donor photo";
                        image.src = "/" + encodeURIComponent(donor.photo);
                        card.prepend(image);
                    }
                    column.append(card);
                    list.append(column);
                });
            } catch (error)
            {
                showMessage(error.message, true);
            }
        });
        async function loadRequests()
        {
            const requests = await api("staff/requests");
            const list = document.getElementById("staffRequests");
            list.replaceChildren();
            if (!requests.length) list.append(element("p", "No patient requests yet."));
            requests.forEach((request) =>
            {
                const card = element("article", undefined, "card card-body");
                card.append(
                    element("h4", request.patient.name + " · " + request.bloodGroup),
                    element("p", request.hospital + " · " + request.area + " · " + displayLabel(request.status)),
                    element(
                        "p",
                        request.disease + " · " + request.condition + " · Ward " + request.ward,
                    ),
                    element("p", request.conditionNote),
                );
                request.pledges.forEach((donor) =>
                    card.append(
                        element(
                            "p",
                            "Pledge: " + donor.name + " · " + donor.phone + " · " + donor.email,
                        ),
                    ),
                );
                if (request.status === "open")
                {
                    const buttons = element("div", undefined, "actions");
                    ["fulfilled", "cancelled"].forEach((status) =>
                        buttons.append(
                            action("Mark " + displayLabel(status), async () =>
                            {
                                const result = await api(
                                    "staff/requests/" + request._id + "/status",
                                    "PUT",
                                    { status },
                                );
                                showMessage(result.message);
                                await loadRequests();
                            }),
                        ),
                    );
                    card.append(buttons);
                }
                list.append(card);
            });
        }
        document
            .querySelector('[data-view="requests"]')
            .addEventListener("click", () =>
                loadRequests().catch((error) => showMessage(error.message, true)),
            );
        await loadRequests();
    } catch (error)
    {
        showMessage(error.message, true);
    }
});
