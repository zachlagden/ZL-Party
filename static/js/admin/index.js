document.addEventListener("DOMContentLoaded", function () {
  $.ajax({
    url: "/api/admin/suggestions",
    type: "GET",
    success: function (data) {
      if (
        "ok" in data &&
        data.ok &&
        "info" in data &&
        "total_suggestions" in data.info
      ) {
        $("#currentSuggestions").html(
          `Current Suggestions: <span>${data.info.total_suggestions}</span>`
        );
      } else {
        console.error("Failed to fetch suggestions count: ", data);
        toastr.error("Failed to fetch suggestions count", "Error");
      }
    },
    error: function (error) {
      response = error.responseJSON;

      if ("ok" in data && !data.ok && "error" in data) {
        console.error("Failed to fetch suggestions count: ", data.error);
        toastr.error(data.error, "Error");
      } else {
        console.error("Failed to fetch suggestions count: ", error);
        toastr.error("Failed to fetch suggestions count", "Error");
      }
    },
  });

  $.ajax({
    url: "/api/whoami",
    type: "GET",
    success: function (data) {
      if ("ok" in data && data.ok && "username" in data) {
        let capsUsername =
          data.username.charAt(0).toUpperCase() + data.username.slice(1);

        $("#welcomeGreeting").html(`Welcome, ${capsUsername}!`);
      } else {
        console.error("Failed to fetch username: ", data);
        toastr.error("Failed to fetch username", "Error");
      }
    },
    error: function (error) {
      response = error.responseJSON;

      if ("ok" in data && !data.ok && "error" in data) {
        console.error("Failed to fetch username: ", data.error);
        toastr.error(data.error, "Error");
      } else {
        console.error("Failed to fetch username: ", error);
        toastr.error("Failed to fetch username", "Error");
      }
    },
  });
});
