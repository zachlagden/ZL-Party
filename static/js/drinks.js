function generateRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function fetchData() {
  $.ajax({
    url: "/api/whoami",
    method: "GET",
    success: function (data) {
      if (data.ok) {
        updatePage(data);
      } else {
        console.error("Error fetching data: ", data);
      }
    },
    error: function (error) {
      console.error("Error fetching data: ", error);
    },
  });
}

function updatePage(data) {
  let capsUsername =
    data.username.charAt(0).toUpperCase() + data.username.slice(1);
  $("#welcome-message").text(`Hello, ${capsUsername}! Redeem Your Drinks`);

  const vouchersContainer = $("#vouchers-container");
  vouchersContainer.empty();

  data.drinks.forEach((drink) => {
    let color1, color2;
    const storedColors = localStorage.getItem(`voucher-${drink.uuid}`);

    if (storedColors) {
      [color1, color2] = storedColors.split(",");
    } else {
      color1 = generateRandomColor();
      color2 = generateRandomColor();
      localStorage.setItem(`voucher-${drink.uuid}`, `${color1},${color2}`);
    }

    const drinkCard = `
        <div
          class="p-6 shadow-md rounded-md gradient cursor-pointer ${
            drink.used ? "opacity-50" : ""
          }"
          style="--color1: ${color1}; --color2: ${color2}"
          onclick="openModal(this, '${drink.uuid}', ${drink.used})"
          data-uuid="${drink.uuid}"
        >
          <h3 class="text-xl font-bold mb-4 text-white">Drink Voucher</h3>
          <img
            src="https://api.zachlagden.uk/images/qr?data=${
              drink.uuid
            }&filetype=PNG&size=8&error_correction=H"
            alt="QR Code"
            class="mb-4 w-full ${drink.used ? "hidden" : ""}"
          />
          <p class="text-white mb-2">Voucher ID: ${drink.uuid}</p>
          <p class="text-white text-sm">
            ${
              drink.used
                ? "This voucher has already been used."
                : "Scan this QR code at the bar to redeem your drink."
            }
          </p>
        </div>
      `;
    vouchersContainer.append(drinkCard);
  });

  $(".gradient").each(function () {
    const element = $(this);
    const color1 = element.css("--color1");
    const color2 = element.css("--color2");
    element.css("background", `linear-gradient(135deg, ${color1}, ${color2})`);
  });
}

function openModal(element, uuid, used) {
  const color1 = $(element).css("--color1");
  const color2 = $(element).css("--color2");

  const modalContent = $("#modalContent");
  modalContent.css("--color1", color1);
  modalContent.css("--color2", color2);
  modalContent.addClass("gradient");

  const voucherImage = $("#voucherImage");
  if (used) {
    voucherImage.addClass("hidden");
  } else {
    voucherImage.removeClass("hidden");
    voucherImage.attr(
      "src",
      `https://api.zachlagden.uk/images/qr?data=${uuid}&filetype=PNG&size=16&error_correction=H`
    );
  }
  $("#voucherId").text(`Voucher ID: ${uuid}`);
  $("#voucherStatus").text(
    used
      ? "This voucher has already been used."
      : "Scan this QR code at the bar to redeem your drink."
  );
  $("#voucherModal").removeClass("hidden");
}

function closeModal(event) {
  if (event) {
    event.stopPropagation();
  }
  $("#voucherModal").addClass("hidden");
  $("#modalContent").removeClass("gradient");
}

$(document).ready(function () {
  fetchData();
  setInterval(fetchData, 5000);
});
