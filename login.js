// Login page: send credentials and open the correct dashboard.
document.addEventListener("DOMContentLoaded", () =>
{
    document.getElementById("loginForm").addEventListener("submit", async (e) =>
    {
        e.preventDefault();
        try
        {
            const result = await api("auth/login", "POST", {
                identity: document.getElementById("identity").value.trim(),
                password: document.getElementById("password").value,
            });
            window.location.href =
                result.role === "admin"
                    ? "admin.html"
                    : result.role === "staff"
                      ? "staff.html"
                      : "user.html";
        } catch (error)
        {
            showMessage(error.message, true);
        }
    });
});
