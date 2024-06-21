// Helper function to toggle loading state on a button
function toggleLoading($button, isLoading) {
  if (isLoading) {
    $button.data("originalText", $button.html());
    $button
      .html('<i class="fas fa-spinner fa-spin"></i>')
      .prop("disabled", true);
  } else {
    $button.html($button.data("originalText")).prop("disabled", false);
  }
}
