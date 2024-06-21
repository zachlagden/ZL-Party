const loginapiroute = "/api/login";

$(document).ready(function () {
  $("#loginForm").on("submit", function (event) {
    event.preventDefault(); // Prevent the default form submission

    // Serialize the form data
    var formData = $(this).serializeArray();

    // Convert form data to JSON
    var jsonData = {};
    $.each(formData, function () {
      jsonData[this.name] = this.value;
    });

    // Send the POST request with JSON data
    $.ajax({
      url: loginapiroute,
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify(jsonData),

      success: function (response) {
        if ("ok" in response && response.ok === true) {
          // Reload the page
          window.location.reload();
        } else {
          console.error(
            "An Expected Error Occurred On A Successful Request:",
            response.error
          );
          toastr.error("An expected error occurred", "Error");
        }
      },

      error: function (error) {
        let response = error.responseJSON;

        if ("ok" in response && response.ok === false) {
          if ("action" in response) {
            if (response.action === "provide_password") {
              $("#password").removeClass("hidden");
              $("#passwordLabel").removeClass("hidden");
              $("#password").focus();
            }
          } else {
            console.error("An Expected Error Occurred:", response.error);
            toastr.error(response.error, "Error");
          }
        } else {
          console.error("An Unexpected Error Occurred:", error);
          toastr.error("An unexpected error occurred", "Error");
        }
      },
    });
  });
});
