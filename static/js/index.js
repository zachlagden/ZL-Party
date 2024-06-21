$.ajax({
  url: "/api/whoami",
  type: "GET",
  success: function (data) {
    let username =
      data.username.charAt(0).toUpperCase() + data.username.slice(1);

    $("#greetingMessage").text(`Hello, ${username}! Please suggest a song.`);

    if (data.admin) {
      $("#adminPanelLink").removeClass("hidden");
    }
  },
  error: function () {
    // This should technically never happen

    // If the status code is 401, reload the page to redirect to the login page
    if (error.status === 401) {
      window.location.reload();
    } else {
      console.error("An unexpected error occurred", error);
      toastr.error("An expected error occurred", "Error");
    }
  },
});

$("#suggestionForm").on("submit", function (event) {
  event.preventDefault(); // Prevent the default form submission

  // Serialize the form data
  var formData = $(this).serializeArray();

  if (!isValidSpotifyUrl(document.getElementById("spotifyLink").value)) {
    toastr.error(
      "Invalid Spotify link. Please enter a valid Spotify track URL.",
      "Error"
    );
    return;
  }

  // Convert form data to JSON
  var jsonData = {};
  $.each(formData, function () {
    jsonData[this.name] = this.value;
  });

  // Send the POST request with JSON data
  $.ajax({
    url: "/api/suggest",
    type: "POST",
    contentType: "application/json",
    data: JSON.stringify(jsonData),
    success: function (response) {
      if ("ok" in response && response.ok) {
        toastr.success(response.message, "Success");

        // Clear the input field and search modal
        document.getElementById("spotifyLink").value = "";
        document.getElementById("songSearchInput").value = "";
        document.getElementById("searchResults").innerHTML = "";
      }
    },
    error: function (error) {
      let response = error.responseJSON;

      if ("ok" in response && !response.ok) {
        toastr.error(response.error, "Error");
      } else {
        console.error("An unexpected error occurred", error);
        toastr.error("An expected error occurred", "Error");
      }
    },
  });
});

function isValidSpotifyUrl(url) {
  return url.includes("open.spotify.com/track/");
}

function displayMessage(message, type) {
  // Clear previous messages
  document.getElementById("messageContainer").innerHTML = "";

  var messageContainer = document.getElementById("messageContainer");
  var messageElement = document.createElement("div");
  messageElement.className =
    type === "error"
      ? "mb-4 text-red-500 text-sm"
      : "mb-4 text-green-500 text-sm";
  messageElement.innerText = message;
  messageContainer.appendChild(messageElement);
}

document
  .getElementById("searchSongButton")
  .addEventListener("click", function () {
    document.getElementById("songSearchModal").classList.remove("hidden");
  });

document
  .getElementById("closeSearchModal")
  .addEventListener("click", function () {
    document.getElementById("songSearchModal").classList.add("hidden");
  });

document
  .getElementById("searchSongSubmit")
  .addEventListener("click", function () {
    const query = document.getElementById("songSearchInput").value.trim();
    if (query.length >= 1) {
      $.ajax(`/api/search/${query}`, {
        success: function (data) {
          if ("ok" in data && data.ok) {
            displaySearchResults(data);
          } else {
            console.error("An error occurred while searching for songs:", data);
            toastr.error(
              "An error occurred while searching for songs. Please try again.",
              "Error"
            );
          }
        },
        error: function (error) {
          console.error("An error occurred while searching for songs:", error);
          toastr.error(
            "An error occurred while searching for songs. Please try again.",
            "Error"
          );
        },
      });
    } else {
      toastr.error(
        "Please enter a search query with at least 1 character.",
        "Error"
      );
    }
  });

function displaySearchResults(results) {
  const searchResultsContainer = document.getElementById("searchResults");
  searchResultsContainer.innerHTML = "";
  results.tracks.items.forEach((track) => {
    const trackElement = document.createElement("div");
    trackElement.classList.add(
      "flex",
      "items-center",
      "justify-between",
      "mb-4"
    );

    const trackInfo = document.createElement("div");
    trackInfo.classList.add("flex", "items-center");

    const albumArt = document.createElement("img");
    albumArt.src = track.album.images[0].url;
    albumArt.alt = track.name;
    albumArt.classList.add("w-12", "h-12", "mr-4", "rounded-md");

    const trackDetails = document.createElement("div");
    const trackName = document.createElement("p");
    trackName.classList.add("font-bold");
    trackName.innerText = track.name;
    const trackArtists = document.createElement("p");
    trackArtists.classList.add("text-sm", "text-gray-600");
    trackArtists.innerText = track.artists
      .map((artist) => artist.name)
      .join(", ");

    trackDetails.appendChild(trackName);
    trackDetails.appendChild(trackArtists);
    trackInfo.appendChild(albumArt);
    trackInfo.appendChild(trackDetails);

    const selectButton = document.createElement("button");
    selectButton.classList.add(
      "bg-green-500",
      "text-white",
      "font-semibold",
      "py-1",
      "px-3",
      "rounded-md",
      "hover:bg-green-600",
      "transition",
      "duration-300"
    );
    selectButton.innerText = "Select";
    selectButton.addEventListener("click", function () {
      document.getElementById("spotifyLink").value =
        track.external_urls.spotify;
      document.getElementById("songSearchModal").classList.add("hidden");
      document
        .getElementById("suggestionForm")
        .dispatchEvent(new Event("submit"));
    });

    trackElement.appendChild(trackInfo);
    trackElement.appendChild(selectButton);
    searchResultsContainer.appendChild(trackElement);
  });
}
