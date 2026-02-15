import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAnalytics, isSupported as analyticsSupported } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB8Fhb9SFCgZo4G-bPcA1l_irVjbJKaEXk",
  authDomain: "wedding-e9aa6.firebaseapp.com",
  projectId: "wedding-e9aa6",
  storageBucket: "wedding-e9aa6.firebasestorage.app",
  messagingSenderId: "379522455029",
  appId: "1:379522455029:web:0e7c268df481a470237cbc",
  measurementId: "G-HLE22EYPQD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const DATABASE_ID = "wedding";
const API_KEY = firebaseConfig.apiKey;
const PROJECT_ID = firebaseConfig.projectId;

setPersistence(auth, browserLocalPersistence).catch(function () {
  // If persistence cannot be set (e.g. restricted browser mode), continue gracefully.
});

// Analytics may be unavailable in some local/private environments.
analyticsSupported()
  .then(function (supported) {
    if (supported) {
      getAnalytics(app);
    }
  })
  .catch(function () {
    // Ignore analytics init failures to avoid blocking site usage.
  });

window.firebaseApp = app;
window.firebaseAuthApi = {
  auth: auth,
  onAuthStateChanged: onAuthStateChanged,
  signInWithEmailAndPassword: function (email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  },
  signOut: function () {
    return signOut(auth);
  }
};

function fromFirestoreValue(value) {
  if (value == null || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) {
    const arr = value.arrayValue && Array.isArray(value.arrayValue.values) ? value.arrayValue.values : [];
    return arr.map(fromFirestoreValue);
  }
  if ("mapValue" in value) {
    const fields = value.mapValue && value.mapValue.fields ? value.mapValue.fields : {};
    const out = {};
    Object.keys(fields).forEach(function (key) {
      out[key] = fromFirestoreValue(fields[key]);
    });
    return out;
  }
  return null;
}

function toFirestoreValue(value) {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(toFirestoreValue)
      }
    };
  }
  if (typeof value === "object") {
    const fields = {};
    Object.keys(value).forEach(function (key) {
      fields[key] = toFirestoreValue(value[key]);
    });
    return {
      mapValue: { fields: fields }
    };
  }
  return { nullValue: null };
}

function decodeDocument(docPayload) {
  const fields = docPayload && docPayload.fields ? docPayload.fields : {};
  const data = {};
  Object.keys(fields).forEach(function (key) {
    data[key] = fromFirestoreValue(fields[key]);
  });
  return data;
}

function inviteDocUrl(code) {
  return "https://firestore.googleapis.com/v1/projects/"
    + encodeURIComponent(PROJECT_ID)
    + "/databases/"
    + encodeURIComponent(DATABASE_ID)
    + "/documents/invites/"
    + encodeURIComponent(code)
    + "?key="
    + encodeURIComponent(API_KEY);
}

async function authedRequest(url, method, bodyObj) {
  if (!auth.currentUser) {
    throw new Error("AUTH_REQUIRED");
  }
  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch(url, {
    method: method,
    headers: {
      "Authorization": "Bearer " + idToken,
      "Content-Type": "application/json"
    },
    body: bodyObj ? JSON.stringify(bodyObj) : undefined
  });
  return res;
}

window.firebaseDataApi = {
  getInviteByCode: async function (code) {
    const res = await authedRequest(inviteDocUrl(code), "GET");
    if (res.status === 404) {
      return {
        exists: function () { return false; },
        data: function () { return {}; }
      };
    }
    if (!res.ok) {
      throw new Error("READ_FAILED_" + res.status);
    }
    const payload = await res.json();
    const data = decodeDocument(payload);
    return {
      exists: function () { return true; },
      data: function () { return data; }
    };
  },
  updateInviteGuests: async function (code, guests) {
    const body = {
      fields: {
        guests: toFirestoreValue(guests)
      }
    };
    const url = inviteDocUrl(code) + "&updateMask.fieldPaths=guests";
    const res = await authedRequest(url, "PATCH", body);
    if (!res.ok) {
      throw new Error("WRITE_FAILED_" + res.status);
    }
  }
};
