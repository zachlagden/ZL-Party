let activeUser = null;

function fetchUsers() {
  $.ajax({
    url: "/api/admin/users",
    type: "GET",
    dataType: "json",
    success: function (data) {
      if ("ok" in data && data.ok) {
        const usersTabsContainer = $("#users-tabs");
        const vouchersContainer = $("#vouchers-container");
        usersTabsContainer.empty();
        vouchersContainer.empty();

        // Add "All Vouchers" tab and set it as active by default
        const allVouchersButton = $("<button></button>")
          .addClass("bg-indigo-500 text-white px-4 py-2 rounded active")
          .text("All Vouchers")
          .on("click", function () {
            showTab("all-vouchers");
          });
        usersTabsContainer.append(allVouchersButton);

        const allVouchersDiv = $(`
            <div class="tab-content active" id="all-vouchers">
              <h3 class="text-2xl font-semibold mb-4 text-center">All Vouchers</h3>
              <div class="overflow-x-auto">
                <div id="all-vouchers-list"></div>
              </div>
            </div>
          `);
        vouchersContainer.append(allVouchersDiv);

        let allVouchersContent = "";

        $.each(data.users, function (index, user) {
          const usernameCapitalized =
            user.username.charAt(0).toUpperCase() + user.username.slice(1);

          const userButton = $("<button></button>")
            .addClass("bg-indigo-500 text-white px-4 py-2 rounded")
            .text(usernameCapitalized)
            .on("click", function () {
              showTab(user.username);
            });

          usersTabsContainer.append(userButton);

          const userDiv = $(`
              <div class="tab-content" id="${user.username}">
                <div class="flex justify-end mb-4">
                  <button class="bg-blue-500 text-white px-4 py-2 rounded" onclick="createVoucher('${
                    user.username
                  }', this)">Create Voucher</button>
                </div>
                <h3 class="text-2xl font-semibold mb-4 text-center">${usernameCapitalized}'s Vouchers</h3>
                <div class="overflow-x-auto">
                  <div id="vouchers-${user.username}">
                    ${
                      user.drinks && user.drinks.length > 0
                        ? user.drinks
                            .map(
                              (drink) => `
                      <div class="p-4 mb-2 bg-white shadow rounded">
                        <p>Username: ${usernameCapitalized}</p>
                        <p>Voucher ID: ${drink.uuid}</p>
                        <p>Status: ${drink.used ? "Used" : "Unused"}</p>
                        <button onclick="markVoucher('${
                          drink.uuid
                        }', ${!drink.used}, this)" class="bg-green-500 text-white py-1 px-2 rounded">
                          ${drink.used ? "Mark as Unused" : "Mark as Used"}
                        </button>
                        <button onclick="deleteVoucher('${
                          drink.uuid
                        }', this)" class="bg-red-500 text-white py-1 px-2 rounded">Delete</button>
                      </div>`
                            )
                            .join("")
                        : "<p>No vouchers</p>"
                    }
                  </div>
                </div>
              </div>
            `);
          vouchersContainer.append(userDiv);

          if (user.drinks && user.drinks.length > 0) {
            allVouchersContent += user.drinks
              .map(
                (drink) => `
                  <div class="p-4 mb-2 bg-white shadow rounded">
                    <p>Username: ${usernameCapitalized}</p>
                    <p>Voucher ID: ${drink.uuid}</p>
                    <p>Status: ${drink.used ? "Used" : "Unused"}</p>
                    <button onclick="markVoucher('${
                      drink.uuid
                    }', ${!drink.used}, this)" class="bg-green-500 text-white py-1 px-2 rounded">
                      ${drink.used ? "Mark as Unused" : "Mark as Used"}
                    </button>
                    <button onclick="deleteVoucher('${
                      drink.uuid
                    }', this)" class="bg-red-500 text-white py-1 px-2 rounded">Delete</button>
                  </div>`
              )
              .join("");
          }
        });

        $("#all-vouchers-list").html(allVouchersContent);

        if (activeUser) {
          showTab(activeUser);
        } else {
          showTab("all-vouchers");
        }
      } else {
        console.error(
          "An unexpected error occurred during a successful response: ",
          data
        );
        toastr.error("An unexpected error occurred", "Error");
      }
    },
    error: function (error) {
      response = error.responseJSON;

      if ("ok" in response && !response.ok && "error" in response) {
        console.error("Failed to fetch users: ", response.error);
        toastr.error(response.error, "Error");
      } else {
        console.error("Failed to fetch users: ", error);
        toastr.error("Failed to fetch users", "Error");
      }
    },
  });
}

function showTab(tabId) {
  activeUser = tabId;
  $(".tab-content").removeClass("active");
  $(".scrollable-container button").removeClass("active");

  $("#" + tabId).addClass("active");
  $(
    `.scrollable-container button:contains(${
      tabId.charAt(0).toUpperCase() + tabId.slice(1)
    })`
  ).addClass("active");
}

function createVoucher(username, button) {
  const $button = $(button);

  toggleLoading($button, true);

  $.ajax({
    url: "/api/admin/create_voucher",
    type: "POST",
    contentType: "application/json",
    data: JSON.stringify({ username }),
    success: function (data) {
      if ("ok" in data && data.ok && "uuid" in data) {
        toastr.success("Voucher created successfully", "Success");
        fetchUsers();
      } else {
        console.error(
          "An unexpected error occurred during a successful response: ",
          data
        );
        toastr.error("An unexpected error occurred", "Error");
      }
    },
    error: function (error) {
      response = error.responseJSON;

      if ("ok" in response && !response.ok && "error" in response) {
        console.error("Failed to create voucher: ", response.error);
        toastr.error(response.error, "Error");
      } else {
        console.error("Failed to create voucher: ", error);
        toastr.error("Failed to create voucher", "Error");
      }
    },
    complete: function () {
      toggleLoading($button, false);
    },
  });
}

function deleteVoucher(uuid, button) {
  const $button = $(button);

  toggleLoading($button, true);

  $.ajax({
    url: `/api/admin/delete_voucher/${uuid}`,
    type: "DELETE",
    success: function (data) {
      if ("ok" in data && data.ok) {
        toastr.success("Voucher deleted successfully", "Success");
        fetchUsers();
      } else {
        console.error("An unexpected error occurred: ", data);
        toastr.error("An unexpected error occurred", "Error");
      }
    },
    error: function (error) {
      response = error.responseJSON;

      if ("ok" in response && !response.ok && "error" in response) {
        console.error("Failed to delete voucher: ", response.error);
        toastr.error(response.error, "Error");
      } else {
        console.error("Failed to delete voucher: ", error);
        toastr.error("Failed to delete voucher", "Error");
      }
    },
    complete: function () {
      toggleLoading($button, false);
    },
  });
}

function markVoucher(uuid, use, button) {
  const $button = $(button);

  toggleLoading($button, true);

  $.ajax({
    url: `/api/admin/vouchers/status/${uuid}/${use ? "use" : "unuse"}`,
    type: "PATCH",
    success: function (data) {
      if ("ok" in data && data.ok) {
        toastr.success(
          "Voucher marked as " + (use ? "used" : "unused"),
          "Success"
        );
        fetchUsers();
      } else {
        console.error("An unexpected error occurred: ", data);
        toastr.error("An unexpected error occurred", "Error");
      }
    },
    error: function (error) {
      response = error.responseJSON;

      if ("ok" in response && !response.ok && "error" in response) {
        console.error("Failed to mark voucher: ", response.error);
        toastr.error(response.error, "Error");
      } else {
        console.error("Failed to mark voucher: ", error);
        toastr.error("Failed to mark voucher", "Error");
      }
    },
    complete: function () {
      toggleLoading($button, false);
    },
  });
}

$(document).ready(function () {
  fetchUsers();
});
