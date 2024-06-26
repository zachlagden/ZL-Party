$(document).ready(function () {
  const $adminToggle = $("#newUserAdminToggle");
  const $adminCheckbox = $("#newUserAdmin");

  function loadUsers() {
    $.ajax({
      url: "/api/admin/users",
      method: "GET",
      success: function (data) {
        if (data.ok) {
          renderUserList(data.users);
        } else {
          toastr.error(data.error);
        }
      },
      error: function (error) {
        console.error("Error:", error);
        toastr.error("Failed to load users.");
      },
    });
  }

  function renderUserList(users) {
    const $userList = $("#userList");
    $userList.empty();

    // Separate and sort users
    const superusers = users
      .filter((user) => user.superuser)
      .sort((a, b) => a.username.localeCompare(b.username));
    const admins = users
      .filter((user) => user.admin && !user.superuser)
      .sort((a, b) => a.username.localeCompare(b.username));
    const regularUsers = users
      .filter((user) => !user.admin && !user.superuser)
      .sort((a, b) => a.username.localeCompare(b.username));

    // Concatenate sorted arrays
    const sortedUsers = [...superusers, ...admins, ...regularUsers];

    sortedUsers.forEach((user) => {
      const userCard = `
          <div class="p-4 bg-gray-50 rounded-lg" id="${user.username}">
            <div class="flex items-center">
              ${
                !user.superuser && !user.pfp
                  ? `<img src="https://ui-avatars.com/api/?name=${user.username}" alt="Profile Picture" class="profile-pic" />`
                  : user.pfp
                  ? `<img src="/static/profiles/${user.pfp}" alt="Profile Picture" class="profile-pic" />`
                  : ""
              }
              <div>
                <h3 class="text-xl font-semibold mb-2">
                  ${
                    user.username.charAt(0).toUpperCase() +
                    user.username.slice(1)
                  } - ${
        user.superuser ? "Superuser" : user.admin ? "Admin" : "User"
      }
                </h3>
                <div class="flex flex-wrap space-x-4 user-buttons">
                  <label class="toggle-button">
                    <input type="checkbox" class="form-checkbox toggle-ban" data-username="${
                      user.username
                    }" ${user.banned ? "checked" : ""} ${
        user.superuser ? "disabled" : ""
      }>
                    <span>Ban from Adding Suggestions</span>
                  </label>
                  <label class="toggle-button">
                    <input type="checkbox" class="form-checkbox toggle-admin" data-username="${
                      user.username
                    }" ${user.admin ? "checked" : ""} ${
        user.superuser ? "disabled" : ""
      }>
                    <span>Admin</span>
                  </label>
                </div>
                <div class="flex flex-wrap space-x-4 user-buttons mt-4">
                  <button class="bg-red-500 text-white px-4 py-2 rounded delete-user ${
                    user.superuser ? "disabled-button" : ""
                  }" data-username="${user.username}" ${
        user.superuser ? "disabled" : ""
      }>
                    Delete User
                  </button>
                  <button class="bg-blue-500 text-white px-4 py-2 rounded change-password ${
                    user.superuser ? "disabled-button" : ""
                  }" data-username="${user.username}" ${
        user.superuser ? "disabled" : ""
      }">
                    ${!user.password ? "Set Password" : "Change Password"}
                  </button>
                  ${
                    user.password
                      ? `<button class="bg-orange-500 text-white px-4 py-2 rounded remove-password ${
                          user.superuser ? "disabled-button" : ""
                        }" data-username="${user.username}" ${
                          user.superuser ? "disabled" : ""
                        }">
                    Remove Password
                  </button>`
                      : ""
                  }
                  <button class="bg-green-500 text-white px-4 py-2 rounded pfp-button ${
                    user.superuser ? "disabled-button" : ""
                  }" data-username="${user.username}" ${
        user.superuser ? "disabled" : ""
      }">
                    ${!user.pfp ? "Set PFP" : "Change PFP"}
                  </button>
                  ${
                    user.pfp
                      ? `<button class="bg-yellow-500 text-white px-4 py-2 rounded remove-pfp ${
                          user.superuser ? "disabled-button" : ""
                        }" data-username="${user.username}" ${
                          user.superuser ? "disabled" : ""
                        }">
                    Remove PFP
                  </button>`
                      : ""
                  }
                </div>
                <div class="flex flex-wrap space-x-4 mt-4 change-password-field" style="display: none" data-username="${
                  user.username
                }">
                  <input type="password" class="w-full p-2 border rounded new-password" placeholder="New Password" />
                  <button class="bg-green-500 text-white px-4 py-2 rounded save-password ${
                    user.superuser ? "disabled-button" : ""
                  }" data-username="${user.username}" ${
        user.superuser ? "disabled" : ""
      }">
                    Save Password
                  </button>
                </div>
                <div class="flex flex-wrap space-x-4 mt-4 pfp-field" style="display: none" data-username="${
                  user.username
                }">
                  <input type="file" class="w-full p-2 border rounded new-pfp" accept=".png, .jpg, .jpeg" />
                  <button class="bg-green-500 text-white px-4 py-2 rounded save-pfp ${
                    user.superuser ? "disabled-button" : ""
                  }" data-username="${user.username}" ${
        user.superuser ? "disabled" : ""
      }">
                    Save PFP
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      $userList.append(userCard);
    });

    attachEventHandlers();
  }

  function attachEventHandlers() {
    // Unbind previous handlers to prevent multiple bindings
    $("#addUserForm").off("submit");
    $("#userList").off("click", ".delete-user");
    $("#userList").off("change", ".toggle-admin");
    $("#userList").off("change", ".toggle-ban");
    $("#userList").off("click", ".change-password");
    $("#userList").off("click", ".save-password");
    $("#userList").off("click", ".remove-password");
    $("#userList").off("click", ".pfp-button");
    $("#userList").off("click", ".save-pfp");
    $("#userList").off("click", ".remove-pfp");

    // Handle form submission for adding user
    $("#addUserForm").on("submit", function (e) {
      e.preventDefault();
      const $submitButton = $(this).find('button[type="submit"]');

      toggleLoading($submitButton, true);

      const username = $("#newUsername").val();
      const isAdmin = $adminCheckbox.prop("checked");
      const password = isAdmin ? $("#newUserPassword").val() : "";

      $.ajax({
        url: "/api/admin/users",
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify({
          username: username,
          admin: isAdmin,
          password: password,
        }),
        success: function (data) {
          if ("ok" in data && data.ok) {
            $("#addUserForm")[0].reset();
            $adminCheckbox.prop("checked", false);
            toggleAdminState();
            loadUsers(); // Refresh the user list
          } else {
            console.error(
              "An unexpected error occurred during a successful request: ",
              data
            );
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
        error: function (error) {
          response = error.responseJSON;

          if ("ok" in response && !response.ok && "error" in response) {
            console.error("Failed to add user: ", response.error);
            toastr.error(response.error, "Error");
          } else {
            console.error("An unexpected error occurred: ", error);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
        complete: function () {
          toggleLoading($submitButton, false);
        },
      });
    });

    // Handle user deletion
    $("#userList").on("click", ".delete-user", function () {
      const username = $(this).data("username");
      const $button = $(this);

      toggleLoading($button, true);

      $.ajax({
        url: `/api/admin/users/${username}`,
        method: "DELETE",
        success: function (data) {
          if ("ok" in data && data.ok) {
            loadUsers(); // Refresh the user list
          } else {
            console.error("An unexpected error occurred: ", data);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
        error: function (error) {
          response = error.responseJSON;

          if ("ok" in response && !response.ok && "error" in response) {
            console.error("Failed to delete user: ", response.error);
            toastr.error(response.error, "Error");
          } else {
            console.error("An unexpected error occurred: ", error);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
        complete: function () {
          toggleLoading($button, false);
        },
      });
    });

    // Handle toggling admin rights
    $("#userList").on("change", ".toggle-admin", function () {
      const username = $(this).data("username");
      const isAdmin = $(this).prop("checked");
      const $checkbox = $(this);

      $.ajax({
        url: `/api/admin/users/${username}/admin`,
        method: "PATCH",
        contentType: "application/json",
        data: JSON.stringify({ admin: isAdmin }),
        success: function (data) {
          if ("ok" in data && data.ok) {
            toastr.success("Admin rights updated successfully.");
          } else {
            $checkbox.prop("checked", !isAdmin);

            console.error("An unexpected error occurred: ", data);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
        error: function (error) {
          data = error.responseJSON;

          $checkbox.prop("checked", !isAdmin);

          if ("ok" in data && !data.ok && "error" in data) {
            console.error("Failed to update admin rights: ", data.error);
            toastr.error(data.error, "Error");
          } else {
            console.error("An unexpected error occurred: ", error);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
      });
    });

    // Handle toggling ban from adding suggestions
    $("#userList").on("change", ".toggle-ban", function () {
      const username = $(this).data("username");
      const isBanned = $(this).prop("checked");
      const $checkbox = $(this);

      $.ajax({
        url: `/api/admin/users/${username}/ban`,
        method: "PATCH",
        contentType: "application/json",
        data: JSON.stringify({ ban: isBanned }),
        success: function (data) {
          if ("ok" in data && data.ok) {
            toastr.success(
              `User ${isBanned ? "banned" : "unbanned"} successfully.`
            );
          } else {
            $checkbox.prop("checked", !isAdmin);

            console.error("An unexpected error occurred: ", data);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
        error: function (error) {
          data = error.responseJSON;

          $checkbox.prop("checked", !isBanned);

          if ("ok" in data && !data.ok && "error" in data) {
            console.error("Failed to update ban status: ", data.error);
            toastr.error(data.error, "Error");
          } else {
            console.error("An unexpected error occurred: ", error);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
      });
    });

    // Show/Hide change password field
    $("#userList").on("click", ".change-password", function () {
      const username = $(this).data("username");
      const $passwordField = $(
        `.change-password-field[data-username="${username}"]`
      );
      $passwordField.css(
        "display",
        $passwordField.css("display") === "none" ? "flex" : "none"
      );
    });

    // Handle saving new password
    $("#userList").on("click", ".save-password", function () {
      const username = $(this).data("username");
      const password = $(
        `.change-password-field[data-username="${username}"] .new-password`
      ).val();
      const $button = $(this);
      $button.data("originalText", $button.html());
      toggleLoading($button, true);

      $.ajax({
        url: `/api/admin/users/${username}/password`,
        method: "PATCH",
        contentType: "application/json",
        data: JSON.stringify({ password: password }),
        success: function (data) {
          if ("ok" in data && data.ok) {
            loadUsers(); // Refresh the user list
          } else {
            console.error("An unexpected error occurred: ", data);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
        error: function (error) {
          data = error.responseJSON;

          if ("ok" in data && !data.ok && "error" in data) {
            console.error("Failed to update password: ", data.error);
            toastr.error(data.error, "Error");
          } else {
            console.error("An unexpected error occurred: ", error);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
        complete: function () {
          toggleLoading($button, false);
        },
      });
    });

    // Handle removing password
    $("#userList").on("click", ".remove-password", function () {
      const username = $(this).data("username");
      const $button = $(this);

      toggleLoading($button, true);

      $.ajax({
        url: `/api/admin/users/${username}/password`,
        method: "PATCH",
        contentType: "application/json",
        data: JSON.stringify({ password: "" }),
        success: function (data) {
          if ("ok" in data && data.ok) {
            loadUsers(); // Refresh the user list
          } else {
            console.error("An unexpected error occurred: ", data);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
        error: function (error) {
          data = error.responseJSON;

          if ("ok" in data && !data.ok && "error" in data) {
            console.error("Failed to remove password: ", data.error);
            toastr.error(data.error, "Error");
          } else {
            console.error("An unexpected error occurred: ", error);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
        complete: function () {
          toggleLoading($button, false);
        },
      });
    });

    // Show/Hide PFP field
    $("#userList").on("click", ".pfp-button", function () {
      const username = $(this).data("username");
      const $pfpField = $(`.pfp-field[data-username="${username}"]`);
      $pfpField.css(
        "display",
        $pfpField.css("display") === "none" ? "flex" : "none"
      );
    });

    // Handle saving new PFP
    $("#userList").on("click", ".save-pfp", function () {
      const username = $(this).data("username");
      const file = $(`.pfp-field[data-username="${username}"] .new-pfp`)[0]
        .files[0];
      const $button = $(this);

      toggleLoading($button, true);

      const formData = new FormData();
      formData.append("file", file);

      $.ajax({
        url: `/api/admin/users/${username}/pfp`,
        method: "POST",
        processData: false,
        contentType: false,
        data: formData,
        success: function (data) {
          if ("ok" in data && data.ok) {
            loadUsers(); // Refresh the user list
          } else {
            console.error("An unexpected error occurred: ", data);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
        error: function (error) {
          data = error.responseJSON;

          if ("ok" in data && !data.ok && "error" in data) {
            console.error("Failed to update PFP: ", data.error);
            toastr.error(data.error, "Error");
          } else {
            console.error("An unexpected error occurred: ", error);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
        complete: function () {
          toggleLoading($button, false);
        },
      });
    });

    // Handle removing PFP
    $("#userList").on("click", ".remove-pfp", function () {
      const username = $(this).data("username");
      const $button = $(this);

      toggleLoading($button, true);

      $.ajax({
        url: `/api/admin/users/${username}/pfp`,
        method: "DELETE",
        success: function (data) {
          if ("ok" in data && data.ok) {
            loadUsers(); // Refresh the user list
          } else {
            console.error("An unexpected error occurred: ", data);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
        error: function (error) {
          data = error.responseJSON;

          if ("ok" in data && !data.ok && "error" in data) {
            console.error("Failed to remove PFP: ", data.error);
            toastr.error(data.error, "Error");
          } else {
            console.error("An unexpected error occurred: ", error);
            toastr.error("An unexpected error occurred.", "Error");
          }
        },
        complete: function () {
          toggleLoading($button, false);
        },
      });
    });

    const hash = window.location.hash;
    if (hash) {
      const username = hash.substring(1);
      const $userElement = $(`#${username}`);
      if ($userElement.length) {
        $userElement.addClass("highlight");
        setTimeout(() => {
          $userElement.removeClass("highlight");
        }, 1000);
      }
    }
  }

  $adminToggle.on("click", function () {
    $adminCheckbox.prop("checked", !$adminCheckbox.prop("checked"));
    toggleAdminState();
  });

  function toggleAdminState() {
    if ($adminCheckbox.prop("checked")) {
      $adminToggle
        .addClass("active")
        .removeClass("bg-red-500 hover:bg-red-600")
        .addClass("bg-green-500 hover:bg-green-600");
      $("#adminPasswordField").css("display", "flex");
      $("#newUserPassword").prop("required", true);
    } else {
      $adminToggle
        .removeClass("active")
        .addClass("bg-red-500 hover:bg-red-600")
        .removeClass("bg-green-500 hover:bg-green-600");
      $("#adminPasswordField").css("display", "none");
      $("#newUserPassword").prop("required", false);
    }
  }

  toggleAdminState();

  loadUsers();
});
