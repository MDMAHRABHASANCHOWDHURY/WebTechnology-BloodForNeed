let csrfToken = "";
const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
async function api(url, method = "GET", data, retried = false)
{
    const multipart = data instanceof FormData;
    const headers = {};
    if (!multipart) headers["Content-Type"] = "application/json";
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    const response = await fetch("/api/" + url, {
        method,
        headers,
        body: data === undefined ? undefined : multipart ? data : JSON.stringify(data),
    });
    const result = await response.json();
    if (response.status === 403 && result.code === "CSRF_TOKEN_MISMATCH" && !retried)
    {
        const session = await fetch("/api/users/me", { cache: "no-store" });
        const current = await session.json();
        if (session.ok && typeof current.csrfToken === "string")
        {
            csrfToken = current.csrfToken;
            return api(url, method, data, true);
        }
        throw new Error("Your session expired. Please log in again.");
    }
    if (!response.ok) throw new Error(result.error || "Please try again.");
    return result;
}
function showMessage(message, error = false)
{
    const output = document.getElementById("message");
    output.className = "alert " + (error ? "alert-danger" : "alert-success");
    output.textContent = message;
}
function element(tag, text, className)
{
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}
function action(label, callback)
{
    const button = element("button", label, "btn btn-primary");
    button.type = "button";
    button.addEventListener("click", async () =>
    {
        button.disabled = true;
        try
        {
            await callback();
        } catch (error)
        {
            showMessage(error.message, true);
        } finally {
            button.disabled = false;
        }
    });
    return button;
}
function fillGroups()
{
    document.querySelectorAll(".blood-select, .blood-filter").forEach((select) =>
    {
        select.append(
            new Option(
                select.classList.contains("blood-filter")
                    ? "All Blood Groups"
                    : "Select Blood Group",
                "",
            ),
        );
        bloodGroups.forEach((group) => select.append(new Option(group, group)));
    });
}
function toggleAccountFields(role)
{
    const donor = ["donor", "volunteer"].includes(role);
    [
        ["donorFields", donor],
        ["staffFields", role === "staff"],
        ["inviteFields", role === "admin"],
    ].forEach(([id, visible]) =>
    {
        const section = document.getElementById(id);
        if (!section) return;
        section.hidden = !visible;
        section.querySelectorAll("input, select").forEach((input) =>
        {
            input.disabled = !visible;
            input.required = visible && !["lastDonation", "skills", "available"].includes(input.id);
        });
    });
}
async function hospitalCards(container, group = "", pledge = false, allRequests = false)
{
    const hospitals = await api(
        (allRequests ? "requests/all" : "requests/open") +
            "?" +
            new URLSearchParams({
                group,
                postalCode: document.getElementById("sortPostalCode")?.value.trim() || "",
                area: document.getElementById("sortArea")?.value.trim() || "",
            }),
    );
    container.replaceChildren();
    if (!hospitals.length)
        container.append(
            element(
                "p",
                allRequests
                    ? "No donation requests match this blood group."
                    : "No open requests match this blood group.",
            ),
        );
    hospitals.forEach((hospital) =>
    {
        const column = element("div", undefined, "col-md-6");
        const card = element("article", undefined, "card card-body");
        card.append(
            element("h3", hospital.hospital),
            element(
                "p",
                [hospital.area, hospital.district, hospital.postalCode].filter(Boolean).join(" · "),
            ),
        );
        hospital.requests.forEach((request) =>
        {
            const section = element("div", undefined, "border-top pt-3 mt-2");
            section.append(
                element("h4", request.bloodGroup + " · " + request.units + " unit(s)"),
                element(
                    "p",
                    request.condition +
                        " · Needed by " +
                        new Date(request.neededBy).toLocaleString(),
                ),
            );
            if (allRequests) section.append(element("p", "Status: " + displayLabel(request.status)));
            if (pledge && (!allRequests || request.status === "open"))
                section.append(
                    action("I Can Help", async () =>
                    {
                        const result = await api("requests/" + request._id + "/pledge", "POST", {});
                        showMessage(result.message);
                    }),
                );
            card.append(section);
        });
        column.append(card);
        container.append(column);
    });
}
function setupAccountForm(admin = false)
{
    const form = document.getElementById("registrationForm");
    const select = document.getElementById("role");
    (admin ? ["donor", "volunteer", "staff"] : ["donor", "volunteer", "staff", "admin"]).forEach(
        (role) =>
            select.append(
                new Option(
                    role === "staff" ? "Medical Staff" : role[0].toUpperCase() + role.slice(1),
                    role,
                ),
            ),
    );
    select.addEventListener("change", () => toggleAccountFields(select.value));
    toggleAccountFields(select.value);
    form.addEventListener("submit", async (e) =>
    {
        e.preventDefault();
        if (
            document.getElementById("password").value !==
            document.getElementById("confirm-password").value
        )
            return showMessage("Passwords do not match.", true);
        try
        {
            const data = admin ? Object.fromEntries(new FormData(form)) : new FormData(form);
            const result = await api(admin ? "admin/users" : "auth/register", "POST", data);
            showMessage(result.message);
            form.reset();
            toggleAccountFields(select.value);
        } catch (error)
        {
            showMessage(error.message, true);
        }
    });
}
async function setupDashboard(roles)
{
    let result;
    try
    {
        result = await api("users/me");
    } catch (error)
    {
        window.location.href = "login.html";
        return null;
    }
    const user = result.user;
    if (!roles.includes(user.role))
    {
        window.location.href =
            user.role === "admin"
                ? "admin.html"
                : user.role === "staff"
                  ? "staff.html"
                  : "user.html";
        return null;
    }
    csrfToken = result.csrfToken;
    document.body.classList.add("session-checked");
    updateSignedInHeader(user);
    document.getElementById("welcome").textContent =
        "Welcome, " + user.name + " (" + displayLabel(user.role) + ")";
    document.querySelectorAll("[data-view]").forEach((button) =>
        button.addEventListener("click", () =>
        {
            document.querySelectorAll(".dashboard-section").forEach((section) =>
            {
                section.hidden = section.id !== button.dataset.view;
            });
            document
                .querySelectorAll("[data-view]")
                .forEach((tab) => tab.classList.toggle("active", tab === button));
        }),
    );
    document.getElementById("logout").addEventListener("click", async () =>
    {
        try
        {
            await api("auth/logout", "POST", {});
            window.location.href = "login.html";
        } catch (error)
        {
            showMessage(error.message, true);
        }
    });
    const form = document.getElementById("profileForm");
    if (form)
    {
        // Admin add-user fields share names but never share IDs with profile fields.
        form.querySelectorAll("[name]").forEach((input) =>
        {
            const value = user[input.name];
            input.value = Array.isArray(value)
                ? value.join(", ")
                : input.name === "lastDonation" && value
                  ? value.slice(0, 10)
                  : value || "";
        });
        const divisionField = form.querySelector('[name="division"]');
        const districtField = form.querySelector('[name="district"]');
        const cityField = form.querySelector('[name="cityCorporation"]');
        divisionField.value = user.division || "";
        divisionField.dispatchEvent(new Event("change"));
        districtField.value = user.district || "";
        districtField.dispatchEvent(new Event("change"));
        cityField.value = user.cityCorporation || "";
        const codeField = form.querySelector('[name="countryCode"]');
        codeField.value = user.countryCode || "+880";
        const phoneField = form.querySelector('[name="phone"]');
        if (user.phone?.startsWith(codeField.value))
            phoneField.value = user.phone.slice(codeField.value.length);
        if (document.getElementById("sortPostalCode"))
            document.getElementById("sortPostalCode").value = user.postalCode || "";
        if (document.getElementById("sortArea"))
            document.getElementById("sortArea").value = user.area || "";
        const donorSection = form.querySelector('[data-profile="donor"]');
        const staffSection = form.querySelector('[data-profile="staff"]');
        const donor = ["donor", "volunteer"].includes(user.role);
        if (donorSection) donorSection.hidden = !donor;
        if (staffSection) staffSection.hidden = user.role !== "staff";
        [donorSection, staffSection].filter(Boolean).forEach((section) =>
            section.querySelectorAll("input,select").forEach((input) =>
            {
                input.disabled = section.hidden;
            }),
        );
        const available = form.querySelector('[name="available"]');
        if (available) available.checked = user.available;
        if (user.photo)
        {
            document.getElementById("profilePhoto").src = "/" + encodeURIComponent(user.photo);
            document.getElementById("profilePhoto").hidden = false;
        }
        form.addEventListener("submit", async (e) =>
        {
            e.preventDefault();
            try
            {
                const data = Object.fromEntries(new FormData(form));
                data.available = available ? available.checked : false;
                const result = await api("users/me", "PUT", data);
                showMessage(result.message);
            } catch (error)
            {
                showMessage(error.message, true);
            }
        });
        document.getElementById("photoForm").addEventListener("submit", async (e) =>
        {
            e.preventDefault();
            try
            {
                const result = await api("users/me/photo", "POST", new FormData(e.target));
                showMessage(result.message);
                document.getElementById("profilePhoto").src =
                    "/" + encodeURIComponent(result.photo);
                document.getElementById("profilePhoto").hidden = false;
            } catch (error)
            {
                showMessage(error.message, true);
            }
        });
    }
    async function passwordHistory()
    {
        const requests = await api("users/me/password-requests");
        const list = document.getElementById("passwordHistory");
        list.replaceChildren();
        requests.forEach((r) =>
            list.append(element("p", new Date(r.createdAt).toLocaleString() + " · " + displayLabel(r.status))),
        );
    }
    document.getElementById("passwordForm").addEventListener("submit", async (e) =>
    {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        if (data.newPassword !== data.confirmPassword)
            return showMessage("Passwords do not match.", true);
        try
        {
            const result = await api("users/me/password-request", "POST", data);
            showMessage(result.message);
            e.target.reset();
            await passwordHistory();
        } catch (error)
        {
            showMessage(error.message, true);
        }
    });
    await passwordHistory();
    if (document.getElementById("hospitalTable"))
    {
        const district = document.getElementById("hospitalDistrict");
        district.append(new Option("All Districts", ""));
        Object.values(BANGLADESH_LOCATIONS)
            .flat()
            .sort()
            .forEach((value) => district.append(new Option(value, value)));
        document.getElementById("hospitalArea").value = user.area || "";
        document.getElementById("hospitalPostcode").value = user.postalCode || "";
        ["hospitalSearch", "hospitalDistrict", "hospitalArea", "hospitalPostcode"].forEach((id) =>
            document
                .getElementById(id)
                .addEventListener("change", () =>
                    loadHospitalDirectory(user, 1).catch((error) =>
                        showMessage(error.message, true),
                    ),
                ),
        );
        document.getElementById("searchHospitals").addEventListener("click", () => loadHospitalDirectory(user, 1).catch(error => showMessage(error.message, true)));
        document
            .getElementById("previousHospitalPage")
            .addEventListener("click", () =>
                loadHospitalDirectory(user, hospitalPage - 1).catch((error) =>
                    showMessage(error.message, true),
                ),
            );
        document
            .getElementById("nextHospitalPage")
            .addEventListener("click", () =>
                loadHospitalDirectory(user, hospitalPage + 1).catch((error) =>
                    showMessage(error.message, true),
                ),
            );
    }
    if (document.getElementById("hospitalTable"))
    {
        const refreshTables = () =>
            loadDonationTables(user).catch((error) => showMessage(error.message, true));
        document.getElementById("searchRequests").addEventListener("click", refreshTables);
        ["groupFilter", "sortPostalCode", "sortArea"].forEach((id) =>
            document.getElementById(id).addEventListener("change", refreshTables),
        );
        document
            .querySelectorAll(
                '[data-view="hospitals"], [data-view="availableRequests"], [data-view="requests"]',
            )
            .forEach((button) => button.addEventListener("click", refreshTables));
        await loadDonationTables(user);
    }
    const requestedView = window.location.hash.slice(1);
    if (requestedView)
    {
        const tab = Array.from(document.querySelectorAll("[data-view]")).find(button => button.dataset.view === requestedView);
        if (tab) tab.click();
    }
    return user;
}

// The same password controls work on every page.
document.addEventListener("DOMContentLoaded", () =>
{
    document.querySelectorAll(".toggle-password").forEach((button) =>
    {
        button.addEventListener("click", () =>
        {
            const input = document.getElementById(button.dataset.target);
            const show = input.type === "password";
            input.type = show ? "text" : "password";
            button.textContent = show ? "Hide" : "Show";
            button.setAttribute("aria-pressed", String(show));
            button.setAttribute("aria-label", (show ? "Hide " : "Show ") + "password");
        });
    });

});

// Division changes show only the matching districts and city corporations.
function setupLocationForms()
{
    document.querySelectorAll(".country-code-select").forEach((select) =>
    {
        Object.entries(COUNTRY_CODES).forEach(([code, country]) =>
            select.append(new Option(country + " (" + code + ")", code)),
        );
    });
    document.querySelectorAll("[data-address]").forEach((section) =>
    {
        const division = section.querySelector(".division-select");
        const district = section.querySelector(".district-select");
        const city = section.querySelector(".cityCorporation-select");
        division.append(new Option("Select Division", ""));
        Object.keys(BANGLADESH_LOCATIONS).forEach((value) =>
            division.append(new Option(value, value)),
        );
        const postcode = section.querySelector('[name="postalCode"]');
        const hint = element("small", "Select a district to see its postcode range.", "postcode-hint");
        postcode.after(hint);
        function validatePostcode()
        {
            const range = POSTCODE_RANGES[district.value];
            const valid = !postcode.value || range && /^[0-9]{4}$/.test(postcode.value) && Number(postcode.value) >= range[0] && Number(postcode.value) <= range[1];
            postcode.setCustomValidity(valid ? "" : "Enter a four-digit postcode within the selected district's range.");
        }
        postcode.addEventListener("input", validatePostcode);
        function updateCities()
        {
            const range = POSTCODE_RANGES[district.value];
            hint.textContent = range ? `District postcode range: ${range[0]}–${range[1]}. Enter your exact post office code.` : "Select a district to see its postcode range.";
            postcode.placeholder = range ? `${range[0]}–${range[1]}` : "Four-digit postcode";
            validatePostcode();
            city.replaceChildren(new Option("Outside City Corporation / Not Applicable", ""));
            (CITY_CORPORATIONS[district.value] || []).forEach((value) =>
                city.append(new Option(value + " City Corporation", value)),
            );
        }
        function updateDistricts()
        {
            district.replaceChildren(new Option("Select District", ""));
            (BANGLADESH_LOCATIONS[division.value] || []).forEach((value) =>
                district.append(new Option(value, value)),
            );
            updateCities();
        }
        division.addEventListener("change", updateDistricts);
        district.addEventListener("change", updateCities);
        updateDistricts();
    });
}
document.addEventListener("DOMContentLoaded", setupLocationForms);

async function loadDonationTables(user)
{
    const query = new URLSearchParams({
        group: document.getElementById("groupFilter").value,
        area: document.getElementById("sortArea").value.trim(),
        postalCode: document.getElementById("sortPostalCode").value.trim(),
    });
    const hospitals = await api("requests/all?" + query);
    const hospitalTable = document.getElementById("hospitalTable");
    const availableTable = document.getElementById("availableTable");
    availableTable.replaceChildren();
    function row(values)
    {
        const result = element("tr");
        values.forEach((value) => result.append(element("td", value)));
        return result;
    }
    if (!hospitals.length)
    {
        const emptyRequest = row(["No matching donation requests."]);
        emptyRequest.firstChild.colSpan = 7;
        availableTable.append(emptyRequest);
    }
    hospitals.forEach((hospital) =>
    {
        hospital.requests.forEach((request) =>
        {
            const record = row([
                hospital.hospital,
                [hospital.area, hospital.postalCode].filter(Boolean).join(" / "),
                request.bloodGroup,
                String(request.units),
                new Date(request.neededBy).toLocaleString(),
                displayLabel(request.status),
            ]);
            const cell = element("td");
            if (request.status === "open" && ["donor", "volunteer"].includes(user.role))
                cell.append(
                    action("I Can Help", async () =>
                    {
                        const result = await api("requests/" + request._id + "/pledge", "POST", {});
                        showMessage(result.message);
                    }),
                );
            else cell.textContent = request.status === "open" ? "View Only" : "Closed";
            record.append(cell);
            availableTable.append(record);
        });
    });
    await loadHospitalDirectory(user, hospitalPage);
}

let hospitalPage = 1;
async function loadHospitalDirectory(user, page = 1)
{
    const query = new URLSearchParams({
        search: document.getElementById("hospitalSearch").value.trim(),
        district: document.getElementById("hospitalDistrict").value,
        area: document.getElementById("hospitalArea").value.trim(),
        postalCode: document.getElementById("hospitalPostcode").value.trim(),
        page: String(Math.max(1, page)),
    });
    const result = await api("hospitals?" + query);
    hospitalPage = result.page;
    const table = document.getElementById("hospitalTable");
    table.replaceChildren();
    if (!result.items.length)
    {
        const row = element("tr"),
            cell = element("td", "No matching facilities.");
        cell.colSpan = 3;
        row.append(cell);
        table.append(row);
    }
    result.items.forEach((item) =>
    {
        const row = element("tr");
        [item.name, item.type].forEach(value => row.append(element("td", value)));
        const cell = element("td");
        if (user.role === "admin")
            cell.append(
                action("Edit address", async () =>
                {
                    document.querySelector('[data-view="manageHospitals"]').click();
                    document.getElementById("editHospitalId").value = item._id;
                    document.getElementById("facilityName").value = item.name;
                    document.getElementById("facilityArea").value = item.area || "";
                    const division = document.getElementById("facilityDivision");
                    division.value = item.division || "";
                    division.dispatchEvent(new Event("change"));
                    const district = document.getElementById("facilityDistrict");
                    district.value = item.district || "";
                    district.dispatchEvent(new Event("change"));
                    document.getElementById("facilityCity").value = item.cityCorporation || "";
                    document.getElementById("facilityPostcode").value = item.postalCode || "";
                    document.getElementById("facilityPostcode").dispatchEvent(new Event("input"));
                    document.getElementById("hospitalEditLabel").textContent =
                        "Update address for " + item.name;
                }),
            );
        else cell.textContent = item.source;
        row.append(cell);
        table.append(row);
    });
    document.getElementById("directoryCoverage").textContent =
        `${result.total.toLocaleString()} matching facilities. Official registry snapshot: ${result.coverage.retrievedAt}. Registry postcodes are unavailable; verified postcodes can be added by admin.`;
    document.getElementById("hospitalPageLabel").textContent =
        `Page ${result.page} of ${Math.max(1, result.pages)}`;
    document.getElementById("previousHospitalPage").disabled = result.page <= 1;
    document.getElementById("nextHospitalPage").disabled = result.page >= result.pages;
}

function displayLabel(value)
{
    if (value === 'staff') return 'Medical Staff';
    return String(value || '').replace(/\b[a-z]/g, letter => letter.toUpperCase());
}
function updateSignedInHeader(user)
{
    const actions = document.querySelector('.header-actions');
    if (!actions) return;
    const page = user.role === 'admin' ? 'admin.html' : user.role === 'staff' ? 'staff.html' : 'user.html';
    const dashboard = element('a', 'Dashboard', 'login-link'); dashboard.href = page;
    const requests = element('a', 'Find Blood', 'outline-link'); requests.href = page + (['donor', 'volunteer'].includes(user.role) ? '#requests' : '#availableRequests');
    // Clicking Find Blood opens the request table when already on a dashboard.
    requests.addEventListener('click', event =>
    {
        const tab = document.querySelector('[data-view="availableRequests"]') || document.querySelector('[data-view="requests"]');
        if (tab) { event.preventDefault(); tab.click(); }
    });
    const logout = action('Log Out', async () =>
    {
        await api('auth/logout', 'POST', {});
        window.location.href = 'index.html';
    });
    logout.className = 'dark-button';
    const profile = element('a', 'My Profile', 'login-link');
    profile.href = page + '#profile';
    profile.addEventListener('click', event =>
    {
        const tab = document.querySelector('[data-view="profile"]');
        if (tab) { event.preventDefault(); tab.click(); }
    });
    const makeRequest = element("a", "Request Blood", "outline-link"); makeRequest.href = "index.html#make-request";
    actions.replaceChildren(makeRequest, dashboard, profile, logout);
    const navigation = document.querySelector('.main-navigation');
    if (navigation && !navigation.querySelector('[data-view]'))
    {
        navigation.replaceChildren();
        const features = [['Hospitals', 'hospitals'],
            ['Available Requests', ['donor', 'volunteer'].includes(user.role) ? 'requests' : 'availableRequests'],
            user.role === 'admin' ? ['Manage Accounts', 'accounts'] : user.role === 'staff' ? ['Add Patient', 'patient'] : ['My Pledges', 'pledges']];
        features.forEach(([label, view]) =>
        {
            const link = element('a', label); link.href = page + '#' + view;
            link.addEventListener('click', event =>
            {
                const tab = Array.from(document.querySelectorAll('[data-view]')).find(button => button.dataset.view === view);
                if (tab) { event.preventDefault(); tab.click(); }
            });
            navigation.append(link);
        });
    }
}
document.addEventListener('DOMContentLoaded', async () =>
{
    // F5 explicitly starts at the public homepage with a fresh browser session.
    if (window.location.pathname.endsWith('/index.html') && new URLSearchParams(window.location.search).get('start') === '1')
    {
        try
        {
            const current = await api('users/me');
            csrfToken = current.csrfToken;
            await api('auth/logout', 'POST', {});
            csrfToken = '';
        }
        catch (error) { /* No active account session to clear. */ }
        window.history.replaceState(null, '', 'index.html');
        return;
    }
    // Dashboards update the header after their existing session check.
    if (document.getElementById('profileForm')) return;
    try
    {
        const result = await api('users/me');
        csrfToken = result.csrfToken;
        updateSignedInHeader(result.user);
    }
    catch (error) { /* Logged-out visitors keep the Login and Register links. */ }
});

// Title Case applies to displayed text, never to stored values or code.
function titleCaseText(text)
{
    return String(text).replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.\w+|\b[A-Za-z][A-Za-z'-]*/g, word =>
    {
        if (word.includes('@') || word.startsWith('http')) return word;
        if (['A', 'B', 'AB', 'O', 'AM', 'PM', 'UK', 'DGHS', 'AI', 'ZIP', 'ID', 'API', 'HTML', 'CSS', 'PNG', 'JPEG', 'USA', 'NGO', 'MCWC'].includes(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
}
document.addEventListener('DOMContentLoaded', () =>
{
    function capitalizeNode(root)
    {
        const nodes = [];
        if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
        else
        {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let node; while (node = walker.nextNode()) nodes.push(node);
        }
        nodes.forEach(node =>
        {
            if (!node.parentElement || node.parentElement.closest('script, style, pre, code, textarea')) return;
            const result = titleCaseText(node.textContent);
            if (result !== node.textContent) node.textContent = result;
        });
    }
    capitalizeNode(document.body);
    new MutationObserver(records => records.forEach(record =>
    {
        if (record.type === 'characterData') capitalizeNode(record.target);
        else record.addedNodes.forEach(capitalizeNode);
    })).observe(document.body, { childList: true, subtree: true, characterData: true });
    [['sortArea', 'searchRequests'], ['sortPostalCode', 'searchRequests'], ['hospitalSearch', 'searchHospitals'], ['hospitalArea', 'searchHospitals'], ['hospitalPostcode', 'searchHospitals']].forEach(([inputId, buttonId]) =>
    {
        const input = document.getElementById(inputId), button = document.getElementById(buttonId);
        if (input && button) input.addEventListener('keydown', event =>
        {
            if (event.key === 'Enter') { event.preventDefault(); button.click(); }
        });
    });
});
