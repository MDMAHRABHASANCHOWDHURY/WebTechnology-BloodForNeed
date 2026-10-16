// Home page: load hospital cards and apply a blood group filter.
document.addEventListener("DOMContentLoaded", () =>
{
    fillGroups();
    const filter = document.getElementById("groupFilter");
    async function load()
    {
        try
        {
            await hospitalCards(document.getElementById("hospitalList"), filter.value);
        } catch (error)
        {
            showMessage(error.message, true);
        }
    }
    filter.addEventListener("change", load);
    document.getElementById("searchRequests").addEventListener("click", load);
    ["sortPostalCode", "sortArea"].forEach((id) =>
        document.getElementById(id).addEventListener("change", load),
    );
    load();
});
