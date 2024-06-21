let html5QrCode = new Html5Qrcode("qr-reader");
let currentUuid = "";

function onScanSuccess(decodedText, decodedResult) {
  console.log(`Scan result: ${decodedText}`, decodedResult);
  html5QrCode.pause(); // Pause scanning
  currentUuid = decodedText;
  validateQRCode(decodedText);
}

function onScanFailure(error) {
  console.warn(`Scan error: ${error}`);
}

function validateQRCode(uuid) {
  $.ajax({
    url: "/api/admin/drinks/validate",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({ uuid: uuid }),
    success: function (data) {
      displayResult(data.status, data.user);
    },
  });
}

function displayResult(status, user) {
  const $modal = $("#qr-modal");
  const $messageElement = $("#modal-message");
  const $ownerUsername = $("#owner-username");
  const $ownerPfp = $("#owner-pfp");
  const $useVoucherBtn = $("#use-voucher");
  const $goBackBtn = $("#go-back");
  const $continueScanningBtn = $("#continue-scanning");

  $modal.attr("class", `modal ${status}`); // Set the class name to the status
  $messageElement.text(status.replace("-", " ").toUpperCase());

  if (status === "okay" || status === "already used") {
    $ownerUsername.text(user.username);
    $ownerPfp.attr(
      "src",
      user.pfp
        ? `/static/profiles/${user.pfp}`
        : `https://ui-avatars.com/api/?name=${user.username}`
    );
    if (status === "okay") {
      $useVoucherBtn.show();
      $goBackBtn.show();
      $continueScanningBtn.hide();
    } else {
      $useVoucherBtn.hide();
      $goBackBtn.hide();
      $continueScanningBtn.show();
    }
  } else {
    $ownerUsername.text("");
    $ownerPfp.attr("src", "");
    $useVoucherBtn.hide();
    $goBackBtn.hide();
    $continueScanningBtn.show();
  }

  $modal.css("display", "flex"); // Show the modal
}

function useVoucher() {
  $.ajax({
    url: `/api/admin/vouchers/status/${currentUuid}/use`,
    method: "PATCH",
    success: function (data) {
      if ("ok" in data && data.ok) {
        toastr.success("Voucher marked as used", "Success");
        $("#qr-modal").css("display", "none"); // Hide the modal
        html5QrCode.resume(); // Resume scanning
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
  });
}

function goBack() {
  continueScanning();
}

function continueScanning() {
  $("#qr-modal").css("display", "none"); // Hide the modal
  html5QrCode.resume(); // Resume scanning
}

function openEnlargedModal() {
  const $enlargedModal = $("#enlarged-modal");
  const $ownerPfp = $("#owner-pfp");
  const $enlargedPfp = $("#enlarged-pfp");

  $enlargedPfp.attr("src", $ownerPfp.attr("src"));
  $enlargedModal.css("display", "flex");
}

function closeEnlargedModal() {
  $("#enlarged-modal").css("display", "none");
}

html5QrCode.start(
  { facingMode: "environment" }, // camera config
  {
    fps: 10, // frames per second
    qrbox: { width: 250, height: 250 }, // scanning box size
  },
  onScanSuccess,
  onScanFailure
);
