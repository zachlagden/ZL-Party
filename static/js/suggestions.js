// Function to format date
function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

// Function to create suggestion row
function createSuggestionRow(suggestion) {
  return `
        <tr>
          <td class="px-4 py-2 border-b">${suggestion.track_name}</td>
          <td class="px-4 py-2 border-b">${suggestion.track_artists.join(
            ", "
          )}</td>
          <td class="px-4 py-2 border-b">${formatDate(
            suggestion.suggested_at
          )}</td>
          <td class="px-4 py-2 border-b text-center">
            <button class="bg-red-500 text-white px-2 py-1 rounded" onclick="removeSuggestion(this)">
              Remove
            </button>
          </td>
          <td class="hidden">${suggestion.track_id}</td>
        </tr>`;
}

// Function to load suggestions
function loadSuggestions() {
  $.ajax({
    url: "/api/whoami",
    type: "GET",
    success: function (response) {
      if (response.ok) {
        const suggestions = response.suggestions;
        const suggestionsBody = $("#suggestionsBody");
        suggestionsBody.empty();
        suggestions.forEach((suggestion) => {
          suggestionsBody.append(createSuggestionRow(suggestion));
        });
        new Tablesort(document.getElementById("suggestionsTable"));
      } else {
        toastr.error("Failed to load suggestions", "Error");
      }
    },
    error: function () {
      toastr.error("An unexpected error occurred while fetching data", "Error");
    },
  });
}

// Function to remove a suggestion
function removeSuggestion(button) {
  let $button = $(button);

  const row = $button.closest("tr");
  const trackId = row.find("td.hidden").text();

  toggleLoading($button, true);

  // Serialize the form data
  var jsonData = {
    track_id: trackId,
  };

  $.ajax({
    url: `/api/suggestion/${trackId}`,
    type: "DELETE",
    contentType: "application/json",
    data: JSON.stringify(jsonData),

    success: function (response) {
      if ("ok" in response && response.ok) {
        row.remove();
        toastr.success(response.message, "Success");
      } else {
        console.error(
          "An unexpected error occurred during a successful request:",
          response
        );
        toastr.error("An unexpected error occurred", "Error");
        toggleLoading($button, false);
      }
    },
    error: function (error) {
      toggleLoading($button, false);

      response = error.responseJSON;

      if ("ok" in response && !response.ok) {
        console.error("An expected error occurred:", response.error);
        toastr.error(response.error, "Error");
      } else {
        console.error("An unexpected error occurred:", error);
        toastr.error("An unexpected error occurred", "Error");
      }
    },
  });
}

// Initialize the page
$(document).ready(function () {
  loadSuggestions();
});
