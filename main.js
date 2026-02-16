(function () {
  const ALLOWED_EMAIL = "wik4tzero@gmail.com";

  const gate = document.getElementById("gate");
  const main = document.getElementById("main");
  const form = document.getElementById("login-form");
  const loginPassword = document.getElementById("login-password");
  const loginBtn = document.getElementById("login-btn");
  const errorEl = document.getElementById("gate-error");
  const firebaseAuthApi = window.firebaseAuthApi;
  const firebaseDataApi = window.firebaseDataApi;
  let appInitialized = false;

  function unlock() {
    gate.classList.add("hidden");
    main.classList.remove("hidden");
    if (!appInitialized) {
      initIntroItinerary();
      initSlideshow();
      initRSVP();
      appInitialized = true;
    }
  }

  function showError(msg) {
    errorEl.textContent = msg;
  }

  function clearError() {
    errorEl.textContent = "";
  }

  function getSignInErrorMessage(error) {
    const code = error && error.code ? error.code : "";
    if (code === "auth/unauthorized-domain") {
      return "This domain is not authorized in Firebase Auth. Use http://localhost:5500 or add this domain in Firebase Console -> Authentication -> Settings -> Authorized domains.";
    }
    if (code === "auth/user-not-found" || code === "auth/invalid-email") {
      return "That account email is not valid for this site.";
    }
    if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
      return "Incorrect password. Please try again.";
    }
    if (code === "auth/too-many-requests") {
      return "Too many failed attempts. Please wait a moment and try again.";
    }
    if (code === "auth/network-request-failed") {
      return "Network error during sign-in. Check your internet connection and try again.";
    }
    if (code === "auth/operation-not-allowed") {
      return "Email/password sign-in is not enabled in Firebase. Enable it in Firebase Console -> Authentication -> Sign-in method.";
    }
    return "Sign-in failed. Please try again.";
  }

  function normalizeAuthHost() {
    if (window.location.protocol === "file:") {
      showError("Open this site through a local server (http://localhost:5500), not as a file.");
      return false;
    }

    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "::1") {
      const url = new URL(window.location.href);
      url.hostname = "localhost";
      window.location.replace(url.toString());
      return false;
    }

    return true;
  }

  function lock() {
    gate.classList.remove("hidden");
    main.classList.add("hidden");
  }

  if (!normalizeAuthHost()) {
    return;
  }

  if (!firebaseAuthApi || !firebaseAuthApi.auth) {
    showError("Firebase authentication is not available.");
    return;
  }

  firebaseAuthApi.onAuthStateChanged(firebaseAuthApi.auth, function (user) {
    clearError();
    if (!user || !user.email) {
      lock();
      return;
    }

    if (user.email.toLowerCase() === ALLOWED_EMAIL) {
      unlock();
      return;
    }

    lock();
    showError("Access restricted for " + user.email + ".");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearError();
    const email = ALLOWED_EMAIL;
    const password = (loginPassword && loginPassword.value) || "";
    if (!password) {
      showError("Please enter your password.");
      return;
    }

    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.textContent = "Signing in...";
    }

    firebaseAuthApi.signInWithEmailAndPassword(email, password).catch(function (error) {
      showError(getSignInErrorMessage(error));
    }).finally(function () {
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign in";
      }
    });
  });

  function initIntroItinerary() {
    const panelIntro = document.getElementById("panel-intro");
    const openBtn = document.getElementById("open-itinerary");
    const closeBtn = document.getElementById("close-itinerary");
    if (!panelIntro || !openBtn || !closeBtn) return;

    openBtn.addEventListener("click", function () {
      panelIntro.classList.add("is-itinerary-open");
    });

    closeBtn.addEventListener("click", function () {
      panelIntro.classList.remove("is-itinerary-open");
    });
  }

  // —— Photo slideshow ——
  function imageExists(src) {
    return new Promise(function (resolve) {
      const img = new Image();
      let done = false;
      const finish = function (value) {
        if (done) return;
        done = true;
        resolve(value);
      };
      img.onload = function () { finish(true); };
      img.onerror = function () { finish(false); };
      img.src = src;
    });
  }

  function initSlideshow() {
    const photoIds = [4, 11, 15, 19, 21, 27, 30, 33, 39, 43, 45, 46, 47, 51, 56, 85, 104];
    const bottomHalfOnlyIds = new Set([56, 104]);
    const cacheBust = Date.now();
    const photoEntries = photoIds.map(function (id) {
      return { id: id, src: "wedding_photos/" + id + ".jpg?v=" + cacheBust };
    });

    const slideImg = main.querySelector(".slider-slide");
    const currentEl = document.getElementById("slide-current");
    const totalEl = document.getElementById("slide-total");
    const btnPrev = main.querySelector(".slider-btn--prev");
    const btnNext = main.querySelector(".slider-btn--next");

    if (!slideImg || !totalEl) return;
    let availableEntries = photoEntries.slice();

    if (availableEntries.length === 0) {
      totalEl.textContent = "0";
      if (currentEl) currentEl.textContent = "0";
      if (btnPrev) btnPrev.disabled = true;
      if (btnNext) btnNext.disabled = true;
      return;
    }

    totalEl.textContent = availableEntries.length;
    let index = 0;
    let autoTimer = null;

    function goTo(i) {
      index = (i + availableEntries.length) % availableEntries.length;
      slideImg.src = availableEntries[index].src;
      slideImg.alt = "";
      slideImg.classList.toggle("slider-slide--bottom-half", bottomHalfOnlyIds.has(availableEntries[index].id));
      if (currentEl) currentEl.textContent = index + 1;
    }

    function next() {
      goTo(index + 1);
      resetAuto();
    }

    function prev() {
      goTo(index - 1);
      resetAuto();
    }

    function resetAuto() {
      clearInterval(autoTimer);
      autoTimer = setInterval(next, 4500);
    }

    if (btnPrev) btnPrev.addEventListener("click", prev);
    if (btnNext) btnNext.addEventListener("click", next);

    slideImg.onerror = function () {
      if (availableEntries.length <= 1) return;
      goTo(index + 1);
    };

    goTo(0);
    resetAuto();

    Promise.all(photoEntries.map(async function (entry) {
      const exists = await imageExists(entry.src);
      return exists ? entry : null;
    })).then(function (resolvedEntries) {
      const filtered = resolvedEntries.filter(function (entry) {
        return entry !== null;
      });
      if (filtered.length === 0) {
        availableEntries = [];
        totalEl.textContent = "0";
        if (currentEl) currentEl.textContent = "0";
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
        slideImg.removeAttribute("src");
        return;
      }
      const currentId = availableEntries[index] ? availableEntries[index].id : filtered[0].id;
      availableEntries = filtered;
      totalEl.textContent = availableEntries.length;
      const nextIndex = availableEntries.findIndex(function (entry) {
        return entry.id === currentId;
      });
      goTo(nextIndex >= 0 ? nextIndex : 0);
    });
  }

  // —— RSVP: Firestore-backed invite status updates ——
  function initRSVP() {
    const rsvpForm = document.getElementById("rsvp-form");
    const guestContainer = document.getElementById("guest-names");
    const loadInviteBtn = document.getElementById("load-invite");
    const messageEl = document.getElementById("rsvp-message");
    const submitBtn = document.getElementById("rsvp-submit");
    const codeInput = document.getElementById("rsvp-code");

    if (!rsvpForm || !guestContainer || !loadInviteBtn || !codeInput || !firebaseDataApi) return;

    let activeInviteCode = "";
    let activeGuests = [];

    function normalizeInviteCode(raw) {
      const digits = (raw || "").replace(/\D/g, "");
      if (digits.length === 6) return "00" + digits;
      return "";
    }

    function renderGuests() {
      guestContainer.innerHTML = "";

      if (activeGuests.length === 0) {
        const empty = document.createElement("p");
        empty.className = "guest-empty";
        empty.textContent = "Load your invite code to see guest names.";
        guestContainer.appendChild(empty);
        return;
      }

      activeGuests.forEach(function (guest, index) {
        const row = document.createElement("div");
        row.className = "guest-row";

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "guest-name-input";
        nameInput.placeholder = guest.isPlusOne ? "+1" : "Guest name";
        if (guest.isPlusOne) nameInput.title = "+1";
        nameInput.value = guest.name === "+1" ? "" : guest.name;
        row.appendChild(nameInput);

        const statusLabel = document.createElement("label");
        statusLabel.className = "guest-status-control";
        const statusInput = document.createElement("input");
        statusInput.type = "checkbox";
        statusInput.className = "guest-status-checkbox";
        statusLabel.appendChild(statusInput);

        statusInput.addEventListener("change", function () {
          if (statusInput.disabled) return;
          activeGuests[index].status = statusInput.checked;
          syncStatusControl();
        });

        function syncStatusControl() {
          const previousName = (activeGuests[index].name || "").trim();
          const typedName = (nameInput.value || "").trim();
          activeGuests[index].name = typedName;
          if (!typedName) {
            activeGuests[index].status = false;
          } else if (!previousName) {
            activeGuests[index].status = true;
          }
          statusInput.disabled = !typedName;
          statusInput.checked = Boolean(activeGuests[index].status);
          statusInput.setAttribute(
            "aria-label",
            typedName
              ? ("Confirm attendance for " + typedName)
              : "Enter guest name to enable confirmation"
          );
          statusLabel.className = "guest-status-control" + (typedName ? "" : " is-disabled");
        }

        nameInput.addEventListener("input", syncStatusControl);
        syncStatusControl();

        row.appendChild(statusLabel);
        guestContainer.appendChild(row);
      });
    }

    renderGuests();

    loadInviteBtn.addEventListener("click", function () {
      messageEl.textContent = "";
      messageEl.className = "rsvp-message";

      const normalizedCode = normalizeInviteCode(codeInput.value);
      if (!normalizedCode) {
        messageEl.textContent = "Please enter a valid 6-digit invite code.";
        messageEl.classList.add("error");
        activeInviteCode = "";
        activeGuests = [];
        renderGuests();
        return;
      }

      loadInviteBtn.disabled = true;
      loadInviteBtn.textContent = "Loading...";

      firebaseDataApi.getInviteByCode(normalizedCode).then(function (docSnap) {
        if (!docSnap.exists()) {
          throw new Error("NOT_FOUND");
        }

        const data = docSnap.data() || {};
        const guests = Array.isArray(data.guests) ? data.guests : [];
        activeGuests = guests.map(function (guest) {
          const guestName = (guest && guest.name ? String(guest.name) : "").trim();
          return {
            name: guestName,
            isPlusOne: guestName === "+1",
            status: Boolean(guest && guest.status)
          };
        });

        if (activeGuests.length === 0) {
          throw new Error("NO_GUESTS");
        }

        activeInviteCode = normalizedCode;
        renderGuests();
        messageEl.textContent = "Guest list loaded. Mark each guest and submit RSVP.";
        messageEl.classList.add("success");
      }).catch(function (error) {
        activeInviteCode = "";
        activeGuests = [];
        renderGuests();
        if (error && error.message === "NOT_FOUND") {
          messageEl.textContent = "Invite code not found. Please check and try again.";
        } else if (error && error.message === "NO_GUESTS") {
          messageEl.textContent = "No guests found for this invite code.";
        } else {
          messageEl.textContent = "Could not load your invite. Please try again.";
        }
        messageEl.classList.add("error");
      }).finally(function () {
        loadInviteBtn.disabled = false;
        loadInviteBtn.textContent = "Load guests";
      });
    });

    codeInput.addEventListener("input", function () {
      if (!activeInviteCode) return;
      const normalizedCode = normalizeInviteCode(codeInput.value);
      if (normalizedCode !== activeInviteCode) {
        activeInviteCode = "";
        activeGuests = [];
        renderGuests();
      }
    });

    rsvpForm.addEventListener("submit", function (e) {
      e.preventDefault();
      messageEl.textContent = "";
      messageEl.className = "rsvp-message";

      if (!activeInviteCode || activeGuests.length === 0) {
        messageEl.textContent = "Load your invite code before submitting RSVP.";
        messageEl.classList.add("error");
        return;
      }

      submitBtn.disabled = true;
      messageEl.textContent = "Saving...";

      const payloadGuests = activeGuests.map(function (guest) {
        const name = (guest.name || "").trim();
        return { name: name, status: name ? guest.status : false };
      });

      firebaseDataApi.updateInviteGuests(activeInviteCode, payloadGuests).then(function () {
        messageEl.textContent = "Thank you! Your RSVP has been updated.";
        messageEl.classList.add("success");
      }).catch(function () {
        messageEl.textContent = "Could not save RSVP. Please try again.";
        messageEl.classList.add("error");
      }).then(function () {
        submitBtn.disabled = false;
      });
    });
  }
})();
