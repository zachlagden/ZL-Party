$(document).ready(function () {
  loadSuggestions();
});

function loadSuggestions() {
  $.getJSON("/api/admin/suggestions", function (data) {
    if (data.ok) {
      const suggestions = data.suggestions;
      const userSuggestions = data.user_suggestions;

      // Populate All Suggestions Tab
      populateAllSuggestions(suggestions);

      // Populate User Tabs
      populateUserTabs(userSuggestions);
    } else {
      toastr.error("Failed to load suggestions.");
    }
  }).fail(function () {
    toastr.error("Failed to load suggestions.");
  });
}

function populateAllSuggestions(suggestions) {
  const allSuggestionsBody = $("#allSuggestionsBody");
  allSuggestionsBody.empty();

  suggestions.forEach((suggestion) => {
    const row = `<tr data-username="${
      suggestion.suggested_by
    }" data-track-id="${suggestion.track_id}">
        <td class="px-4 py-2 border-b">${suggestion.suggested_by}</td>
        <td class="px-4 py-2 border-b">${suggestion.track_name}</td>
        <td class="px-4 py-2 border-b">${suggestion.track_artists.join(
          ", "
        )}</td>
        <td class="px-4 py-2 border-b">${new Date(
          suggestion.suggested_at * 1000
        ).toLocaleString()}</td>
        <td class="px-4 py-2 border-b">${suggestion.popularity}</td>
        <td class="px-4 py-2 border-b text-center">
          <button class="bg-red-500 text-white px-2 py-1 rounded remove-btn" onclick="removeSuggestion(this, '${
            suggestion.suggested_by
          }')">Remove</button>
          <button class="bg-green-500 text-white px-2 py-1 rounded download-btn" onclick="downloadTrack('${
            suggestion.track_id
          }', '${suggestion.track_name}', '${suggestion.track_artists.join(
      ", "
    )}', this)">Download</button>
        </td>
        <td class="hidden">${suggestion.track_id}</td>
      </tr>`;
    allSuggestionsBody.append(row);
  });

  new Tablesort(document.getElementById("allSuggestionsTable"));
}

function populateUserTabs(userSuggestions) {
  const tabsContainer = $("#tabs-container");
  const userTabsContainer = $("#userTabsContainer");

  tabsContainer.empty();
  userTabsContainer.empty();

  tabsContainer.append(
    '<button class="bg-indigo-500 text-white px-4 py-2 rounded" onclick="showTab(\'all\')">All Suggestions</button>'
  );

  for (const [username, suggestions] of Object.entries(userSuggestions)) {
    let capsUsername = username.charAt(0).toUpperCase() + username.slice(1);

    tabsContainer.append(
      `<button class="bg-indigo-500 text-white px-4 py-2 rounded" onclick="showTab('${username}')">${capsUsername}</button>`
    );

    const userTabContent = `<div id="${username}" class="tab-content hidden">
        <div class="flex justify-end mb-4">
          <button class="bg-blue-500 text-white px-4 py-2 rounded download-all-btn" onclick="downloadAllTracks('${username}', this)">Download All</button>
        </div>
        <h3 class="text-2xl font-semibold mb-4 text-center">${capsUsername}'s Suggestions</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full bg-white border" id="suggestionsTable_${username}">
            <thead>
              <tr>
                <th class="px-4 py-2 border-b cursor-pointer">Track Name</th>
                <th class="px-4 py-2 border-b cursor-pointer">Artists</th>
                <th class="px-4 py-2 border-b cursor-pointer">Added At</th>
                <th class="px-4 py-2 border-b cursor-pointer">Popularity</th>
                <th class="px-4 py-2 border-b">Actions</th>
                <th class="hidden">Track ID</th>
              </tr>
            </thead>
            <tbody>${suggestions
              .map(
                (suggestion) => `
              <tr data-track-id="${suggestion.track_id}">
                <td class="px-4 py-2 border-b">${suggestion.track_name}</td>
                <td class="px-4 py-2 border-b">${suggestion.track_artists.join(
                  ", "
                )}</td>
                <td class="px-4 py-2 border-b">${new Date(
                  suggestion.suggested_at * 1000
                ).toLocaleString()}</td>
                <td class="px-4 py-2 border-b">${suggestion.popularity}</td>
                <td class="px-4 py-2 border-b text-center">
                  <button class="bg-red-500 text-white px-2 py-1 rounded remove-btn" onclick="removeSuggestion(this, '${username}')">Remove</button>
                  <button class="bg-green-500 text-white px-2 py-1 rounded download-btn" onclick="downloadTrack('${
                    suggestion.track_id
                  }', '${
                  suggestion.track_name
                }', '${suggestion.track_artists.join(
                  ", "
                )}', this)">Download</button>
                </td>
                <td class="hidden">${suggestion.track_id}</td>
              </tr>`
              )
              .join("")}
            </tbody>
          </table>
        </div>
      </div>`;

    userTabsContainer.append(userTabContent);
    new Tablesort(document.getElementById(`suggestionsTable_${username}`));
  }
}

function showTab(tabId) {
  $(".tab-content").addClass("hidden");
  $("#" + tabId).removeClass("hidden");
}

function removeSuggestion(button, username) {
  const $button = $(button);
  toggleLoading($button, true);
  const row = $button.closest("tr");
  const trackId = row.find("td.hidden").text();

  $.ajax({
    url: `/admin/suggestion/${username}/${trackId}`,
    type: "DELETE",
    success: function (response) {
      toggleLoading($button, false);

      if ("ok" in response && response.ok) {
        $(`tr[data-track-id="${trackId}"]`).remove();
        $(`#${username} tr[data-track-id="${trackId}"]`).remove();

        toastr.success("Suggestion removed successfully.");
      } else {
        console.error(
          "Failed to remove the suggestion on a successful response:",
          response
        );
        toastr.error("Failed to remove the suggestion.");
      }
    },
    error: function (error) {
      toggleLoading($button, false);

      response = error.responseJSON;

      if ("ok" in response && !response.ok) {
        toastr.error(response.error);
      } else {
        console.error("Failed to remove the suggestion:", response);
        toastr.error("Failed to remove the suggestion.");
      }
    },
  });
}

function downloadTrack(trackId, trackName, trackArtists, button) {
  toggleLoading(button, true);
  $.ajax({
    url: `/api/admin/download/${trackId}`,
    type: "GET",
    success: function (data, status, xhr) {
      const contentType = xhr.getResponseHeader("Content-Type");

      if (contentType && contentType.includes("application/json")) {
        const jsonResponse = typeof data === "string" ? JSON.parse(data) : data;
        if (jsonResponse.error) {
          toastr.clear();
          toastr.error(jsonResponse.error);
        } else {
          toastr.error("Unexpected JSON response");
        }
        toggleLoading(button, false);
      } else {
        const blob = new Blob([data], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `${trackArtists} - ${trackName}.mp3`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toggleLoading(button, false);
      }
    },
    error: function () {
      toastr.clear();
      toastr.error("An error occurred while trying to download the track.");
      toggleLoading(button, false);
    },
  });
}

function downloadAllTracks(tabId, button) {
  toggleLoading(button, true);
  const table = $(
    "#" +
      (tabId === "all" ? "allSuggestionsTable" : `suggestionsTable_${tabId}`)
  );
  const trackIds = table
    .find("td.hidden")
    .map(function () {
      return $(this).text();
    })
    .get();

  $.ajax({
    url: "/api/admin/download_all",
    type: "POST",
    contentType: "application/json",
    data: JSON.stringify({ tracks: trackIds }),
    xhrFields: {
      responseType: "blob",
    },
    success: function (blob) {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = "all_tracks.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toggleLoading(button, false);
    },
    error: function () {
      toastr.error("An error occurred while trying to download all tracks.");
      toggleLoading(button, false);
    },
  });
}

function toggleLoading(button, isLoading) {
  const $button = $(button);
  if (isLoading) {
    $button
      .html('<i class="fas fa-spinner fa-spin"></i>')
      .prop("disabled", true);
  } else {
    const isDownloadAll = $button.hasClass("download-all-btn");
    const isRemove = $button.hasClass("remove-btn");
    if (isDownloadAll) {
      $button.html("Download All");
    } else if (isRemove) {
      $button.html("Remove");
    } else {
      $button.html("Download");
    }
    $button.prop("disabled", false);
  }
}
