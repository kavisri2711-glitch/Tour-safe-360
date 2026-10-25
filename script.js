
const sosButton = document.getElementById("sosButton");
const modal = document.getElementById("confirmModal");
const closeModal = document.getElementById("closeModal");
const cancelModal = document.getElementById("cancelModal");
const consentCheck = document.getElementById("consentCheck");
const confirmSOS = document.getElementById("confirmSOS");
const solvedButton = document.getElementById("solvedButton");
const alertBanner = document.getElementById("alertBanner");
const toast = document.getElementById("toast");

let incidentActive = false;
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function openModal() {
  if (incidentActive) {
    showToast("An SOS incident is already active.");
    return;
  }

  consentCheck.checked = false;
  confirmSOS.disabled = true;
  modal.classList.remove("hidden");
}

function hideModal() {
  modal.classList.add("hidden");
}

function showBanner(message, success = false) {
  alertBanner.textContent = message;
  alertBanner.classList.toggle("success", success);
  alertBanner.classList.remove("hidden");
}

function updateRecipients(status, notified) {
  const recipients = [
    "policeState",
    "forestState",
    "contactState"
  ];

  recipients.forEach(id => {
    const element = document.getElementById(id);
    element.textContent = status;
    element.classList.toggle("notified", notified);
  });
}

// Open SOS confirmation popup
sosButton.addEventListener("click", openModal);

// Close popup
closeModal.addEventListener("click", hideModal);
cancelModal.addEventListener("click", hideModal);

// Close popup when clicking outside it
modal.addEventListener("click", function(event) {
  if (event.target === modal) {
    hideModal();
  }
});

// Enable confirmation only after consent
consentCheck.addEventListener("change", function() {
  confirmSOS.disabled = !consentCheck.checked;
});

// Activate SOS
confirmSOS.addEventListener("click", function() {
  if (!consentCheck.checked || incidentActive) {
    return;
  }

  incidentActive = true;
  hideModal();

  // Update safety status
  document.getElementById("statusTitle").textContent =
    "Emergency response in progress";

  const badge = document.getElementById("statusBadge");
  badge.textContent = "● SOS ACTIVE";
  badge.classList.remove("safe");
  badge.classList.add("danger");

  document.getElementById("tripStatus").textContent =
    "SOS Active";

  // Simulate notifying all three recipients
  updateRecipients("Alerted · Demo", true);

  showBanner(
    "SOS activated successfully in demo mode. " +
    "Kerala Police, Forest Department and your emergency " +
    "contact are marked as alerted. No real notifications were sent."
  );

  // Enable incident resolution
  solvedButton.disabled = false;

  sosButton.querySelector("strong").textContent =
    "SOS ALERT ACTIVE";

  sosButton.querySelector("small").textContent =
    "Resolve the incident after confirming safety";

  showToast("Demo SOS activated. Recipients marked as alerted.");
});

// Mark incident solved
solvedButton.addEventListener("click", function() {
  if (!incidentActive) {
    return;
  }

  const confirmed = window.confirm(
    "Has the tourist been confirmed safe and is the incident resolved?"
  );

  if (!confirmed) {
    return;
  }

  incidentActive = false;

  // Change status to safe
  document.getElementById("statusTitle").textContent =
    "Tourist confirmed safe";

  const badge = document.getElementById("statusBadge");
  badge.textContent = "● SAFE";
  badge.classList.remove("danger");
  badge.classList.add("safe");

  document.getElementById("tripStatus").textContent =
    "Safe · Resolved";

  // Update recipient statuses
  updateRecipients("Resolved · Demo", false);

  showBanner(
    "Incident marked as solved. The tourist is now shown as SAFE " +
    "on the dashboard. This status change is local to this demo.",
    true
  );

  // Reset SOS button
  solvedButton.disabled = true;

  sosButton.querySelector("strong").textContent =
    "ACTIVATE SOS ALERT";

  sosButton.querySelector("small").textContent =
    "Notify emergency contacts in this demo";

  showToast("Incident solved. Tourist status updated to SAFE.");
});

// Allow Escape key to close popup
document.addEventListener("keydown", function(event) {
  if (event.key === "Escape") {
    hideModal();
  }
});
